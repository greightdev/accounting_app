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

$asOf = $_GET['as_of'] ?? date('Y-m-d');

try {
    $sql = "
        SELECT
            a.id AS id,
            a.name AS account_name,
            a.code AS account_code,
            ag.name AS group_name,
            ag.type AS group_type,
            COALESCE(SUM(le.debit), 0) AS total_debit,
            COALESCE(SUM(le.credit), 0) AS total_credit
        FROM accounts a
        JOIN account_groups ag ON ag.id = a.account_group_id
        LEFT JOIN ledger_entries le ON le.account_id = a.id
        LEFT JOIN transactions t
            ON t.id = le.transaction_id
            AND t.status = 'APPROVED'
            AND le.date <= ?
        WHERE a.is_active = TRUE
        GROUP BY a.id, a.name, a.code, ag.name, ag.type
        ORDER BY ag.type, a.code
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$asOf]);
    $rows = $stmt->fetchAll();

    $grandDebit = 0;
    $grandCredit = 0;
    $accounts = [];

    foreach ($rows as $row) {
        $totalDebit = (float)$row['total_debit'];
        $totalCredit = (float)$row['total_credit'];
        $netBalance = $totalDebit - $totalCredit;
        
        $grandDebit += $totalDebit;
        $grandCredit += $totalCredit;

        $accounts[] = [
            'account_code' => $row['account_code'],
            'account_name' => $row['account_name'],
            'group_name' => $row['group_name'],
            'group_type' => $row['group_type'],
            'debit' => $netBalance > 0 ? $netBalance : 0,
            'credit' => $netBalance < 0 ? abs($netBalance) : 0,
        ];
    }

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Trial balance fetched successfully.",
        "data" => $accounts,
        "meta" => [
            "as_of" => $asOf,
            "total_debit" => $grandDebit,
            "total_credit" => $grandCredit,
            "is_balanced" => round($grandDebit, 2) === round($grandCredit, 2),
        ],
    ]);
} catch (PDOException $e) {
    error_log("Trial balance error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to generate trial balance."
    ]);
}