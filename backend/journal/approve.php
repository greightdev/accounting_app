<?php

require_once '../server.php';
require_once '../db.php';
require_once '../includes/auth.php';
require_once '../includes/audit.php';

requireRole(['admin']);

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Method not allowed"
    ]);
    exit();
}

$data = json_decode(file_get_contents('php://input'), true);
$id = isset($data['id']) ? (int) $data['id'] : 0;

if ($id <= 0) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "A valid transaction ID is required."
    ]);
    exit();
}

try {
    $stmt = $pdo->prepare("
        SELECT id, date
        FROM transactions
        WHERE id = ? AND type = 'JOURNAL' AND status = 'DRAFT'
    ");
    $stmt->execute([$id]);
    $tx = $stmt->fetch();

    if (!$tx) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Draft journal entry not found."
        ]);
        exit();
    }

    $lineStmt = $pdo->prepare("
        SELECT account_id, debit, credit, narration
        FROM journal_lines
        WHERE transaction_id = ?
    ");
    $lineStmt->execute([$id]);
    $lines = $lineStmt->fetchAll();

    if (count($lines) < 2) {
        http_response_code(422);
        echo json_encode([
            "success" => false,
            "message" => "Journal entry has no lines to post."
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
    foreach ($lines as $line) {
        $ledgerStmt->execute([
            $id,
            $line['account_id'],
            $line['debit'],
            $line['credit'],
            $tx['date'],
            $line['narration']
        ]);
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
        "message" => "Journal entry approved successfully."
    ]);

} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log("Approve journal error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to approve journal entry."
    ]);
}