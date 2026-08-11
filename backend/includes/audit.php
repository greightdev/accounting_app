<?php

function logAudit(PDO $pdo, int $userId, string $action, string $tableName, int $recordId, ?array $oldValue, ?array $newValue): void
{
    try {
        $stmt = $pdo->prepare("
            INSERT INTO audit_logs (user_id, action, table_name, record_id, old_value, new_value, ip_address)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $userId,
            $action,
            $tableName,
            $recordId,
            $oldValue !== null ? json_encode($oldValue) : null,
            $newValue !== null ? json_encode($newValue) : null,
            $_SERVER['REMOTE_ADDR'] ?? null,
        ]);
    } catch (PDOException $e) {
        error_log("Audit log write failed: " . $e->getMessage());
    }
}