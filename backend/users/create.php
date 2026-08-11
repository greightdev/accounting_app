<?php

require_once '../server.php';
require_once '../db.php';
require_once '../includes/auth.php';

requireRole(['admin']);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
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

$name = trim($data['name'] ?? '');
$email = trim($data['email'] ?? '');
$password = $data['password'] ?? '';
$role = $data['role'] ?? '';

$validRoles = ['admin', 'accountant', 'user'];

// Validation
$errors = [];

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
if ($password === '') {
    $errors[] = "Password is required.";
} elseif (!preg_match('/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/', $password)) {
    $errors[] = "Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.";
}

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
        SELECT id
        FROM users
        WHERE email = ?
    ");
    $existing->execute([$email]);
    if ($existing->fetch()) {
        http_response_code(409);
        echo json_encode([
            "success" => false,
            "message" => "A user with this email already exists."
        ]);
        exit();
    }

    $passwordHash = password_hash($password, PASSWORD_BCRYPT);

    $stmt = $pdo->prepare("
        INSERT INTO users (name, email, password, role, is_active)
        VALUES (?, ?, ?, ?, TRUE)
    ");
    $stmt->execute([$name, $email, $passwordHash, $role]);

    http_response_code(201);
    echo json_encode([
        "success" => true,
        "message" => "User created successfully.",
        "data" => ["id" => (int) $pdo->lastInsertId()],
    ]);
} catch (PDOException $e) {
    error_log("Create user error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to create user."
    ]);
}