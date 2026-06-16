<?php

// Start session
function startSecureSession(): void {
    if (session_status() === PHP_SESSION_NONE) {
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'secure' => false,
            'httponly' => true,
            'samesite' => 'Strict',
        ]);
        session_start();
    }
}

// Auth guard
function requireAuth(): void {
    startSecureSession();

    $maxIdleSeconds = 30 * 60;

    if (
        empty($_SESSION['logged_in']) ||
        empty($_SESSION['user_id'])
    ) {
        session_unset();
        session_destroy();
        http_response_code(401);
        echo json_encode([
            "success" => false,
            "message" => "Not authenticated"
        ]);
        exit();
    }

    if (isset($_SESSION['last_activity']) && 
        (time() - ($_SESSION['last_activity']) > $maxIdleSeconds)
    ) {
        session_unset();
        session_destroy();
        http_response_code(401);
        echo json_encode([
            "success" => false,
            "message" => "Session expired"
        ]);
        exit();
    }

    // Refresh activity timestamp on every request
    $_SESSION['last_activity'] = time();
}

// Role guard
function requireRole(array $allowedRoles): void {
    requireAuth();
    if (!in_array($_SESSION['role'] ?? '', $allowedRoles, true)) {
        http_response_code(403);
        echo json_encode([
            "success" => false,
            "message" => "Access denied"
        ]);
        exit();
    }
}