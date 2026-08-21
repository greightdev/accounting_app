<?php

require_once '../server.php';
require_once '../db.php';
require_once '../includes/auth.php';
require_once '../includes/audit.php';
require_once '../includes/payment_mode.php';

requireRole(['admin', 'accountant']);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Method not allowed"
    ]);
    exit();
}

$data = json_decode(file_get_contents('php://input'), true);

if (!$data) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "No input received."
    ]);
    exit();
}

$date = $data['date'] ?? '';
$bankAccountId = $data['bank_account_id'] ?? null;
$tdsEntryIds = $data['tds_entry_ids'] ?? []; // which tds_entries are being paid
$fiscalYear = $data['fiscal_year'] ?? '';
$notes = trim($data['notes'] ?? '');
$paymentMode = $data['payment_mode'] ?? '';
$paymentRef = trim($data['payment_ref'] ?? '');

$errors = [];
if (empty($date)) $errors[] = "Date is required.";
if (!$bankAccountId) $errors[] = "Bank account is required.";
if (!in_array($paymentMode, validPaymentModes(), true)) $errors[] = "A valid payment mode is required.";
if (empty($tdsEntryIds)) $errors[] = "At least one TDS entry must be selected.";
if (empty($fiscalYear)) $errors[] = "Fiscal year is required.";

if ($errors) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => implode(' ', $errors)
    ]);
    exit();
}

try {
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

    $placeholders = implode(',', array_fill(0, count($tdsEntryIds), '?'));
    $tdsStmt = $pdo->prepare("
        SELECT id, tds_amount, tds_type
        FROM tds_entries
        WHERE id IN ($placeholders)
            AND is_paid = FALSE
            AND tds_type IN ('PAYABLE', 'EXPENSE')
            AND fiscal_year = ?
    ");
    $tdsStmt->execute([...$tdsEntryIds, $fiscalYear]);
    $tdsEntries = $tdsStmt->fetchAll();

    if (empty($tdsEntries)) {
        http_response_code(422);
        echo json_encode([
            "success" => false,
            "message" => "No unpaid TDS payable entries found for the selected ids and fiscal year."
        ]);
        exit();
    }

    $totalTds = array_sum(array_column($tdsEntries, 'tds_amount'));

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

    $tdsPayableId = $getAccount('TDS Payable');

    if (!$tdsPayableId) {
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "message" => "TDS Payable ledger account not found."
        ]);
        exit();
    }

    // Auto-generate ref number
    $countStmt = $pdo->query("
        SELECT COUNT(*) AS cnt
        FROM transactions
        WHERE type = 'TDS_PAYMENT'
    ");
    $count = $countStmt->fetch()['cnt'];
    $refNumber = 'TDS-' . str_pad($count + 1, 5, '0', STR_PAD_LEFT);

    $pdo->beginTransaction();

    // Insert transaction
    $txStmt = $pdo->prepare("
        INSERT INTO transactions (
            type,
            date,
            ref_number,
            bank_account_id,
            payment_mode,
            payment_ref,
            total_amount,
            notes,
            status,
            created_by
        )
        VALUES ('TDS_PAYMENT', ?, ?, ?, ?, ?, ?, ?, 'APPROVED', ?)
    ");
    $txStmt->execute([
        $date,
        $refNumber,
        $bankAccountId,
        $paymentMode,
        $paymentRef ?: null,
        $totalTds,
        $notes ?: "TDS payment to government for fiscal year {$fiscalYear}",
        $_SESSION['user_id'],
    ]);
    $txId = (int) $pdo->lastInsertId();

    // Post ledger entries
    // TDS Payable Dr (clears the liability)
    // Bank Cr (cash goes out)
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

    $narration = "TDS Payment to Govt {$refNumber} - FY {$fiscalYear}";

    $ledgerStmt->execute([$txId, $tdsPayableId, $totalTds, 0, $date, $narration]);
    $ledgerStmt->execute([$txId, $bank['ledger_account_id'], 0, $totalTds, $date, $narration]);

    // Mark selected TDS entries as paid and link them to this payment transaction
    $markPaid = $pdo->prepare("
        UPDATE tds_entries
        SET is_paid = TRUE, paid_via_tx_id = ?
        WHERE id = ?
    ");
    foreach ($tdsEntries as $entry) {
        $markPaid->execute([$txId, $entry['id']]);
    }

    $pdo->commit();

    logAudit(
        $pdo,
        (int) $_SESSION['user_id'],
        'CREATE',
        'transactions',
        $txId,
        null,
        ['type' => 'TDS_PAYMENT', 'ref_number' => $refNumber, 'bank_account_id' => (int)$bankAccountId, 'payment_mode' => $paymentMode, 'payment_ref' => $paymentRef ?: null, 'total_amount' => $totalTds, 'fiscal_year' => $fiscalYear, 'tds_entry_ids' => array_column($tdsEntries, 'id')]
    );

    http_response_code(201);
    echo json_encode([
        "success" => true,
        "message" => "TDS payment of Rs. " . number_format($totalTds, 2) . " recorded successfully.",
        "data" => [
            "id" => $txId,
            "ref_number" => $refNumber,
            "total_tds" => $totalTds,
            "entries_paid" => count($tdsEntries),
        ]
    ]);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log("TDS payment error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to record TDS payment."
    ]);
}