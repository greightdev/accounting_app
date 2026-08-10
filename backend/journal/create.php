<?php

require_once '../server.php';
require_once '../db.php';
require_once '../includes/auth.php';

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

$date = $data['date'] ?? '';
$notes = trim($data['notes'] ?? '');
$lines = $data['lines'] ?? [];
$status = $data['status'] ?? 'DRAFT';

if ($_SESSION['role'] !== 'admin') {
    $status = 'DRAFT';
}

$validStatuses = ['DRAFT', 'APPROVED'];

// Validation
$errors = [];
if (empty($date)) $errors[] = "Date is required.";
if (count($lines) < 2) $errors[] = "A journal entry needs at least two lines.";
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
    $totalDebit = 0;
    $totalCredit = 0;
    $validLines = [];
    $lineErrors = [];

    foreach ($lines as $idx => $line) {
        $accountId = $line['account_id'] ?? null;
        $debit = (float)($line['debit'] ?? 0);
        $credit = (float)($line['credit'] ?? 0);
        $narration = trim($line['narration'] ?? '');

        if (!$accountId) {
            $lineErrors[] = "Line " . ($idx + 1) . ": account is required.";
            continue;
        }

        // Each line must have either a debit or credit, not both, not neither
        if (($debit > 0 && $credit > 0) || ($debit === 0.0 && $credit === 0.0)) {
            $lineErrors[] = "Line " . ($idx + 1) . ": each line must have either a debit or credit amount, not both.";
            continue;
        }

        // Validate account exists
        $accStmt = $pdo->prepare("
            SELECT id
            FROM accounts
            WHERE id = ? AND is_active = TRUE
        ");
        $accStmt->execute([$accountId]);
        if (!$accStmt->fetch()) {
            $lineErrors[] = "Line " . ($idx + 1) . ": account not found.";
            continue;
        }

        $totalDebit += $debit;
        $totalCredit += $credit;

        $validLines[] = [
            'account_id' => $accountId,
            'debit' => $debit,
            'credit' => $credit,
            'narration' => $narration ?: $notes,
        ];
    }

    if ($lineErrors) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => implode(' ', $lineErrors)
        ]);
        exit();
    }

    // Enforce double-entry: debits must equal credits
    if (abs(round($totalDebit, 2) - round($totalCredit, 2)) > 0.01) {
        http_response_code(422);
        echo json_encode([
            "success" => false,
            "message" => "Journal entry is unbalanced. Total debits (Rs. " . number_format($totalDebit, 2) . ") must equal total credits (Rs. " . number_format($totalCredit, 2) . ")."
        ]);
        exit();
    }

    // Auto-generate ref number
    $countStmt = $pdo->query("
        SELECT COUNT(*) AS cnt
        FROM transactions
        WHERE type = 'JOURNAL'
    ");
    $count = $countStmt->fetch()['cnt'];
    $refNumber = 'JNL-' . str_pad($count + 1, 5, '0', STR_PAD_LEFT);

    $pdo->beginTransaction();

    // Insert transaction
    $txStmt = $pdo->prepare("
        INSERT INTO transactions (
            type,
            date,
            ref_number,
            total_amount,
            notes,
            status,
            created_by
        )
        VALUES ('JOURNAL', ?, ?, ?, ?, ?, ?)
    ");
    $txStmt->execute([
        $date,
        $refNumber,
        $totalDebit, // total_amount = total debits = total credits
        $notes ?: null,
        $status,
        $_SESSION['user_id'],
    ]);
    $txId = (int) $pdo->lastInsertId();

    // Store line items in journal_lines
    $lineStmt = $pdo->prepare("
        INSERT INTO journal_lines (
            transaction_id,
            account_id,
            debit,
            credit,
            narration
        )
        VALUES (?, ?, ?, ?, ?)
    ");
    foreach ($validLines as $line) {
        $lineStmt->execute([
            $txId,
            $line['account_id'],
            $line['debit'],
            $line['credit'],
            $line['narration']
        ]);
    }

    // Insert ledger entries only if APPROVED
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

        foreach ($validLines as $line) {
            $ledgerStmt->execute([
                $txId,
                $line['account_id'],
                $line['debit'],
                $line['credit'],
                $date,
                $line['narration'],
            ]);
        }
    }

    // Link journal to TDS
    $tdsContext = $data['tds_context'] ?? null;

    if ($tdsContext) {
        $contactId = $tdsContext['contact_id'] ?? null;
        $pan = trim($tdsContext['pan'] ?? '');
        $fiscalYear = trim($tdsContext['fiscal_year'] ?? '');
        $tdsAmount = (float)($tdsContext['tds_amount'] ?? 0);
        
        if (!$contactId || !$fiscalYear || $tdsAmount <= 0) {
            $pdo->rollBack();
            http_response_code(400);
            echo json_encode([
                "success" => false,
                "message" => "TDS context requires a contact, fiscal year and amount."
            ]);
            exit();
        }

        $tdsStmt = $pdo->prepare("
            INSERT INTO tds_entries (
                transaction_id,
                contact_id,
                pan,
                tds_amount,
                tds_type,
                fiscal_year,
                date,
                is_paid
            )
            VALUES (?, ?, ?, ?, 'EXPENSE', ?, ?, FALSE)
        ");
        $tdsStmt->execute([$txId, $contactId, $pan ?: null, $tdsAmount, $fiscalYear, $date]);
    }

    $pdo->commit();

    http_response_code(201);
    echo json_encode([
        "success" => true,
        "message" => "Journal entry " . ($status === 'APPROVED' ? "created and approved" : "saved as draft") . " successfully.",
        "data" => [
            "id" => $txId,
            "ref_number" => $refNumber,
        ]
    ]);

} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log("Create journal error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to create journal entry."
    ]);
}