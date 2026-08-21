<?php

require_once '../../server.php';
require_once '../../db.php';
require_once '../../includes/auth.php';
require_once '../../includes/audit.php';
require_once '../../includes/payment_mode.php';

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
// $tdsAmount = (float)$data['tds_amount'] ?? 0;
$fiscalYear = $data['fiscal_year'] ?? '';
$notes = trim($data['notes'] ?? '');
$paymentMode = $data['payment_mode'] ?? '';
$paymentRef = trim($data['payment_ref'] ?? '');

// Validation
$errors = [];

if (!$contactId) $errors[] = "Customer is required.";
if (empty($date)) $errors[] = "Date is required.";
if (!$bankAccountId) $errors[] = "Bank / Cash account is required.";
if (!in_array($paymentMode, validPaymentModes(), true)) $errors[] = "A valid payment mode is required.";
if ($amountReceived <= 0) $errors[] = "Amount must be greater than zero.";
if ($tdsDeducted) {
    // if ($tdsAmount <= 0) $errors[] = "TDS amount is required when customer deducts TDS.";
    if (!$invoiceId) $errors[] = "TDS can only be applied against a specific invoice.";
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
        SELECT id, name, pan, tds_deducted
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
        SELECT ba.id, ba.account_id AS ledger_account_id, ba.account_type
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

    $modeErrors = validatePaymentModeAndRef($paymentMode, $paymentRef, $bank['account_type']);
    if ($modeErrors) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => implode(' ', $modeErrors)
        ]);
        exit();
    }

    // Fetch system ledger accounts
    $getAccount = function($name) use ($pdo) {
        $stmt = $pdo->prepare("
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
    $tdsPayableId = $getAccount('TDS Payable');

    if (!$receivableId) {
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "message" => "System ledger accounts not found."
        ]);
        exit();
    }

    // Validate invoice if provided, and pull sub_total so we can compute TDS ourselves
    $invoice = null;
    $alreadyAllocated = 0.0;
    if ($invoiceId) {
        $invCheck = $pdo->prepare("
            SELECT id, total_amount, sub_total
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

        $allocStmt = $pdo->prepare("
            SELECT COALESCE(SUM(allocated_amount), 0) AS total
            FROM transaction_allocations
            WHERE settled_transaction_id = ?
        ");
        $allocStmt->execute([$invoiceId]);
        $alreadyAllocated = (float)$allocStmt->fetch()['total'];
    }

    $tdsAmount = 0.0;
    if ($tdsDeducted) {
        if (!$contact['tds_deducted']) {
            http_response_code(422);
            echo json_encode([
                "success" => false,
                "message" => "This customer is not flagged to deduct TDS."
            ]);
            exit();
        }
        if ($alreadyAllocated > 0.009) {
            http_response_code(422);
            echo json_encode([
                "success" => false,
                "message" => "TDS only applies on the first settlement of an invoice; this invoice already has settlements against it."
            ]);
            exit();
        }
        $tdsAmount = round(((float)$invoice['sub_total']) * 0.015, 2);
    }

    // Total receivable cleared = cash received + TDS deducted by customer
    // $totalCleared = $amountReceived + ($tdsDeducted ? $tdsAmount : 0);
    $totalCleared = round($amountReceived + $tdsAmount, 2);

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
            payment_mode,
            payment_ref,
            total_amount,
            tds_amount,
            notes,
            status,
            created_by
        )
        VALUES ('RECEIPT', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'APPROVED', ?)
    ");
    $txStmt->execute([
        $date,
        $refNumber,
        $contactId,
        $bankAccountId,
        $paymentMode,
        $paymentRef ?: null,
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
        // TDS Receivable Dr (TDS they deducted - we can claim this from govt)
        $ledgerStmt->execute([$txId, $tdsReceivableId, $tdsAmount, 0, $date, $narration]);
        // Customer Receivable Cr (full invoice amount cleared)
        $ledgerStmt->execute([$txId, $receivableId, 0, $totalCleared, $date, $narration]);

    } else {
        // Scenario B: no TDS on this receipt at all — plain cash/bank receipt
        // Bank Dr (full amount received)
        $ledgerStmt->execute([$txId, $bank['ledger_account_id'], $amountReceived, 0, $date, $narration]);
        // Customer Receivable Cr (full amount cleared)
        $ledgerStmt->execute([$txId, $receivableId, 0, $amountReceived, $date, $narration]);
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
            VALUES (?, ?, ?, ?, 'RECEIVABLE', ?, ?)
        ");
        $tdsStmt->execute([
            $txId,
            $contactId,
            $contact['pan'],
            $tdsAmount,
            $fiscalYear,
            $date
        ]);
    }

    if ($invoiceId) {
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

    logAudit(
        $pdo,
        (int) $_SESSION['user_id'],
        'CREATE',
        'transactions',
        $txId,
        null,
        ['type' => 'RECEIPT', 'ref_number' => $refNumber, 'contact_id' => (int)$contactId, 'bank_account_id' => (int)$bankAccountId, 'payment_mode' => $paymentMode, 'payment_ref' => $paymentRef ?: null, 'total_amount' => $totalCleared, 'tds_amount' => $tdsDeducted ? $tdsAmount : 0, 'invoice_id' => $invoiceId ? (int)$invoiceId : null]
    );

    http_response_code(201);
    echo json_encode([
        "success" => true,
        "message" => "Receipt recorded successfully.",
        "data" => [
            "id" => $txId,
            "ref_number" => $refNumber,
            "total_cleared" => $totalCleared,
            "tds_amount" => $tdsAmount
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
