<?php

require_once '../server.php';
require_once '../db.php';
require_once '../includes/auth.php';

requireRole(['admin', 'accountant']);

// Only accept GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Method not allowed"
    ]);
    exit();
}

$direction = $_GET['direction'] ?? null;
$type = $_GET['type'] ?? null;

$directionTypes = [
    'in' => ['BANK_DEP', 'RECEIPT'],
    'out' => ['BANK_WITH', 'PAYMENT', 'TDS_PAYMENT'],
];
$validTypes = ['BANK_DEP', 'BANK_WITH', 'RECEIPT', 'PAYMENT', 'TDS_PAYMENT'];

$status = $_GET['status'] ?? null;
$status = $status ? strtoupper($status) : null;
$validStatuses = ['DRAFT', 'APPROVED'];

try {
    $sql = "
        SELECT
            t.id,
            t.type,
            t.date,
            t.ref_number,
            t.total_amount,
            t.payment_mode,
            t.payment_ref,
            t.notes,
            t.status,
            t.created_at,
            ba.id AS bank_account_id,
            ba.name AS bank_account_name,
            ba.account_number,
            ca.id AS contra_account_id,
            ca.name AS contra_account_name,
            c.id AS contact_id,
            c.name AS contact_name,
            u.name AS created_by_name
        FROM transactions t
        LEFT JOIN bank_accounts ba ON ba.id = t.bank_account_id
        LEFT JOIN accounts ca ON ca.id = t.contra_account_id
        LEFT JOIN contacts c ON c.id = t.contact_id
        LEFT JOIN users u ON u.id  = t.created_by
        WHERE 1=1
    ";

    $params = [];

    if ($direction && isset($directionTypes[$direction])) {
        $types = $directionTypes[$direction];
        $placeholders = implode(',', array_fill(0, count($types), '?'));
        $sql .= " AND t.type IN ($placeholders) AND ba.account_type = 'BANK'";
        $params = array_merge($params, $types);
    } elseif ($type && in_array($type, $validTypes, true)) {
        $sql .= " AND t.type = ?";
        $params[] = $type;
    } else {
        $sql .= " AND t.type IN ('BANK_DEP', 'BANK_WITH')";
    }

    if ($status && in_array($status, $validStatuses, true)) {
        $sql .= " AND t.status = ?";
        $params[] = $status;
    }

    $sql .= " ORDER BY t.date DESC, t.id DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $transactions = $stmt->fetchAll();

    foreach ($transactions as &$tx) {
        if (in_array($tx['type'], ['BANK_DEP', 'BANK_WITH'], true)) {
            $tx['counterparty_name'] = $tx['contra_account_name'];
            $tx['is_native'] = true;
        } elseif (in_array($tx['type'], ['RECEIPT', 'PAYMENT'], true)) {
            $tx['counterparty_name'] = $tx['contact_name'];
            $tx['is_native'] = false;
        } elseif ($tx['type'] === 'TDS_PAYMENT') {
            $tx['counterparty_name'] = 'TDS Payable (Government)';
            $tx['is_native'] = false;
        } else {
            $tx['counterparty_name'] = $tx['contra_account_name'] ?? $tx['contact_name'];
            $tx['is_native'] = false;
        }
    }
    unset($tx);

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Transactions fetched successfully.",
        "data" => $transactions
    ]);
} catch (PDOException $e) {
    error_log("List banking transactions error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to fetch banking transactions."
    ]);
}