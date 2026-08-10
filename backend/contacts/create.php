<?php

require_once '../server.php';
require_once '../db.php';
require_once '../includes/auth.php';

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
$type = $data['type'] ?? '';
$address = trim($data['address'] ?? '');
$email = trim($data['email'] ?? '');
$phone = trim($data['phone'] ?? '');
$pan = trim($data['pan'] ?? '');
$tdsDeducted = ($data['tds_deducted'] ?? false) ? 1 : 0;
$openingDate = $data['opening_date'] ?? null;

// Validation
$errors = [];

if ($name === '') $errors[] = "Contact name is required.";
if ($name !== '' && !preg_match("/^[A-Za-z\s.,'&-]+$/", $name)) {
    $errors[] = "Contact name can only contain letters, spaces, and . , ' & -";
}
if (!in_array($type, ['Customer', 'Vendor', 'Employee'], true)) $errors[] = "Type must be Customer, Vendor or Employee.";
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = "Enter a valid email.";
if ($pan !== '' && !preg_match('/^\d{9}$/', $pan)) {
    $errors[] = "PAN must be exactly 9 digits, numbers only.";
}
if ($phone !== '' && !preg_match('/^98\d{8}$/', $phone)) {
    $errors[] = "Phone number must be 10 digits and start with 98.";
}

if ($errors) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => implode(' ', $errors)
    ]);
    exit();
}

try {
    // Duplicate check
    $dupCheck = $pdo->prepare("
        SELECT id
        FROM contacts
        WHERE email = ? AND is_active = TRUE
    ");
    $dupCheck->execute([$email]);
    if ($dupCheck->fetch()) {
        http_response_code(409);
        echo json_encode([
            "success" => false,
            "message" => "A contact with this email already exists."
        ]);
        exit();
    }

    $stmt = $pdo->prepare("
        INSERT INTO contacts(
            name,
            type,
            pan,
            phone,
            email,
            address,
            tds_deducted,
            opening_date
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?
        )
    ");

    $stmt->execute([
        $name,
        $type,
        $pan ?: null,
        $phone ?: null,
        $email ?: null,
        $address ?: null,
        $tdsDeducted,
        $openingDate
    ]);
    $newId = (int) $pdo->lastInsertId();

    http_response_code(201);
    echo json_encode([
        "success" => true,
        "message" => "Contact created successfully.",
        "data" => ["id" => $newId]
    ]);

} catch (PDOException $e) {
    error_log("Create contact error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to create contact."
    ]);
}
