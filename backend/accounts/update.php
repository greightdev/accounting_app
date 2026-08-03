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
        "message" => "No input received."
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

    // System ledgers
    if ($account['is_system'] && $name !== $account['name']) {
        http_response_code(403);
        echo json_encode([
            "success" => false,
            "message" => "This is a system ledger and its name cannot be changed."
        ]);
        exit();
    }

    if ($account['is_system'] && (int)$accountGroupId !== (int)$account['account_group_id']) {
        http_response_code(403);
        echo json_encode([
            "success" => false,
            "message" => "This is a system ledger and its account group cannot be changed."
        ]);
        exit();
    }

    // Validate new account group exists
    $groupStmt = $pdo->prepare("
        SELECT id, name, code
        FROM account_groups
        WHERE id = ? AND is_active = TRUE
    ");
    $groupStmt->execute([$accountGroupId]);
    $newGroup = $groupStmt->fetch();

    if (!$newGroup) {
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
                "message" => "An account with this name already exists."
            ]);
            exit();
        }
    }

    // Generate new code if parent has been changed
    $groupChanged = (int)$accountGroupId !== (int)$account['account_group_id'];
    $newCode = $account['code'];

    if ($groupChanged) {
        $newCode = generateAccountCode($pdo, $newGroup['id'], $newGroup['code'], $id);
    }

    $wasBankOrCash = false;
    $oldGroupStmt = $pdo->prepare("
        SELECT name
        FROM account_groups
        WHERE id = ?
    ");
    $oldGroupStmt->execute([$account['account_group_id']]);
    $oldGroup = $oldGroupStmt->fetch();

    if ($oldGroup && in_array($oldGroup['name'], ['Bank', 'Cash'], true)) {
        $wasBankOrCash = true;
    }

    $isNowBankOrCash = in_array($newGroup['name'], ['Bank', 'Cash'], true);

    $pdo->beginTransaction();

    $stmt = $pdo->prepare("
        UPDATE accounts
        SET
            name = ?,
            account_group_id = ?,
            code = ?
        WHERE id = ?
    ");
    $stmt->execute([$name, $accountGroupId, $newCode, $id]);

    // Existing bank_accounts row for this ledger account, if any
    $bankRowStmt = $pdo->prepare("
        SELECT id
        FROM bank_accounts
        WHERE account_id = ? AND is_active = TRUE
    ");
    $bankRowStmt->execute([$id]);
    $bankRow = $bankRowStmt->fetch();

    if ($isNowBankOrCash) {
        $accountType = $newGroup['name'] === 'Bank' ? 'BANK' : 'CASH';

        if ($bankRow) {
            $pdo->prepare("
                UPDATE bank_accounts
                SET name = ?, account_type = ?
                WHERE id = ?
            ")->execute([$name, $accountType, $bankRow['id']]);
        } else {
            $pdo->prepare("
                INSERT INTO bank_accounts (account_id, name, account_type, opening_balance)
                VALUES (?, ?, ?, 0)
            ")->execute([$id, $name, $accountType]);
        }
    } elseif ($wasBankOrCash && $bankRow) {
        // Moving OUT of Bank/Cash — block if this account is still in active use anywhere.
        $ledgerUsage = $pdo->prepare("SELECT id FROM ledger_entries WHERE account_id = ? LIMIT 1");
        $ledgerUsage->execute([$id]);

        $bankUsage = $pdo->prepare("
            SELECT id FROM transactions WHERE bank_account_id = ? AND status != 'VOID' LIMIT 1
        ");
        $bankUsage->execute([$bankRow['id']]);

        if ($ledgerUsage->fetch() || $bankUsage->fetch()) {
            $pdo->rollBack();
            http_response_code(409);
            echo json_encode([
                "success" => false,
                "message" => "This account has existing transactions and cannot be moved out of the Bank/Cash group."
            ]);
            exit();
        }

        $pdo->prepare("UPDATE bank_accounts SET is_active = FALSE WHERE id = ?")->execute([$bankRow['id']]);
    }

    $pdo->commit();

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Account updated successfully."
    ]);

} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log("Update account error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to update account."
    ]);
}