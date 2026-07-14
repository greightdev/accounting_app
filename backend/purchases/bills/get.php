<?php

require_once '../../server.php';
require_once '../../db.php';
require_once '../../includes/auth.php';

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
        "message" => "Bill id is required."
    ]);
    exit();
}

try {
    $stmt = $pdo->prepare("
        SELECT
            t.id,
            t.date,
            t.due_date,
            t.ref_number,
            t.contact_id,
            c.name AS vendor_name,
            t.sub_total,
            t.vat_amount,
            t.tds_amount,
            t.total_amount,
            t.notes,
            t.status
        FROM transactions t
        JOIN contacts c ON c.id = t.contact_id
        WHERE t.id = ? AND t.type = 'PURCHASE'
    ");
    $stmt->execute([$id]);
    $bill = $stmt->fetch();

    if (!$bill) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Bill not found."
        ]);
        exit();
    }

    // Only DRAFT bills should ever be opened in the edit form —
    if ($bill['status'] !== 'DRAFT') {
        http_response_code(403);
        echo json_encode([
            "success" => false,
            "message" => "Only draft bills can be edited."
        ]);
        exit();
    }

    $itemsStmt = $pdo->prepare("
        SELECT
            ti.item_id,
            i.name AS item_name,
            ti.description,
            ti.quantity,
            ti.rate,
            ti.taxable_amount,
            ti.vat_rate,
            ti.vat_amount,
            ti.total_amount
        FROM transaction_items ti
        JOIN items i ON i.id = ti.item_id
        WHERE ti.transaction_id = ?
        ORDER BY ti.id
    ");
    $itemsStmt->execute([$id]);
    $bill['line_items'] = $itemsStmt->fetchAll();

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "data" => $bill
    ]);
} catch (PDOException $e) {
    error_log("Get bill error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to fetch bill."
    ]);
}