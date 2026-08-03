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

$contactId = $_GET['contact_id'] ?? null;

try {
    $sql = "
        SELECT
            c.id AS contact_id,
            c.name AS vendor_name,
            c.pan,
            c.phone,
            c.email,
            c.opening_balance,
            c.opening_balance_type,
            COALESCE(bil.total_billed, 0) AS total_billed,
            COALESCE(pay.total_paid, 0) AS total_paid
        FROM contacts c
        LEFT JOIN (
            SELECT contact_id, SUM(total_amount) AS total_billed
            FROM transactions
            WHERE type = 'PURCHASE' AND status = 'APPROVED'
            GROUP BY contact_id
        ) bil ON bil.contact_id = c.id
        LEFT JOIN (
            SELECT contact_id, SUM(total_amount) AS total_paid
            FROM transactions
            WHERE type = 'PAYMENT' AND status = 'APPROVED'
            GROUP BY contact_id
        ) pay ON pay.contact_id = c.id
        WHERE c.type = 'Vendor'
            AND c.is_active = TRUE
            AND (COALESCE(bil.total_billed, 0) > 0 OR COALESCE(c.opening_balance, 0) > 0)
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

    $grandBilled = 0;
    $grandPaid = 0;
    $grandDue = 0;

    foreach ($rawRows as &$row) {
        $billed = (float)$row['total_billed'];
        $paid = (float)$row['total_paid'];
        $ob = (float)$row['opening_balance'];
        $obSigned = $row['opening_balance_type'] === 'CREDIT' ? $ob : -$ob;

        $balanceDue = $obSigned + $billed - $paid;

        $grandBilled += $billed;
        $grandPaid += $paid;
        $grandDue += $balanceDue;

        $rows[] = [
            'contact_id' => $row['contact_id'],
            'vendor_name' => $row['vendor_name'],
            'pan' => $row['pan'],
            'phone' => $row['phone'],
            'email' => $row['email'],
            'total_billed' => $billed,
            'total_paid' => $paid,
            'balance_due' => $balanceDue,
        ];
    }

    usort($rows, fn($a, $b) => $b['balance_due'] <=> $a['balance_due']);

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Vendor balances fetched successfully.",
        "data" => $rows,
        "meta" => [
            "total_billed" => $grandBilled,
            "total_paid" => $grandPaid,
            "total_due" => $grandDue,
        ],
    ]);
} catch (PDOException $e) {
    error_log("Vendor balances error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to generate vendor balances."
    ]);
}