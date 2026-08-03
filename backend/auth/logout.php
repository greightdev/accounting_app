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

destroySession();

http_response_code(200);
echo json_encode([
    "success" => true,
    "message" => "Logged out successfully."
]);