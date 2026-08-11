<?php

require_once '../server.php';
require_once '../db.php';
require_once '../includes/auth.php';
require_once '../includes/audit.php';

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
$date = $data['date'] ?? '';
$bankAccountId = $data['bank_account_id'] ?? null;
$accountId = $data['account_id'] ?? null;
$amount = $data['amount'] ?? 0;
$notes = trim($data['notes'] ?? '');

// Validation
$errors = [];

if ($id <= 0) $errors[] = "A valid transaction ID is required.";
if (empty($date)) $errors[] = "Date is required.";
if (!$bankAccountId) $errors[] = "Bank account is required.";
if (!$accountId) $errors[] = "Offsetting account (Cash or Expense) is required.";
if ((float)$amount <= 0) $errors[] = "Amount must be greater than zero.";

if ($errors) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => implode(' ', $errors)
    ]);
    exit();
}

try {
    // Check if it exists
    $existing = $pdo->prepare("
        SELECT id, type, status, date, bank_account_id, contra_account_id, total_amount, notes
        FROM transactions
        WHERE id = ? AND type IN ('BANK_DEP','BANK_WITH')
    ");
    $existing->execute([$id]);
    $tx = $existing->fetch();

    if (!$tx) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Transaction not found."
        ]);
        exit();
    }

    if ($tx['status'] !== 'DRAFT') {
        http_response_code(403);
        echo json_encode([
            "success" => false,
            "message" => "Only draft transactions can be edited."
        ]);
        exit();
    }
    
    $bankStmt = $pdo->prepare("
        SELECT account_id
        FROM bank_accounts
        WHERE id = ? AND is_active = TRUE"
    );
    $bankStmt->execute([$bankAccountId]);
    $bankLedgerId = $bankStmt->fetchColumn();
    
    if ((int)$bankLedgerId === (int)$accountId) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "Source and destination accounts must be different."
        ]);
        exit();
    }
            
    $pdo->beginTransaction();  

    $pdo->prepare("
        UPDATE transactions
        SET date = ?, bank_account_id = ?, contra_account_id = ?, total_amount = ?, notes = ?
        WHERE id = ?
    ")->execute([$date, $bankAccountId, $accountId, $amount, $notes ?: null, $id]);

    $pdo->commit();

    logAudit(
        $pdo,
        (int) $_SESSION['user_id'],
        'UPDATE',
        'transactions',
        $id,
        ['date' => $tx['date'], 'bank_account_id' => (int)$tx['bank_account_id'], 'account_id' => (int)$tx['contra_account_id'], 'amount' => (float)$tx['total_amount'], 'notes' => $tx['notes']],
        ['date' => $date, 'bank_account_id' => (int)$bankAccountId, 'account_id' => (int)$accountId, 'amount' => (float)$amount, 'notes' => $notes ?: null]
    );

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Transaction updated successfully."
    ]);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log("Update banking transaction error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to update transaction."
    ]);
}