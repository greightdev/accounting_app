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

// 
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

function isLockedOut(array $user): ?int {
    if (!empty($user['lockout_remaining']) && $user['lockout_remaining'] > 0) {
        return (int) $user['lockout_remaining'];
    }
    return null;
}

function recordFailedAttempt(PDO $pdo, int $userId, int $currentAttempts): void {
    $newCount = $currentAttempts + 1;

    if ($newCount >= MAX_FAILED_ATTEMPTS) {
        $stmt = $pdo->prepare("
            UPDATE users
            SET failed_login_attempts = ?, lockout_until = DATE_ADD(NOW(), INTERVAL ? MINUTE)
            WHERE id = ?
        ");
        $stmt->execute([$newCount, LOCKOUT_MINUTES, $userId]);
    } else {
        $stmt = $pdo->prepare("UPDATE users SET failed_login_attempts = ? WHERE id = ?");
        $stmt->execute([$newCount, $userId]);
    }
}

function resetFailedAttempts(PDO $pdo, int $userId): void {
    $stmt = $pdo->prepare("
        UPDATE users
        SET failed_login_attempts = 0, lockout_until = NULL
        WHERE id = ?
    ");
    $stmt->execute([$userId]);
}

// 
function destroySession(): void {
    session_unset();
    session_destroy();
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $params['path'], $params['domain'],
            $params['secure'], $params['httponly']
        );
    }
}