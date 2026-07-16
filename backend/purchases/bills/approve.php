<?php

require_once '../../server.php';
require_once '../../db.php';
require_once '../../includes/auth.php';

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
        "message" => "Bill ID is required."
    ]);
    exit();
}

try {
    $stmt = $pdo->prepare("
        SELECT t.*, c.name AS vendor_name
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

    if ($bill['status'] !== 'DRAFT') {
        http_response_code(409);
        echo json_encode([
            "success" => false,
            "message" => "Only draft bills can be approved."
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

    $purchaseId = $getAccount('Purchase');
    $vatReceivableId = $getAccount('VAT Receivable');
    $payableId = $getAccount('Vendor Payable');

    if (!$purchaseId || !$vatReceivableId || !$payableId) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "message" => "System ledger accounts not found."
        ]);
        exit();
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
    $narration = "Purchase Bill {$bill['ref_number']} - {$bill['vendor_name']}";

    $ledgerStmt->execute([$id, $purchaseId, $bill['sub_total'], 0, $bill['date'], $narration]);
    if ($bill['vat_amount'] > 0) {
        $ledgerStmt->execute([$id, $vatReceivableId, $bill['vat_amount'], 0, $bill['date'], $narration]);
    }
    $ledgerStmt->execute([$id, $payableId, 0, $bill['total_amount'], $bill['date'], $narration]);

    $pdo->commit();

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Bill approved successfully."
    ]);

} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log("Approve bill error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to approve bill."
    ]);
}