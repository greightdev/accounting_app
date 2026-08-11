<?php

require_once "../server.php";
require_once "../db.php";
require_once "../includes/auth.php";
require_once "../includes/helpers.php";
require_once "../includes/audit.php";

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

if ($name === '') {
    $errors[] = "Account group name is required.";
} elseif (strlen($name) > 100) {
    $errors[] = "Account group name must be 100 characters or fewer.";
} elseif (!preg_match("/^[A-Za-z0-9\s.,'&()\/-]+$/", $name)) {
    $errors[] = "Account group name can only contain letters, numbers, spaces, and . , ' & ( ) / -";
}
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
    ");
    $stmt->execute([
        $name,
        $newCode,
        $type,
        $parentId,
    ]);
    $newId = (int) $pdo->lastInsertId();

    logAudit(
        $pdo,
        (int) $_SESSION['user_id'],
        'CREATE',
        'account_groups',
        $newId,
        null,
        ['name' => $name, 'parent_id' => (int)$parentId, 'code' => $newCode, 'type' => $type]
    );

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
    echo json_encode([
        "success" => false,
        "message" => "Failed to create account group."
    ]);
}
