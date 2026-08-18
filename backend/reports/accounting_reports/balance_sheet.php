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

$asOf = $_GET['as_of'] ?? date('Y-m-d'); // default to today

try {
    // Fetch all Asset, Liability, Equity accounts with balances up to $asOf
    $stmt = $pdo->prepare("
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
        LEFT JOIN (
            SELECT le.account_id, le.debit, le.credit
            FROM ledger_entries le
            JOIN transactions t ON t.id = le.transaction_id
            WHERE t.status = 'APPROVED' AND le.date <= ?
        ) le ON le.account_id = a.id
        WHERE a.is_active = TRUE AND ag.type IN ('Asset', 'Liability', 'Equity')
        GROUP BY a.id, a.name, a.code, ag.type, ag.name
        ORDER BY ag.type, a.code
    ");
    $stmt->execute([$asOf]);
    $rows = $stmt->fetchAll();

    $plStmt = $pdo->prepare("
        SELECT
            ag.type,
            COALESCE(SUM(le.debit), 0) AS total_debit,
            COALESCE(SUM(le.credit), 0) AS total_credit
        FROM accounts a
        JOIN account_groups ag ON ag.id = a.account_group_id
        LEFT JOIN (
            SELECT le.account_id, le.debit, le.credit
            FROM ledger_entries le
            JOIN transactions t ON t.id = le.transaction_id
            WHERE t.status = 'APPROVED' AND le.date <= ?
        ) le ON le.account_id = a.id
        WHERE a.is_active = TRUE AND ag.type IN ('Income', 'Expense')
        GROUP BY ag.type
    ");
    $plStmt->execute([$asOf]);
    $plRows = $plStmt->fetchAll();

    $totalIncome = 0;
    $totalExpense = 0;
    foreach ($plRows as $pl) {
        if ($pl['type'] === 'Income') $totalIncome = (float)$pl['total_credit'] - (float)$pl['total_debit'];
        if ($pl['type'] === 'Expense') $totalExpense = (float)$pl['total_debit'] - (float)$pl['total_credit'];
    }
    $retainedEarnings = $totalIncome - $totalExpense;

    $assetRows = [];
    $liabilityRows = [];
    $equityRows = [];
    $totalAssets = 0;
    $totalLiabilities = 0;
    $totalEquity = 0;

    foreach ($rows as $row) {
        $debit = (float)$row['total_debit'];
        $credit = (float)$row['total_credit'];
        $amount = ($row['group_type'] === 'Asset') ? ($debit - $credit) : ($credit - $debit);

        $entry = [
            'account_code' => $row['account_code'],
            'account_name' => $row['account_name'],
            'group_name' => $row['group_name'],
            'section' => $row['group_type'],
            'amount' => $amount,
            'is_subtotal' => false,
        ];

        switch ($row['group_type']) {
            case 'Asset':
                $totalAssets += $amount;
                $assetRows[] = $entry;
                break;
            case 'Liability':
                $totalLiabilities += $amount;
                $liabilityRows[] = $entry;
                break;
            case 'Equity':
                $totalEquity += $amount;
                $equityRows[] = $entry;
                break;
        }
    }

    $totalEquity += $retainedEarnings;
    $equityRows[] = [
        'account_code' => '', 'account_name' => 'Retained Earnings (Current Period)',
        'group_name' => 'Equity Accounts', 'section' => 'Equity',
        'amount' => $retainedEarnings, 'is_subtotal' => false,
    ];

    $totalLiabilitiesAndEquity = $totalLiabilities + $totalEquity;

    $flatRows = array_merge(
        $assetRows,
        [['account_code' => '', 'account_name' => 'Total Assets', 'group_name' => '', 'section' => 'Asset', 'amount' => $totalAssets, 'is_subtotal' => true]],
        $liabilityRows,
        [['account_code' => '', 'account_name' => 'Total Liabilities', 'group_name' => '', 'section' => 'Liability', 'amount' => $totalLiabilities, 'is_subtotal' => true]],
        $equityRows,
        [['account_code' => '', 'account_name' => 'Total Equity', 'group_name' => '', 'section' => 'Equity', 'amount' => $totalEquity, 'is_subtotal' => true]]
    );

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Balance sheet fetched successfully.",
        "data" => $flatRows,
        "meta" => [
            "as_of" => $asOf,
            "total_assets" => $totalAssets,
            "total_liabilities_and_equity" => $totalLiabilitiesAndEquity,
            "is_balanced" => abs($totalAssets - $totalLiabilitiesAndEquity) < 0.01,
        ],
    ]);

} catch (PDOException $e) {
    error_log("Balance sheet error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to generate balance sheet."
    ]);
}