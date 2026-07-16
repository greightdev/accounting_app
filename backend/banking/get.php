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

// Parse JSON body
$id = $_GET['id'] ?? null;

if (!$id) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Transaction id is required."
    ]);
    exit();
}

try {
    $stmt = $pdo->prepare("
        SELECT
            t.id,
            t.type,
            t.date,
            t.ref_number,
            t.bank_account_id,
            t.contra_account_id,
            t.total_amount,
            t.notes,
            t.status
        FROM transactions t
        WHERE t.id = ? AND t.type IN ('BANK_DEP', 'BANK_WITH')
    ");
    $stmt->execute([$id]);
    $tx = $stmt->fetch();

    if (!$tx) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Transaction not found."
        ]);
        exit();
    }

    // Only DRAFT transactions should ever be opened in the edit form —
    if ($tx['status'] !== 'DRAFT') {
        http_response_code(403);
        echo json_encode([
            "success" => false,
            "message" => "Only draft transactions can be edited."
        ]);
        exit();
    }

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Transaction fetched successfully.",
        "data" => $tx
    ]);
} catch (PDOException $e) {
    error_log("Get banking transaction error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to fetch transaction."
    ]);
}