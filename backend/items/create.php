<?php

require_once '../server.php';
require_once '../db.php';
require_once '../includes/auth.php';
require_once '../includes/audit.php';

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
$type = $data['type'] ?? 'SELLING';
$vendorId = isset($data['vendor_id']) && $data['vendor_id'] !== '' && $data['vendor_id'] !== null
    ? (int) $data['vendor_id']
    : null;
$accountId = isset($data['account_id']) && $data['account_id'] !== '' && $data['account_id'] !== null
    ? (int) $data['account_id']
    : null;

$validTaxTypes = ['VAT13', 'Exempt'];
$validTypes = ['SELLING', 'PURCHASE'];

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
if (!in_array($type, $validTypes, true)) $errors[] = "Item type must be Selling or Purchase.";
if (!is_numeric($sellingPrice)) $errors[] = "Selling price must be a valid number.";
if (!is_numeric($purchaseRate)) $errors[] = "Purchase rate must be a valid number.";
if (is_numeric($sellingPrice) && (float)$sellingPrice < 0) $errors[] = "Selling price cannot be negative.";
if (is_numeric($purchaseRate) && (float)$purchaseRate < 0) $errors[] = "Purchase rate cannot be negative.";

if ($type === 'SELLING' && is_numeric($sellingPrice) && (float)$sellingPrice <= 0) {
    $errors[] = "Selling price must be greater than zero for a selling item.";
}
if ($type === 'PURCHASE') {
    if (is_numeric($purchaseRate) && (float)$purchaseRate <= 0) {
        $errors[] = "Purchase rate must be greater than zero for a purchase item.";
    }
    if (!$vendorId) {
        $errors[] = "A vendor is required for a purchase item.";
    }
}
if (!$accountId) {
    $errors[] = "An account is required.";
}

if ($errors) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => implode(' ', $errors)
    ]);
    exit();
}

try {
    // Purchase items must belong to an active vendor contact
    if ($type === 'PURCHASE') {
        $vendorStmt = $pdo->prepare("
            SELECT id
            FROM contacts
            WHERE id = ? AND type = 'Vendor' AND is_active = TRUE
        ");
        $vendorStmt->execute([$vendorId]);
        if (!$vendorStmt->fetch()) {
            http_response_code(422);
            echo json_encode([
                "success" => false,
                "message" => "Selected vendor not found."
            ]);
            exit();
        }
    } else {
        $vendorId = null;
    }

    // Account must exist and be active
    $accountStmt = $pdo->prepare("
        SELECT a.id, ag.type AS group_type
        FROM accounts a
        JOIN account_groups ag ON ag.id = a.account_group_id
        WHERE a.id = ? AND a.is_active = TRUE
    ");
    $accountStmt->execute([$accountId]);
    $account = $accountStmt->fetch();
    if (!$account) {
        http_response_code(422);
        echo json_encode([
            "success" => false,
            "message" => "Selected account not found."
        ]);
        exit();
    }
    if ($type === 'SELLING' && $account['group_type'] !== 'Income') {
        http_response_code(422);
        echo json_encode([
            "success" => false,
            "message" => "A selling item must be linked to an Income account."
        ]);
        exit();
    }
    if ($type === 'PURCHASE' && !in_array($account['group_type'], ['Expense', 'Asset'], true)) {
        http_response_code(422);
        echo json_encode([
            "success" => false,
            "message" => "A purchase item must be linked to an Expense or Asset account."
        ]);
        exit();
    }

    // Duplicate name check, scoped to type
    $dupCheck = $pdo->prepare("
        SELECT id
        FROM items
        WHERE LOWER(name) = LOWER(?) AND type = ? AND is_active = TRUE AND vendor_id <=> ?
    ");
    $dupCheck->execute([$name, $type, $vendorId]);
    if ($dupCheck->fetch()) {
        http_response_code(409);
        echo json_encode([
            "success" => false,
            "message" => $type === 'PURCHASE'
                ? "This vendor already has a purchase item with this name."
                : "A selling item with this name already exists."
        ]);
        exit();
    }

    $stmt = $pdo->prepare("
        INSERT INTO items (
            name,
            type,
            vendor_id,
            account_id,
            unit,
            hsn_sac_code,
            selling_price,
            purchase_rate,
            tax_type
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
    ");

    $stmt->execute([
        $name,
        $type,
        $vendorId,
        $accountId,
        $unit,
        $hsnSacCode,
        (float)$sellingPrice,
        (float)$purchaseRate,
        $taxType
    ]);
    $newId = (int) $pdo->lastInsertId();

    logAudit(
        $pdo,
        (int) $_SESSION['user_id'],
        'CREATE',
        'items',
        $newId,
        null,
        ['name' => $name, 'type' => $type, 'vendor_id' => $vendorId, 'account_id' => $accountId, 'unit' => $unit, 'hsn_sac_code' => $hsnSacCode, 'selling_price' => (float)$sellingPrice, 'purchase_rate' => (float)$purchaseRate, 'tax_type' => $taxType]
    );

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
