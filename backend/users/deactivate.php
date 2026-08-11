<?php

require_once '../server.php';
require_once '../db.php';
require_once '../includes/auth.php';

requireRole(['admin']);

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
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

if ($id === (int) $_SESSION['user_id']) {
    http_response_code(422);
    echo json_encode([
        "success" => false,
        "message" => "You cannot deactivate your own account."
    ]);
    exit();
}

try {
    $existing = $pdo->prepare("
        SELECT id, role, is_active
        FROM users
        WHERE id = ?
    ");
    $existing->execute([$id]);
    $user = $existing->fetch();

    if (!$user) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "User not found."
        ]);
        exit();
    }

    if (!$user['is_active']) {
        http_response_code(200);
        echo json_encode([
            "success" => true,
            "message" => "User is already inactive."
        ]);
        exit();
    }

    if ($user['role'] === 'admin') {
        $adminCount = $pdo->prepare("
            SELECT COUNT(*) AS cnt
            FROM users
            WHERE role = 'admin' AND is_active = TRUE AND id != ?
        ");
        $adminCount->execute([$id]);
        if ((int) $adminCount->fetch()['cnt'] === 0) {
            http_response_code(422);
            echo json_encode([
                "success" => false,
                "message" => "Cannot deactivate the last active admin."
            ]);
            exit();
        }
    }

    $stmt = $pdo->prepare("
        UPDATE users
        SET is_active = FALSE
        WHERE id = ?
    ");
    $stmt->execute([$id]);

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "User deactivated successfully."
    ]);
} catch (PDOException $e) {
    error_log("Deactivate user error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to deactivate user."
    ]);
}