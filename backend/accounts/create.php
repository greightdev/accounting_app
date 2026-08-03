<?php

require_once "../server.php";
require_once "../db.php";
require_once "../includes/auth.php";
require_once "../includes/helpers.php";

requireRole(['admin', 'accountant']);

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
$accountGroupId = $data['account_group_id'] ?? null;

// Validation
$errors = [];

if ($name === '') $errors[] = "Account name is required.";
if (!$accountGroupId) $errors[] = "Account group is required.";

if ($errors) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => implode(' ', $errors)
    ]);
    exit();
}

try {
    // Confirm the account group actually exists
    $groupCheck = $pdo->prepare("
        SELECT id, name, code
        FROM account_groups
        WHERE id = ?
    ");
    $groupCheck->execute([$accountGroupId]);
    $group = $groupCheck->fetch();

    if (!$group) {
        http_response_code(422);
        echo json_encode([
            "success" => false,
            "message" => "Invalid account group."
        ]);
        exit();
    }

    $isBankOrCashGroup = in_array($group['name'], ['Bank', 'Cash'], true);

    $accountCode = generateAccountCode($pdo, $group['id'], $group['code']);

    // Prevent duplicate account names
    $dupCheck = $pdo->prepare("
        SELECT id
        FROM accounts
        WHERE LOWER(name) = LOWER(?) AND is_active = TRUE
    ");
    $dupCheck->execute([$name]);
    if ($dupCheck->fetch()) {
        http_response_code(422);
        echo json_encode([
            "success" => false,
            "message" => "An account with this name already exists."
        ]);
        exit();
    }

    $pdo->beginTransaction();

    $stmt = $pdo->prepare("
        INSERT INTO accounts (
            account_group_id,
            name,
            code,
            is_system
        )
        VALUES (?, ?, ?, FALSE)
    ");
    $stmt->execute([
        $accountGroupId,
        $name,
        $accountCode
    ]);
    $newId = (int) $pdo->lastInsertId();

    if ($isBankOrCashGroup) {
        $accountType = $group['name'] === 'Bank' ? 'BANK' : 'CASH';

        $bankStmt = $pdo->prepare("
            INSERT INTO bank_accounts (account_id, name, account_type, opening_balance)
            VALUES (?, ?, ?, 0)
        ");
        $bankStmt->execute([
            $newId,
            $name,
            $accountType
        ]);
    }

    $pdo->commit();

    http_response_code(201);
    echo json_encode([
        "success" => true,
        "message" => "Account created successfully.",
        "data" => [
            "id" => $newId,
            "code" => $accountCode
        ]
    ]);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log("Create account error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to create account."
    ]);
}
