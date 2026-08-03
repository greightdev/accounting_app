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

if (!$dateFrom || !$dateTo) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "date_from and date_to are required."
    ]);
    exit();
}

try {
    // Net balance movement for a named account in the period
    $getAccountMovement = function(string $accountName) use ($pdo, $dateFrom, $dateTo): float {
        $stmt = $pdo->prepare("
            SELECT COALESCE(SUM(le.debit), 0) - COALESCE(SUM(le.credit), 0) AS net
            FROM ledger_entries le
            JOIN accounts a ON a.id = le.account_id
            JOIN transactions t ON t.id = le.transaction_id
            WHERE a.name = ? AND t.status = 'APPROVED' AND le.date BETWEEN ? AND ?
        ");
        $stmt->execute([$accountName, $dateFrom, $dateTo]);
        return (float)$stmt->fetch()['net'];
    };

    // Net profit for the period
    $incomeStmt = $pdo->prepare("
        SELECT
            ag.type,
            COALESCE(SUM(le.debit), 0) AS total_debit,
            COALESCE(SUM(le.credit), 0) AS total_credit
        FROM ledger_entries le
        JOIN accounts a ON a.id  = le.account_id
        JOIN account_groups ag ON ag.id = a.account_group_id
        JOIN transactions t ON t.id = le.transaction_id
        WHERE ag.type IN ('Income', 'Expense') AND t.status = 'APPROVED' AND le.date BETWEEN ? AND ?
        GROUP BY ag.type
    ");
    $incomeStmt->execute([$dateFrom, $dateTo]);
    $plRows = $incomeStmt->fetchAll();

    $totalIncome = 0;
    $totalExpense = 0;
    foreach ($plRows as $pl) {
        if ($pl['type'] === 'Income') $totalIncome = (float)$pl['total_credit'] - (float)$pl['total_debit'];
        if ($pl['type'] === 'Expense') $totalExpense = (float)$pl['total_debit'] - (float)$pl['total_credit'];
    }
    $netProfit = $totalIncome - $totalExpense;

    // Working capital changes (increase in asset = cash outflow, increase in liability = cash inflow)
    $changeReceivable = $getAccountMovement('Customer Receivable');
    $changePayable = $getAccountMovement('Vendor Payable');
    $changeVatRec = $getAccountMovement('VAT Receivable');
    $changeVatPay = $getAccountMovement('VAT Payable');
    $changeTdsPay = $getAccountMovement('TDS Payable');
    $changeTdsRec = $getAccountMovement('TDS Receivable');

    $operatingCashFlow = $netProfit
        - $changeReceivable
        + (-$changePayable)
        - $changeVatRec
        - $changeTdsRec
        + (-$changeVatPay)
        + (-$changeTdsPay);

    $operatingItems = [
        ["label" => "Net Profit for the period", "amount" => $netProfit],
        ["label" => "Increase in Customer Receivable", "amount" => -$changeReceivable],
        ["label" => "Increase in Vendor Payable", "amount" => -$changePayable],
        ["label" => "Increase in VAT Receivable", "amount" => -$changeVatRec],
        ["label" => "Increase in TDS Receivable", "amount" => -$changeTdsRec],
        ["label" => "Increase in VAT Payable", "amount" => -$changeVatPay],
        ["label" => "Increase in TDS Payable", "amount" => -$changeTdsPay],
    ];

    // Purchases of fixed assets, proceeds from asset sales
    $investingStmt = $pdo->prepare("
        SELECT COALESCE(SUM(le.debit), 0) - COALESCE(SUM(le.credit), 0) AS net
        FROM ledger_entries le
        JOIN accounts a ON a.id   = le.account_id
        JOIN account_groups ag ON ag.id  = a.account_group_id
        JOIN transactions t ON t.id = le.transaction_id
        WHERE ag.name LIKE '%Fixed%' AND t.status = 'APPROVED' AND le.date BETWEEN ? AND ?
    ");
    $investingStmt->execute([$dateFrom, $dateTo]);
    $investingNet = -(float)$investingStmt->fetch()['net']; // purchase = outflow
    $investingItems = [
        ["label" => "Purchase of Fixed Assets", "amount" => $investingNet],
    ];
    $investingCashFlow = $investingNet;

    // Capital introduced, loans taken/repaid
    $changeCapital = $getAccountMovement('Capital/Equity'); // Cr = inflow (negate)
    $financingCashFlow = -$changeCapital; // credit movement = cash inflow
    $financingItems = [
        ["label" => "Capital Introduced / Withdrawn", "amount" => -$changeCapital],
    ];

    // Net change in cash
    $netCashChange = $operatingCashFlow + $investingCashFlow + $financingCashFlow;

    // Opening and closing cash + bank balances
    $cashBankStmt = $pdo->prepare("
        SELECT
            COALESCE(SUM(le.debit), 0) - COALESCE(SUM(le.credit), 0) AS net
        FROM ledger_entries le
        JOIN accounts a ON a.id = le.account_id
        JOIN transactions t ON t.id = le.transaction_id
        WHERE (a.name = 'Cash' OR a.id IN (SELECT account_id FROM bank_accounts WHERE is_active = 1))
            AND t.status = 'APPROVED' AND le.date < ?
    ");
    $cashBankStmt->execute([$dateFrom]);
    $openingCash = (float)$cashBankStmt->fetch()['net'];
    $closingCash = $openingCash + $netCashChange;

    $rows = array_merge(
        array_map(fn($item) => [
            'section' => 'Operating', 'label' => $item['label'], 'amount' => $item['amount'], 'is_subtotal' => false,
        ], $operatingItems),
        [['section' => 'Operating', 'label' => 'Net Cash from Operating Activities', 'amount' => $operatingCashFlow, 'is_subtotal' => true]],

        array_map(fn($item) => [
            'section' => 'Investing', 'label' => $item['label'], 'amount' => $item['amount'], 'is_subtotal' => false,
        ], $investingItems),
        [['section' => 'Investing', 'label' => 'Net Cash from Investing Activities', 'amount' => $investingCashFlow, 'is_subtotal' => true]],

        array_map(fn($item) => [
            'section' => 'Financing', 'label' => $item['label'], 'amount' => $item['amount'], 'is_subtotal' => false,
        ], $financingItems),
        [['section' => 'Financing', 'label' => 'Net Cash from Financing Activities', 'amount' => $financingCashFlow, 'is_subtotal' => true]],

        [['section' => 'Summary', 'label' => 'Net Change in Cash', 'amount' => $netCashChange, 'is_subtotal' => true]]
    );

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Cash flow statement fetched successfully.",
        "data" => $rows,
        "meta" => [
            "date_from" => $dateFrom,
            "date_to" => $dateTo,
            "opening_cash" => $openingCash,
            "closing_cash" => $closingCash,
            "net_cash_change" => $netCashChange,
        ],
    ]);

} catch (PDOException $e) {
    error_log("Cash flow error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to generate cash flow statement."
    ]);
}