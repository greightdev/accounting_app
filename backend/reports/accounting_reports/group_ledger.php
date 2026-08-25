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

$groupId = $_GET['group_id'] ?? null;
$dateFrom = $_GET['date_from'] ?? null;
$dateTo = $_GET['date_to'] ?? null;

if (!$groupId) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "group_id is required."
    ]);
    exit();
}

try {
    // Fetch group details
    $groupStmt = $pdo->prepare("
        SELECT id, name, code, type
        FROM account_groups
        WHERE id = ? AND is_active = TRUE
    ");
    $groupStmt->execute([$groupId]);
    $group = $groupStmt->fetch();

    if (!$group) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Account group not found."
        ]);
        exit();
    }

    // Get all active accounts under this group (including sub-groups recursively)
    function getDescendantGroupIds(PDO $pdo, int $groupId): array {
        $ids = [$groupId];
        $stmt = $pdo->prepare("
            SELECT id
            FROM account_groups
            WHERE parent_id = ? AND is_active = TRUE
        ");
        $queue = [$groupId];
        while (!empty($queue)) {
            $current = array_shift($queue);
            $stmt->execute([$current]);
            $children = $stmt->fetchAll(PDO::FETCH_COLUMN);
            foreach ($children as $childId) {
                $ids[] = (int)$childId;
                $queue[] = (int)$childId;
            }
        }
        return $ids;
    }

    $groupIds = getDescendantGroupIds($pdo, (int)$groupId);
    $placeholders = implode(',', array_fill(0, count($groupIds), '?'));

    // Get all accounts under these groups
    $accountsStmt = $pdo->prepare("
        SELECT id, name, code
        FROM accounts
        WHERE account_group_id IN ($placeholders) AND is_active = TRUE
        ORDER BY code
    ");
    $accountsStmt->execute($groupIds);
    $accounts = $accountsStmt->fetchAll();

    if (empty($accounts)) {
        http_response_code(200);
        echo json_encode([
            "success" => true,
            "group" => $group,
            "accounts" => [],
            "group_total_debit" => 0,
            "group_total_credit" => 0,
        ]);
        exit();
    }

    // For each account, fetch its ledger entries
    $entrySql = "
        SELECT
            le.debit,
            le.credit,
            le.narration,
            le.date,
            t.ref_number,
            t.vendor_bill_no,
            t.type AS transaction_type,
            t.status
        FROM ledger_entries le
        JOIN transactions t ON t.id = le.transaction_id
        WHERE le.account_id = ? AND t.status = 'APPROVED'
    ";
    $entryParams = [];

    if ($dateFrom) { $entrySql .= " AND le.date >= ?"; $entryParams[] = $dateFrom; }
    if ($dateTo) { $entrySql .= " AND le.date <= ?"; $entryParams[] = $dateTo; }
    $entrySql .= " ORDER BY le.date ASC, le.id ASC";

    $entryStmt = $pdo->prepare($entrySql);

    $rows = [];
    $groupTotalDebit = 0;
    $groupTotalCredit = 0;

    foreach ($accounts as $account) {
        $entryStmt->execute(array_merge([$account['id']], $entryParams));
        $entries = $entryStmt->fetchAll();

        $totalDebit = 0;
        $totalCredit = 0;
        $runningBalance = 0;

        foreach ($entries as $entry) {
            $debit = (float)$entry['debit'];
            $credit = (float)$entry['credit'];
            $runningBalance += $debit - $credit;
            $totalDebit += $debit;
            $totalCredit += $credit;

            $rows[] = [
                'account_code' => $account['code'],
                'account_name' => $account['name'],
                'date' => $entry['date'],
                'ref_number' => $entry['ref_number'],
                'display_ref_number' => $entry['vendor_bill_no'] ?: $entry['ref_number'],
                'transaction_type' => $entry['transaction_type'],
                'narration' => $entry['narration'],
                'debit' => $debit > 0 ? $debit : 0,
                'credit' => $credit > 0 ? $credit : 0,
                'balance' => abs($runningBalance),
                'balance_type' => $runningBalance >= 0 ? 'Dr' : 'Cr',
                'is_subtotal' => false,
            ];
        }

        // Per-account subtotal row, inline — frontend can style based on is_subtotal
        $rows[] = [
            'account_code' => $account['code'],
            'account_name' => $account['name'] . ' — Closing Balance',
            'date' => '',
            'ref_number' => '',
            'transaction_type' => '',
            'narration' => '',
            'debit' => $totalDebit,
            'credit' => $totalCredit,
            'balance' => abs($runningBalance),
            'balance_type' => $runningBalance >= 0 ? 'Dr' : 'Cr',
            'is_subtotal' => true,
        ];

        $groupTotalDebit += $totalDebit;
        $groupTotalCredit += $totalCredit;
    }

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Group ledger fetched successfully.",
        "data" => $rows,
        "meta" => [
            "group" => $group,
            "date_from" => $dateFrom,
            "date_to" => $dateTo,
            "total_debit" => $groupTotalDebit,
            "total_credit" => $groupTotalCredit,
        ],
    ]);
} catch (PDOException $e) {
    error_log("Group ledger error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to generate group ledger."
        ]);
}