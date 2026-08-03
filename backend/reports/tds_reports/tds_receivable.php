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
$contactId = $_GET['contact_id'] ?? null;

try {
    $sql = "
        SELECT
            te.id,
            te.tds_amount,
            te.pan,
            te.fiscal_year,
            te.date,
            te.is_paid,
            c.id   AS contact_id,
            c.name AS customer_name,
            t.ref_number,
            pt.ref_number AS paid_via_ref
        FROM tds_entries te
        JOIN contacts c ON c.id  = te.contact_id
        JOIN transactions t ON t.id  = te.transaction_id
        LEFT JOIN transactions pt ON pt.id = te.paid_via_tx_id
        WHERE te.tds_type = 'RECEIVABLE' AND t.status = 'APPROVED'
    ";
    $params = [];

    if ($dateFrom) { $sql .= " AND te.date >= ?"; $params[] = $dateFrom; }
    if ($dateTo) { $sql .= " AND te.date <= ?"; $params[] = $dateTo; }
    if ($fiscalYear) { $sql .= " AND te.fiscal_year = ?"; $params[] = $fiscalYear; }
    if ($contactId) { $sql .= " AND te.contact_id = ?"; $params[] = $contactId; }

    $sql .= " ORDER BY te.date ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $entries = $stmt->fetchAll();

    $totalTds = 0;
    $paidTds = 0;
    $unpaidTds = 0;
    $byCustomer = [];
    $rows = [];

    foreach ($entries as $entry) {
        $amt = (float)$entry['tds_amount'];
        $totalTds += $amt;
        if ($entry['is_paid']) $paidTds += $amt;
        else $unpaidTds += $amt;

        $rows[] = [
            'id' => $entry['id'],
            'date' => $entry['date'],
            'ref_number' => $entry['ref_number'],
            'customer_name' => $entry['customer_name'],
            'pan' => $entry['pan'],
            'fiscal_year' => $entry['fiscal_year'],
            'tds_amount' => $amt,
            'is_paid' => (bool)$entry['is_paid'],
            'paid_via_ref' => $entry['paid_via_ref'],
        ];

        $cid = $entry['contact_id'];
        if (!isset($byCustomer[$cid])) {
            $byCustomer[$cid] = [
                'contact_id' => $cid, 'customer_name' => $entry['customer_name'], 'pan' => $entry['pan'],
                'entry_count' => 0, 'total_tds' => 0, 'paid_tds' => 0, 'unpaid_tds' => 0,
            ];
        }
        $byCustomer[$cid]['entry_count']++;
        $byCustomer[$cid]['total_tds'] += $amt;
        if ($entry['is_paid']) $byCustomer[$cid]['paid_tds'] += $amt;
        else $byCustomer[$cid]['unpaid_tds'] += $amt;
    }

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "TDS receivable report fetched successfully.",
        "data" => $rows,
        "meta" => [
            "date_from" => $dateFrom,
            "date_to" => $dateTo,
            "fiscal_year" => $fiscalYear,
            "total_entries" => count($rows),
            "total_tds" => $totalTds,
            "paid_tds" => $paidTds,
            "unpaid_tds" => $unpaidTds,
            "by_customer" => array_values($byCustomer),
        ],
    ]);
    
} catch (PDOException $e) {
    error_log("TDS receivable error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to generate TDS receivable report."
    ]);
}
