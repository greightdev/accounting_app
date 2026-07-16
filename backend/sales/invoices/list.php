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

// Optional filter: ?status=DRAFT or ?status=APPROVED
$status = $_GET['status'] ?? null;
$status = $status ? strtoupper($status) : null;
$validStatuses = ['DRAFT', 'APPROVED', 'VOID'];

$contactId = $_GET['contact_id'] ?? null;

try {
    $sql = "
        SELECT
            t.id,
            t.date,
            t.due_date,
            t.ref_number,
            t.sub_total,
            t.vat_amount,
            t.total_amount,
            t.notes,
            t.status,
            t.created_at,
            c.id AS contact_id,
            c.name AS customer_name,
            c.pan AS customer_pan,
            u.name AS created_by_name,
            COALESCE(SUM(ta.allocated_amount), 0) AS amount_paid
        FROM transactions t
        JOIN contacts c ON c.id = t.contact_id
        JOIN users u ON u.id = t.created_by
        LEFT JOIN transaction_allocations ta ON ta.settled_transaction_id = t.id
        WHERE t.type = 'SALES'
    ";

    $params = [];

    if ($status && in_array($status, $validStatuses, true)) {
        $sql .= " AND t.status = ?";
        $params[] = $status;
    }

    if ($contactId) {
        $sql .= " AND t.contact_id = ?";
        $params[] = $contactId;
    }

    $sql .= " GROUP BY t.id, t.ref_number, t.date, t.due_date, t.sub_total, t.vat_amount, t.total_amount, t.notes, t.status, t.created_at, c.id, c.name, c.pan, u.name
              ORDER BY t.date DESC, t.id DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $invoices = $stmt->fetchAll();

    // Line Items
    // Collect invoice IDs
    $invoiceIds = array_column($invoices, 'id');

    $itemsByInvoice = [];

    if (!empty($invoiceIds)) {
        // Create placeholders
        $placeholders = implode(',', array_fill(0, count($invoiceIds), '?'));

        $lineStmt = $pdo->prepare("
            SELECT
                ti.transaction_id,
                ti.id,
                ti.item_id,
                ti.description,
                ti.quantity,
                ti.rate,
                ti.taxable_amount,
                ti.vat_rate,
                ti.vat_amount,
                ti.total_amount,
                i.name AS item_name
            FROM transaction_items ti
            JOIN items i ON i.id = ti.item_id
            WHERE ti.transaction_id IN ($placeholders)
            ORDER BY ti.transaction_id, ti.id
        ");

        $lineStmt->execute($invoiceIds);

        while ($item = $lineStmt->fetch(PDO::FETCH_ASSOC)) {
            $itemsByInvoice[$item['transaction_id']][] = $item;
        }
    }

    $today = new DateTime('today');

    foreach ($invoices as &$invoice) {
        // Attach line items
        $invoice['line_items'] = $itemsByInvoice[$invoice['id']] ?? [];

        $paid = (float)$invoice['amount_paid'];
        $invoice['balance_due'] = round(
            (float)$invoice['total_amount'] - $paid,
            2
        );
        $balance = $invoice['balance_due'];

        $invoice['payment_status'] = null;
        if ($invoice['status'] === 'APPROVED') {
            if ($balance <= 0) $invoice['payment_status'] = 'Fully Paid';
            elseif ($paid > 0) $invoice['payment_status'] = 'Partially Paid';
            else {
                if (!empty($invoice['due_date'])) {
                    $due = new DateTime($invoice['due_date']);
                    $days = (int)$today->diff($due)->format('%r%a');

                    if ($days < 0) {
                        $invoice['payment_status'] = 'Overdue by ' . abs($days) . ' day' . (abs($days) === 1 ? '' : 's');
                    } else {
                        $invoice['payment_status'] = 'Due in ' . $days . ' day' . ($days === 1 ? '' : 's');
                    }
                } else {
                    $invoice['payment_status'] = 'Unpaid';
                }
            }
        }
    }

    unset($invoice);

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Invoices fetched successfully.",
        "data" => $invoices
    ]);

} catch (PDOException $e) {
    error_log("Get all invoices error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to fetch invoices."
    ]);
}
