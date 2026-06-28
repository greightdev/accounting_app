<?php

require_once '../server.php';
require_once '../db.php';
require_once '../includes/auth.php';
require_once '../includes/helpers.php';

requireRole(['admin', 'accountant']);

// Only accept PUT
if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
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

$id = isset($data['id']) ? (int) $data['id'] : 0;
$name = trim($data['name'] ?? '');
$parentId = $data['parent_id'] ?? null;

// Validation
$errors = [];

if ($id <= 0) $errors[] = 'A valid account group ID is required';
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
    // Check group exists
    $existing = $pdo->prepare("
        SELECT id, name, code, parent_id
        FROM account_groups
        WHERE id = ? AND is_active = TRUE
    ");
    $existing->execute([$id]);
    $group = $existing->fetch();

    if (!$group) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Account group not found."
        ]);
        exit();
    }

    // Root groups cannot be edited
    if ($group['parent_id'] === null) {
        http_response_code(403);
        echo json_encode([
            "success" => false,
            "message" => "Root groups cannot be edited."
        ]);
        exit();
    }

    // Prevent a group being set as its own parent
    if ((int)$parentId === $id) {
        http_response_code(422);
        echo json_encode([
            "success" => false,
            "message" => "A group cannot be its own parent."
        ]);
        exit();
    }

    // Prevent circular references
    $decendants = getDecendantsIds($pdo, $id);
    if (in_array((int)$parentId, $decendants, true)) {
        http_response_code(422);
        echo json_encode([
            "success" => false,
            "message" => "Cannot move a group under one of its own children."
        ]);
        exit();
    }

    // Validate new parent exists
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
    if (strtolower($name) !== strtolower($group['name'])) {
        $dupCheck = $pdo->prepare("
            SELECT id
            FROM account_groups
            WHERE LOWER(name) = LOWER(?) AND id != ? AND is_active = TRUE
        ");
        $dupCheck->execute([$name, $id]);
        if ($dupCheck->fetch()) {
            http_response_code(409);
            echo json_encode([
                "success" => false,
                "message" => "An account group with this name already exists."
            ]);
            exit();
        }
    }

    $newType = $parent['type'];
    $parentChanged = (int)$parentId !== (int)$group['parent_id'];

    // Code (Generate new if parent has been changed)
    $newCode = $group['code'];

    if ($parentChanged) {
        $newCode = generateNextChildCode($pdo, $parentId, $parent['code']);
    }

    // Update
    $pdo->beginTransaction();

    $stmt = $pdo->prepare("
        UPDATE account_groups
        SET
            name = ?,
            code = ?,
            type = ?,
            parent_id = ?
        WHERE id = ?
    ");
    $stmt->execute([
        $name,
        $newCode,
        $newType,
        $parentId,
        $id
    ]);

    // If the code changed, cascade the new prefix to all children
    if ($parentChanged && $newCode !== $group['code']) {
        cascadeCodeUpdate($pdo, $id, $group['code'], $newCode, $newType);
        cascadeAccountCodeUpdate($pdo, $id, $newCode);
    }

    $pdo->commit();

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Account group updated successfully.",
    ]);

} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Update account group error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to update account group."
    ]);
}

// Collect all decendant IDs for circular reference check
function getDecendantsIds(PDO $pdo, int $groupId): array {
    $ids = [];
    $stmt = $pdo->prepare("
        SELECT id
        FROM account_groups
        WHERE parent_id = ? AND is_active = TRUE
    ");
    $queue = [$groupId];

    while (!empty($queue)) {
        $current = array_shift($queue);
        $stmt->execute([$current]);
        $children = $stmt->fetchAll(PDO::FETCH_COLUMN);
        foreach ($children as $childId) {
            $ids[] = (int)$childId;
            $queue[] = (int)$childId;
        }
    }

    return $ids;
}


