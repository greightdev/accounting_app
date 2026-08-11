<?php

require_once '../server.php';
require_once '../db.php';
require_once '../includes/auth.php';
require_once '../includes/audit.php';

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

$type = $data['type'] ?? '';    // 'BANK_DEP' OR 'BANK_WITH'
$date = $data['date'] ?? '';
$bankAccountId = $data['bank_account_id'] ?? null;
$accountId = $data['account_id'] ?? null;
$amount = $data['amount'] ?? 0;
$notes = trim($data['notes'] ?? '');
$status = $data['status'] ?? 'DRAFT';

if ($_SESSION['role'] !== 'admin') {
    $status = 'DRAFT';
}

$validStatuses = ['DRAFT', 'APPROVED'];

// Validation
$errors = [];

if (!in_array($type, ['BANK_DEP', 'BANK_WITH'], true)) {
    $errors[] = "Type must be BANK_DEP or BANK_WITH.";
}
if (empty($date)) $errors[] = "Date is required.";
if (!$bankAccountId) $errors[] = "Bank account is required.";
if (!$accountId) $errors[] = "Offsetting account (Cash or Expense) is required.";
if ((float)$amount <= 0) $errors[] = "Amount must be greater than zero.";
if (!in_array($status, $validStatuses, true)) $errors[] = "Status must be DRAFT or APPROVED.";

if ($errors) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => implode(' ', $errors)
    ]);
    exit();
}

try {
    // Fetch the bank account's linked ledger account id
    $bankStmt = $pdo->prepare("
        SELECT ba.id, ba.account_id AS ledger_account_id, a.name AS account_name
        FROM bank_accounts ba
        JOIN accounts a ON a.id = ba.account_id
        WHERE ba.id = ? AND ba.is_active = TRUE
    ");
    $bankStmt->execute([$bankAccountId]);
    $bank = $bankStmt->fetch();

    if (!$bank) {
        http_response_code(422);
        echo json_encode([
            "success" => false,
            "message" => "Bank account not found."
        ]);
        exit();
    }

    // Validate ofsetting account
    $accStmt = $pdo->prepare("
        SELECT id, name
        FROM accounts
        WHERE id = ? AND is_active = TRUE
    ");
    $accStmt->execute([$accountId]);
    $offsetAccount = $accStmt->fetch();

    if (!$offsetAccount) {
        http_response_code(422);
        echo json_encode([
            "success" => false,
            "message" => "Offsetting account not found."
        ]);
        exit();
    }

    // Validate source and destination are not same
    if ((int)$bank['ledger_account_id'] === (int)$accountId) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "Source and destination accounts must be different."
        ]);
        exit();
    }

    // Auto generate ref number
    $countStmt = $pdo->prepare("
        SELECT COUNT(*) AS cnt
        FROM transactions
        WHERE type = ?
    ");
    $countStmt->execute([$type]);
    $count = $countStmt->fetch()['cnt'];
    $prefix = $type === 'BANK_DEP' ? 'DEP' : 'WITH';
    $refNumber = $prefix . '-' . str_pad($count + 1, 5, '0', STR_PAD_LEFT);

    $pdo->beginTransaction();

    // Insert transaction
    $txStmt = $pdo->prepare("
        INSERT INTO transactions (
            type,
            date,
            ref_number,
            bank_account_id,
            contra_account_id,
            total_amount,
            notes,
            status,
            created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $txStmt->execute([
        $type,
        $date,
        $refNumber,
        $bankAccountId,
        $accountId,
        $amount,
        $notes ?: null,
        $status,
        $_SESSION['user_id']
    ]);
    $txId = (int) $pdo->lastInsertId();

    // Post double entry ledger entries only for APPROVED invoices
    if ($status === 'APPROVED') {
        $ledgerStmt = $pdo->prepare("
            INSERT INTO ledger_entries (
                transaction_id,
                account_id,
                debit,
                credit,
                date,
                narration
            )
            VALUES (?, ?, ?, ?, ?, ?)
        ");
    
        $narration = $type === 'BANK_DEP'
            ? "Bank Deposit - {$bank['account_name']}"
            : "Bank Withdrawal - {$bank['account_name']}";
    
        if ($type === 'BANK_DEP') {
            // Deposit: Cash → Bank
            // Bank Account Dr, Cash/Source Account Cr
            $ledgerStmt->execute([$txId, $bank['ledger_account_id'], $amount, 0, $date, $narration]);
            $ledgerStmt->execute([$txId, $accountId, 0, $amount, $date, $narration]);
        } else {
            // Withdrawal: Bank → Cash/Expense
            // Cash/Expense Account Dr, Bank Account Cr
            $ledgerStmt->execute([$txId, $accountId, $amount, 0, $date, $narration]);
            $ledgerStmt->execute([$txId, $bank['ledger_account_id'], 0, $amount, $date, $narration]);
        }
    }

    $pdo->commit();

    logAudit(
        $pdo,
        (int) $_SESSION['user_id'],
        'CREATE',
        'transactions',
        $txId,
        null,
        ['type' => $type, 'ref_number' => $refNumber, 'bank_account_id' => (int)$bankAccountId, 'account_id' => (int)$accountId, 'amount' => (float)$amount, 'status' => $status]
    );

    http_response_code(201);
    echo json_encode([
        "success" => true,
        "message" => ($type === 'BANK_DEP' ? "Deposit" : "Withdrawal") . " recorded successfully.",
        "data" => [
            "id" => $txId,
            "ref_number" => $refNumber
        ]
    ]);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log("Create banking transaction error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to record transaction."
    ]);
}
