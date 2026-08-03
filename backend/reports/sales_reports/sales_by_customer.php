<?php

require_once '../../server.php';
require_once '../../db.php';
require_once '../../includes/auth.php';
require_once '../../includes/report.php';

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

try {
    $report = generateContactSummaryReport(
        $pdo,
        'SALES',
        $dateFrom,
        $dateTo
    );

    http_response_code(200);
    echo json_encode($report);
    
} catch (PDOException $e) {
    error_log("Sales by customer error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to generate sales by customer."
    ]);
}