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

$asOf = $_GET['as_of'] ?? date('Y-m-d');

try {
    $stmt = $pdo->prepare("
        SELECT
            t.id,
            t.ref_number,
            t.date AS bill_date,
            t.due_date,
            t.total_amount AS billed_amount,
            c.id AS contact_id,
            c.name AS vendor_name,
            c.pan,
            COALESCE(alloc.allocated, 0) AS paid_amount,
            t.total_amount - COALESCE(alloc.allocated, 0) AS outstanding,
            DATEDIFF(?, COALESCE(t.due_date, t.date)) AS days_overdue
        FROM transactions t
        JOIN contacts c ON c.id = t.contact_id
        LEFT JOIN (
            SELECT settled_transaction_id, SUM(allocated_amount) AS allocated
            FROM transaction_allocations
            GROUP BY settled_transaction_id
        ) alloc ON alloc.settled_transaction_id = t.id
        WHERE t.type = 'PURCHASE'
            AND t.status = 'APPROVED'
            AND COALESCE(t.due_date, t.date) <= ?
            AND t.total_amount - COALESCE(alloc.allocated, 0) > 0.01
        ORDER BY days_overdue DESC
    ");
    $stmt->execute([$asOf, $asOf]);
    $bills = $stmt->fetchAll();

    $totals = ['current' => 0, '30' => 0, '60' => 0, '90+' => 0, 'total' => 0];
    $vendorSummary = [];
    $rows = [];

    foreach ($bills as $bill) {
        $days = (int)$bill['days_overdue'];
        $outstanding = (float)$bill['outstanding'];
        $totals['total'] += $outstanding;

        if ($days <= 30) { $bucket = 'Current (0-30)'; $totals['current'] += $outstanding; }
        elseif ($days <= 60) { $bucket = '31-60 Days'; $totals['30'] += $outstanding; }
        elseif ($days <= 90) { $bucket = '61-90 Days'; $totals['60'] += $outstanding; }
        else { $bucket = '90+ Days'; $totals['90+'] += $outstanding; }

        $rows[] = [
            'id' => $bill['id'],
            'ref_number' => $bill['ref_number'],
            'bill_date' => $bill['bill_date'],
            'due_date' => $bill['due_date'],
            'vendor_name' => $bill['vendor_name'],
            'pan' => $bill['pan'],
            'billed_amount' => (float)$bill['billed_amount'],
            'paid_amount' => (float)$bill['paid_amount'],
            'outstanding' => $outstanding,
            'days_overdue' => $days,
            'bucket' => $bucket,
        ];

        $vid = $bill['contact_id'];
        if (!isset($vendorSummary[$vid])) {
            $vendorSummary[$vid] = [
                'contact_id' => $vid, 'vendor_name' => $bill['vendor_name'], 'pan' => $bill['pan'],
                'current' => 0, '30' => 0, '60' => 0, '90+' => 0, 'total' => 0,
            ];
        }
        $vendorSummary[$vid]['total'] += $outstanding;
        if ($days <= 30) $vendorSummary[$vid]['current'] += $outstanding;
        elseif ($days <= 60) $vendorSummary[$vid]['30'] += $outstanding;
        elseif ($days <= 90) $vendorSummary[$vid]['60'] += $outstanding;
        else $vendorSummary[$vid]['90+'] += $outstanding;
    }

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Payables ageing fetched successfully.",
        "data" => $rows,
        "meta" => [
            "as_of" => $asOf,
            "total_current" => $totals['current'],
            "total_30" => $totals['30'],
            "total_60" => $totals['60'],
            "total_90_plus" => $totals['90+'],
            "total_outstanding" => $totals['total'],
            "vendor_summary" => array_values($vendorSummary),
        ],
    ]);
    
} catch (PDOException $e) {
    error_log("Payables ageing error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to generate payables ageing."
    ]);
}