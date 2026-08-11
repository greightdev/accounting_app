<?php

require_once '../server.php';
require_once '../db.php';
require_once '../includes/auth.php';
require_once '../includes/audit.php';

requireRole(['admin']);

// Only accept DELETE
if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
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

$id = isset($data['id']) ? (int) $data['id'] : 0;

if ($id <= 0) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "A valid account ID is required."
    ]);
    exit();
}

try {
    // Check account exists
    $existing = $pdo->prepare("
        SELECT id, name, is_system
        FROM accounts
        WHERE id = ? AND is_active = TRUE
    ");
    $existing->execute([$id]);
    $account = $existing->fetch();
    if (!$account) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Account not found."
        ]);
        exit();
    }

    // Block delete if the contact has any transactions
    if ($account['is_system']) {
        http_response_code(403);
        echo json_encode(["success" => false, "message" => "This is a system ledger and cannot be deleted."]);
        exit();
    }

    // Block delete if this account has any ledger activity at all
    $usageCheck = $pdo->prepare("
        SELECT le.id, t.status
        FROM ledger_entries le
        LEFT JOIN transactions t
        ON le.transaction_id = t.id
        WHERE le.account_id = ? AND t.status != 'VOID'
        LIMIT 1
    ");
    $usageCheck->execute([$id]);
    if ($usageCheck->fetch()) {
        http_response_code(409);
        echo json_encode([
            "success" => false,
            "message" => "This account has existing ledger entries and cannot be deleted."
        ]);
        exit();
    }

    $pdo->beginTransaction();

    $pdo->prepare("
        UPDATE accounts
        SET is_active = FALSE
        WHERE id = ?
    ")->execute([$id]);

    // If this was a Bank/Cash account, deactivate its linked bank_accounts row too
    $bankRowStmt = $pdo->prepare("
        SELECT id
        FROM bank_accounts
        WHERE account_id = ? AND is_active = TRUE
    ");
    $bankRowStmt->execute([$id]);
    $bankRow = $bankRowStmt->fetch();
    if ($bankRow) {
        $pdo->prepare("
            UPDATE bank_accounts
            SET is_active = FALSE
            WHERE id = ?
        ")->execute([$bankRow['id']]);
    }

    $pdo->commit();

    logAudit(
        $pdo,
        (int) $_SESSION['user_id'],
        'DELETE',
        'accounts',
        $id,
        ['name' => $account['name'], 'is_active' => true],
        ['is_active' => false]
    );

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Account deleted successfully."
    ]);

} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log("Delete account error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to delete account."
    ]);
}
