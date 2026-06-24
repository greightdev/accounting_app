<?php

require_once '../server.php';
require_once '../db.php';
require_once '../includes/auth.php';

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

// Filter: ?type=Customer / Vendor / Employee
$typeFilter = $_GET['type'] ?? null;
 
try {
    $sql = "
        SELECT
            id,
            name,
            type,
            pan,
            phone,
            email,
            address,
            tds_deducted,
            opening_date,
            created_at,
            updated_at
        FROM contacts
        WHERE is_active = TRUE
    ";
    $params = [];

    if ($typeFilter && in_array($typeFilter, ['Customer', 'Vendor', 'Employee'], true)) {
        $sql .= " AND type = ?";
        $params[] = $typeFilter;
    }

    $sql .= " ORDER BY name";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $contacts = $stmt->fetchAll();

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Contacts fetched successfully.",
        "data" => $contacts
    ]);

} catch (PDOException $e) {
    error_log("Get all contacts error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to fetch contact."
    ]);
}
