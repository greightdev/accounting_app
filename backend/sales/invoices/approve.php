<?php

require_once '../../server.php';
require_once '../../db.php';
require_once '../../includes/auth.php';
require_once '../../includes/audit.php';

requireRole(['admin']);

// Only accept PUT
if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Method not allowed"
    ]);
    exit();
}

// Parse JSON body
$data = json_decode(file_get_contents('php://input'), true);

$id = isset($data['id']) ? (int) $data['id'] : 0;

if ($id <= 0) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Invoice ID is required."
    ]);
    exit();
}

try {
    $stmt = $pdo->prepare("
        SELECT t.*, c.name AS customer_name
        FROM transactions t
        JOIN contacts c ON c.id = t.contact_id
        WHERE t.id = ? AND t.type = 'SALES'
    ");
    $stmt->execute([$id]);
    $invoice = $stmt->fetch();

    if (!$invoice) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Invoice not found."
        ]);
        exit();
    }

    if ($invoice['status'] !== 'DRAFT') {
        http_response_code(409);
        echo json_encode([
            "success" => false,
            "message" => "Only draft invoices can be approved."
        ]);
        exit();
    }

    $pdo->beginTransaction();

    $pdo->prepare("
        UPDATE transactions
        SET status = 'APPROVED'
        WHERE id = ?
    ")->execute([$id]);

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

    $receivableId = $getAccount('Customer Receivable');
    $salesId = $getAccount('Sales');
    $vatPayableId = $getAccount('VAT Payable');

    if (!$receivableId || !$salesId || !$vatPayableId) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "message" => "System ledger accounts not found."
        ]);
        exit();
    }

    // Post each line item's taxable amount to its own income account when the item has one set, falling back to the system "Sales" account otherwise.
    $breakdownStmt = $pdo->prepare("
        SELECT COALESCE(i.account_id, ?) AS resolved_account_id, SUM(ti.taxable_amount) AS amount
        FROM transaction_items ti
        LEFT JOIN items i ON i.id = ti.item_id
        WHERE ti.transaction_id = ?
        GROUP BY resolved_account_id
    ");
    $breakdownStmt->execute([$salesId, $id]);
    $accountBreakdown = $breakdownStmt->fetchAll();

    if (!$accountBreakdown) {
        $accountBreakdown = [['resolved_account_id' => $salesId, 'amount' => $invoice['sub_total']]];
    }

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
    $narration = "Sales Invoice {$invoice['ref_number']} - {$invoice['customer_name']}";

    $ledgerStmt->execute([$id, $receivableId, $invoice['total_amount'], 0, $invoice['date'], $narration]);
    foreach ($accountBreakdown as $row) {
        if ((float)$row['amount'] <= 0) continue;
        $ledgerStmt->execute([$id, (int)$row['resolved_account_id'], 0, $row['amount'], $invoice['date'], $narration]);
    }
    if ($invoice['vat_amount'] > 0) {
        $ledgerStmt->execute([$id, $vatPayableId, 0, $invoice['vat_amount'], $invoice['date'], $narration]);
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
        "message" => "Invoice approved successfully."
    ]);

} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log("Approve invoice error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to approve invoice."
    ]);
}