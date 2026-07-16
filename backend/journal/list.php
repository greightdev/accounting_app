<?php

require_once '../server.php';
require_once '../db.php';
require_once '../includes/auth.php';

requireRole(['admin', 'accountant']);

// Only accept GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Method not allowed"
    ]);
    exit();
}

$status = $_GET['status'] ?? null;
$status = $status ? strtoupper($status) : null;
$validStatuses = ['DRAFT', 'APPROVED'];

try {
    $sql = "
        SELECT
            t.id,
            t.ref_number,
            t.date,
            t.total_amount,
            t.notes,
            t.status,
            t.created_at,
            u.name AS created_by_name
        FROM transactions t
        JOIN users u ON u.id = t.created_by
        WHERE t.type = 'JOURNAL' AND t.status != 'VOID'
    ";
    $params = [];

    if ($status && in_array($status, $validStatuses, true)) {
        $sql .= " AND t.status = ?";
        $params[] = $status;
    }

    $sql .= " ORDER BY t.date DESC, t.id DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $journals = $stmt->fetchAll();

    // Attach ledger lines to each journal
    $lineStmt = $pdo->prepare("
        SELECT
            jl.id,
            jl.account_id,
            jl.debit,
            jl.credit,
            jl.narration,
            a.name AS account_name
        FROM journal_lines jl
        JOIN accounts a ON a.id  = jl.account_id
        WHERE jl.transaction_id = ?
        ORDER BY jl.debit DESC
    ");

    foreach ($journals as &$journal) {
        $lineStmt->execute([$journal['id']]);
        $journal['lines'] = $lineStmt->fetchAll();
    }

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Journal entries fetched successfully",
        "data" => $journals
    ]);

} catch (PDOException $e) {
    error_log("List journal error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to fetch journal entries."
    ]);
}