<?php

require_once '../server.php';
require_once '../db.php';
require_once '../includes/auth.php';

requireRole(['admin', 'accountant']);

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Method not allowed"
    ]);
    exit();
}

// Optional filters
$fiscalYear = $_GET['fiscal_year'] ?? null;
$tdsType = $_GET['tds_type'] ?? null; // PAYABLE, RECEIVABLE, EXPENSE
$isPaid = $_GET['is_paid'] ?? null; // 'true' or 'false'

$validTypes = ['PAYABLE', 'RECEIVABLE', 'EXPENSE'];

try {
    $sql = "
        SELECT
            te.id,
            te.tds_amount,
            te.tds_type,
            te.fiscal_year,
            te.date,
            te.is_paid,
            te.pan,
            c.id   AS contact_id,
            c.name AS contact_name,
            t.ref_number,
            pt.ref_number AS paid_via_ref
        FROM tds_entries te
        JOIN contacts c ON c.id  = te.contact_id
        JOIN transactions t ON t.id  = te.transaction_id
        LEFT JOIN transactions pt ON pt.id = te.paid_via_tx_id
        WHERE t.status = 'APPROVED'
    ";
    $params = [];

    if ($fiscalYear) {
        $sql .= " AND te.fiscal_year = ?";
        $params[] = $fiscalYear;
    }

    if ($tdsType && in_array($tdsType, $validTypes, true)) {
        $sql .= " AND te.tds_type = ?";
        $params[] = $tdsType;
    }

    if ($isPaid !== null) {
        $sql .= " AND te.is_paid = ?";
        $params[] = $isPaid === 'true' ? 1 : 0;
    }

    $sql .= " ORDER BY te.date DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $entries = $stmt->fetchAll();

    // Summary totals by type
    $summary = [
        'PAYABLE' => 0,
        'RECEIVABLE' => 0,
        'EXPENSE' => 0,
    ];
    foreach ($entries as $entry) {
        $summary[$entry['tds_type']] += (float)$entry['tds_amount'];
    }

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "TDS entries fetched successfully.",
        "data" => $entries,
        "summary" => $summary,
    ]);
} catch (PDOException $e) {
    error_log("List TDS entries error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to fetch TDS entries."
    ]);
}