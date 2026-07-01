<?php

require_once '../server.php';
require_once '../db.php';
require_once '../includes/auth.php';
require_once '../includes/helpers.php';

requireRole(['admin', 'accountant']);

// Only accept PUT
if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
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
        "message" => "Account id is required."
    ]);
    exit();
}

$id = isset($data['id']) ? (int) $data['id'] : 0;
$name = trim($data['name'] ?? '');
$accountGroupId = $data['account_group_id'] ?? null;

// Validation
$errors = [];

if ($id <= 0) $errors[] = 'A valid account ID is required';
if ($name === '') $errors[] = "Account name is required.";
if (!$accountGroupId) $errors[] = "Account group id is required.";

if ($errors) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => implode(' ', $errors)
    ]);
    exit();
}

try {
    // Check account exists
    $existing = $pdo->prepare("
        SELECT *
        FROM accounts
        WHERE id = ? AND is_active = TRUE
    ");
    $existing->execute([$id]);
    $account = $existing->fetch();

    if (!$account) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Account not found."
        ]);
        exit();
    }

    // // System ledgers (the 13 fixed ones): block name/group changes
    // if ($account['is_system'] && $name !== '' && $name !== $account['name']) {
    //     http_response_code(403);
    //     echo json_encode([
    //         "success" => false,
    //         "message" => "This is a system ledger and its name cannot be changed."
    //     ]);
    //     exit();
    // }

    // if ($account['is_system'] && isset($data['account_group_id']) && $data['account_group_id'] != $account['account_group_id']) {
    //     http_response_code(403);
    //     echo json_encode([
    //         "success" => false,
    //         "message" => "This is a system ledger and its account group cannot be changed."
    //     ]);
    //     exit();
    // }

    // Validate new account group exists
    $groupCheck = $pdo->prepare("
        SELECT id
        FROM account_groups
        WHERE id = ? AND is_active = TRUE
    ");
    $groupCheck->execute([$accountGroupId]);
    if (!$groupCheck->fetch()) {
        http_response_code(422);
        echo json_encode([
            "success" => false,
            "message" => "Invalid account group."
        ]);
        exit();
    }

    // Duplicate name check (excluding itself)
    if (strtolower($name) !== strtolower($account['name'])) {
        $dupCheck = $pdo->prepare("
            SELECT id
            FROM accounts
            WHERE LOWER(name) = LOWER(?) AND id != ? AND is_active = TRUE
        ");
        $dupCheck->execute([$name, $id]);
        if ($dupCheck->fetch()) {
            http_response_code(422);
            echo json_encode([
                "success" => false,
                "message" => "A account with this name already exists."
            ]);
            exit();
        }
    }

    // Generate new code if parent has been changed
    $groupChanged = (int)$accountGroupId !== (int)$account['account_group_id'];
    $newCode = $account['code'];

    if ($groupChanged) {
        $groupStmt = $pdo->prepare("
            SELECT id, code
            FROM account_groups
            WHERE id = ? AND is_active = TRUE
        ");
        $groupStmt->execute([$accountGroupId]);
        $group = $groupStmt->fetch();
        $newCode = generateAccountCode($pdo, $group['id'], $group['code'], $id);
    }

    $stmt = $pdo->prepare("
        UPDATE accounts
        SET
            name = ?,
            account_group_id = ?,
            code = ?
        WHERE id = ?
    ");
    $stmt->execute([$name, $accountGroupId, $newCode, $id]);

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Account updated successfully."
    ]);
} catch (PDOException $e) {
    error_log("Update account error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to update ledger."
    ]);
}