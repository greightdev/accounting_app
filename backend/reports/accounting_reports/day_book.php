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

$dateFrom = $_GET['date_from'] ?? date('Y-m-d');
$dateTo = $_GET['date_to'] ?? date('Y-m-d');
$type = $_GET['type'] ?? null; // optional: filter by transaction type

$validTypes = ['SALES', 'PURCHASE', 'RECEIPT', 'PAYMENT', 'BANK_DEP', 'BANK_WITH', 'TDS_PAYMENT', 'JOURNAL'];

try {
    $sql = "
        SELECT
            le.date,
            le.debit,
            le.credit,
            le.narration,
            t.id AS transaction_id,
            t.ref_number,
            t.vendor_bill_no,
            t.type AS transaction_type,
            t.status,
            a.name AS account_name,
            a.code AS account_code,
            ag.type AS account_group_type,
            c.name AS contact_name
        FROM ledger_entries le
        JOIN transactions t  ON t.id  = le.transaction_id
        JOIN accounts a ON a.id  = le.account_id
        JOIN account_groups ag ON ag.id = a.account_group_id
        LEFT JOIN contacts c ON c.id  = t.contact_id
        WHERE le.date BETWEEN ? AND ? AND t.status = 'APPROVED'
    ";
    $params = [$dateFrom, $dateTo];

    if ($type && in_array($type, $validTypes, true)) {
        $sql .= " AND t.type = ?";
        $params[] = $type;
    }

    $sql .= " ORDER BY le.date ASC, t.id ASC, le.debit DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $entries = $stmt->fetchAll();

    $rows = [];
    $totalDebit = 0;
    $totalCredit = 0;

    foreach ($entries as $entry) {
        $debit = (float)$entry['debit'];
        $credit = (float)$entry['credit'];
        $totalDebit += $debit;
        $totalCredit += $credit;

        $rows[] = [
            'date' => $entry['date'],
            'ref_number' => $entry['ref_number'],
            'display_ref_number' => $entry['vendor_bill_no'] ?: $entry['ref_number'],
            'transaction_type' => $entry['transaction_type'],
            'account_name' => $entry['account_name'],
            'account_code' => $entry['account_code'],
            'contact_name' => $entry['contact_name'],
            'narration' => $entry['narration'],
            'debit' => $debit > 0 ? $debit : 0,
            'credit' => $credit > 0 ? $credit : 0,
        ];
    }

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Day book fetched successfully.",
        "data" => $rows,
        "meta" => [
            "date_from" => $dateFrom,
            "date_to" => $dateTo,
            "total_debit" => $totalDebit,
            "total_credit" => $totalCredit,
        ],
    ]);
    
} catch (PDOException $e) {
    error_log("Day book error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to generate day book."
    ]);
}