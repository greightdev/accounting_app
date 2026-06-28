<?php

function generateNextChildCode(PDO $pdo, int $parentId, string $parentCode): string
{
    $stmt = $pdo->prepare("
        SELECT code
        FROM account_groups
        WHERE parent_id = ? AND is_active = TRUE
        ORDER BY code DESC
        LIMIT 1
    ");
    $stmt->execute([$parentId]);
    $lastChild = $stmt->fetch();
 
    if ($lastChild) {
        // Extract last 2 digits from teh highest child code and increment
        $suffix = (int) substr($lastChild['code'], strlen($parentCode));
        $nextSuffix = $suffix + 1;
    } else {
        // No children yet - start at 01
        $nextSuffix = 1;
    }
 
    // Pad to 2 digits and append to parent code
    return $parentCode . str_pad($nextSuffix, 2, '0', STR_PAD_LEFT);
}

function cascadeCodeUpdate(PDO $pdo, int $groupId, string $oldPrefix, string $newPrefix, string $inheritedType): void {
    $childStmt = $pdo->prepare("
        SELECT id, code
        FROM account_groups
        WHERE parent_id = ? AND is_active = TRUE
    ");
    $updateStmt = $pdo->prepare("
        UPDATE account_groups
        SET code = ?, type = ?
        WHERE id = ?
    ");

    $childStmt->execute([$groupId]);
    $children = $childStmt->fetchAll();

    foreach ($children as $child) {
        // Swap the old prefix for the new one (rest of the suffix stays identical)
        $newChildCode = $newPrefix . substr($child['code'], strlen($oldPrefix));
        $updateStmt->execute([$newChildCode, $inheritedType, $child['id']]);
 
        // Recurse into this child's subtree
        cascadeCodeUpdate($pdo, $child['id'], $child['code'], $newChildCode, $inheritedType);
    }
}