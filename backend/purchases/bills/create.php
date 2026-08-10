<?php

require_once '../../server.php';
require_once '../../db.php';
require_once '../../includes/auth.php';

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

$contactId = $data['contact_id'] ?? null;
$date = $data['date'] ?? '';
$dueDate = $data['due_date'] ?? null;
$vendorBillNo = trim($data['vendor_bill_no'] ?? '');
$notes = trim($data['notes'] ?? '');
$status = $data['status'] ?? 'DRAFT';
$lineItems = $data['line_items'] ?? [];

if ($_SESSION['role'] !== 'admin') {
    $status = 'DRAFT';
}

$validStatuses = ['DRAFT', 'APPROVED'];

// Validation
$errors = [];

if (!$contactId) $errors[] = "Vendor is required.";
if (empty($date)) $errors[] = "Date is required.";
if (!empty($dueDate) && (strtotime($dueDate) < strtotime($date))) $errors[] = "Due date cannot be before creation date.";
if (!in_array($status, $validStatuses, true)) $errors[] = "Status must be DRAFT or APPROVED.";
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
    // Confirm the contact is a vendor
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

    // Validate and compute each line item
    $computedLines = [];
    $subTotal = 0;
    $vatTotal = 0;

    foreach ($lineItems as $idx => $line) {
        $itemId = $line['item_id'] ?? null;
        $quantity = (int)($line['quantity'] ?? 0);
        $rate = (float)($line['rate'] ?? 0);
        // $discount = (float)($line['discount'] ?? 0);
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

        $computedLines[] = [
            'item_id' => $itemId,
            'description' => $description,
            'quantity' => $quantity,
            'rate' => $rate,
            // 'discount' => $discount,
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

    // Auto-generate bill ref number
    $countStmt = $pdo->query("
        SELECT COUNT(*) AS cnt
        FROM transactions
        WHERE type = 'PURCHASE'
    ");
    $count = $countStmt->fetch()['cnt'];
    $refNumber = 'BILL-' . str_pad($count + 1, 5, '0', STR_PAD_LEFT);

    $pdo->beginTransaction();

    // Insert transaction
    $fullNotes = $vendorBillNo
        ? "Vendor Bill #: {$vendorBillNo}" . ($notes ? " | {$notes}" : '')
        : ($notes ?: null);

    $txStmt = $pdo->prepare("
        INSERT INTO transactions (
            type,
            date,
            due_date,
            ref_number,
            contact_id,
            sub_total,
            vat_amount,
            total_amount,
            notes,
            status,
            created_by
        )
        VALUES ('PURCHASE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $txStmt->execute([
        $date,
        $dueDate ?: null,
        $refNumber,
        $contactId,
        $subTotal,
        $vatTotal,
        $grandTotal,
        $fullNotes,
        $status,
        $_SESSION['user_id']
    ]);
    $txId = (int) $pdo->lastInsertId();

    // Insert line items
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
            $txId,
            $line['item_id'],
            $line['description'] ?: null,
            $line['quantity'],
            $line['rate'],
            $line['taxable_amount'],
            $line['vat_rate'],
            $line['vat_amount'],
            $line['total_amount'],
        ]);
    }

    // Post ledger entries only for APPROVED bills
    if ($status === 'APPROVED') {
        // Fetch system ledger account IDs
        $getAccount = function($name) use ($pdo) {
            $stmt = $pdo->prepare("
                SELECT id
                FROM accounts
                WHERE name = ? AND is_active = TRUE
                LIMIT 1
            ");
            $stmt->execute([$name]);
            $row = $stmt->fetch();
            return $row ? $row['id'] : null;
        };

        $purchaseId = $getAccount('Purchase');
        $vatReceivableId = $getAccount('VAT Receivable');
        $payableId = $getAccount('Vendor Payable');

        if (!$purchaseId || !$vatReceivableId || !$payableId) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode([
                "success" => false,
                "message" => "System ledger accounts not found. Please check your Chart of Accounts."
            ]);
            exit();
        }

        $ledgerStmt = $pdo->prepare("
            INSERT INTO ledger_entries (
                transaction_id,
                account_id,
                debit,
                credit,
                date,
                narration
            )
            VALUES (?, ?, ?, ?, ?, ?)
        ");

        $narration = "Purchase Bill {$refNumber} - {$contact['name']}";

        // Purchase Dr (taxable amount - our cost)
        $ledgerStmt->execute([$txId, $purchaseId, $subTotal, 0, $date, $narration]);
        // VAT Receivable Dr (VAT we paid - claimable against VAT Payable)
        if ($vatTotal > 0) {
            $ledgerStmt->execute([$txId, $vatReceivableId, $vatTotal, 0, $date, $narration]);
        }
        // Vendor Payable Cr
        $ledgerStmt->execute([$txId, $payableId, 0, $grandTotal, $date, $narration]);
    }

    $pdo->commit();

    http_response_code(201);
    echo json_encode([
        "success" => true,
        "message" => "Bill " . ($status === 'APPROVED' ? "approved" : "saved as draft") . " successfully.",
        "data" => [
            "id" => $txId,
            "ref_number" => $refNumber,
            "status" => $status,
        ]
    ]);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log("Create bill error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to create bill."
    ]);
}
