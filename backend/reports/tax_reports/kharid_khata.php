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
$fiscalYear = $_GET['fiscal_year'] ?? null;

if (!$dateFrom || !$dateTo) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "date_from and date_to are required."
    ]);
    exit();
}

try {
    $stmt = $pdo->prepare("
        SELECT
            t.id,
            t.ref_number AS bill_number,
            t.date AS bill_date,
            c.name AS vendor_name,
            c.pan AS vendor_pan,
            t.sub_total AS taxable_amount,
            t.vat_amount AS vat_amount,
            t.total_amount AS total_amount,
            SUM(CASE WHEN ti.vat_rate > 0 THEN ti.taxable_amount ELSE 0 END) AS vatable_purchase,
            SUM(CASE WHEN ti.vat_rate = 0 THEN ti.taxable_amount ELSE 0 END) AS exempt_purchase,
            COUNT(DISTINCT it.unit) AS unit_count,
            MIN(it.unit) AS single_unit,
            COALESCE(tds.tds_total, 0) AS tds_amount
        FROM transactions t
        JOIN contacts c ON c.id  = t.contact_id
        JOIN transaction_items ti ON ti.transaction_id = t.id
        JOIN items it ON it.id = ti.item_id
        LEFT JOIN (
            SELECT ta.settled_transaction_id AS bill_id, SUM(te.tds_amount) AS tds_total
            FROM transaction_allocations ta
            JOIN tds_entries te ON te.transaction_id = ta.settling_transaction_id AND te.tds_type = 'PAYABLE'
            GROUP BY ta.settled_transaction_id
        ) tds ON tds.bill_id = t.id
        WHERE t.type = 'PURCHASE' AND t.status = 'APPROVED' AND t.date BETWEEN ? AND ?
        GROUP BY t.id, t.ref_number, t.date, c.name, c.pan, t.sub_total, t.vat_amount, t.total_amount, tds.tds_total
        ORDER BY t.date ASC, t.id ASC
    ");
    $stmt->execute([$dateFrom, $dateTo]);
    $rows = $stmt->fetchAll();

    $totalVatable = 0;
    $totalExempt = 0;
    $totalVat = 0;
    $totalAmount = 0;
    $totalTds = 0;
    $data = [];

    foreach ($rows as $index => $row) {
        $vatable = (float)$row['vatable_purchase'];
        $exempt = (float)$row['exempt_purchase'];
        $vat = (float)$row['vat_amount'];
        $total = (float)$row['total_amount'];
        $tds = (float)$row['tds_amount'];

        $totalVatable += $vatable;
        $totalExempt += $exempt;
        $totalVat += $vat;
        $totalAmount += $total;
        $totalTds += $tds;

        $data[] = [
            'sn' => $index + 1,
            'bill_number' => $row['bill_number'],
            'bill_date' => $row['bill_date'],
            'vendor_name' => $row['vendor_name'],
            'vendor_pan' => $row['vendor_pan'] ?? '—',
            'unit' => (int)$row['unit_count'] > 1 ? 'Mixed' : ($row['single_unit'] ?? '—'),
            'vatable_purchase' => $vatable,
            'exempt_purchase' => $exempt,
            'vat_amount' => $vat,
            'total_amount' => $total,
            'tds_deducted' => $tds > 0 ? 'Yes' : 'No',
            'tds_amount' => $tds,
        ];
    }

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Purchase account (खरिद खाता) fetched successfully.",
        "data" => $data,
        "meta" => [
            "date_from" => $dateFrom,
            "date_to" => $dateTo,
            "fiscal_year" => $fiscalYear,
            "total_bills" => count($data),
            "total_vatable" => $totalVatable,
            "total_exempt" => $totalExempt,
            "total_vat" => $totalVat,
            "total_amount" => $totalAmount,
            "total_tds" => $totalTds,
        ],
    ]);

} catch (PDOException $e) {
    error_log("Kharid khata error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to generate खरिद खाता."
    ]);
}