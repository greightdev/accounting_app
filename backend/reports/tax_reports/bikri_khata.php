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
    // Each invoice as one row — Nepal IRD sales book format
    $stmt = $pdo->prepare("
        SELECT
            t.id,
            t.ref_number AS invoice_number,
            t.date AS bill_date,
            c.name AS customer_name,
            c.pan AS customer_pan,
            t.sub_total AS taxable_amount,
            t.vat_amount AS vat_amount,
            t.total_amount AS total_amount,
            -- Vatable vs exempt breakdown from line items
            SUM(CASE WHEN ti.vat_rate > 0 THEN ti.taxable_amount ELSE 0 END) AS vatable_sales,
            SUM(CASE WHEN ti.vat_rate = 0 THEN ti.taxable_amount ELSE 0 END) AS exempt_sales,
            COUNT(DISTINCT it.unit) AS unit_count,
            MIN(it.unit) AS single_unit,
            COALESCE(alloc.allocated, 0) AS received_amount,
            COALESCE(tds.tds_total, 0) AS tds_amount
        FROM transactions t
        JOIN contacts c ON c.id  = t.contact_id
        JOIN transaction_items ti ON ti.transaction_id = t.id
        JOIN items it ON it.id = ti.item_id
        LEFT JOIN (
            SELECT settled_transaction_id, SUM(allocated_amount) AS allocated
            FROM transaction_allocations
            GROUP BY settled_transaction_id
        ) alloc ON alloc.settled_transaction_id = t.id
        LEFT JOIN (
            SELECT ta.settled_transaction_id AS invoice_id, SUM(te.tds_amount) AS tds_total
            FROM transaction_allocations ta
            JOIN tds_entries te ON te.transaction_id = ta.settling_transaction_id AND te.tds_type = 'RECEIVABLE'
            GROUP BY ta.settled_transaction_id
        ) tds ON tds.invoice_id = t.id
        WHERE t.type = 'SALES' AND t.status = 'APPROVED' AND t.date BETWEEN ? AND ?
        GROUP BY t.id, t.ref_number, t.date, c.name, c.pan, t.sub_total, t.vat_amount, t.total_amount, alloc.allocated, tds.tds_total
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
        $vatable = (float)$row['vatable_sales'];
        $exempt = (float)$row['exempt_sales'];
        $vat = (float)$row['vat_amount'];
        $total = (float)$row['total_amount'];
        $received = (float)$row['received_amount'];
        $tds = (float)$row['tds_amount'];

        $totalVatable += $vatable;
        $totalExempt += $exempt;
        $totalVat += $vat;
        $totalAmount += $total;
        $totalTds += $tds;

        if ($received >= $total - 0.01) {
            $paidStatus = 'PAID';
        } elseif ($received > 0) {
            $paidStatus = 'PARTIAL';
        } else {
            $paidStatus = 'UNPAID';
        }

        $data[] = [
            'sn' => $index + 1,
            'invoice_number' => $row['invoice_number'],
            'bill_date' => $row['bill_date'],
            'customer_name' => $row['customer_name'],
            'customer_pan' => $row['customer_pan'] ?? '—',
            'unit' => (int)$row['unit_count'] > 1 ? 'Mixed' : ($row['single_unit'] ?? '—'),
            'vatable_sales' => $vatable,
            'exempt_sales' => $exempt,
            'vat_amount' => $vat,
            'total_amount' => $total,
            'tds_amount' => $tds,
            'paid_status' => $paidStatus,
        ];
    }

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Sales account (बिक्री खाता) fetched successfully.",
        "data" => $data,
        "meta" => [
            "date_from" => $dateFrom,
            "date_to" => $dateTo,
            "fiscal_year" => $fiscalYear,
            "total_invoices" => count($data),
            "total_vatable" => $totalVatable,
            "total_exempt" => $totalExempt,
            "total_vat" => $totalVat,
            "total_amount" => $totalAmount,
            "total_tds" => $totalTds,
        ],
    ]);

} catch (PDOException $e) {
    error_log("Bikri khata error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to generate bikri khata."
    ]);
}