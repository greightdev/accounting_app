<?php

require_once '../server.php';
require_once '../db.php';
require_once '../includes/auth.php';

requireRole(['admin']);

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
$action = $_GET['action'] ?? null;
$tableName = $_GET['table_name'] ?? null;
$userId = $_GET['user_id'] ?? null;
$search = trim($_GET['search'] ?? '');
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : null;
if ($limit !== null && ($limit <= 0 || $limit > 500)) {
    $limit = null;
}
 
$validActions = ['CREATE', 'UPDATE', 'DELETE', 'VOID'];

try {
    $where = [];
    $params = [];
 
    if ($dateFrom) {
        $where[] = "DATE(al.created_at) >= ?";
        $params[] = $dateFrom;
    }
    if ($dateTo) {
        $where[] = "DATE(al.created_at) <= ?";
        $params[] = $dateTo;
    }
    if ($action && in_array($action, $validActions, true)) {
        $where[] = "al.action = ?";
        $params[] = $action;
    }
    if ($tableName) {
        $where[] = "al.table_name = ?";
        $params[] = $tableName;
    }
    if ($userId) {
        $where[] = "al.user_id = ?";
        $params[] = (int)$userId;
    }
    if ($search !== '') {
        $where[] = "(u.name LIKE ? OR al.table_name LIKE ? OR al.record_id = ?)";
        $like = "%{$search}%";
        $params[] = $like;
        $params[] = $like;
        $params[] = is_numeric($search) ? (int)$search : -1;
    }
 
    $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';
    $limitSql = $limit !== null ? "LIMIT $limit" : '';

    $stmt = $pdo->prepare("
        SELECT
            al.id,
            al.user_id,
            u.name AS user_name,
            al.action,
            al.table_name,
            al.record_id,
            al.old_value,
            al.new_value,
            al.ip_address,
            al.created_at
        FROM audit_logs al
        LEFT JOIN users u ON u.id = al.user_id
        $whereSql
        ORDER BY al.created_at DESC, al.id DESC
        $limitSql
    ");
    $stmt->execute($params);
    $rows = $stmt->fetchAll();
 
    $logs = array_map(function ($row) {
        return [
            'id' => (int) $row['id'],
            'user_id' => $row['user_id'] !== null ? (int) $row['user_id'] : null,
            'user_name' => $row['user_name'] ?? 'Unknown user',
            'action' => $row['action'],
            'table_name' => $row['table_name'],
            'record_id' => (int) $row['record_id'],
            'old_value' => $row['old_value'] ? json_decode($row['old_value'], true) : null,
            'new_value' => $row['new_value'] ? json_decode($row['new_value'], true) : null,
            'ip_address' => $row['ip_address'],
            'created_at' => $row['created_at'],
        ];
    }, $rows);
 
    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Activity log fetched successfully.",
        "data" => $logs,
    ]);
} catch (PDOException $e) {
    error_log("Audit log list error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to fetch activity log."
    ]);
}