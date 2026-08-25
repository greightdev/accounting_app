<?php

require_once '../server.php';
require_once '../db.php';
require_once '../includes/auth.php';

requireRole(['admin', 'accountant', 'user']);

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
            t.id, t.type, t.date, t.due_date, t.ref_number, t.vendor_bill_no, COALESCE(NULLIF(t.vendor_bill_no, ''), t.ref_number) AS display_ref_number,
            t.contact_id, t.bank_account_id, t.payment_mode, t.payment_ref, t.contra_account_id,
            t.sub_total, t.vat_amount, t.tds_amount, t.total_amount,
            t.notes, t.status, t.voided_at, t.void_reason,
            c.name AS contact_name, c.pan AS contact_pan, c.address AS contact_address,
            ba.name AS bank_account_name,
            ca.name AS contra_account_name,
            u.name AS created_by_name
        FROM transactions t
        LEFT JOIN contacts c ON c.id = t.contact_id
        LEFT JOIN bank_accounts ba ON ba.id = t.bank_account_id
        LEFT JOIN accounts ca ON ca.id = t.contra_account_id
        LEFT JOIN users u ON u.id = t.created_by
        WHERE t.id = ?
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

    // Type-specific supporting data
    switch ($tx['type']) {
        case 'SALES':
        case 'PURCHASE':
            $itemStmt = $pdo->prepare("
                SELECT ti.description, ti.quantity, ti.rate, ti.taxable_amount,
                       ti.vat_rate, ti.vat_amount, ti.total_amount, i.name AS item_name
                FROM transaction_items ti
                JOIN items i ON i.id = ti.item_id
                WHERE ti.transaction_id = ?
                ORDER BY ti.id
            ");
            $itemStmt->execute([$id]);
            $tx['line_items'] = $itemStmt->fetchAll();
            break;

        case 'JOURNAL':
            $lineStmt = $pdo->prepare("
                SELECT jl.account_id, jl.debit, jl.credit, jl.narration, a.name AS account_name
                FROM journal_lines jl
                JOIN accounts a ON a.id = jl.account_id
                WHERE jl.transaction_id = ?
                ORDER BY jl.id
            ");
            $lineStmt->execute([$id]);
            $tx['lines'] = $lineStmt->fetchAll();
            break;

        case 'BANK_DEP':
        case 'BANK_WITH':
            // bank_account_name / contra_account_name already joined
            break;

        case 'RECEIPT':
        case 'PAYMENT':
            // contact_name already joined; fetch linked TDS entry if any
            $tdsStmt = $pdo->prepare("
                SELECT tds_amount, tds_type, fiscal_year, is_paid
                FROM tds_entries
                WHERE transaction_id = ?
                LIMIT 1
            ");
            $tdsStmt->execute([$id]);
            $tx['tds_entry'] = $tdsStmt->fetch() ?: null;
            break;

        case 'TDS_PAYMENT':
            // No additional detail needed beyond the base row
            break;
    }

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Transaction fetched successfully.",
        "data" => $tx
    ]);

} catch (PDOException $e) {
    error_log("Get transaction error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to fetch transaction."
    ]);
}