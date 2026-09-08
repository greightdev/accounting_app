<?php

require_once '../server.php';
require_once '../db.php';
require_once '../includes/auth.php';
require_once '../includes/audit.php';

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
        "message" => "A valid unit ID is required."
    ]);
    exit();
}

try {
    $existing = $pdo->prepare("
        SELECT id, symbol
        FROM units
        WHERE id = ? AND is_active = TRUE
    ");
    $existing->execute([$id]);
    $unit = $existing->fetch();
    if (!$unit) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Unit not found."
        ]);
        exit();
    }

    $stmt = $pdo->prepare("
        UPDATE units
        SET is_active = FALSE
        WHERE id = ?
    ");
    $stmt->execute([$id]);

    logAudit(
        $pdo,
        (int) $_SESSION['user_id'],
        'DELETE',
        'units',
        $id,
        ['symbol' => $unit['symbol'], 'is_active' => true],
        ['is_active' => false]
    );

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Unit deleted successfully."
    ]);
} catch (PDOException $e) {
    error_log("Delete unit error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to delete unit."
    ]);
}
