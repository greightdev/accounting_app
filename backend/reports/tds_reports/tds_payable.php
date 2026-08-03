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
            c.id AS contact_id,
            c.name AS vendor_name,
            t.ref_number,
            pt.ref_number AS paid_via_ref
        FROM tds_entries te
        JOIN contacts c ON c.id  = te.contact_id
        JOIN transactions t ON t.id  = te.transaction_id
        LEFT JOIN transactions pt ON pt.id = te.paid_via_tx_id
        WHERE te.tds_type = 'PAYABLE' AND t.status = 'APPROVED'
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
    $byVendor = [];
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
            'vendor_name' => $entry['vendor_name'],
            'pan' => $entry['pan'],
            'fiscal_year' => $entry['fiscal_year'],
            'tds_amount' => $amt,
            'is_paid' => (bool)$entry['is_paid'],
            'paid_via_ref' => $entry['paid_via_ref'],
        ];

        $vid = $entry['contact_id'];
        if (!isset($byVendor[$vid])) {
            $byVendor[$vid] = [
                'contact_id' => $vid, 'vendor_name' => $entry['vendor_name'], 'pan' => $entry['pan'],
                'entry_count' => 0, 'total_tds' => 0, 'paid_tds' => 0, 'unpaid_tds' => 0,
            ];
        }
        $byVendor[$vid]['entry_count']++;
        $byVendor[$vid]['total_tds'] += $amt;
        if ($entry['is_paid']) $byVendor[$vid]['paid_tds'] += $amt;
        else $byVendor[$vid]['unpaid_tds'] += $amt;
    }

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "TDS payable report fetched successfully.",
        "data" => $rows,
        "meta" => [
            "date_from" => $dateFrom,
            "date_to" => $dateTo,
            "fiscal_year" => $fiscalYear,
            "total_entries" => count($rows),
            "total_tds" => $totalTds,
            "paid_tds" => $paidTds,
            "unpaid_tds" => $unpaidTds,
            "by_vendor" => array_values($byVendor),
        ],
    ]);
    
} catch (PDOException $e) {
    error_log("TDS payable error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to generate TDS payable report."
    ]);
}
