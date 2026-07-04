<?php

require_once '../server.php';
require_once '../db.php';
require_once '../includes/auth.php';

requireRole(['admin', 'accountant']);

// Only accept POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Method not allowed"
    ]);
    exit();
}

// Parse JSON body
$data = json_decode(file_get_contents('php://input'), true);

if (!$data) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "No input received."
    ]);
    exit();
}

$name = trim($data['name'] ?? '');
$unit = trim($data['unit'] ?? '');
$hsnSacCode = trim($data['hsn_sac_code'] ?? '');
$sellingPrice = $data['selling_price'] ?? 0;
$purchaseRate = $data['purchase_rate'] ?? 0;
$taxType = $data['tax_type'] ?? 'VAT13';

$validTaxTypes = ['VAT13', 'Exempt'];

// Validation
$errors = [];

if ($name === '') $errors[] = "Item name is required.";
if ($unit === '') $errors[] = "Item unit is required.";
if ($hsnSacCode === '') $errors[] = "HSN/SAC code is required.";
if (!in_array($taxType, $validTaxTypes, true)) $errors[] = "Tax type must be VAT13 or Exempt.";
if ((float)$sellingPrice < 0) $errors[] = "Selling price cannot be negative.";
if ((float)$purchaseRate < 0) $errors[] = "Purchase rate cannot be negative.";

if ($errors) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => implode(' ', $errors)
    ]);
    exit();
}

try {
    // Duplicate name check
    $dupCheck = $pdo->prepare("
        SELECT id
        FROM items
        WHERE LOWER(name) = LOWER(?) AND is_active = TRUE
    ");
    $dupCheck->execute([$name]);
    if ($dupCheck->fetch()) {
        http_response_code(409);
        echo json_encode([
            "success" => false,
            "message" => "An item with this name already exists."
        ]);
        exit();
    }

    $stmt = $pdo->prepare("
        INSERT INTO items (
            name,
            unit,
            hsn_sac_code,
            selling_price,
            purchase_rate,
            tax_type
        ) VALUES (
            ?, ?, ?, ?, ?, ?
        )
    ");

    $stmt->execute([
        $name,
        $unit,
        $hsnSacCode,
        (float)$sellingPrice,
        (float)$purchaseRate,
        $taxType
    ]);
    $newId = (int) $pdo->lastInsertId();

    http_response_code(201);
    echo json_encode([
        "success" => true,
        "message" => "Item created successfully.",
        "data" => ["id" => $newId]
    ]);

} catch (PDOException $e) {
    error_log("Create item error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to create item."
    ]);
}
