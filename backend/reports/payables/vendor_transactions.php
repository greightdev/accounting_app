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
$dateFrom = $_GET['date_from'] ?? null;
$dateTo = $_GET['date_to'] ?? null;

if (!$contactId) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "contact_id is required."
    ]);
    exit();
}

try {
    // Fetch vendor details
    $contactStmt = $pdo->prepare("
        SELECT id, name, pan, phone, email, address, opening_balance, opening_balance_type
        FROM contacts
        WHERE id = ? AND type = 'Vendor' AND is_active = TRUE
    ");
    $contactStmt->execute([$contactId]);
    $contact = $contactStmt->fetch();

    if (!$contact) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Vendor not found."
        ]);
        exit();
    }

    // Fetch all bills and payments for this vendor
    $sql = "
        SELECT
            t.id,
            t.type,
            t.ref_number,
            t.date,
            t.sub_total,
            t.vat_amount,
            t.tds_amount,
            t.total_amount,
            t.status,
            t.notes,
            u.name AS created_by_name
        FROM transactions t
        JOIN users u ON u.id = t.created_by
        WHERE t.contact_id = ? AND t.type IN ('PURCHASE', 'PAYMENT') AND t.status = 'APPROVED'
    ";
    $params = [$contactId];

    if ($dateFrom) { $sql .= " AND t.date >= ?"; $params[] = $dateFrom; }
    if ($dateTo) { $sql .= " AND t.date <= ?"; $params[] = $dateTo; }

    $sql .= " ORDER BY t.date ASC, t.id ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $transactions = $stmt->fetchAll();

    $rows = [];
    $totalBilled = 0;
    $totalPaid = 0;
    $totalTds = 0;

    foreach ($transactions as $tx) {
        $rows[] = [
            'id' => $tx['id'],
            'date' => $tx['date'],
            'ref_number' => $tx['ref_number'],
            'type' => $tx['type'],
            'sub_total' => (float)$tx['sub_total'],
            'vat_amount' => (float)$tx['vat_amount'],
            'tds_amount' => (float)$tx['tds_amount'],
            'total_amount' => (float)$tx['total_amount'],
            'status' => $tx['status'],
            'notes' => $tx['notes'],
            'created_by_name' => $tx['created_by_name'],
        ];

        if ($tx['type'] === 'PURCHASE') {
            $totalBilled += (float)$tx['total_amount'];
        } else {
            $totalPaid += (float)$tx['total_amount'];
            $totalTds += (float)$tx['tds_amount'];
        }
    }

    $ob = (float)$contact['opening_balance'];
    $obSigned = $contact['opening_balance_type'] === 'CREDIT' ? $ob : -$ob;
    $balanceDue = $obSigned + $totalBilled - $totalPaid;

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Vendor transactions fetched successfully.",
        "data" => $rows,
        "meta" => [
            "contact" => $contact,
            "date_from" => $dateFrom,
            "date_to" => $dateTo,
            "total_billed" => $totalBilled,
            "total_paid" => $totalPaid,
            "total_tds" => $totalTds,
            "balance_due" => $balanceDue,
        ],
    ]);
    
} catch (PDOException $e) {
    error_log("Vendor transactions error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to generate vendor transactions."
    ]);
}