<?php

require_once '../server.php';
require_once '../db.php';
require_once '../includes/auth.php';

requireRole(['admin', 'accountant']);

// Only accept POST
if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
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

$id = isset($data['id']) ? (int) $data['id'] : 0;
$name = trim($data['name'] ?? '');
$unit = trim($data['unit'] ?? '');
$hsnSacCode = trim($data['hsn_sac_code'] ?? '');
$sellingPrice = $data['selling_price'] ?? 0;
$purchaseRate = $data['purchase_rate'] ?? 0;
$taxType = $data['tax_type'] ?? 'VAT13';

$validTaxTypes = ['VAT13', 'Exempt'];

// Validation
$errors = [];

if ($id <= 0) $errors[] = 'A valid item ID is required';
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
    // Check item exists
    $existing = $pdo->prepare("
        SELECT id, name
        FROM items
        WHERE id = ? AND is_active = TRUE
    ");
    $existing->execute([$id]);
    $item = $existing->fetch();

    if (!$item) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Item not found."
        ]);
        exit();
    }

    // Duplicate name check
    if (strtolower($name) !== strtolower($item['name'])) {
        $dupCheck = $pdo->prepare("
            SELECT id
            FROM items
            WHERE LOWER(name) = LOWER(?) AND id != ? AND is_active = TRUE
        ");
        $dupCheck->execute([$name, $id]);
        if ($dupCheck->fetch()) {
            http_response_code(409);
            echo json_encode([
                "success" => false,
                "message" => "An item with this name already exists."
            ]);
            exit();
        }
    }

    $stmt = $pdo->prepare("
        UPDATE items
        SET
            name = ?,
            unit = ?,
            hsn_sac_code = ?,
            selling_price = ?,
            purchase_rate = ?,
            tax_type = ?
        WHERE id = ?
    ");
    $stmt->execute([
        $name,
        $unit,
        $hsnSacCode,
        (float)$sellingPrice,
        (float)$purchaseRate,
        $taxType,
        $id
    ]);

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Item updated successfully.",
    ]);

} catch (PDOException $e) {
    error_log("Update item error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to update item."
    ]);
}
