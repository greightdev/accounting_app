<?php

require_once "../server.php";
require_once "../db.php";
require_once "../includes/auth.php";
require_once "../includes/helpers.php";

requireRole(['admin', 'accountant']);

// Only accept POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Method not allowed"
    ]);
    exit();
}

// Parse JSON body
$data = json_decode(file_get_contents('php://input'), true);

if (!$data) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "No input received."
    ]);
    exit();
}

$name = trim($data['name'] ?? '');
$parentId = $data['parent_id'] ?? null;

// Validation
$errors = [];

if ($name === '') $errors[] = "Account group name is required.";
if (!$parentId) $errors[] = "Parent group is required.";

if ($errors) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => implode(' ', $errors)
    ]);
    exit();
}

try {
    // Validate parent group exists
    $parentStmt = $pdo->prepare("
        SELECT id, code, type
        FROM account_groups
        WHERE id = ? AND is_active = TRUE
    ");
    $parentStmt->execute([$parentId]);
    $parent = $parentStmt->fetch();

    if (!$parent) {
        http_response_code(422);
        echo json_encode([
            "success" => false,
            "message" => "Selected parent group does not exist."
        ]);
        exit();
    }

    // Duplicate name check
    $dupName = $pdo->prepare("
        SELECT id
        FROM account_groups
        WHERE LOWER(name) = LOWER(?) and is_active = TRUE
    ");
    $dupName->execute([$name]);
    if ($dupName->fetch()) {
        http_response_code(422);
        echo json_encode([
            "success" => false,
            "message" => "An account group with this name already exists."
        ]);
        exit();
    }

    // Generate code
    $parentCode = $parent['code'];
    $newCode = generateNextChildCode($pdo, $parentId, $parentCode);

    // Inherit type from parent
    $type = $parent['type'];

    $stmt = $pdo->prepare("
        INSERT INTO account_groups (
            name,
            code,
            type,
            parent_id
        )
        VALUES (?, ?, ?, ?)
        RETURNING id
    ");
    $stmt->execute([
        $name,
        $newCode,
        $type,
        $parentId,
    ]);
    $newId = $stmt->fetch()['id'];

    http_response_code(201);
    echo json_encode([
        "success" => true,
        "message" => "Account group created successfully.",
        "data" => [
            "id" => $newId,
            "code" => $newCode,
            "type" => $type
        ]
    ]);
} catch (PDOException $e) {
    error_log("Create account group error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Failed to create account group."]);
}
