<?php

require_once '../server.php';
require_once '../db.php';
require_once '../includes/auth.php';

requireRole(['admin']);

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Method not allowed"
    ]);
    exit();
}

$data = json_decode(file_get_contents('php://input'), true);

if (!$data) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "No input received."
    ]);
    exit();
}

$id = isset($data['id']) ? (int) $data['id'] : 0;

if ($id <= 0) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "A valid user ID is required."
    ]);
    exit();
}

try {
    $existing = $pdo->prepare("
        SELECT id
        FROM users
        WHERE id = ?
    ");
    $existing->execute([$id]);
    if (!$existing->fetch()) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "User not found."
        ]);
        exit();
    }

    $stmt = $pdo->prepare("
        UPDATE users
        SET is_active = TRUE, failed_login_attempts = 0, lockout_until = NULL
        WHERE id = ?
    ");
    $stmt->execute([$id]);

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "User reactivated successfully."
    ]);
} catch (PDOException $e) {
    error_log("Reactivate user error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to reactivate user."
    ]);
}