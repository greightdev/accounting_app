<?php

require_once '../server.php';
require_once '../db.php';
require_once '../includes/auth.php';
require_once '../includes/audit.php';

requireRole(['admin', 'accountant']);

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

$symbol = trim($data['symbol'] ?? '');
$name = trim($data['name'] ?? '');
$description = trim($data['description'] ?? '');

$errors = [];
if ($symbol === '') $errors[] = "Unit symbol is required.";
if ($symbol !== '' && strlen($symbol) > 20) $errors[] = "Unit symbol must be 20 characters or fewer.";
if ($symbol !== '' && !preg_match("/^[A-Za-z\s.\/-]+$/", $symbol)) {
    $errors[] = "Unit symbol can only contain letters, spaces and . / -";
}
if ($name === '') $errors[] = "Unit name is required.";
if ($name !== '' && strlen($name) > 100) $errors[] = "Unit name must be 100 characters or fewer.";
if (strlen($description) > 1000) $errors[] = "Description must be 1000 characters or fewer.";

if ($errors) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => implode(' ', $errors)
    ]);
    exit();
}

try {
    $dupCheck = $pdo->prepare("
        SELECT id
        FROM units
        WHERE symbol = ? AND is_active = TRUE
    ");
    $dupCheck->execute([$symbol]);
    if ($dupCheck->fetch()) {
        http_response_code(409);
        echo json_encode([
            "success" => false,
            "message" => "This unit already exists."
        ]);
        exit();
    }

    $stmt = $pdo->prepare("
        INSERT INTO units (symbol, name, description)
        VALUES (?, ?, ?)
    ");
    $stmt->execute([$symbol, $name, $description !== '' ? $description : null]);
    $newId = (int) $pdo->lastInsertId();

    logAudit(
        $pdo,
        (int) $_SESSION['user_id'],
        'CREATE',
        'units',
        $newId,
        null,
        ['symbol' => $symbol, 'name' => $name, 'description' => $description]
    );

    http_response_code(201);
    echo json_encode([
        "success" => true,
        "message" => "Unit created successfully.",
        "data" => [
            "id" => $newId,
            "symbol" => $symbol,
            "name" => $name,
            "description" => $description
        ]
    ]);
} catch (PDOException $e) {
    error_log("Create unit error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to create unit."
    ]);
}
