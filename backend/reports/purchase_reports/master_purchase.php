<?php

require_once '../../server.php';
require_once '../../db.php';
require_once '../../includes/auth.php';

requireRole(['admin', 'accountant', 'user']);

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Method not allowed"
    ]);
    exit();
}

$dateFrom = $_GET['date_from'] ?? null;
$dateTo = $_GET['date_to'] ?? null;
$contactId = $_GET['contact_id'] ?? null;

try {
    $sql = "
        SELECT
            ti.id,
            t.date,
            t.ref_number,
            COALESCE(NULLIF(t.vendor_bill_no, ''), t.ref_number) AS display_ref_number,
            i.name AS item_name,
            ti.rate,
            ti.quantity,
            (ti.rate * ti.quantity) AS purchase_amount,
            ti.taxable_amount,
            ti.vat_amount AS tax,
            ti.total_amount AS bill_amount
        FROM transaction_items ti
        JOIN transactions t ON t.id = ti.transaction_id
        JOIN items i ON i.id = ti.item_id
        WHERE t.type = 'PURCHASE' AND t.status = 'APPROVED'
    ";
    $params = [];

    if ($dateFrom) { $sql .= " AND t.date >= ?"; $params[] = $dateFrom; }
    if ($dateTo) { $sql .= " AND t.date <= ?"; $params[] = $dateTo; }
    if ($contactId) { $sql .= " AND t.contact_id = ?"; $params[] = $contactId; }

    $sql .= " ORDER BY t.date ASC, t.id ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $totalPurchase = 0;
    $totalTaxable = 0;
    $totalTax = 0;
    $totalBill = 0;

    foreach ($rows as $row) {
        $totalPurchase += (float)$row['purchase_amount'];
        $totalTaxable += (float)$row['taxable_amount'];
        $totalTax += (float)$row['tax'];
        $totalBill += (float)$row['bill_amount'];
    }

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Master purchase report fetched successfully.",
        "data" => $rows,
        "meta" => [
            "date_from" => $dateFrom,
            "date_to" => $dateTo,
            "total_purchase" => $totalPurchase,
            "total_taxable" => $totalTaxable,
            "total_tax" => $totalTax,
            "total_bill" => $totalBill,
        ],
    ]);
} catch (PDOException $e) {
    error_log("Master purchase report error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to generate master purchase report."
    ]);
}