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

$contactId = $_GET['contact_id'] ?? null; // optional — single customer

try {
    // Get all customers with their net receivable balance
    // Balance = total invoiced - total received
    $sql = "
        SELECT
            c.id AS contact_id,
            c.name AS customer_name,
            c.pan,
            c.phone,
            c.email,
            c.opening_balance,
            c.opening_balance_type,
            COALESCE(inv.total_invoiced, 0) AS total_invoiced,
            COALESCE(rec.total_received, 0) AS total_received
        FROM contacts c
        LEFT JOIN (
            SELECT contact_id, SUM(total_amount) AS total_invoiced
            FROM transactions
            WHERE type = 'SALES' AND status = 'APPROVED'
            GROUP BY contact_id
        ) inv ON inv.contact_id = c.id
        LEFT JOIN (
            SELECT contact_id, SUM(total_amount) AS total_received
            FROM transactions
            WHERE type = 'RECEIPT' AND status = 'APPROVED'
            GROUP BY contact_id
        ) rec ON rec.contact_id = c.id
        WHERE c.type = 'Customer'
            AND c.is_active = TRUE
            AND (
                COALESCE(inv.total_invoiced, 0) > 0
                OR COALESCE(c.opening_balance, 0) > 0
            )
    ";
    $params = [];

    if ($contactId) {
        $sql .= " AND c.id = ?";
        $params[] = $contactId;
    }

    $sql .= " ORDER BY c.name";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rawRows = $stmt->fetchAll();

    $rows = [];
    $grandInvoiced = 0;
    $grandReceived = 0;
    $grandDue = 0;

    foreach ($rawRows as $row) {
        $invoiced = (float)$row['total_invoiced'];
        $received = (float)$row['total_received'];
        $ob = (float)$row['opening_balance'];
        $obSigned = $row['opening_balance_type'] === 'DEBIT' ? $ob : -$ob;

        $balanceDue = $obSigned + $invoiced - $received;

        $grandInvoiced += $invoiced;
        $grandReceived += $received;
        $grandDue += $balanceDue;

        $rows[] = [
            'contact_id' => $row['contact_id'],
            'customer_name' => $row['customer_name'],
            'pan' => $row['pan'],
            'phone' => $row['phone'],
            'email' => $row['email'],
            'total_invoiced' => $invoiced,
            'total_received' => $received,
            'balance_due' => $balanceDue,
        ];
    }

    // Sort by balance due, highest first
    usort($rows, fn($a, $b) => $b['balance_due'] <=> $a['balance_due']);

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Customer balances fetched successfully.",
        "data" => $rows,
        "meta" => [
            "total_invoiced" => $grandInvoiced,
            "total_received" => $grandReceived,
            "total_due" => $grandDue,
        ],
    ]);

} catch (PDOException $e) {
    error_log("Customer balances error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to generate customer balances."
    ]);
}
