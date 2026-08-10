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

if ($name === '') {
    $errors[] = "Item name is required.";
} elseif (strlen($name) > 150) {
    $errors[] = "Item name must be 150 characters or fewer.";
} elseif (!preg_match("/^[A-Za-z0-9\s.,'&()\/-]+$/", $name)) {
    $errors[] = "Item name can only contain letters, numbers, spaces, and . , ' & ( ) / -";
}

if ($unit === '') {
    $errors[] = "Item unit is required.";
} elseif (strlen($unit) > 30) {
    $errors[] = "Unit must be 30 characters or fewer.";
} elseif (!preg_match("/^[A-Za-z\s.\/-]+$/", $unit)) {
    $errors[] = "Unit can only contain letters, spaces, and . / -";
}

if ($hsnSacCode === '') {
    $errors[] = "HSN/SAC code is required.";
} elseif (!preg_match('/^\d{2,20}$/', $hsnSacCode)) {
    $errors[] = "HSN/SAC code must be 2 to 20 digits, numbers only.";
}

if (!in_array($taxType, $validTaxTypes, true)) $errors[] = "Tax type must be VAT13 or Exempt.";
if (!is_numeric($sellingPrice)) $errors[] = "Selling price must be a valid number.";
if (!is_numeric($purchaseRate)) $errors[] = "Purchase rate must be a valid number.";
if (is_numeric($sellingPrice) && (float)$sellingPrice < 0) $errors[] = "Selling price cannot be negative.";
if (is_numeric($purchaseRate) && (float)$purchaseRate < 0) $errors[] = "Purchase rate cannot be negative.";

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
