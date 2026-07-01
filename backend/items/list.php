<?php

require_once '../server.php';
require_once '../db.php';
require_once '../includes/auth.php';

requireRole(['admin', 'accountant']);

// Only accept GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Method not allowed"
    ]);
    exit();
}

// Filter: ?tax_type=VAT13 / Exempt
$taxType = $_GET['tax_type'] ?? null;
$validTaxType = ['VAT13', 'Exempt'];
 
try {
    $sql = "
        SELECT
            id,
            name,
            unit,
            hsn_sac_code,
            selling_price,
            purchase_rate,
            tax_type,
            created_at,
            updated_at
        FROM items
        WHERE is_active = TRUE
    ";
    $params = [];

    if ($taxType && in_array($taxType, $validTaxType, true)) {
        $sql .= " AND tax_type = ?";
        $params[] = $taxType;
    }

    $sql .= " ORDER BY name";

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
