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
    // Get each unpaid/partially paid invoice with its due date
    $stmt = $pdo->prepare("
        SELECT
            t.id,
            t.ref_number,
            t.date AS invoice_date,
            t.due_date,
            t.total_amount AS invoiced_amount,
            c.id AS contact_id,
            c.name AS customer_name,
            c.pan,
            COALESCE(alloc.allocated, 0) AS received_amount,
            t.total_amount - COALESCE(alloc.allocated, 0) AS outstanding,
            DATEDIFF(?, COALESCE(t.due_date, t.date)) AS days_overdue
        FROM transactions t
        JOIN contacts c ON c.id = t.contact_id
        LEFT JOIN (
            SELECT settled_transaction_id, SUM(allocated_amount) AS allocated
            FROM transaction_allocations
            GROUP BY settled_transaction_id
        ) alloc ON alloc.settled_transaction_id = t.id
        WHERE t.type = 'SALES'
            AND t.status = 'APPROVED'
            AND COALESCE(t.due_date, t.date) <= ?
            AND t.total_amount - COALESCE(alloc.allocated, 0) > 0.01
        ORDER BY days_overdue DESC
    ");
    $stmt->execute([$asOf, $asOf]);
    $invoices = $stmt->fetchAll();

    // Bucket into ageing periods
    $totals = ['current' => 0, '30' => 0, '60' => 0, '90+' => 0, 'total' => 0];
    $customerSummary = [];
    $rows = [];

    foreach ($invoices as $inv) {
        $days = (int)$inv['days_overdue'];
        $outstanding = (float)$inv['outstanding'];
        $totals['total'] += $outstanding;

        if ($days <= 30) { $bucket = 'Current (0-30)'; $totals['current'] += $outstanding; }
        elseif ($days <= 60) { $bucket = '31-60 Days'; $totals['30'] += $outstanding; }
        elseif ($days <= 90) { $bucket = '61-90 Days'; $totals['60'] += $outstanding; }
        else { $bucket = '90+ Days'; $totals['90+'] += $outstanding; }

        $rows[] = [
            'id' => $inv['id'],
            'ref_number' => $inv['ref_number'],
            'invoice_date' => $inv['invoice_date'],
            'due_date' => $inv['due_date'],
            'customer_name' => $inv['customer_name'],
            'pan' => $inv['pan'],
            'invoiced_amount' => (float)$inv['invoiced_amount'],
            'received_amount' => (float)$inv['received_amount'],
            'outstanding' => $outstanding,
            'days_overdue' => $days,
            'bucket' => $bucket,
        ];

        $cid = $inv['contact_id'];
        if (!isset($customerSummary[$cid])) {
            $customerSummary[$cid] = [
                'contact_id' => $cid, 'customer_name' => $inv['customer_name'], 'pan' => $inv['pan'],
                'current' => 0, '30' => 0, '60' => 0, '90+' => 0, 'total' => 0,
            ];
        }
        $customerSummary[$cid]['total'] += $outstanding;
        if ($days <= 30) $customerSummary[$cid]['current'] += $outstanding;
        elseif ($days <= 60) $customerSummary[$cid]['30'] += $outstanding;
        elseif ($days <= 90) $customerSummary[$cid]['60'] += $outstanding;
        else $customerSummary[$cid]['90+'] += $outstanding;
    }

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Receivables ageing fetched successfully.",
        "data" => $rows,
        "meta" => [
            "as_of" => $asOf,
            "total_current" => $totals['current'],
            "total_30" => $totals['30'],
            "total_60" => $totals['60'],
            "total_90_plus" => $totals['90+'],
            "total_outstanding" => $totals['total'],
            "customer_summary" => array_values($customerSummary),
        ],
    ]);

} catch (PDOException $e) {
    error_log("Receivables ageing error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to generate receivables ageing."
    ]);
}
