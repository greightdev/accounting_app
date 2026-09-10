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
            a.account_group_id,
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
        GROUP BY a.id, a.name, a.code, a.account_group_id, ag.type, ag.name
        ORDER BY ag.type, a.code
    ");
    $stmt->execute([$asOf]);
    $rows = $stmt->fetchAll();

    // Accounts that should be expanded into a per-contact subledger instead of a single aggregate line.
    $subledgerAccounts = [
        'Vendor Payable' => 'Vendor',
        'Customer Receivable' => 'Customer',
    ];

    $fetchSubledger = function (string $accountName, string $contactType, string $groupType, string $asOf) use ($pdo): array {
        $stmt = $pdo->prepare("
            SELECT
                c.id AS contact_id,
                c.name AS contact_name,
                c.opening_balance,
                c.opening_balance_type,
                c.opening_date,
                COALESCE(SUM(le.debit), 0) AS total_debit,
                COALESCE(SUM(le.credit), 0) AS total_credit
            FROM contacts c
            LEFT JOIN transactions t
                ON t.contact_id = c.id AND t.status = 'APPROVED'
            LEFT JOIN ledger_entries le
                ON le.transaction_id = t.id
                AND le.date <= ?
                AND le.account_id = (SELECT id FROM accounts WHERE name = ? LIMIT 1)
            WHERE c.type = ? AND c.is_active = TRUE
            GROUP BY c.id, c.name, c.opening_balance, c.opening_balance_type, c.opening_date
        ");
        $stmt->execute([$asOf, $accountName, $contactType]);

        $out = [];
        foreach ($stmt->fetchAll() as $r) {
            $debit = (float)$r['total_debit'];
            $credit = (float)$r['total_credit'];
            $ledgerNet = ($groupType === 'Asset') ? ($debit - $credit) : ($credit - $debit);
            $openingSigned = 0.0;
            if ($r['opening_balance'] !== null && (float)$r['opening_balance'] !== 0.0 && $r['opening_date'] !== null && $r['opening_date'] <= $asOf) {
                $ob = (float)$r['opening_balance'];
                $isPositiveType = ($groupType === 'Asset')
                    ? ($r['opening_balance_type'] === 'DEBIT')
                    : ($r['opening_balance_type'] === 'CREDIT');
                $openingSigned = $isPositiveType ? $ob : -$ob;
            }

            $balance = $openingSigned + $ledgerNet;
            if (abs($balance) < 0.01) continue;

            $out[] = ['contact_id' => (int)$r['contact_id'], 'name' => $r['contact_name'], 'balance' => $balance];
        }
        usort($out, fn($a, $b) => strcmp($a['name'], $b['name']));
        return $out;
    };

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

    $groupsById = [];
    foreach ($pdo->query("SELECT id, name, parent_id FROM account_groups")->fetchAll() as $g) {
        $groupsById[(int)$g['id']] = ['name' => $g['name'], 'parent_id' => $g['parent_id'] !== null ? (int)$g['parent_id'] : null];
    }
    $topLevelGroupName = function (int $groupId) use ($groupsById): string {
        $current = $groupsById[$groupId] ?? null;
        if (!$current) return '';
        while ($current['parent_id'] !== null && isset($groupsById[$current['parent_id']]) && $groupsById[$current['parent_id']]['parent_id'] !== null) {
            $current = $groupsById[$current['parent_id']];
        }
        return $current['name'];
    };

    $assetRows = [];
    $liabilityRows = [];
    $equityRows = [];
    $totalAssets = 0;
    $totalLiabilities = 0;
    $totalEquity = 0;

    // Running subtotal per top-level bucket, for Asset/Liability sections only.
    $bucketTrackers = [
        'Asset' => ['name' => null, 'subtotal' => 0.0],
        'Liability' => ['name' => null, 'subtotal' => 0.0],
    ];
    $flushBucket = function (string $type) use (&$bucketTrackers, &$assetRows, &$liabilityRows) {
        $name = $bucketTrackers[$type]['name'];
        if ($name === null) return;
        $subtotalRow = [
            'account_code' => '',
            'account_name' => "Total {$name}",
            'group_name' => $name,
            'section' => $type,
            'amount' => $bucketTrackers[$type]['subtotal'],
            'is_subtotal' => true,
            'is_group_subtotal' => true,
        ];
        if ($type === 'Asset') { $assetRows[] = $subtotalRow; }
        if ($type === 'Liability') { $liabilityRows[] = $subtotalRow; }
    };

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

        if (isset($bucketTrackers[$row['group_type']])) {
            $bucketName = $topLevelGroupName((int)$row['account_group_id']);
            $currentBucket = $bucketTrackers[$row['group_type']]['name'];
            if ($currentBucket !== null && $currentBucket !== $bucketName) {
                $flushBucket($row['group_type']);
                $bucketTrackers[$row['group_type']] = ['name' => $bucketName, 'subtotal' => 0.0];
            } elseif ($currentBucket === null) {
                $bucketTrackers[$row['group_type']]['name'] = $bucketName;
            }
            $bucketTrackers[$row['group_type']]['subtotal'] += $amount;
        }

        $targetRows = null;
        switch ($row['group_type']) {
            case 'Asset':
                $totalAssets += $amount;
                $targetRows = &$assetRows;
                break;
            case 'Liability':
                $totalLiabilities += $amount;
                $targetRows = &$liabilityRows;
                break;
            case 'Equity':
                $totalEquity += $amount;
                $targetRows = &$equityRows;
                break;
        }

        if ($targetRows !== null && isset($subledgerAccounts[$row['account_name']])) {
            // Expand into a per-contact subledger instead of one aggregate line.
            $contactType = $subledgerAccounts[$row['account_name']];
            $breakdown = $fetchSubledger($row['account_name'], $contactType, $row['group_type'], $asOf);

            foreach ($breakdown as $b) {
                $targetRows[] = [
                    'account_code' => '',
                    'account_name' => $b['name'],
                    'group_name' => $row['group_name'],
                    'section' => $row['group_type'],
                    'amount' => $b['balance'],
                    'is_subtotal' => false,
                    'is_contact_row' => true,
                    'contact_id' => $b['contact_id'],
                ];
            }

            $entry['account_name'] = 'Total ' . $row['account_name'];
            $targetRows[] = $entry;
        } else if ($targetRows !== null) {
            $targetRows[] = $entry;
        }
        unset($targetRows);
    }
    $flushBucket('Asset');
    $flushBucket('Liability');

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