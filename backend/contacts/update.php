<?php

require_once '../server.php';
require_once '../db.php';
require_once '../includes/auth.php';

requireRole(['admin', 'accountant']);

// Only accept POST
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
$type = $data['type'] ?? '';
$address = trim($data['address'] ?? '');
$email = trim($data['email'] ?? '');
$phone = trim($data['phone'] ?? '');
$pan = trim($data['pan'] ?? '');
$tdsDeducted = ($data['tds_deducted'] ?? false) ? 'true' : 'false';

// Validation
$errors = [];

if ($id <= 0) $errors[] = 'A valid contact ID is required';
if ($name === '') $errors[] = "Contact name is required.";
if (!in_array($type, ['Customer', 'Vendor', 'Employee'], true)) $errors[] = "Type must be Customer, Vendor or Employee.";
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = "Enter a valid email.";

if ($errors) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => implode(' ', $errors)
    ]);
    exit();
}

try {
    // Check contact exists
    $existing = $pdo->prepare("
        SELECT id, email
        FROM contacts
        WHERE id = ? AND is_active = TRUE
    ");
    $existing->execute([$id]);
    $contacts = $existing->fetch();

    if (!$contacts) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Contact not found."
        ]);
        exit();
    }

    // Duplicate check
    if ($email !== $contacts['email']) {
        $dupCheck = $pdo->prepare("
            SELECT id
            FROM contacts
            WHERE email = ? AND id != ? AND is_active = TRUE
        ");
        $dupCheck->execute([$email, $id]);
        if ($dupCheck->fetch()) {
            http_response_code(409);
            echo json_encode([
                "success" => false,
                "message" => "A contact with this email already exists."
            ]);
            exit();
        }
    }

    $stmt = $pdo->prepare("
        UPDATE contacts
        SET
            name = ?,
            type = ?,
            pan = ?,
            phone = ?,
            email = ?,
            address = ?,
            tds_deducted = ?
        WHERE id = ?
    ");
    $stmt->execute([
        $name,
        $type,
        $pan ?: null,
        $phone ?: null,
        $email ?: null,
        $address ?: null,
        $tdsDeducted,
        $id
    ]);

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Contact updated successfully.",
    ]);

} catch (PDOException $e) {
    error_log("Update contact error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to update contact."
    ]);
}
