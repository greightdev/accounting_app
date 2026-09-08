<?php

require_once '../server.php';
require_once '../db.php';
require_once '../includes/auth.php';

requireAuth();

try {
    $stmt = $pdo->query("
        SELECT id, symbol, name, description, is_active
        FROM units
        WHERE is_active = TRUE
        ORDER BY symbol ASC
    ");
    $units = $stmt->fetchAll();

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "data" => $units
    ]);
} catch (PDOException $e) {
    error_log("List units error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to fetch units."
    ]);
}
