<?php

require_once '../../server.php';
require_once '../../db.php';
require_once '../../includes/auth.php';

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
$contactId = $data['contact_id'] ?? null;
$date = $data['date'] ?? '';
$dueDate = $data['due_date'] ?? '';
$notes = trim($data['notes'] ?? '');
$lineItems = $data['line_items'] ?? [];

// Validation
$errors = [];

if ($id <= 0) $errors[] = 'A valid invoice ID is required';
if (!$contactId) $errors[] = "Customer is required.";
if (empty($date)) $errors[] = "Date is required.";
if (empty($dueDate)) $errors[] = "Due date is required.";
if (strtotime($dueDate) < strtotime($date)) $errors[] = "Due date cannot be before invoice date.";
if (empty($lineItems)) $errors[] = "At least one line item is required.";

if ($errors) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => implode(' ', $errors)
    ]);
    exit();
}

try {
    // Check invoice exists
    $existing = $pdo->prepare("
        SELECT id, status, ref_number
        FROM transactions
        WHERE id = ? AND type = 'SALES'
    ");
    $existing->execute([$id]);
    $invoice = $existing->fetch();

    if (!$invoice) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Invoice not found."
        ]);
        exit();
    }

    // Approved invoices cannot be edited — only voided and re-created
    if ($invoice['status'] === 'APPROVED') {
        http_response_code(403);
        echo json_encode([
            "success" => false,
            "message" => "Approved invoices cannot be edited. Void this invoice and create a new one."
        ]);
        exit();
    }

    if ($invoice['status'] === 'VOID') {
        http_response_code(403);
        echo json_encode([
            "success" => false,
            "message" => "Voided invoices cannot be edited."
        ]);
        exit();
    }

    // Validate contact
    $contactStmt = $pdo->prepare("
        SELECT id, name
        FROM contacts
        WHERE id = ? AND type IN ('Customer') AND is_active = TRUE
    ");
    $contactStmt->execute([$contactId]);
    $contact = $contactStmt->fetch();

    if (!$contact) {
        http_response_code(422);
        echo json_encode([
            "success" => false,
            "message" => "Customer not found."
        ]);
        exit();
    }

    // Recompute line items
    $computedLines = [];
    $subTotal = 0;
    $vatTotal = 0;

    foreach ($lineItems as $idx => $line) {
        $itemId = $line['item_id'] ?? null;
        $quantity = (int)($line['quantity'] ?? 0);
        $rate = (float)($line['rate'] ?? 0);
        $taxRate = (float)($line['tax_rate'] ?? 13);
        $description = trim($line['description'] ?? '');

        if (!$itemId || $quantity <= 0) {
            $errors[] = "Line " . ($idx + 1) . ": item and quantity are required.";
            continue;
        }

        if ($rate < 0) {
            $errors[] = "Line " . ($idx + 1) . ": rate cannot be negative.";
            continue;
        }

        $itemStmt = $pdo->prepare("
            SELECT id, name
            FROM items
            WHERE id = ? AND is_active = TRUE
        ");
        $itemStmt->execute([$itemId]);

        if (!$itemStmt->fetch()) {
            $errors[] = "Line " . ($idx + 1) . ": item not found.";
            continue;
        }

        // $gross = $quantity * $rate;
        // $taxableAmount = max($gross - $discount, 0);
        $taxableAmount = $quantity * $rate;
        $vatAmount = $taxableAmount * ($taxRate / 100);
        $lineTotal = $taxableAmount + $vatAmount;

        $subTotal += $taxableAmount;
        $vatTotal += $vatAmount;

        $computedLines[] = compact(
            'itemId',
            'description',
            'quantity',
            'rate',
            'taxableAmount',
            'taxRate',
            'vatAmount',
            'lineTotal'
        );
    }

    if ($errors) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => implode(' ', $errors)
        ]);
        exit();
    }

    $grandTotal = $subTotal + $vatTotal;

    $pdo->beginTransaction();

    // Update transaction
    $updateTx = $pdo->prepare("
        UPDATE transactions
        SET
            contact_id = ?,
            date = ?,
            due_date = ?,
            sub_total = ?,
            vat_amount = ?,
            total_amount = ?,
            notes = ?
        WHERE id = ?
    ");
    $updateTx->execute([
        $contactId,
        $date,
        $dueDate,
        $subTotal,
        $vatTotal,
        $grandTotal,
        $notes ?: null,
        $id
    ]);

    // Replace line items
    $pdo->prepare("
        DELETE FROM transaction_items
        WHERE transaction_id = ?
    ")->execute([$id]);

    $lineStmt = $pdo->prepare("
        INSERT INTO transaction_items (
            transaction_id,
            item_id,
            description,
            quantity,
            rate,
            taxable_amount,
            vat_rate,
            vat_amount,
            total_amount
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    foreach ($computedLines as $line) {
        $lineStmt->execute([
            $id,
            $line['itemId'],
            $line['description'] ?: null,
            $line['quantity'],
            $line['rate'],
            $line['taxableAmount'],
            $line['taxRate'],
            $line['vatAmount'],
            $line['lineTotal']
        ]);
    }

    $pdo->commit();

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Invoice updated successfully."
    ]);

} catch (PDOException $e) {
    if ($pdo->inTransaction())  $pdo->rollBack();
    error_log("Update invoice error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to update invoice."
    ]);
}