<?php

require_once '../server.php';
require_once '../db.php';
require_once '../includes/auth.php';
require_once '../includes/audit.php';

requireRole(['admin']);

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

$id = isset($data['id']) ? (int) $data['id'] : 0;

if ($id <= 0) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Transaction ID is required."
    ]);
    exit();
}

try {
    $stmt = $pdo->prepare("
        SELECT 
            t.id,
            t.type,
            t.date,
            t.bank_account_id,
            t.contra_account_id,
            t.total_amount,
            ba.account_id AS bank_ledger_account_id,
            ba.name AS bank_account_name
        FROM transactions t
        JOIN bank_accounts ba ON ba.id = t.bank_account_id
        WHERE t.id = ? AND t.type IN ('BANK_DEP', 'BANK_WITH') AND t.status = 'DRAFT'
    ");
    $stmt->execute([$id]);
    $tx = $stmt->fetch();

    if (!$tx) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Transaction not found."
        ]);
        exit();
    }

    $pdo->beginTransaction();

    $pdo->prepare("
        UPDATE transactions
        SET status = 'APPROVED'
        WHERE id = ?
    ")->execute([$id]);

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
    $narration = $tx['type'] === 'BANK_DEP'
        ? "Bank Deposit - {$tx['bank_account_name']}"
        : "Bank Withdrawal - {$tx['bank_account_name']}";

    if ($tx['type'] === 'BANK_DEP') {
        $ledgerStmt->execute([$id, $tx['bank_ledger_account_id'], $tx['total_amount'], 0, $tx['date'], $narration]);
        $ledgerStmt->execute([$id, $tx['contra_account_id'], 0, $tx['total_amount'], $tx['date'], $narration]);
    } else {
        $ledgerStmt->execute([$id, $tx['contra_account_id'], $tx['total_amount'], 0, $tx['date'], $narration]);
        $ledgerStmt->execute([$id, $tx['bank_ledger_account_id'], 0, $tx['total_amount'], $tx['date'], $narration]);
    }

    $pdo->commit();

    logAudit(
        $pdo,
        (int) $_SESSION['user_id'],
        'UPDATE',
        'transactions',
        $id,
        ['status' => 'DRAFT'],
        ['status' => 'APPROVED']
    );

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => ($tx['type'] === 'BANK_DEP' ? "Deposit" : "Withdrawal") . " approved successfully."
    ]);

} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log("Approve banking transaction error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to approve transaction."
    ]);
}