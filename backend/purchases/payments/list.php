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

// Optional filter: ?contact_id=1
$contactId = $_GET['contact_id'] ?? null;
$status = $_GET['status'] ?? null;
$status = $status ? strtoupper($status) : null;
$validStatuses = ['DRAFT', 'APPROVED', 'VOID'];

try {
    $sql = "
        SELECT
            t.id,
            t.ref_number,
            t.date,
            t.total_amount,
            t.tds_amount,
            t.notes,
            t.status,
            t.created_at,
            c.id AS contact_id,
            c.name AS vendor_name,
            c.pan AS vendor_pan,
            u.name AS created_by_name,
            ba.name AS bank_account_name,
            bill.ref_number AS bill_ref_number,
            te.tds_type,
            te.tds_amount AS tds_entry_amount,
            te.pan,
            te.fiscal_year
        FROM transactions t
        JOIN contacts c ON c.id = t.contact_id
        JOIN users u ON u.id = t.created_by
        LEFT JOIN bank_accounts ba ON ba.id = t.bank_account_id
        LEFT JOIN transaction_allocations ta ON ta.settling_transaction_id = t.id
        LEFT JOIN transactions bill ON bill.id = ta.settled_transaction_id
        LEFT JOIN tds_entries te ON te.transaction_id = t.id
        WHERE t.type = 'PAYMENT'
    ";
    $params = [];

    if ($contactId) {
        $sql .= " AND t.contact_id = ?";
        $params[] = $contactId;
    }

    if ($status && in_array($status, $validStatuses, true)) {
        $sql .= " AND t.status = ?";
        $params[] = $status;
    }

    $sql .= " ORDER BY t.date DESC, t.id DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $payments = $stmt->fetchAll();

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Payments fetched successfully.",
        "data" => $payments
    ]);

} catch (PDOException $e) {
    error_log("Get all payments error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to fetch payments."
    ]);
}
