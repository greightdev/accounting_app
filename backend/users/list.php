<?php

require_once '../server.php';
require_once '../db.php';
require_once '../includes/auth.php';

requireRole(['admin']);

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
        SELECT id, name, email, role, is_active, created_at
        FROM users
        ORDER BY name ASC
    ");
    $users = $stmt->fetchAll();

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "data" => $users,
    ]);
} catch (PDOException $e) {
    error_log("List users error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to fetch users."
    ]);
}