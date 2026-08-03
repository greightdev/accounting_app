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

$dateFrom = $_GET['date_from'] ?? null;
$dateTo = $_GET['date_to'] ?? null;
$fiscalYear = $_GET['fiscal_year'] ?? null;

try {
    $sql = "
        SELECT
            te.id, te.tds_amount, te.pan, te.fiscal_year, te.date, te.is_paid, te.tds_type,
            c.name AS party_name,
            t.ref_number,
            pt.ref_number AS paid_via_ref
        FROM tds_entries te
        JOIN contacts c ON c.id = te.contact_id
        JOIN transactions t ON t.id = te.transaction_id
        LEFT JOIN transactions pt ON pt.id = te.paid_via_tx_id
        WHERE t.status = 'APPROVED'
    ";
    $params = [];

    if ($dateFrom) { $sql .= " AND te.date >= ?"; $params[] = $dateFrom; }
    if ($dateTo) { $sql .= " AND te.date <= ?"; $params[] = $dateTo; }
    if ($fiscalYear) { $sql .= " AND te.fiscal_year = ?"; $params[] = $fiscalYear; }

    $sql .= " ORDER BY te.date ASC, te.tds_type";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $entries = $stmt->fetchAll();

    $rows = [];
    $totalReceivable = 0;
    $totalPayable = 0;
    $totalExpense = 0;

    foreach ($entries as $entry) {
        $amt = (float)$entry['tds_amount'];
        if ($entry['tds_type'] === 'RECEIVABLE') $totalReceivable += $amt;
        if ($entry['tds_type'] === 'PAYABLE') $totalPayable += $amt;
        if ($entry['tds_type'] === 'EXPENSE') $totalExpense += $amt;

        $rows[] = [
            'id' => $entry['id'],
            'date' => $entry['date'],
            'ref_number' => $entry['ref_number'],
            'party_name' => $entry['party_name'],
            'pan' => $entry['pan'] ?? '-',
            'tds_type' => $entry['tds_type'],
            'fiscal_year' => $entry['fiscal_year'],
            'tds_amount' => $amt,
            'is_paid' => (bool)$entry['is_paid'],
            'paid_via_ref' => $entry['paid_via_ref'],
        ];
    }

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "TDS report fetched successfully.",
        "data" => $rows,
        "meta" => [
            "date_from" => $dateFrom,
            "date_to" => $dateTo,
            "fiscal_year" => $fiscalYear,
            "total_receivable" => $totalReceivable,
            "total_payable" => $totalPayable,
            "total_expense" => $totalExpense,
        ],
    ]);
    
} catch (PDOException $e) {
    error_log("TDS report (Nepali) error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" =>
        false, "message" => "Failed to generate TDS report."
    ]);
}