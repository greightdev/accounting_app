<?php

require_once '../server.php';
require_once '../db.php';
require_once '../includes/auth.php';

startSecureSession();

// Only accept POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Method not allowed"
    ]);
    exit();
}

// Parse JSON body
$data = json_decode(file_get_contents("php://input"), true);

if (!$data) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "No input received"
    ]);
    exit();
}

$email = trim($data['email'] ?? '');
$password = $data['password'] ?? '';

// Rate limiting
if (($_SESSION['login_attempts'] ?? 0) > 5) {
    if (!isset($_SESSION['lockout_start'])) {
        $_SESSION['lockout_start'] = time();
    }

    $lockoutSeconds = 15 * 60;
    $elapsed = time() - $_SESSION['lockout_start'];

    if ($elapsed < $lockoutSeconds) {
        http_response_code(429);
        echo json_encode([
            "success" => false,
            "message" => "Too many failed attempts.",
            "retry_after" => $lockoutSeconds - $elapsed
        ]);
        exit();
    }

    // Reset
    $_SESSION['login_attempts'] = 0;
    unset($_SESSION['lockout_start']);
}

// Input validation
$errors = [];

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'A valid email is required';
if (empty($password)) $errors[] = 'Password is required';

if ($errors) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => implode(' ', $errors)
    ]);
    exit();
}

// Find user
$stmt = $pdo->prepare("
    SELECT id, name, email, password, role, failed_login_attempts, lockout_until, TIMESTAMPDIFF(SECOND, NOW(), lockout_until) AS lockout_remaining
    FROM users
    WHERE email = ? AND is_active = TRUE
    LIMIT 1
");

$stmt->execute([$email]);
$user = $stmt->fetch();

// Check lockout
if ($user && ($remaining = isLockedOut($user)) !== null) {
    http_response_code(429);
    echo json_encode([
        "success" => false,
        "message" => "Too many failed attempts. Try again later.",
        "retry_after" => $remaining
    ]);
    exit();
}

// User not found or incorrect password
if (!$user || !password_verify($password, $user['password'])) {
    if ($user) {
        recordFailedAttempt($pdo, $user['id'], $user['failed_login_attempts']);
    }

    http_response_code(401);
    echo json_encode([
        "success" => false,
        "message" => "Invalid credentials"
    ]);
    exit();
}

// Regenerate session ID on privilege change
session_regenerate_id(true);

$_SESSION["user_id"] = $user["id"];
$_SESSION["email"] = $user['email'];
$_SESSION["role"] = $user['role'];
$_SESSION['logged_in'] = true;
$_SESSION['login_time'] = time();

resetFailedAttempts($pdo, $user['id']);

http_response_code(200);
echo json_encode([
    "success" => true,
    "message" => "Login successful",
    "user" => [
        "id" => $user['id'],
        "name" => $user['name'],
        "email" => $user['email'],
        "role" => $user['role'],
    ],
]);
