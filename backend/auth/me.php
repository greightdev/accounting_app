<?php

require_once '../server.php';
require_once '../db.php';
require_once '../includes/auth.php';

requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Method not allowed"
    ]);
    exit();
}

try {
    $stmt = $pdo->prepare("
        SELECT id, name, email, role
        FROM users
        WHERE id = ? AND is_active = TRUE
        LIMIT 1
    ");
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch();

    if (!$user) {
        // Account was deactivated/deleted after the session was issued.
        destroySession();
        http_response_code(401);
        echo json_encode([
            "success" => false,
            "message" => "Not authenticated"
        ]);
        exit();
    }

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "user" => [
            "id" => $user['id'],
            "name" => $user['name'],
            "email" => $user['email'],
            "role" => $user['role'],
        ],
    ]);
} catch (PDOException $e) {
    error_log("auth/me error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to fetch session."
    ]);
}