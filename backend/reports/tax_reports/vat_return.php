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
    // Output VAT — from approved sales invoices
    $outputStmt = $pdo->prepare("
        SELECT
            COALESCE(SUM(t.sub_total), 0) AS total_taxable_sales,
            COALESCE(SUM(t.vat_amount), 0) AS output_vat,
            -- Vatable vs exempt breakdown
            COALESCE(SUM(
                CASE WHEN ti.vat_rate > 0 THEN ti.taxable_amount ELSE 0 END
            ), 0) AS vatable_sales,
            COALESCE(SUM(
                CASE WHEN ti.vat_rate = 0 THEN ti.taxable_amount ELSE 0 END
            ), 0) AS exempt_sales
        FROM transactions t
        JOIN transaction_items ti ON ti.transaction_id = t.id
        WHERE t.type = 'SALES' AND t.status = 'APPROVED' AND t.date BETWEEN ? AND ?
    ");
    $outputStmt->execute([$dateFrom, $dateTo]);
    $output = $outputStmt->fetch();

    // Input VAT — from approved purchase bills
    $inputStmt = $pdo->prepare("
        SELECT
            COALESCE(SUM(t.sub_total),  0) AS total_taxable_purchases,
            COALESCE(SUM(t.vat_amount), 0) AS input_vat,
            COALESCE(SUM(
                CASE WHEN ti.vat_rate > 0 THEN ti.taxable_amount ELSE 0 END
            ), 0) AS vatable_purchases,
            COALESCE(SUM(
                CASE WHEN ti.vat_rate = 0 THEN ti.taxable_amount ELSE 0 END
            ), 0) AS exempt_purchases
        FROM transactions t
        JOIN transaction_items ti ON ti.transaction_id = t.id
        WHERE t.type = 'PURCHASE' AND t.status = 'APPROVED' AND t.date BETWEEN ? AND ?
    ");
    $inputStmt->execute([$dateFrom, $dateTo]);
    $input = $inputStmt->fetch();

    $outputVat = (float)$output['output_vat'];
    $inputVat = (float)$input['input_vat'];
    $netVat = $outputVat - $inputVat; // positive = payable to IRD, negative = refundable

    // VAT ledger balance verification
    $vatPayableStmt = $pdo->prepare("
        SELECT
            COALESCE(SUM(le.credit), 0) - COALESCE(SUM(le.debit), 0) AS vat_payable_balance
        FROM ledger_entries le
        JOIN accounts a ON a.id  = le.account_id
        JOIN transactions t ON t.id  = le.transaction_id
        WHERE a.name = 'VAT Payable' AND t.status = 'APPROVED' AND le.date BETWEEN ? AND ?
    ");
    $vatPayableStmt->execute([$dateFrom, $dateTo]);
    $vatPayableBalance = (float)$vatPayableStmt->fetch()['vat_payable_balance'];

    $vatReceivableStmt = $pdo->prepare("
        SELECT
            COALESCE(SUM(le.debit), 0) - COALESCE(SUM(le.credit), 0) AS vat_receivable_balance
        FROM ledger_entries le
        JOIN accounts a ON a.id  = le.account_id
        JOIN transactions t ON t.id  = le.transaction_id
        WHERE a.name = 'VAT Receivable' AND t.status = 'APPROVED' AND le.date BETWEEN ? AND ?
    ");
    $vatReceivableStmt->execute([$dateFrom, $dateTo]);
    $vatReceivableBalance = (float)$vatReceivableStmt->fetch()['vat_receivable_balance'];

    $netFromLedger = $vatPayableBalance - $vatReceivableBalance;
    $matchesCalculation = round($netVat, 2) === round($netFromLedger, 2);

    $rows = [
        ['section' => 'Output (Sales)', 'label' => 'Vatable Sales', 'amount' => (float)$output['vatable_sales'], 'is_subtotal' => false],
        ['section' => 'Output (Sales)', 'label' => 'Exempt Sales', 'amount' => (float)$output['exempt_sales'], 'is_subtotal' => false],
        ['section' => 'Output (Sales)', 'label' => 'Output VAT', 'amount' => $outputVat, 'is_subtotal' => true],

        ['section' => 'Input (Purchases)', 'label' => 'Vatable Purchases', 'amount' => (float)$input['vatable_purchases'], 'is_subtotal' => false],
        ['section' => 'Input (Purchases)', 'label' => 'Exempt Purchases', 'amount' => (float)$input['exempt_purchases'], 'is_subtotal' => false],
        ['section' => 'Input (Purchases)', 'label' => 'Input VAT', 'amount' => $inputVat, 'is_subtotal' => true],

        ['section' => 'Net Position', 'label' => $netVat >= 0 ? 'Net VAT Payable to IRD' : 'Net VAT Refundable', 'amount' => abs($netVat), 'is_subtotal' => true],
    ];

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "VAT return fetched successfully.",
        "data" => $rows,
        "meta" => [
            "date_from" => $dateFrom,
            "date_to" => $dateTo,
            "fiscal_year" => $fiscalYear,
            "net_vat" => $netVat,
            "is_payable" => $netVat > 0,
            "is_refundable" => $netVat < 0,
            "vat_payable_balance" => $vatPayableBalance,
            "vat_receivable_balance" => $vatReceivableBalance,
            "matches_calculation" => $matchesCalculation,
        ],
    ]);

} catch (PDOException $e) {
    error_log("VAT return error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to generate VAT return."
    ]);
}
