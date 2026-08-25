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

$accountId = $_GET['account_id'] ?? null;
$dateFrom = $_GET['date_from'] ?? null;
$dateTo = $_GET['date_to'] ?? null;

if (!$accountId) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "account_id is required."
    ]);
    exit();
}

try {
    // Fetch account details
    $accStmt = $pdo->prepare("
        SELECT
            a.id,
            a.name,
            a.code,
            ag.name AS group_name,
            ag.type AS group_type
        FROM accounts a
        JOIN account_groups ag ON ag.id = a.account_group_id
        WHERE a.id = ? AND a.is_active = TRUE
    ");
    $accStmt->execute([$accountId]);
    $account = $accStmt->fetch();

    if (!$account) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Account not found."
        ]);
        exit();
    }

    // Build ledger entries query
    $sql = "
        SELECT
            le.id,
            le.debit,
            le.credit,
            le.narration,
            le.date,
            t.id AS transaction_id,
            t.ref_number,
            t.vendor_bill_no,
            t.type AS transaction_type,
            t.status
        FROM ledger_entries le
        JOIN transactions t ON t.id = le.transaction_id
        WHERE le.account_id = ? AND t.status = 'APPROVED'
    ";
    $params = [$accountId];

    if ($dateFrom) {
        $sql .= " AND le.date >= ?";
        $params[] = $dateFrom;
    }
    if ($dateTo) {
        $sql .= " AND le.date <= ?";
        $params[] = $dateTo;
    }

    $sql .= " ORDER BY le.date ASC, le.id ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $entries = $stmt->fetchAll();

    // Calculate running balance per row
    $rows = [];
    $runningBalance = 0;
    $totalDebit = 0;
    $totalCredit = 0;

    foreach ($entries as $entry) {
        $debit = (float)$entry['debit'];
        $credit = (float)$entry['credit'];

        $runningBalance += $debit - $credit;
        $totalDebit += $debit;
        $totalCredit += $credit;

        $rows[] = [
            'date' => $entry['date'],
            'ref_number' => $entry['ref_number'],
            'display_ref_number' => $entry['vendor_bill_no'] ?: $entry['ref_number'],
            'transaction_type' => $entry['transaction_type'],
            'narration' => $entry['narration'],
            'debit' => $debit > 0 ? $debit : null,
            'credit' => $credit > 0 ? $credit : null,
            'balance' => abs($runningBalance),
            'balance_type' => $runningBalance >= 0 ? 'Dr' : 'Cr',
            'status' => $entry['status'],
        ];
    }

    // Closing balance
    $closingBalance = abs($runningBalance);
    $closingBalanceType = $runningBalance >= 0 ? 'Dr' : 'Cr';

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Account ledger fetched successfully.",
        "data" => $rows,
        "meta" => [
            "account" => $account,
            "date_from" => $dateFrom,
            "date_to" => $dateTo,
            "total_debit" => $totalDebit,
            "total_credit" => $totalCredit,
            "closing_balance" => $closingBalance,
            "closing_balance_type" => $closingBalanceType,
        ],
    ]);
} catch (PDOException $e) {
    error_log("Account ledger error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to generate account ledger."
    ]);
}