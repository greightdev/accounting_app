<?php

require_once '../server.php';
require_once '../db.php';
require_once '../includes/auth.php';
require_once '../includes/audit.php';

requireRole(['admin', 'accountant']);

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
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

$id = isset($data['id']) ? (int) $data['id'] : 0;
$date = $data['date'] ?? '';
$notes = trim($data['notes'] ?? '');
$lines = $data['lines'] ?? [];

$errors = [];
if ($id <= 0) $errors[] = "A valid transaction ID is required.";
if (empty($date)) $errors[] = "Date is required.";
if (count($lines) < 2) $errors[] = "A journal entry needs at least two lines.";

if ($errors) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => implode(' ', $errors)
    ]);
    exit();
}

try {
    $existing = $pdo->prepare("
        SELECT id, status, date, total_amount, notes
        FROM transactions
        WHERE id = ? AND type = 'JOURNAL'
    ");
    $existing->execute([$id]);
    $tx = $existing->fetch();

    if (!$tx) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Journal entry not found."
        ]);
        exit();
    }

    if ($tx['status'] !== 'DRAFT') {
        http_response_code(403);
        echo json_encode([
            "success" => false,
            "message" => "Only draft journal entries can be edited."
        ]);
        exit();
    }

    // Re-validate lines exactly as create.php does
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
        if (($debit > 0 && $credit > 0) || ($debit === 0.0 && $credit === 0.0)) {
            $lineErrors[] = "Line " . ($idx + 1) . ": each line must have either a debit or credit amount, not both.";
            continue;
        }

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

    if (abs(round($totalDebit, 2) - round($totalCredit, 2)) > 0.01) {
        http_response_code(422);
        echo json_encode([
            "success" => false,
            "message" => "Journal entry is unbalanced. Total debits (Rs. " . number_format($totalDebit, 2) . ") must equal total credits (Rs. " . number_format($totalCredit, 2) . ")."
        ]);
        exit();
    }

    $oldLinesStmt = $pdo->prepare("
        SELECT account_id, debit, credit, narration
        FROM journal_lines
        WHERE transaction_id = ?
    ");
    $oldLinesStmt->execute([$id]);
    $oldLines = $oldLinesStmt->fetchAll();

    $pdo->beginTransaction();

    $pdo->prepare("
        UPDATE transactions
        SET date = ?, total_amount = ?, notes = ?
        WHERE id = ?
    ")->execute([$date, $totalDebit, $notes ?: null, $id]);

    // Replace lines wholesale — simplest correct way to handle add/remove rows
    $pdo->prepare("
        DELETE FROM journal_lines
        WHERE transaction_id = ?
    ")->execute([$id]);

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
        $lineStmt->execute([$id, $line['account_id'], $line['debit'], $line['credit'], $line['narration']]);
    }

    // Replace tds_entries
    $pdo->prepare("
        DELETE FROM tds_entries
        WHERE transaction_id = ? AND tds_type = 'EXPENSE' AND is_paid = FALSE
    ")->execute([$id]);

    $tdsContext = $data['tds_context'] ?? null;
    
    if ($tdsContext) {
        $contactId = $tdsContext['contact_id'] ?? null;
        $pan = trim($tdsContext['pan'] ?? '');
        $fiscalYear = trim($tdsContext['fiscal_year'] ?? '');
        $tdsAmount = (float)($tdsContext['tds_amount'] ?? 0);

        if ($contactId && $fiscalYear && $tdsAmount > 0) {
            $pdo->prepare("
                INSERT INTO tds_entries (transaction_id, contact_id, pan, tds_amount, tds_type, fiscal_year, date, is_paid)
                VALUES (?, ?, ?, ?, 'EXPENSE', ?, ?, FALSE)
            ")->execute([$id, $contactId, $pan ?: null, $tdsAmount, $fiscalYear, $date]);
        }
    }

    $pdo->commit();

    logAudit(
        $pdo,
        (int) $_SESSION['user_id'],
        'UPDATE',
        'transactions',
        $id,
        ['date' => $tx['date'], 'total_amount' => (float)$tx['total_amount'], 'notes' => $tx['notes'], 'lines' => $oldLines],
        ['date' => $date, 'total_amount' => $totalDebit, 'notes' => $notes ?: null, 'lines' => $validLines]
    );

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Journal entry updated successfully."
    ]);

} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log("Update journal error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to update journal entry."
    ]);
}