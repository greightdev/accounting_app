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

// Optional filter
$type = $_GET['type'] ?? null;
$validTypes = ['BANK_DEP', 'BANK_WITH'];

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
            t.notes,
            t.status,
            t.created_at,
            ba.id AS bank_account_id,
            ba.name AS bank_account_name,
            ba.account_number,
            ca.id AS contra_account_id,
            ca.name AS contra_account_name,
            u.name AS created_by_name
        FROM transactions t
        LEFT JOIN bank_accounts ba ON ba.id = t.bank_account_id
        LEFT JOIN accounts ca ON ca.id = t.contra_account_id
        LEFT JOIN users u ON u.id  = t.created_by
        WHERE t.type IN ('BANK_DEP', 'BANK_WITH')
    ";

    $params = [];

    if ($type && in_array($type, $validTypes, true)) {
        $sql .= " AND t.type = ?";
        $params[] = $type;
    }

    if ($status && in_array($status, $validStatuses, true)) {
        $sql .= " AND t.status = ?";
        $params[] = $status;
    }

    $sql .= " ORDER BY t.date DESC, t.id DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $transactions = $stmt->fetchAll();

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
