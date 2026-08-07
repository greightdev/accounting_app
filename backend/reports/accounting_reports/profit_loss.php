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

try {
    // Fetch all Income and Expense accounts with their net balances
    $subSql = "
        SELECT le.account_id, le.debit, le.credit
        FROM ledger_entries le
        JOIN transactions t ON t.id = le.transaction_id
        WHERE t.status = 'APPROVED'
    ";
    $params = [];

    if ($dateFrom) { $subSql .= " AND le.date >= ?"; $params[] = $dateFrom; }
    if ($dateTo) { $subSql .= " AND le.date <= ?"; $params[] = $dateTo; }

    $sql = "
        SELECT
            a.id,
            a.name AS account_name,
            a.code AS account_code,
            ag.type AS group_type,
            ag.name AS group_name,
            COALESCE(SUM(le.debit), 0) AS total_debit,
            COALESCE(SUM(le.credit), 0) AS total_credit
        FROM accounts a
        JOIN account_groups ag ON ag.id = a.account_group_id
        LEFT JOIN ($subSql) le ON le.account_id = a.id
        WHERE a.is_active = TRUE AND ag.type IN ('Income', 'Expense')
        GROUP BY a.id, a.name, a.code, ag.type, ag.name
        ORDER BY ag.type DESC, a.code
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $accountRows = $stmt->fetchAll();

    $rows = [];
    $totalIncome = 0;
    $totalExpense = 0;
    $incomeRows = [];
    $expenseRows = [];

    foreach ($accountRows as $row) {
        $debit = (float)$row['total_debit'];
        $credit = (float)$row['total_credit'];

        if ($row['group_type'] === 'Income') {
            $net = $credit - $debit;
            $totalIncome += $net;
            $incomeRows[] = [
                'account_code' => $row['account_code'],
                'account_name' => $row['account_name'],
                'group_name' => $row['group_name'],
                'section' => 'Income',
                'amount' => $net,
                'is_subtotal' => false,
            ];
        } else {
            $net = $debit - $credit;
            $totalExpense += $net;
            $expenseRows[] = [
                'account_code' => $row['account_code'],
                'account_name' => $row['account_name'],
                'group_name' => $row['group_name'],
                'section' => 'Expense',
                'amount' => $net,
                'is_subtotal' => false,
            ];
        }
    }

    $rows = array_merge(
        $incomeRows,
        [[
            'account_code' => '', 'account_name' => 'Total Income', 'group_name' => '',
            'section' => 'Income', 'amount' => $totalIncome, 'is_subtotal' => true,
        ]],
        $expenseRows,
        [[
            'account_code' => '', 'account_name' => 'Total Expenses', 'group_name' => '',
            'section' => 'Expense', 'amount' => $totalExpense, 'is_subtotal' => true,
        ]]
    );

    $netProfit = $totalIncome - $totalExpense;

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Profit & Loss statement fetched successfully.",
        "data" => $rows,
        "meta" => [
            "date_from" => $dateFrom,
            "date_to" => $dateTo,
            "total_income" => $totalIncome,
            "total_expense" => $totalExpense,
            "net_profit" => $netProfit,
            "is_profit" => $netProfit >= 0,
        ],
    ]);

} catch (PDOException $e) {
    error_log("Profit & Loss error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to generate Profit & Loss statement."
    ]);
}