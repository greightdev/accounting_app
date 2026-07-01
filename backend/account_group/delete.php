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
        "message" => "A valid account group ID is required."
    ]);
    exit();
}

try {
    // Check account group exists
    $existing = $pdo->prepare("
        SELECT id, parent_id
        FROM account_groups
        WHERE id = ? AND is_active = TRUE
    ");
    $existing->execute([$id]);
    $group = $existing->fetch();

    if (!$group) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Account group not found."
        ]);
        exit();
    }

    // Root groups cannot be deleted
    if ($group['parent_id'] == null) {
        http_response_code(403);
        echo json_encode([
            "success" => false,
            "message" => "Root groups cannot be deleted."
        ]);
        exit();
    }

    // Block delete if the group has any active child groups
    $childGroups = $pdo->prepare("
        SELECT id
        FROM account_groups
        WHERE parent_id = ? AND is_active = TRUE
        LIMIT 1
    ");
    $childGroups->execute([$id]);
    if ($childGroups->fetch()) {
        http_response_code(409);
        echo json_encode([
            "success" => false,
            "message" => "This group has sub-groups under it. Delete or reassign them first."
        ]);
        exit();
    }

    // Block if this group has active accounts linked to it
    $linkedAccounts = $pdo->prepare("
        SELECT id
        FROM accounts
        WHERE account_group_id = ? AND is_active = TRUE
        LIMIT 1
    ");
    $linkedAccounts->execute([$id]);
    if ($linkedAccounts->fetch()) {
        http_response_code(409);
        echo json_encode([
            "success" => false,
            "message" => "This group has active accounts under it. Remove or reassign those accounts."
        ]);
        exit();
    }

    // Soft delete
    $stmt = $pdo->prepare("
        UPDATE account_groups
        SET is_active = FALSE
        WHERE id = ?
    ");
    $stmt->execute([$id]);

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Account group deleted successfully."
    ]);

} catch (PDOException $e) {
    error_log("Delete account group error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to delete account group."
    ]);
}
