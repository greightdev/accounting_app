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
$billId = $data['bill_id'] ?? null;
$date = $data['date'] ?? '';
$bankAccountId = $data['bank_account_id'] ?? null;
$amountPaid = (float)($data['amount_paid'] ?? 0);
$tdsDeducted = (bool)($data['tds_deducted'] ?? false);
// $tdsAmount = (float)$data['tds_amount'] ?? 0;
$fiscalYear = $data['fiscal_year'] ?? '';
$notes = trim($data['notes'] ?? '');
$paymentMode = $data['payment_mode'] ?? '';
$paymentRef = trim($data['payment_ref'] ?? '');

// Validation
$errors = [];

if (!$contactId) $errors[] = "Vendor is required.";
if (empty($date)) $errors[] = "Date is required.";
if (!$bankAccountId) $errors[] = "Bank / Cash account is required.";
if (!in_array($paymentMode, validPaymentModes(), true)) $errors[] = "A valid payment mode is required.";
if ($amountPaid <= 0) $errors[] = "Amount must be greater than zero.";
if ($tdsDeducted) {
    // if ($tdsAmount <= 0) $errors[] = "TDS amount is required when deducting TDS from vendor.";
    if (!$billId) $errors[] = "TDS can only be applied against a specific bill.";
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
    // Validate vendor
    $contactStmt = $pdo->prepare("
        SELECT id, name, pan, tds_deducted
        FROM contacts
        WHERE id = ? AND type = 'Vendor' AND is_active = TRUE
    ");
    $contactStmt->execute([$contactId]);
    $contact = $contactStmt->fetch();

    if (!$contact) {
        http_response_code(422);
        echo json_encode([
            "success" => false,
            "message" => "Vendor not found."
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

    $payableId = $getAccount('Vendor Payable');
    $tdsPayableId = $getAccount('TDS Payable');

    if (!$payableId) {
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "message" => "System ledger accounts not found."
        ]);
        exit();
    }

    if ($tdsDeducted && !$tdsPayableId) {
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "message" => "TDS Payable ledger not found — cannot record a TDS-deducted payment."
        ]);
        exit();
    }

    // Validate bill if provided, and pull sub_total so we can compute TDS ourselves
    $bill = null;
    $alreadyAllocated = 0.0;
    if ($billId) {
        $billCheck = $pdo->prepare("
            SELECT id, total_amount, sub_total
            FROM transactions
            WHERE id = ? AND contact_id = ? AND type = 'PURCHASE' AND status = 'APPROVED'
        ");
        $billCheck->execute([$billId, $contactId]);
        $bill = $billCheck->fetch();

        if (!$bill) {
            http_response_code(422);
            echo json_encode([
                "success" => false,
                "message" => "Bill not found or not approved for this vendor."
            ]);
            exit();
        }

        $allocStmt = $pdo->prepare("
            SELECT COALESCE(SUM(allocated_amount), 0) AS total
            FROM transaction_allocations
            WHERE settled_transaction_id = ?
        ");
        $allocStmt->execute([$billId]);
        $alreadyAllocated = (float)$allocStmt->fetch()['total'];
    }

    $tdsAmount = 0.0;
    if ($tdsDeducted) {
        if (!$contact['tds_deducted']) {
            http_response_code(422);
            echo json_encode([
                "success" => false,
                "message" => "This vendor is not flagged as TDS deductible."
            ]);
            exit();
        }
        if ($alreadyAllocated > 0.009) {
            http_response_code(422);
            echo json_encode([
                "success" => false,
                "message" => "TDS only applies on the first settlement of a bill; this bill already has settlements against it."
            ]);
            exit();
        }
        $tdsAmount = round(((float)$bill['sub_total']) * 0.015, 2);
    }

    // Total payable cleared = cash paid + TDS we deducted
    $totalCleared = round($amountPaid + $tdsAmount, 2);

    // Auto-generate ref number
    $countStmt = $pdo->query("
        SELECT COUNT(*) AS cnt
        FROM transactions
        WHERE type = 'PAYMENT'
    ");
    $count = $countStmt->fetch()['cnt'];
    $refNumber = 'PAY-' . str_pad($count + 1, 5, '0', STR_PAD_LEFT);

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
        VALUES ('PAYMENT', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'APPROVED', ?)
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

    $narration = "Vendor Payment {$refNumber} - {$contact['name']}";

    if ($tdsDeducted) {
        // Scenario A: We deduct TDS from vendor payment
        // Vendor Payable Dr (full bill amount cleared)
        $ledgerStmt->execute([$txId, $payableId, $totalCleared, 0, $date, $narration]);
        // Bank Cr (only what we actually paid out)
        $ledgerStmt->execute([$txId, $bank['ledger_account_id'], 0, $amountPaid, $date, $narration]);
        // TDS Payable Cr (TDS we owe to government)
        $ledgerStmt->execute([$txId, $tdsPayableId, 0, $tdsAmount, $date, $narration]);
    } else {
        // Scenario B: No TDS deducted — pay vendor the full amount
        // Vendor Payable Dr
        $ledgerStmt->execute([$txId, $payableId, $amountPaid, 0, $date, $narration]);
        // Bank Cr
        $ledgerStmt->execute([$txId, $bank['ledger_account_id'], 0, $amountPaid, $date, $narration]);
    }

    // Insert TDS entry for Annexure 13
    if ($tdsDeducted && $tdsAmount > 0) {
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
            VALUES (?, ?, ?, ?, 'PAYABLE', ?, ?)
        ");
        $tdsStmt->execute([
            $txId,
            $contactId,
            $contact['pan'],
            $tdsAmount,
            $fiscalYear,
            $date,
        ]);
    }

    if ($billId && $bill) {
        $billTotal = (float)$bill['total_amount'];
        $remaining = $billTotal - $alreadyAllocated; // how much is still unpaid on this bill
        $toAllocate = min($totalCleared, $remaining); // never allocate more than what's due
 
        if ($toAllocate > 0) {
            $pdo->prepare("
                INSERT INTO transaction_allocations (
                    settling_transaction_id,
                    settled_transaction_id,
                    allocated_amount
                )
                VALUES (?, ?, ?)
            ")->execute([$txId, $billId, $toAllocate]);
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
        ['type' => 'PAYMENT', 'ref_number' => $refNumber, 'contact_id' => (int)$contactId, 'bank_account_id' => (int)$bankAccountId, 'payment_mode' => $paymentMode, 'payment_ref' => $paymentRef ?: null, 'total_amount' => $totalCleared, 'tds_amount' => $tdsDeducted ? $tdsAmount : 0, 'bill_id' => $billId ? (int)$billId : null]
    );

    http_response_code(201);
    echo json_encode([
        "success" => true,
        "message" => "Payment recorded successfully.",
        "data" => [
            "id" => $txId,
            "ref_number" => $refNumber,
            "tds_amount" => $tdsAmount
        ]
    ]);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log("Create payment error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to record payment."
    ]);
}
