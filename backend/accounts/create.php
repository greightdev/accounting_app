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
$openingBalance = $data['opening_balance'] ?? 0;
$openingBalanceType = $data['opening_balance_type'] ?? null;
$openingDate = $data['opening_date'] ?? null;

// Validation
$errors = [];

if ($name === '') $errors[] = "Account name is required.";
if (!$accountGroupId) $errors[] = "Account group is required.";
if ($openingBalance > 0 && !in_array($openingBalanceType, ['DEBIT', 'CREDIT'], true)) {
    $errors[] = "Opening balance type must be DEBIT or CREDIT when an opening balance is set.";
}
if ($openingBalance > 0 && !$openingDate) {
    $errors[] = "Opening date is required when an opening balance is set.";
}

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
        SELECT id, code
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

    $stmt = $pdo->prepare("
        INSERT INTO accounts (
            account_group_id,
            name,
            code,
            opening_balance,
            opening_balance_type,
            opening_date,
            is_system
        )
        VALUES (?, ?, ?, ?, ?, ?, FALSE)
        RETURNING id
    ");
    $stmt->execute([
        $accountGroupId,
        $name,
        $accountCode,
        $openingBalance,
        $openingBalanceType,
        $openingDate
    ]);
    $newId = $stmt->fetch()['id'];

    // If an opening balance was given, post the offsetting entry to "Opening Balance" equity account
    if ($openingBalance > 0) {
        $obAccount = $pdo->query("
            SELECT id
            FROM accounts
            WHERE name = 'Opening Balance'
            LIMIT 1
        ")->fetch();

        if ($obAccount) {
            // Insert a JOURNAL transaction representing the opening balance
            $txStmt = $pdo->prepare("
                INSERT INTO transactions (
                    type,
                    date,
                    ref_number,
                    total_amount,
                    notes,
                    created_by
                )
                VALUES ('JOURNAL', ?, ?, ?, ?, ?)
                RETURNING id
            ");
            $refNumber = 'OB-' . $newId . '-' . time();
            $txStmt->execute([
                $openingDate,
                $refNumber,
                $openingBalance,
                "Opening balance for account: $name",
                $_SESSION['user_id'],
            ]);
            $txId = $txStmt->fetch()['id'];

            $accountStmt = $pdo->prepare("
                INSERT INTO account_entries (
                    transaction_id,
                    account_id,
                    debit, credit,
                    date,
                    narration
                )
                VALUES (?, ?, ?, ?, ?, ?)
            ");

            if ($openingBalanceType === 'DEBIT') {
                $accountStmt->execute([$txId, $newId, $openingBalance, 0, $openingDate, "Opening balance"]);
                $accountStmt->execute([$txId, $obAccount['id'], 0, $openingBalance, $openingDate, "Opening balance offset"]);
            } else {
                $accountStmt->execute([$txId, $newId, 0, $openingBalance, $openingDate, "Opening balance"]);
                $accountStmt->execute([$txId, $obAccount['id'], $openingBalance, 0, $openingDate, "Opening balance offset"]);
            }
        }
    }

    http_response_code(201);
    echo json_encode([
        "success" => true,
        "message" => "Account created successfully.",
        "data" => ["id" => $newId]
    ]);
} catch (PDOException $e) {
    error_log("Create account error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Failed to create account."]);
}
