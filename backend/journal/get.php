<?php

require_once '../server.php';
require_once '../db.php';
require_once '../includes/auth.php';

requireRole(['admin', 'accountant']);

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Method not allowed"
    ]);
    exit();
}

$id = isset($_GET['id']) ? (int) $_GET['id'] : 0;

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
        SELECT
            id,
            ref_number,
            date,
            total_amount,
            notes,
            status
        FROM transactions
        WHERE id = ? AND type = 'JOURNAL'
    ");
    $stmt->execute([$id]);
    $journal = $stmt->fetch();

    if (!$journal) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Journal entry not found."
        ]);
        exit();
    }

    if ($journal['status'] !== 'DRAFT') {
        http_response_code(403);
        echo json_encode([
            "success" => false,
            "message" => "Only draft journal entries can be edited."
        ]);
        exit();
    }

    $lineStmt = $pdo->prepare("
        SELECT
            jl.id,
            jl.account_id,
            jl.debit,
            jl.credit,
            jl.narration,
            a.name AS account_name
        FROM journal_lines jl
        JOIN accounts a ON a.id = jl.account_id
        WHERE jl.transaction_id = ?
        ORDER BY jl.id
    ");
    $lineStmt->execute([$id]);
    $journal['lines'] = $lineStmt->fetchAll();

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Journal entry fetched successfully.", "data" => $journal
    ]);

} catch (PDOException $e) {
    error_log("Get journal error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to fetch journal entry."
    ]);
}