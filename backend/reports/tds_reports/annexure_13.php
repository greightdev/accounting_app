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

// Fiscal year is required for Annexure 13
$fiscalYear = $_GET['fiscal_year'] ?? null;

if (!$fiscalYear) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "fiscal_year is required (e.g. 2081-82)."
    ]);
    exit();
}

try {
    // Annexure 13 format — vendor-wise TDS deducted by us (PAYABLE type)
    // Nepal IRD requires: SN, Vendor Name, PAN, Amount Paid, TDS Rate, TDS Amount
    $stmt = $pdo->prepare("
        SELECT
            c.name AS vendor_name,
            c.pan AS vendor_pan,
            SUM(t.total_amount) AS total_paid,
            SUM(te.tds_amount / 0.015) AS total_taxable,
            SUM(te.tds_amount) AS total_tds,
            1.5 AS effective_tds_rate
        FROM tds_entries te
        JOIN contacts c ON c.id = te.contact_id
        JOIN transactions t ON t.id  = te.transaction_id
        WHERE te.tds_type = 'PAYABLE'
            AND te.fiscal_year = ?
            AND t.status = 'APPROVED'
        GROUP BY c.id, c.name, c.pan
        ORDER BY c.name
    ");
    $stmt->execute([$fiscalYear]);
    $vendors = $stmt->fetchAll();

    // TDS the company bore itself — customer did not deduct, so we owe this to the government
    $expStmt = $pdo->prepare("
        SELECT
            c.name AS customer_name,
            c.pan AS customer_pan,
            SUM(t.total_amount) AS total_invoiced,
            SUM(te.tds_amount / 0.015) AS total_taxable,
            SUM(te.tds_amount) AS total_tds_borne,
            1.5 AS effective_tds_rate
        FROM tds_entries te
        JOIN contacts c ON c.id = te.contact_id
        JOIN transactions t ON t.id = te.transaction_id
        WHERE te.tds_type = 'EXPENSE' AND te.fiscal_year = ? AND t.status = 'APPROVED'
        GROUP BY c.id, c.name, c.pan
        ORDER BY c.name
    ");
    $expStmt->execute([$fiscalYear]);
    $expenseParties = $expStmt->fetchAll();

    // Also include TDS Receivable (customers who deducted from us)
    $recStmt = $pdo->prepare("
        SELECT
            c.name AS customer_name,
            c.pan AS customer_pan,
            SUM(t.total_amount) AS total_invoiced,
            SUM(te.tds_amount / 0.015) AS total_taxable,
            SUM(te.tds_amount) AS total_tds_deducted,
            1.5 AS effective_tds_rate
        FROM tds_entries te
        JOIN contacts c ON c.id = te.contact_id
        JOIN transactions t ON t.id = te.transaction_id
        WHERE te.tds_type = 'RECEIVABLE' AND te.fiscal_year = ? AND t.status = 'APPROVED'
        GROUP BY c.id, c.name, c.pan
        ORDER BY c.name
    ");
    $recStmt->execute([$fiscalYear]);
    $customers = $recStmt->fetchAll();

    $rows = [];
    $sn = 1;

    foreach ($vendors as $v) {
        $rows[] = [
            'sn' => $sn++,
            'party_name' => $v['vendor_name'],
            'pan' => $v['vendor_pan'] ?? '-',
            'party_type' => 'Vendor',
            'tds_direction' => 'Deducted by us (Payable)',
            'total_amount' => (float)$v['total_paid'],
            'total_taxable' => (float)$v['total_taxable'],
            'total_tds' => (float)$v['total_tds'],
            'effective_tds_rate' => (float)$v['effective_tds_rate'],
        ];
    }

    foreach ($expenseParties as $e) {
        $rows[] = [
            'sn' => $sn++,
            'party_name' => $e['customer_name'],
            'pan' => $e['customer_pan'] ?? '-',
            'party_type' => 'Customer',
            'tds_direction' => 'Borne by us (Expense)',
            'total_amount' => (float)$e['total_invoiced'],
            'total_taxable' => (float)$e['total_taxable'],
            'total_tds' => (float)$e['total_tds_borne'],
            'effective_tds_rate' => (float)$e['effective_tds_rate'],
        ];
    }

    foreach ($customers as $c) {
        $rows[] = [
            'sn' => $sn++,
            'party_name' => $c['customer_name'],
            'pan' => $c['customer_pan'] ?? '-',
            'party_type' => 'Customer',
            'tds_direction' => 'Deducted by them (Receivable)',
            'total_amount' => (float)$c['total_invoiced'],
            'total_taxable' => (float)$c['total_taxable'],
            'total_tds' => (float)$c['total_tds_deducted'],
            'effective_tds_rate' => (float)$c['effective_tds_rate'],
        ];
    }

    $totalTdsPayable = array_sum(array_column($vendors, 'total_tds'));
    $totalTdsExpense = array_sum(array_column($expenseParties, 'total_tds_borne'));
    $totalTdsReceivable = array_sum(array_column($customers, 'total_tds_deducted'));

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Annexure 13 fetched successfully.",
        "data" => $rows,
        "meta" => [
            "fiscal_year" => $fiscalYear,
            "total_tds_payable" => $totalTdsPayable,
            "total_tds_expense" => $totalTdsExpense,
            "total_tds_receivable" => $totalTdsReceivable,
            "net_tds_liability" => $totalTdsPayable + $totalTdsExpense,
        ],
    ]);

} catch (PDOException $e) {
    error_log("Annexure 13 error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to generate Annexure 13."
    ]);
}
