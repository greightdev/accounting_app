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
    // 1. Sales side — Taxable Sales (1.1) and Exempt Sales (1.2)
    $outputStmt = $pdo->prepare("
        SELECT
            COALESCE(SUM(
                CASE WHEN ti.vat_rate > 0 THEN ti.taxable_amount ELSE 0 END
            ), 0) AS taxable_sales_amount,
            COALESCE(SUM(t.vat_amount), 0) AS taxable_sales_vat,
            COALESCE(SUM(
                CASE WHEN ti.vat_rate = 0 THEN ti.taxable_amount ELSE 0 END
            ), 0) AS exempt_sales_amount
        FROM transactions t
        JOIN transaction_items ti ON ti.transaction_id = t.id
        WHERE t.type = 'SALES' AND t.status = 'APPROVED' AND t.date BETWEEN ? AND ?
    ");
    $outputStmt->execute([$dateFrom, $dateTo]);
    $sales = $outputStmt->fetch();

    // 2. Purchase side — Taxable Purchase (2.1) and Exempt Purchase (2.2)
    $inputStmt = $pdo->prepare("
        SELECT
            COALESCE(SUM(
                CASE WHEN ti.vat_rate > 0 THEN ti.taxable_amount ELSE 0 END
            ), 0) AS taxable_purchase_amount,
            COALESCE(SUM(t.vat_amount), 0) AS taxable_purchase_vat,
            COALESCE(SUM(
                CASE WHEN ti.vat_rate = 0 THEN ti.taxable_amount ELSE 0 END
            ), 0) AS exempt_purchase_amount
        FROM transactions t
        JOIN transaction_items ti ON ti.transaction_id = t.id
        WHERE t.type = 'PURCHASE' AND t.status = 'APPROVED' AND t.date BETWEEN ? AND ?
    ");
    $inputStmt->execute([$dateFrom, $dateTo]);
    $purchases = $inputStmt->fetch();

    $taxableSalesAmount = (float)$sales['taxable_sales_amount'];
    $taxableSalesVat = (float)$sales['taxable_sales_vat'];
    $exemptSalesAmount = (float)$sales['exempt_sales_amount'];

    $taxablePurchaseAmount = (float)$purchases['taxable_purchase_amount'];
    $taxablePurchaseVat = (float)$purchases['taxable_purchase_vat'];
    $exemptPurchaseAmount = (float)$purchases['exempt_purchase_amount'];

    // 3. जम्मा (Total)
    $totalCredit = $taxablePurchaseVat;
    $totalDebit = $taxableSalesVat;

    // 4. डेविट-क्रेडिट (+/-) — net position for the period (positive = payable, negative = credit)
    $netPosition = $totalDebit - $totalCredit;

    $rows = [
        ['is_section_header' => true, 'label' => '1. बिक्री'],
        ['label' => '1.1 कर लाग्ने बिक्री', 'amount' => $taxableSalesAmount, 'credit' => null, 'debit' => $taxableSalesVat],
        ['label' => '1.2 छुट बिक्री', 'amount' => $exemptSalesAmount, 'credit' => null, 'debit' => null],

        ['is_section_header' => true, 'label' => '2. खरिद'],
        ['label' => '2.1 कर लाग्ने खरिद', 'amount' => $taxablePurchaseAmount, 'credit' => $taxablePurchaseVat, 'debit' => null],
        ['label' => '2.2 छुट खरिद', 'amount' => $exemptPurchaseAmount, 'credit' => null, 'debit' => null],

        ['is_section_header' => true, 'label' => '3. जम्मा'],
        ['label' => 'जम्मा', 'amount' => null, 'credit' => $totalCredit, 'debit' => $totalDebit, 'is_total' => true],

        ['is_section_header' => true, 'label' => '4. नतिजा'],
        ['label' => 'डेविट-क्रेडिट (+/-)', 'amount' => null, 'credit' => null, 'debit' => $netPosition, 'is_total' => true],
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
            "total_credit" => $totalCredit,
            "total_debit" => $totalDebit,
            "net_position" => $netPosition,
            "status" => $netPosition > 0 ? "PAYABLE" : ($netPosition < 0 ? "CREDIT_CARRIED_FORWARD" : "SETTLED"),
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