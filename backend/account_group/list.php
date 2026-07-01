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

try {
    // Fetch all active groups
    $stmt = $pdo->query("
        SELECT id, name, code, type, parent_id, is_active
        FROM account_groups
        WHERE is_active = TRUE
        ORDER BY code
    ");
    $flat = $stmt->fetchAll();

    // Build tree recursively
    $map = [];
    $tree = [];

    foreach ($flat as $group) {
        $group['children'] = [];
        $map[$group['id']] = $group;
    }

    foreach ($map as $id => &$group) {
        if ($group['parent_id'] === null) {
            $tree[] = &$group;
        } else {
            $map[$group['parent_id']]['children'][] = &$group;
        }
    }

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Account groups fetched successfully.",
        "data" => $tree,    // nested tree for the CoA tree
        "flat" => $flat     //flat list for dropdowns
    ]);

} catch (PDOException $e) {
    error_log("Get all account group error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to fetch account groups."
    ]);
}
