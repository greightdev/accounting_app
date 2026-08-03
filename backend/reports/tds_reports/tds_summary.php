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
    // Overall totals by type
    $totalSql = "
        SELECT
            te.tds_type,
            COUNT(te.id) AS entry_count,
            SUM(te.tds_amount) AS total_amount,
            SUM(CASE WHEN te.is_paid = 1 THEN te.tds_amount ELSE 0 END) AS paid_amount,
            SUM(CASE WHEN te.is_paid = 0 THEN te.tds_amount ELSE 0 END) AS unpaid_amount
        FROM tds_entries te
        JOIN transactions t ON t.id = te.transaction_id
        WHERE t.status = 'APPROVED'
    ";
    $params = [];

    if ($dateFrom) { $totalSql .= " AND te.date >= ?"; $params[] = $dateFrom; }
    if ($dateTo) { $totalSql .= " AND te.date <= ?"; $params[] = $dateTo; }
    if ($fiscalYear) { $totalSql .= " AND te.fiscal_year = ?"; $params[] = $fiscalYear; }

    $totalSql .= " GROUP BY te.tds_type";

    $stmt = $pdo->prepare($totalSql);
    $stmt->execute($params);
    $typeRows = $stmt->fetchAll();

    $byType = [
        'RECEIVABLE' => ['entry_count' => 0, 'total_amount' => 0, 'paid_amount' => 0, 'unpaid_amount' => 0],
        'PAYABLE' => ['entry_count' => 0, 'total_amount' => 0, 'paid_amount' => 0, 'unpaid_amount' => 0],
        'EXPENSE' => ['entry_count' => 0, 'total_amount' => 0, 'paid_amount' => 0, 'unpaid_amount' => 0],
    ];
    foreach ($typeRows as $row) {
        $byType[$row['tds_type']] = [
            'entry_count' => (int)$row['entry_count'],
            'total_amount' => (float)$row['total_amount'],
            'paid_amount' => (float)$row['paid_amount'],
            'unpaid_amount' => (float)$row['unpaid_amount'],
        ];
    }

    // Customer-wise summary (RECEIVABLE + EXPENSE)
    $custSql = "
        SELECT
            c.id AS contact_id,
            c.name AS contact_name,
            c.pan,
            te.tds_type,
            SUM(te.tds_amount) AS total_tds
        FROM tds_entries te
        JOIN contacts c ON c.id  = te.contact_id
        JOIN transactions t ON t.id  = te.transaction_id
        WHERE te.tds_type IN ('RECEIVABLE', 'EXPENSE') AND t.status = 'APPROVED'
    ";
    $custParams = [];

    if ($dateFrom) { $custSql .= " AND te.date >= ?"; $custParams[] = $dateFrom; }
    if ($dateTo) { $custSql .= " AND te.date <= ?"; $custParams[] = $dateTo; }
    if ($fiscalYear) { $custSql .= " AND te.fiscal_year = ?"; $custParams[] = $fiscalYear; }

    $custSql .= " GROUP BY c.id, c.name, c.pan, te.tds_type ORDER BY c.name";

    $custStmt = $pdo->prepare($custSql);
    $custStmt->execute($custParams);
    $custRows = $custStmt->fetchAll();

    $customerSummary = [];
    foreach ($custRows as $row) {
        $cid = $row['contact_id'];
        if (!isset($customerSummary[$cid])) {
            $customerSummary[$cid] = [
                'contact_id' => $cid,
                'contact_name' => $row['contact_name'],
                'pan' => $row['pan'],
                'party_type' => 'Customer',
                'tds_receivable' => 0,
                'tds_payable' => 0,
                'tds_expense' => 0,
                'total' => 0,
            ];
        }
        $amt = (float)$row['total_tds'];
        if ($row['tds_type'] === 'RECEIVABLE') $customerSummary[$cid]['tds_receivable'] += $amt;
        if ($row['tds_type'] === 'EXPENSE') $customerSummary[$cid]['tds_expense'] += $amt;
        $customerSummary[$cid]['total'] += $amt;
    }

    // Vendor-wise summary (PAYABLE)
    $vendSql = "
        SELECT
            c.id AS contact_id,
            c.name AS contact_name,
            c.pan,
            SUM(te.tds_amount) AS tds_payable
        FROM tds_entries te
        JOIN contacts c ON c.id  = te.contact_id
        JOIN transactions t ON t.id  = te.transaction_id
        WHERE te.tds_type = 'PAYABLE' AND t.status = 'APPROVED'
    ";
    $vendParams = [];

    if ($dateFrom) { $vendSql .= " AND te.date >= ?"; $vendParams[] = $dateFrom; }
    if ($dateTo) { $vendSql .= " AND te.date <= ?"; $vendParams[] = $dateTo; }
    if ($fiscalYear) { $vendSql .= " AND te.fiscal_year = ?"; $vendParams[] = $fiscalYear; }

    $vendSql .= " GROUP BY c.id, c.name, c.pan ORDER BY c.name";

    $vendStmt = $pdo->prepare($vendSql);
    $vendStmt->execute($vendParams);
    $vendorRows = $vendStmt->fetchAll();

    $vendorSummary = [];
    foreach ($vendorRows as $row) {
        $vendorSummary[] = [
            'contact_id' => $row['contact_id'],
            'contact_name' => $row['contact_name'],
            'pan' => $row['pan'],
            'party_type' => 'Vendor',
            'tds_receivable' => 0,
            'tds_payable' => (float)$row['tds_payable'],
            'tds_expense' => 0,
            'total' => (float)$row['tds_payable'],
        ];
    }

    // Unified flat list — one row per party, regardless of Customer/Vendor
    $rows = array_merge(array_values($customerSummary), $vendorSummary);

    $netPayable = $byType['PAYABLE']['unpaid_amount'] + $byType['EXPENSE']['unpaid_amount'];

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "TDS summary fetched successfully.",
        "data" => $rows,
        "meta" => [
            "date_from" => $dateFrom,
            "date_to" => $dateTo,
            "fiscal_year" => $fiscalYear,
            "receivable_total" => $byType['RECEIVABLE']['total_amount'],
            "payable_total" => $byType['PAYABLE']['total_amount'],
            "expense_total" => $byType['EXPENSE']['total_amount'],
            "net_tds_payable" => $netPayable,
        ],
    ]);
    
} catch (PDOException $e) {
    error_log("TDS summary error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to generate TDS summary."
    ]);
}
