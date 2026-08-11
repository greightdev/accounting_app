<?php

require_once '../server.php';
require_once '../db.php';
require_once '../includes/auth.php';
require_once '../includes/audit.php';

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

if (!$data || empty($data['id'])) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Transaction id is required."
    ]);
    exit();
}

$id = (int)$data['id'];
$voidReason = trim($data['void_reason'] ?? '');

// Types that post ledger entries on creation and need reversal on void
const TYPES_WITH_LEDGER = ['SALES', 'PURCHASE', 'RECEIPT', 'PAYMENT', 'BANK_DEP', 'BANK_WITH', 'TDS_PAYMENT', 'JOURNAL'];

// Types where DRAFT status means no ledger entries were posted yet
const TYPES_WITH_DRAFT = ['SALES', 'PURCHASE', 'BANK_DEP', 'BANK_WITH', 'JOURNAL', 'TDS_PAYMENT'];

try {
    $existing = $pdo->prepare("
        SELECT id, type, status, date, ref_number
        FROM transactions
        WHERE id = ?
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

    if ($tx['status'] === 'VOID') {
        http_response_code(409);
        echo json_encode([
            "success" => false,
            "message" => "Transaction {$tx['ref_number']} is already voided."
        ]);
        exit();
    }

    $pdo->beginTransaction();

    // Mark transaction as void
    $void = $pdo->prepare("
        UPDATE transactions
        SET status = 'VOID', voided_by = ?, voided_at = NOW(), void_reason = ?
        WHERE id = ?
    ");
    $void->execute([$_SESSION['user_id'], $voidReason ?: null, $id]);

    // Post reversal ledger entries if this transaction type posts to the ledger and it was not a DRAFT
    $wasDraft = in_array($tx['type'], TYPES_WITH_DRAFT, true) && $tx['status'] === 'DRAFT';

    if (in_array($tx['type'], TYPES_WITH_LEDGER, true) && !$wasDraft) {
        $entries = $pdo->prepare("
            SELECT account_id, debit, credit, narration
            FROM ledger_entries
            WHERE transaction_id = ? AND (debit > 0 OR credit > 0)
        ");
        $entries->execute([$id]);
        $originalEntries = $entries->fetchAll();

        if (!empty($originalEntries)) {
            $reversalStmt = $pdo->prepare("
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

            foreach ($originalEntries as $entry) {
                // Swap debit and credit to cancel out the original posting
                $reversalStmt->execute([
                    $id,
                    $entry['account_id'],
                    $entry['credit'],
                    $entry['debit'],
                    $tx['date'],
                    "VOID: " . $entry['narration'],
                ]);
            }
        }
    }

    // Type-specific cleanup after voiding
    switch ($tx['type']) {

        case 'RECEIPT':
        case 'PAYMENT':
            // Remove allocations made by this receipt/payment
            $pdo->prepare("
                DELETE FROM transaction_allocations
                WHERE settling_transaction_id = ?
            ")->execute([$id]);
            
            // Unmark any TDS entries linked to this transaction
            $pdo->prepare("
                UPDATE tds_entries
                SET is_paid = FALSE, paid_via_tx_id = NULL
                WHERE transaction_id = ?
            ")->execute([$id]);
            break;

        case 'TDS_PAYMENT':
            // Unmark all TDS entries that were settled by this payment
            $pdo->prepare("
                UPDATE tds_entries
                SET is_paid = FALSE, paid_via_tx_id = NULL
                WHERE paid_via_tx_id = ?
            ")->execute([$id]);
            break;

        case 'SALES':
        case 'PURCHASE':
            // Line items stay in transaction_items for audit trail
            break;
    }

    $pdo->commit();

    logAudit(
        $pdo,
        (int) $_SESSION['user_id'],
        'VOID',
        'transactions',
        $id,
        ['status' => $tx['status']],
        ['status' => 'VOID', 'void_reason' => $voidReason ?: null]
    );

    $label = match($tx['type']) {
        'SALES' => 'Invoice',
        'PURCHASE' => 'Bill',
        'RECEIPT' => 'Receipt',
        'PAYMENT' => 'Payment',
        'BANK_DEP' => 'Deposit',
        'BANK_WITH' => 'Withdrawal',
        'TDS_PAYMENT' => 'TDS Payment',
        'JOURNAL' => 'Journal Entry',
        default => 'Transaction',
    };

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "{$label} {$tx['ref_number']} voided successfully.",
        "data" => [
            "id" => $id,
            "ref_number" => $tx['ref_number'],
            "type" => $tx['type'],
            "was_draft" => $wasDraft,
            "ledger_reversed" => !$wasDraft && in_array($tx['type'], TYPES_WITH_LEDGER, true),
        ]
    ]);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log("Generic void error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to void transaction."
    ]);
}