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

$contactId = $_GET['contact_id'] ?? null;
$dateFrom = $_GET['date_from'] ?? null;
$dateTo = $_GET['date_to'] ?? null;

if (!$contactId) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "contact_id is required."
    ]);
    exit();
}

try {
    // Fetch contact details
    $contactStmt = $pdo->prepare("
        SELECT id, name, type, pan, phone, email, opening_balance, opening_balance_type
        FROM contacts
        WHERE id = ? AND is_active = TRUE
    ");
    $contactStmt->execute([$contactId]);
    $contact = $contactStmt->fetch();

    if (!$contact) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Contact not found."
        ]);
        exit();
    }

    $controlAccountName = match ($contact['type']) {
        'Customer' => 'Customer Receivable',
        'Vendor' => 'Vendor Payable',
        default => null,
    };

    if (!$controlAccountName) {
        http_response_code(422);
        echo json_encode([
            "success" => false,
            "message" => "Contact ledger is only available for Customers and Vendors."
        ]);
        exit();
    }

    // Fetch all ledger entries on Customer Receivable account for this contact
    $sql = "
        SELECT
            le.date,
            le.debit,
            le.credit,
            le.narration,
            t.id AS transaction_id,
            t.ref_number,
            t.type AS transaction_type,
            t.status
        FROM ledger_entries le
        JOIN transactions t ON t.id = le.transaction_id
        JOIN accounts a ON a.id = le.account_id
        WHERE t.contact_id = ? AND a.name = ? AND t.status = 'APPROVED'
    ";
    $params = [$contactId, $controlAccountName];

    if ($dateFrom) { $sql .= " AND le.date >= ?"; $params[] = $dateFrom; }
    if ($dateTo) { $sql .= " AND le.date <= ?"; $params[] = $dateTo; }

    $sql .= " ORDER BY le.date ASC, le.id ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $entries = $stmt->fetchAll();

    // Opening balance from contact record
    $ob = (float)$contact['opening_balance'];
    $obType = $contact['opening_balance_type'];
    $runningBalance = $obType === 'DEBIT' ? $ob : -$ob;

    $rows = [];
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
            'transaction_type' => $entry['transaction_type'],
            'narration' => $entry['narration'],
            'debit' => $debit  > 0 ? $debit  : 0,
            'credit' => $credit > 0 ? $credit : 0,
            'balance' => abs($runningBalance),
            'balance_type' => $runningBalance >= 0 ? 'Dr' : 'Cr',
        ];
    }

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Contact ledger fetched successfully.",
        "data" => $rows,
        "meta" => [
            "contact" => $contact,
            "date_from" => $dateFrom,
            "date_to" => $dateTo,
            "opening_balance" => $ob,
            "opening_balance_type" => $obType,
            "closing_balance" => abs($runningBalance),
            "closing_balance_type" => $runningBalance >= 0 ? 'Dr' : 'Cr',
        ],
    ]);

} catch (PDOException $e) {
    error_log("Contact ledger error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to generate contact ledger."
    ]);
}
