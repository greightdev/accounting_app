<?php

require_once '../server.php';
require_once '../db.php';
require_once '../includes/auth.php';

requireRole(['admin', 'accountant']);

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Method not allowed"
    ]);
    exit();
}

$type = $_GET['type'] ?? null;
$validTypes = ['BANK', 'CASH'];

try {
    $sql = "
        SELECT
            ba.id,
            ba.name,
            ba.account_number,
            ba.bank_name,
            ba.account_type,
            ba.opening_balance,
            ba.is_active,
            ba.created_at,
            a.id AS ledger_account_id,
            a.name AS ledger_account_name,
            a.code AS ledger_account_code
        FROM bank_accounts ba
        JOIN accounts a ON a.id = ba.account_id
        WHERE ba.is_active = TRUE
    ";
    $params = [];
    
    if ($type && in_array($type, $validTypes, true)) {
        $sql .= " AND ba.account_type = ?";
        $params[] = $type;
    }

    $sql .= " ORDER BY ba.name";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $bankAccounts = $stmt->fetchAll();
    
    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Bank accounts fetched successfully.",
        "data" => $bankAccounts
    ]);
} catch (PDOException $e) {
    error_log("List bank accounts error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to fetch bank accounts."
    ]);
}