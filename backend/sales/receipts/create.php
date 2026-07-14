<?php

require_once '../../server.php';
require_once '../../db.php';
require_once '../../includes/auth.php';

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

$contactId = $data['contact_id'] ?? null;
$invoiceId = $data['invoice_id'] ?? null;
$date = $data['date'] ?? '';
$bankAccountId = $data['bank_account_id'] ?? null;
$amountReceived = (float)($data['amount_received'] ?? 0);
$tdsDeducted = (bool)($data['tds_deducted'] ?? false);
$tdsAmount = (float)$data['tds_amount'] ?? 0;
$fiscalYear = $data['fiscal_year'] ?? '';
$notes = trim($data['notes'] ?? '');

// Validation
$errors = [];

if (!$contactId) $errors[] = "Customer is required.";
if (empty($date)) $errors[] = "Date is required.";
if (!$bankAccountId) $errors[] = "Bank / Cash account is required.";
if ($amountReceived <= 0) $errors[] = "Amount must be greater than zero.";
if ($tdsDeducted) {
    if ($tdsAmount <= 0) $errors[] = "TDS amount is required when customer deducts TDS.";
    if (empty($fiscalYear)) $errors[] = "Fiscal year is required for TDS entries.";
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
    // Validate customer
    $contactStmt = $pdo->prepare("
        SELECT id, name, pan
        FROM contacts
        WHERE id = ? AND type = 'Customer' AND is_active = TRUE
    ");
    $contactStmt->execute([$contactId]);
    $contact = $contactStmt->fetch();

    if (!$contact) {
        http_response_code(422);
        echo json_encode([
            "success" => false,
            "message" => "Customer not found."
        ]);
        exit();
    }

    // Validate bank account
    $bankStmt = $pdo->prepare("
        SELECT ba.id, ba.account_id AS ledger_account_id
        FROM bank_accounts ba
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

    // Fetch system ledger accounts
    $getAccount = function($name) use ($pdo) {
        $stmt = $pdo-> prepare("
            SELECT id
            FROM accounts
            WHERE name = ? AND is_active = TRUE
            LIMIT 1
        ");
        $stmt->execute([$name]);
        $row = $stmt->fetch();
        return $row ? $row['id'] : null;
    };

    $receivableId = $getAccount('Customer Receivable');
    $tdsReceivableId = $getAccount('TDS Receivable');
    $tdsExpenseId = $getAccount('TDS Expense');

    if (!$receivableId) {
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "message" => "System ledger accounts not found."
        ]);
        exit();
    }

    // Validate invoice if provided
    if ($invoiceId) {
        // Validate invoice belongs to this customer
        $invCheck = $pdo->prepare("
            SELECT id, total_amount
            FROM transactions
            WHERE id = ? AND contact_id = ? AND type = 'SALES' AND status = 'APPROVED'
        ");
        $invCheck->execute([$invoiceId, $contactId]);
        $invoice = $invCheck->fetch();
        
        if (!$invoice) {
            http_response_code(422);
            echo json_encode([
                "success" => false,
                "message" => "Invoice not found or not approved for this customer."
            ]);
            exit();
        }
    }

    // Total receivable cleared = cash received + TDS deducted by customer
    $totalCleared = $amountReceived + ($tdsDeducted ? $tdsAmount : 0);

    // Auto-generate ref number
    $countStmt = $pdo->query("
        SELECT COUNT(*) AS cnt
        FROM transactions
        WHERE type = 'RECEIPT'
    ");
    $count = $countStmt->fetch()['cnt'];
    $refNumber = 'REC-' . str_pad($count + 1, 5, '0', STR_PAD_LEFT);

    $pdo->beginTransaction();

    // Insert transaction
    $txStmt = $pdo->prepare("
        INSERT INTO transactions (
            type,
            date,
            ref_number,
            contact_id,
            bank_account_id,
            total_amount,
            tds_amount,
            notes,
            status,
            created_by
        )
        VALUES ('RECEIPT', ?, ?, ?, ?, ?, ?, ?, 'APPROVED', ?)
    ");
    $txStmt->execute([
        $date,
        $refNumber,
        $contactId,
        $bankAccountId,
        $totalCleared,
        $tdsDeducted ? $tdsAmount : 0,
        $notes ?: null,
        $_SESSION['user_id']
    ]);
    $txId = (int) $pdo->lastInsertId();

    // Post ledger entries
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

    $narration = "Receipt {$refNumber} - {$contact['name']}";

    if ($tdsDeducted) {
        // Scenario A: Customer deducted TDS - they paid less cash, rest is TDS credit
        // Bank Dr (cash actually received)
        $ledgerStmt->execute([$txId, $bank['ledger_account_id'], $amountReceived, 0, $date, $narration]);
        // TDS Receivable Dr (TDS they deducted - we can clain this from govt)
        $ledgerStmt->execute([$txId, $tdsReceivableId, $tdsAmount, 0, $date, $narration]);
        // Customer Receivable Cr (full invoice amount cleared)
        $ledgerStmt->execute([$txId, $receivableId, 0, $totalCleared, $date, $narration]);

    } else {
        // Scenario B: Customer did not deduct TDS - we received full amount, but we still owe TDS to the government (TDS Expense on our side)
        // Bank Dr (full amount received)
        $ledgerStmt->execute([$txId, $bank['ledger_account_id'], $amountReceived, 0, $date, $narration]);
        // Customer Receivable Cr (full amount cleared)
        $ledgerStmt->execute([$txId, $receivableId, 0, $amountReceived, $date, $narration]);

        if ($tdsAmount > 0 && $tdsExpenseId) {
            $ledgerStmt->execute([$txId,$tdsExpenseId, $tdsAmount, 0, $date, "TDS Expense On {$narration}"]);
        }
    }

    // Insert TDS entry for reporting / Annexure 13
    if ($tdsAmount > 0) {
        $tdsStmt = $pdo->prepare("
            INSERT INTO tds_entries (
                transaction_id,
                contact_id,
                pan,
                tds_amount,
                tds_type,
                fiscal_year,
                date
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $tdsType = $tdsDeducted ? 'RECEIVABLE' : 'EXPENSE';
        $tdsStmt->execute([
            $txId,
            $contactId,
            $contact['pan'],
            $tdsAmount,
            $tdsType,
            $fiscalYear,
            $date
        ]);
    }

    if ($invoiceId) {
        // How much has already been allocated to this invoice from other receipts
        $allocStmt = $pdo->prepare("
            SELECT COALESCE(SUM(allocated_amount), 0) AS total
            FROM transaction_allocations
            WHERE settled_transaction_id = ?");
        $allocStmt->execute([$invoiceId]);
        $alreadyAllocated = (float)$allocStmt->fetch()['total'];
 
        $invoiceTotal = (float)$invoice['total_amount'];
        $remaining = $invoiceTotal - $alreadyAllocated; // how much is still unpaid on this invoice
        $toAllocate = min($totalCleared, $remaining);   // never allocate more than what's due
 
        if ($toAllocate > 0) {
            $pdo->prepare("
                INSERT INTO transaction_allocations (
                    settling_transaction_id,
                    settled_transaction_id,
                    allocated_amount
                )
                VALUES (?, ?, ?)
            ")->execute([$txId, $invoiceId, $toAllocate]);
        }
    }

    $pdo->commit();

    http_response_code(201);
    echo json_encode([
        "success" => true,
        "message" => "Receipt recorded successfully.",
        "data" => [
            "id" => $txId,
            "ref_number" => $refNumber,
            "total_cleared" => $totalCleared
        ]
    ]);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log("Create receipt error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to record receipt."
    ]);
}
