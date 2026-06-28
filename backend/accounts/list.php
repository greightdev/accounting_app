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

try {
    $stmt = $pdo->query("
        SELECT
            a.id,
            a.name,
            a.code,
            a.opening_balance,
            a.opening_balance_type,
            a.opening_date,
            a.is_system,
            ag.id   AS account_group_id,
            ag.name AS account_group_name,
            ag.code AS account_group_code,
            ag.type AS account_group_type
        FROM accounts a
        JOIN account_groups ag ON ag.id = a.account_group_id
        WHERE a.is_active = TRUE
        ORDER BY ag.type, a.name
    ");
    $accounts = $stmt->fetchAll();

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Accounts fetched successfully.",
        "data" => $accounts
    ]);

} catch (PDOException $e) {
    error_log("Get all accounts error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to fetch accounts."
    ]);
}
