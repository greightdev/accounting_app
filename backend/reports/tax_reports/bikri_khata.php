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
            SUM(CASE WHEN ti.vat_rate = 0 THEN ti.taxable_amount ELSE 0 END) AS exempt_sales
        FROM transactions t
        JOIN contacts c ON c.id  = t.contact_id
        JOIN transaction_items ti ON ti.transaction_id = t.id
        WHERE t.type = 'SALES' AND t.status = 'APPROVED' AND t.date BETWEEN ? AND ?
        GROUP BY t.id, t.ref_number, t.date, c.name, c.pan, t.sub_total, t.vat_amount, t.total_amount
        ORDER BY t.date ASC, t.id ASC
    ");
    $stmt->execute([$dateFrom, $dateTo]);
    $rows = $stmt->fetchAll();

    $totalVatable = 0;
    $totalExempt = 0;
    $totalVat = 0;
    $totalAmount = 0;
    $data = [];

    foreach ($rows as $index => $row) {
        $vatable = (float)$row['vatable_sales'];
        $exempt = (float)$row['exempt_sales'];
        $vat = (float)$row['vat_amount'];
        $total = (float)$row['total_amount'];

        $totalVatable += $vatable;
        $totalExempt += $exempt;
        $totalVat += $vat;
        $totalAmount += $total;

        $data[] = [
            'sn' => $index + 1,
            'invoice_number' => $row['invoice_number'],
            'bill_date' => $row['bill_date'],
            'customer_name' => $row['customer_name'],
            'customer_pan' => $row['customer_pan'] ?? '—',
            'vatable_sales' => $vatable,
            'exempt_sales' => $exempt,
            'vat_amount' => $vat,
            'total_amount' => $total,
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
