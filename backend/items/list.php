<?php

require_once '../server.php';
require_once '../db.php';
require_once '../includes/auth.php';

requireRole(['admin', 'accountant', 'user']);

// Only accept GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Method not allowed"
    ]);
    exit();
}

// Filters
$taxType = $_GET['tax_type'] ?? null;
$type = $_GET['type'] ?? null;
$vendorId = isset($_GET['vendor_id']) && $_GET['vendor_id'] !== '' ? (int) $_GET['vendor_id'] : null;

$validTaxType = ['VAT13', 'Exempt'];
$validType = ['SELLING', 'PURCHASE'];

try {
    $sql = "
        SELECT
            i.id,
            i.name,
            i.type,
            i.vendor_id,
            v.name AS vendor_name,
            i.account_id,
            a.name AS account_name,
            a.code AS account_code,
            i.unit,
            i.hsn_sac_code,
            i.selling_price,
            i.purchase_rate,
            i.tax_type,
            i.created_at,
            i.updated_at
        FROM items i
        LEFT JOIN contacts v ON v.id = i.vendor_id
        LEFT JOIN accounts a ON a.id = i.account_id
        WHERE i.is_active = TRUE
    ";
    $params = [];

    if ($taxType && in_array($taxType, $validTaxType, true)) {
        $sql .= " AND i.tax_type = ?";
        $params[] = $taxType;
    }

    if ($type && in_array($type, $validType, true)) {
        $sql .= " AND i.type = ?";
        $params[] = $type;
    }

    if ($vendorId) {
        $sql .= " AND i.vendor_id = ?";
        $params[] = $vendorId;
    }

    $sql .= " ORDER BY i.name";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $items = $stmt->fetchAll();

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Items fetched successfully.",
        "data" => $items
    ]);

} catch (PDOException $e) {
    error_log("Get all items error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to fetch items."
    ]);
}
