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
    $rows = [];

    // Source A: Purchase bills (vendor invoices, categorized under 'Purchase') ---
    $billStmt = $pdo->prepare("
        SELECT
            t.id,
            t.ref_number,
            t.vendor_bill_no,
            t.date,
            c.name AS party_name,
            c.pan AS party_pan,
            'Purchase' AS category,
            SUM(CASE WHEN ti.vat_rate = 0 THEN ti.taxable_amount ELSE 0 END) AS exempt_amount,
            SUM(CASE WHEN ti.vat_rate > 0 THEN ti.taxable_amount ELSE 0 END) AS taxable_amount,
            t.vat_amount,
            t.total_amount,
            COALESCE(alloc.allocated, 0) AS allocated
        FROM transactions t
        JOIN contacts c ON c.id = t.contact_id
        JOIN transaction_items ti ON ti.transaction_id = t.id
        LEFT JOIN (
            SELECT settled_transaction_id, SUM(allocated_amount) AS allocated
            FROM transaction_allocations
            GROUP BY settled_transaction_id
        ) alloc ON alloc.settled_transaction_id = t.id
        WHERE t.type = 'PURCHASE' AND t.status = 'APPROVED' AND t.date BETWEEN ? AND ?
        GROUP BY t.id, t.ref_number, t.vendor_bill_no, t.date, c.name, c.pan, t.vat_amount, t.total_amount, alloc.allocated
    ");
    $billStmt->execute([$dateFrom, $dateTo]);

    foreach ($billStmt->fetchAll() as $row) {
        $total = (float)$row['total_amount'];
        $allocated = (float)$row['allocated'];
        $rows[] = [
            'date' => $row['date'],
            'ref_number' => $row['vendor_bill_no'] ?: $row['ref_number'],
            'party_name' => $row['party_name'],
            'party_pan' => $row['party_pan'] ?? '—',
            'category' => $row['category'],
            'exempt_amount' => (float)$row['exempt_amount'],
            'taxable_amount' => (float)$row['taxable_amount'],
            'vat_amount' => (float)$row['vat_amount'],
            'total_amount' => $total,
            'paid_status' => $allocated >= $total - 0.01 ? 'PAID' : ($allocated > 0 ? 'PARTIAL' : 'UNPAID'),
        ];
    }

    // --- Source B: Direct expense withdrawals (no vendor bill; category = whichever expense account was hit) ---
    $withStmt = $pdo->prepare("
        SELECT
            t.id,
            t.ref_number,
            t.date,
            t.notes,
            a.name AS category,
            t.total_amount
        FROM transactions t
        JOIN accounts a ON a.id = t.contra_account_id
        JOIN account_groups ag ON ag.id = a.account_group_id
        WHERE t.type = 'BANK_WITH' AND t.status = 'APPROVED' AND ag.type = 'Expense'
              AND a.name != 'TDS Expense'
              AND t.date BETWEEN ? AND ?
    ");
    $withStmt->execute([$dateFrom, $dateTo]);

    foreach ($withStmt->fetchAll() as $row) {
        $total = (float)$row['total_amount'];
        $rows[] = [
            'date' => $row['date'],
            'ref_number' => $row['ref_number'],
            'party_name' => $row['notes'] ?: $row['ref_number'],
            'party_pan' => '—',
            'category' => $row['category'],
            // Direct withdrawals have no line-item VAT split; treated as non-VAT expense
            'exempt_amount' => $total,
            'taxable_amount' => 0,
            'vat_amount' => 0,
            'total_amount' => $total,
            'paid_status' => 'PAID',
        ];
    }

    // Sort combined rows by date, then assign serials + totals
    usort($rows, fn($a, $b) => strcmp($a['date'], $b['date']) ?: strcmp($a['ref_number'], $b['ref_number']));

    $totalExempt = 0;
    $totalTaxable = 0;
    $totalVat = 0;
    $totalAmount = 0;
    $data = [];

    foreach ($rows as $index => $row) {
        $totalExempt += $row['exempt_amount'];
        $totalTaxable += $row['taxable_amount'];
        $totalVat += $row['vat_amount'];
        $totalAmount += $row['total_amount'];

        $data[] = array_merge(['sn' => $index + 1], $row);
    }

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Expense book fetched successfully.",
        "data" => $data,
        "meta" => [
            "date_from" => $dateFrom,
            "date_to" => $dateTo,
            "fiscal_year" => $fiscalYear,
            "total_entries" => count($data),
            "total_exempt" => $totalExempt,
            "total_taxable" => $totalTaxable,
            "total_vat" => $totalVat,
            "total_amount" => $totalAmount,
        ],
    ]);

} catch (PDOException $e) {
    error_log("Expense book error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to generate expense book."
    ]);
}