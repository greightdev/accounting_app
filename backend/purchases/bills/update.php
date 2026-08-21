<?php

require_once '../../server.php';
require_once '../../db.php';
require_once '../../includes/auth.php';
require_once '../../includes/audit.php';

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
$dueDate = $data['due_date'] ?? null;
$vendorBillNo = trim($data['vendor_bill_no'] ?? '');
$notes = trim($data['notes'] ?? '');
$lineItems = $data['line_items'] ?? [];

// Validation
$errors = [];

if (!$contactId) $errors[] = "Vendor is required.";
if (empty($date)) $errors[] = "Date is required.";
if (!empty($dueDate) && (strtotime($dueDate) < strtotime($date))) $errors[] = "Due date cannot be before creation date.";
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
    // Check bill exists
    $existing = $pdo->prepare("
        SELECT id, status, ref_number, contact_id, date, due_date, sub_total, vat_amount, total_amount, notes
        FROM transactions
        WHERE id = ? AND type = 'PURCHASE'
    ");
    $existing->execute([$id]);
    $bill = $existing->fetch();

    if (!$bill) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Bill not found."
        ]);
        exit();
    }

    // Approved bills cannot be edited — only voided and re-created
    if ($bill['status'] === 'APPROVED') {
        http_response_code(403);
        echo json_encode([
            "success" => false,
            "message" => "Approved bills cannot be edited. Void this bill and create a new one."
        ]);
        exit();
    }

    if ($bill['status'] === 'VOID') {
        http_response_code(403);
        echo json_encode([
            "success" => false,
            "message" => "Voided bills cannot be edited."
        ]);
        exit();
    }

    // Validate vendor
    $contactStmt = $pdo->prepare("
        SELECT id, name
        FROM contacts
        WHERE id = ? AND type IN ('Vendor') AND is_active = TRUE
    ");
    $contactStmt->execute([$contactId]);
    $contact = $contactStmt->fetch();

    if (!$contact) {
        http_response_code(422);
        echo json_encode([
            "success" => false,
            "message" => "Vendor not found."
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
            SELECT id, name, type, vendor_id
            FROM items
            WHERE id = ? AND is_active = TRUE
        ");
        $itemStmt->execute([$itemId]);
        $itemRow = $itemStmt->fetch();

        if (!$itemRow) {
            $errors[] = "Line " . ($idx + 1) . ": item not found.";
            continue;
        }
        if ($itemRow['type'] === 'PURCHASE' && (int)$itemRow['vendor_id'] !== (int)$contactId) {
            $errors[] = "Line " . ($idx + 1) . ": \"{$itemRow['name']}\" does not belong to this vendor.";
            continue;
        }

        // $gross = $quantity * $rate;
        // $taxableAmount = max($gross - $discount, 0);
        $taxableAmount = $quantity * $rate;
        $vatAmount = $taxableAmount * ($taxRate / 100);
        $lineTotal = $taxableAmount + $vatAmount;

        $subTotal += $taxableAmount;
        $vatTotal += $vatAmount;

        $computedLines[] = [
            'item_id' => $itemId,
            'description' => $description,
            'quantity' => $quantity,
            'rate' => $rate,
            'taxable_amount' => $taxableAmount,
            'vat_rate' => $taxRate,
            'vat_amount' => $vatAmount,
            'total_amount' => $lineTotal,
        ];
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
    $fullNotes  = $vendorBillNo
        ? "Vendor Bill #: {$vendorBillNo}" . ($notes ? " | {$notes}" : '')
        : ($notes ?: null);

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
        $dueDate ?: null,
        $subTotal,
        $vatTotal,
        $grandTotal,
        $fullNotes,
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
            $line['item_id'],
            $line['description'] ?: null,
            $line['quantity'],
            $line['rate'],
            $line['taxable_amount'],
            $line['tax_rate'],
            $line['vat_amount'],
            $line['total_amount']
        ]);
    }

    $pdo->commit();

    logAudit(
        $pdo,
        (int) $_SESSION['user_id'],
        'UPDATE',
        'transactions',
        $id,
        ['contact_id' => (int)$bill['contact_id'], 'date' => $bill['date'], 'due_date' => $bill['due_date'], 'sub_total' => (float)$bill['sub_total'], 'vat_amount' => (float)$bill['vat_amount'], 'total_amount' => (float)$bill['total_amount'], 'notes' => $bill['notes']],
        ['contact_id' => (int)$contactId, 'date' => $date, 'due_date' => $dueDate ?: null, 'sub_total' => $subTotal, 'vat_amount' => $vatTotal, 'total_amount' => $grandTotal, 'notes' => $fullNotes]
    );

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Bill updated successfully."
    ]);

} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log("Update bill error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to update bill."
    ]);
}