<?php

require_once '../server.php';
require_once '../db.php';
require_once '../includes/auth.php';

requireRole(['admin']);

// Only accept DELETE
if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Method not allowed"
    ]);
    exit();
}
 
// Parse JSON body
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
        "message" => "A valid item ID is required."
    ]);
    exit();
}
 
try {
    // Check item exists
    $existing = $pdo->prepare("
        SELECT id
        FROM items
        WHERE id = ? AND is_active = TRUE
    ");
    $existing->execute([$id]);
    if (!$existing->fetch()) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Item not found."
        ]);
        exit();
    }

    // Block delete if the item has been used in any transactions
    $usageCheck = $pdo->prepare("
        SELECT id
        FROM transaction_items
        WHERE item_id = ?
        LIMIT 1
    ");
    $usageCheck->execute([$id]);
    if ($usageCheck->fetch()) {
        http_response_code(409);
        echo json_encode([
            "success" => false,
            "message" => "This item has been used in existing transactions and cannot be deleted."
        ]);
        exit();
    }

    // Soft delete
    $stmt = $pdo->prepare("
        UPDATE items
        SET is_active = FALSE
        WHERE id = ?
    ");
    $stmt->execute([$id]);

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Item deleted successfully."
    ]);

} catch (PDOException $e) {
    error_log("Delete item error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to delete item."
    ]);
}
