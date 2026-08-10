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

// Default to current month, but allow override
$monthStart = $_GET['month_start'] ?? date('Y-m-01');
$monthEnd = $_GET['month_end'] ?? date('Y-m-t');

try {
    // 1. Total Sales this month
    $stmt = $pdo->prepare("
        SELECT COALESCE(SUM(total_amount), 0) AS total
        FROM transactions
        WHERE type = 'SALES' AND status = 'APPROVED' AND date BETWEEN ? AND ?
    ");
    $stmt->execute([$monthStart, $monthEnd]);
    $totalSales = (float)$stmt->fetch()['total'];

    // 2. Total Purchase this month
    $stmt = $pdo->prepare("
        SELECT COALESCE(SUM(total_amount), 0) AS total
        FROM transactions
        WHERE type = 'PURCHASE' AND status = 'APPROVED' AND date BETWEEN ? AND ?
    ");
    $stmt->execute([$monthStart, $monthEnd]);
    $totalPurchase = (float)$stmt->fetch()['total'];

    // 3. Total Receipts, net after TDS
    $stmt = $pdo->prepare("
        SELECT
            COALESCE(SUM(total_amount), 0) AS gross,
            COALESCE(SUM(tds_amount), 0) AS tds
        FROM transactions
        WHERE type = 'RECEIPT' AND status = 'APPROVED' AND date BETWEEN ? AND ?
    ");
    $stmt->execute([$monthStart, $monthEnd]);
    $receiptRow = $stmt->fetch();
    $totalReceiptsNet = (float)$receiptRow['gross'] - (float)$receiptRow['tds'];

    // 4. Total Payments, net after TDS
    $stmt = $pdo->prepare("
        SELECT
            COALESCE(SUM(total_amount), 0) AS gross,
            COALESCE(SUM(tds_amount), 0) AS tds
        FROM transactions
        WHERE type = 'PAYMENT' AND status = 'APPROVED' AND date BETWEEN ? AND ?
    ");
    $stmt->execute([$monthStart, $monthEnd]);
    $paymentRow = $stmt->fetch();
    $totalPaymentsNet = (float)$paymentRow['gross'] - (float)$paymentRow['tds'];

    // 5. Total TDS Collected FROM customers (RECEIVABLE type — customer deducted from us)
    $stmt = $pdo->prepare("
        SELECT COALESCE(SUM(te.tds_amount), 0) AS total
        FROM tds_entries te
        JOIN transactions t ON t.id = te.transaction_id
        WHERE te.tds_type = 'RECEIVABLE' AND t.status = 'APPROVED' AND te.date BETWEEN ? AND ?
    ");
    $stmt->execute([$monthStart, $monthEnd]);
    $tdsFromCustomers = (float)$stmt->fetch()['total'];

    // 6. Total TDS Deducted FROM vendors (PAYABLE type — we deducted from them)
    $stmt = $pdo->prepare("
        SELECT COALESCE(SUM(te.tds_amount), 0) AS total
        FROM tds_entries te
        JOIN transactions t ON t.id = te.transaction_id
        WHERE te.tds_type = 'PAYABLE' AND t.status = 'APPROVED' AND te.date BETWEEN ? AND ?
    ");
    $stmt->execute([$monthStart, $monthEnd]);
    $tdsFromVendors = (float)$stmt->fetch()['total'];

    // 7. Total TDS Paid BY company (EXPENSE type — customer didn't deduct)
    $stmt = $pdo->prepare("
        SELECT COALESCE(SUM(te.tds_amount), 0) AS total
        FROM tds_entries te
        JOIN transactions t ON t.id = te.transaction_id
        WHERE te.tds_type = 'EXPENSE' AND t.status = 'APPROVED' AND te.date BETWEEN ? AND ?
    ");
    $stmt->execute([$monthStart, $monthEnd]);
    $tdsExpense = (float)$stmt->fetch()['total'];

    // 8. Bank Balance — sum across all active bank_accounts (Cash + real banks), all-time
    $stmt = $pdo->query("
        SELECT
            ba.id, ba.name, ba.account_type,
            COALESCE(SUM(le.debit), 0) - COALESCE(SUM(le.credit), 0) AS balance
        FROM bank_accounts ba
        JOIN accounts a ON a.id = ba.account_id
        LEFT JOIN ledger_entries le ON le.account_id = a.id
        LEFT JOIN transactions t ON t.id = le.transaction_id AND t.status = 'APPROVED'
        WHERE ba.is_active = TRUE
        GROUP BY ba.id, ba.name, ba.account_type
        ORDER BY ba.name
    ");
    $bankAccounts = $stmt->fetchAll();
    $totalBankBalance = array_sum(array_column($bankAccounts, 'balance'));

    // 9. Outstanding Receivables — all-time, all customers
    $stmt = $pdo->query("
        SELECT COALESCE(SUM(le.debit), 0) - COALESCE(SUM(le.credit), 0) AS balance
        FROM ledger_entries le
        JOIN accounts a ON a.id = le.account_id
        JOIN transactions t ON t.id = le.transaction_id
        WHERE a.name = 'Customer Receivable' AND t.status = 'APPROVED'
    ");
    $outstandingReceivables = (float)$stmt->fetch()['balance'];

    // 10. Outstanding Payables — all-time, all vendors
    $stmt = $pdo->query("
        SELECT COALESCE(SUM(le.credit), 0) - COALESCE(SUM(le.debit), 0) AS balance
        FROM ledger_entries le
        JOIN accounts a ON a.id = le.account_id
        JOIN transactions t ON t.id = le.transaction_id
        WHERE a.name = 'Vendor Payable' AND t.status = 'APPROVED'
    ");
    $outstandingPayables = (float)$stmt->fetch()['balance'];

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Dashboard summary fetched successfully.",
        "data" => [
            "month_start" => $monthStart,
            "month_end" => $monthEnd,
            "total_sales" => $totalSales,
            "total_purchase" => $totalPurchase,
            "total_receipts_net" => $totalReceiptsNet,
            "total_payments_net" => $totalPaymentsNet,
            "tds_from_customers" => $tdsFromCustomers,
            "tds_from_vendors" => $tdsFromVendors,
            "tds_expense" => $tdsExpense,
            "total_bank_balance" => $totalBankBalance,
            "bank_accounts" => $bankAccounts,
            "outstanding_receivables" => $outstandingReceivables,
            "outstanding_payables" => $outstandingPayables,
        ],
    ]);
} catch (PDOException $e) {
    error_log("Dashboard summary error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Failed to generate dashboard summary."]);
}