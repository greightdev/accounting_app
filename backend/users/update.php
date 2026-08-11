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
$name = trim($data['name'] ?? '');
$email = trim($data['email'] ?? '');
$role = $data['role'] ?? '';

$validRoles = ['admin', 'accountant', 'user'];

$errors = [];

if ($id <= 0) $errors[] = "A valid user ID is required.";
if ($name === '') {
    $errors[] = "Name is required.";
} elseif (!preg_match("/^[A-Za-z\s.,'&-]+$/", $name)) {
    $errors[] = "Name can only contain letters, spaces, and . , ' & -";
}
if ($email === '') {
    $errors[] = "Email is required.";
} elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors[] = "A valid email is required.";
}
if (!in_array($role, $validRoles, true)) $errors[] = "Role must be admin, accountant, or user.";

if ($errors) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => implode(' ', $errors)
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

    if ($id === (int) $_SESSION['user_id'] && $role !== 'admin') {
        http_response_code(422);
        echo json_encode([
            "success" => false,
            "message" => "You cannot change your own role away from admin."
        ]);
        exit();
    }

    if ($user['role'] === 'admin' && $user['is_active'] && $role !== 'admin') {
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
                "message" => "Cannot remove the last active admin. Promote another user to admin first."
            ]);
            exit();
        }
    }

    $emailCheck = $pdo->prepare("
        SELECT id
        FROM users
        WHERE email = ? AND id != ?
    ");
    $emailCheck->execute([$email, $id]);
    if ($emailCheck->fetch()) {
        http_response_code(409);
        echo json_encode([
            "success" => false,
            "message" => "A user with this email already exists."
        ]);
        exit();
    }

    $stmt = $pdo->prepare("
        UPDATE users
        SET name = ?, email = ?, role = ?
        WHERE id = ?
    ");
    $stmt->execute([$name, $email, $role, $id]);

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "User updated successfully."
    ]);
} catch (PDOException $e) {
    error_log("Update user error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to update user."
    ]);
}