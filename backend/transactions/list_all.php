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

$type = $_GET['type'] ?? null;
$status = $_GET['status'] ?? null;
$dateFrom = $_GET['date_from'] ?? null;
$dateTo = $_GET['date_to'] ?? null;
$search = $_GET['search'] ?? null;

$validTypes = ['SALES', 'PURCHASE', 'RECEIPT', 'PAYMENT', 'BANK_DEP', 'BANK_WITH', 'TDS_PAYMENT', 'JOURNAL'];
$validStatuses = ['DRAFT', 'APPROVED', 'VOID'];

try {
    $sql = "
        SELECT
            t.id, t.type, t.date, t.ref_number, t.total_amount, t.status, t.notes,
            c.name AS contact_name,
            ba.name AS bank_account_name,
            u.name AS created_by_name
        FROM transactions t
        LEFT JOIN contacts c ON c.id = t.contact_id
        LEFT JOIN bank_accounts ba ON ba.id = t.bank_account_id
        LEFT JOIN users u ON u.id = t.created_by
        WHERE t.status != 'VOID'
    ";
    $params = [];

    if ($type && in_array($type, $validTypes, true)) { $sql .= " AND t.type = ?"; $params[] = $type; }
    if ($status && in_array(strtoupper($status), $validStatuses, true)) { $sql .= " AND t.status = ?"; $params[] = strtoupper($status); }
    if ($dateFrom) { $sql .= " AND t.date >= ?"; $params[] = $dateFrom; }
    if ($dateTo) { $sql .= " AND t.date <= ?"; $params[] = $dateTo; }
    if ($search) {
        $sql .= " AND (t.ref_number LIKE ? OR c.name LIKE ?)";
        $params[] = "%$search%";
        $params[] = "%$search%";
    }

    $sql .= " ORDER BY t.date DESC, t.id DESC LIMIT 200";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Transactions fetched successfully.",
        "data" => $rows]
    );
} catch (PDOException $e) {
    error_log("List all transactions error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to fetch transactions."
    ]);
}