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

$type = $_GET['type'] ?? 'cash_bank'; // 'cash_bank' | 'cash_bank_or_expense'
$excludeBankAccountId = $_GET['exclude_bank_account_id'] ?? null;

try {
    $sql = "
        SELECT a.id, a.name, a.code, ba.id AS bank_account_id
        FROM bank_accounts ba
        JOIN accounts a ON a.id = ba.account_id
        WHERE ba.is_active = TRUE AND a.is_active = TRUE
    ";
    $params = [];

    if ($excludeBankAccountId) {
        $sql .= " AND ba.id != ?";
        $params[] = (int) $excludeBankAccountId;
    }

    if ($type === 'cash_bank_or_expense') {
        $sql .= "
            UNION
            SELECT a.id, a.name, a.code, NULL AS bank_account_id
            FROM accounts a
            JOIN account_groups ag ON ag.id = a.account_group_id
            WHERE ag.type = 'Expense' AND a.is_active = TRUE
        ";
    }

    $sql .= " ORDER BY name";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Accounts fetched successfully.",
        "data" => $stmt->fetchAll()
    ]);
    
} catch (PDOException $e) {
    error_log("Banking contra accounts error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to fetch accounts."
    ]);
}