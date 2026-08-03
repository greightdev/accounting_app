<?php

require_once '../../server.php';
require_once '../../db.php';
require_once '../../includes/auth.php';

requireRole(['admin', 'accountant', 'user']);

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Method not allowed"
    ]);
    exit();
}

$dateFrom  = $_GET['date_from'] ?? null;
$dateTo = $_GET['date_to'] ?? null;
$contactId = $_GET['contact_id'] ?? null;

try {
    // Overall receipt summary
    $sumSql = "
        SELECT
            COUNT(t.id) AS total_receipts,
            SUM(t.total_amount) AS total_received,
            SUM(t.tds_amount) AS total_tds,
            SUM(t.total_amount) - SUM(t.tds_amount) AS net_cash_received,
            SUM(CASE WHEN t.tds_amount > 0 THEN 1 ELSE 0 END) AS receipts_with_tds,
            SUM(CASE WHEN t.tds_amount = 0 THEN 1 ELSE 0 END) AS receipts_without_tds
        FROM transactions t
        WHERE t.type = 'RECEIPT' AND t.status = 'APPROVED'
    ";
    $sumParams = [];

    if ($dateFrom) { $sumSql .= " AND t.date >= ?"; $sumParams[] = $dateFrom; }
    if ($dateTo) { $sumSql .= " AND t.date <= ?"; $sumParams[] = $dateTo; }
    if ($contactId) { $sumSql .= " AND t.contact_id = ?"; $sumParams[] = $contactId; }

    $sumStmt = $pdo->prepare($sumSql);
    $sumStmt->execute($sumParams);
    $summary = $sumStmt->fetch();

    // Detailed receipt list
    $detailSql = "
        SELECT
            t.id,
            t.ref_number,
            t.date,
            t.total_amount,
            t.tds_amount,
            t.total_amount - t.tds_amount AS cash_received,
            t.notes,
            c.id AS contact_id,
            c.name AS customer_name,
            c.pan,
            ba.name AS bank_account_name,
            te.tds_type,
            te.fiscal_year
        FROM transactions t
        JOIN contacts c ON c.id = t.contact_id
        LEFT JOIN bank_accounts ba ON ba.id = t.bank_account_id
        LEFT JOIN tds_entries te ON te.transaction_id = t.id
        WHERE t.type = 'RECEIPT' AND t.status = 'APPROVED'
    ";
    $detailParams = [];

    if ($dateFrom) { $detailSql .= " AND t.date >= ?"; $detailParams[] = $dateFrom; }
    if ($dateTo) { $detailSql .= " AND t.date <= ?"; $detailParams[] = $dateTo; }
    if ($contactId) { $detailSql .= " AND t.contact_id = ?"; $detailParams[] = $contactId; }

    $detailSql .= " ORDER BY t.date ASC, t.id ASC";

    $detailStmt = $pdo->prepare($detailSql);
    $detailStmt->execute($detailParams);
    $receipts = $detailStmt->fetchAll();

    // Customer-wise receipt summary
    $custSql = "
        SELECT
            c.id AS contact_id,
            c.name AS customer_name,
            COUNT(t.id) AS receipt_count,
            SUM(t.total_amount) AS total_received,
            SUM(t.tds_amount) AS total_tds
        FROM transactions t
        JOIN contacts c ON c.id = t.contact_id
        WHERE t.type = 'RECEIPT' AND t.status = 'APPROVED'
    ";
    $custParams = [];

    if ($dateFrom) { $custSql .= " AND t.date >= ?"; $custParams[] = $dateFrom; }
    if ($dateTo) { $custSql .= " AND t.date <= ?"; $custParams[] = $dateTo; }
    if ($contactId) { $custSql .= " AND t.contact_id = ?"; $custParams[] = $contactId; }

    $custSql .= " GROUP BY c.id, c.name ORDER BY total_received DESC";

    $custStmt = $pdo->prepare($custSql);
    $custStmt->execute($custParams);
    $byCustomer = $custStmt->fetchAll();

    $rows = array_map(fn($r) => [
        'id' => $r['id'],
        'date' => $r['date'],
        'ref_number' => $r['ref_number'],
        'customer_name' => $r['customer_name'],
        'pan' => $r['pan'],
        'bank_account_name' => $r['bank_account_name'],
        'total_amount' => (float)$r['total_amount'],
        'tds_amount' => (float)$r['tds_amount'],
        'cash_received' => (float)$r['cash_received'],
        'tds_type' => $r['tds_type'],
        'fiscal_year' => $r['fiscal_year'],
        'notes' => $r['notes'],
    ], $receipts);

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Transaction summary fetched successfully.",
        "data" => $rows,
        "meta" => [
            "date_from" => $dateFrom,
            "date_to" => $dateTo,
            "total_receipts" => (int)$summary['total_receipts'],
            "total_received" => (float)$summary['total_received'],
            "total_tds" => (float)$summary['total_tds'],
            "net_cash_received" => (float)$summary['net_cash_received'],
            "by_customer" => $byCustomer,
        ],
    ]);

} catch (PDOException $e) {
    error_log("Transaction summary error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to generate transaction summary."
    ]);
}
