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

        cascadeAccountCodeUpdate($pdo, $child['id'], $newChildCode);

        // Recurse into this child's subtree
        cascadeCodeUpdate($pdo, $child['id'], $child['code'], $newChildCode, $inheritedType);
    }
}

function cascadeAccountCodeUpdate(PDO $pdo, int $groupId, string $newGroupCode): void
{
    // Renumber all accounts under this group
    $accounts = $pdo->prepare("
        SELECT id FROM accounts
        WHERE account_group_id = ? AND is_active = TRUE
        ORDER BY code ASC
    ");
    $accounts->execute([$groupId]);
    $accountList = $accounts->fetchAll();

    $updateAccount = $pdo->prepare("
        UPDATE accounts
        SET code = ?
        WHERE id = ?
    ");

    foreach ($accountList as $index => $account) {
        $newCode = $newGroupCode . '.' . str_pad($index + 1, 5, '0', STR_PAD_LEFT);
        $updateAccount->execute([$newCode, $account['id']]);
    }
}

function generateAccountCode(PDO $pdo, int $groupId, string $groupCode, int $excludeId = 0): string {
    $stmt = $pdo->prepare("
        SELECT code
        FROM accounts
        WHERE account_group_id = ?
            AND is_active = TRUE
            AND id != ?
        ORDER BY code DESC
        LIMIT 1
    ");
    $stmt->execute([$groupId, $excludeId]);
    $last = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($last && preg_match('/\.(\d+)$/', $last['code'], $m)) {
        $next = (int)$m[1] + 1;
    } else {
        $next = 1;
    }

    return $groupCode . '.' . str_pad($next, 5, '0', STR_PAD_LEFT);
}