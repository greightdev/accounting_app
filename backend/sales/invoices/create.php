<?php

require_once '../../server.php';
require_once '../../db.php';
require_once '../../includes/auth.php';

requireRole(['admin', 'accountant', 'user']);

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
$dueDate = $data['due_date'] ?? '';
$notes = trim($data['notes'] ?? '');
$status = $data['status'] ?? 'DRAFT';
$lineItems = $data['line_items'] ?? [];

if ($_SESSION['role'] !== 'admin') {
    $status = 'DRAFT';
}

$validStatuses = ['DRAFT', 'APPROVED'];

// Validation
$errors = [];

if (!$contactId) $errors[] = "Customer is required.";
if (empty($date)) $errors[] = "Date is required.";
if (empty($dueDate)) $errors[] = "Due date is required.";
if (strtotime($dueDate) < strtotime($date)) $errors[] = "Due date cannot be before invoice date.";
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
    // Confirm the contact is a customer
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

    // Auto-generate invoice ref number
    $countStmt = $pdo->query("
        SELECT COUNT(*) AS cnt
        FROM transactions
        WHERE type = 'SALES'
    ");
    $count = $countStmt->fetch()['cnt'];
    $refNumber = 'INV-' . str_pad($count + 1, 5, '0', STR_PAD_LEFT);

    $pdo->beginTransaction();

    // Insert transaction
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
        VALUES ('SALES', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $txStmt->execute([
        $date,
        $dueDate,
        $refNumber,
        $contactId,
        $subTotal,
        $vatTotal,
        $grandTotal,
        $notes ?: null,
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

    // Post ledger entries only for APPROVED invoices
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

        $receivableId = $getAccount('Customer Receivable');
        $salesId = $getAccount('Sales');
        $vatPayableId = $getAccount('VAT Payable');

        if (!$receivableId || !$salesId || !$vatPayableId) {
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

        $narration = "Sales Invoice {$refNumber} - {$contact['name']}";

        // Customer Receivable Dr (total including VAT)
        $ledgerStmt->execute([$txId, $receivableId, $grandTotal, 0, $date, $narration]);
        // Sales Cr (taxable amount only)
        $ledgerStmt->execute([$txId, $salesId, 0, $subTotal, $date, $narration]);
        // VAT Payable Cr
        if ($vatTotal > 0) {
            $ledgerStmt->execute([$txId, $vatPayableId, 0, $vatTotal, $date, $narration]);
        }
    }

    $pdo->commit();

    http_response_code(201);
    echo json_encode([
        "success" => true,
        "message" => "Invoice " . ($status === 'APPROVED' ? "approved" : "saved as draft") . " successfully.",
        "data" => [
            "id" => $txId,
            "ref_number" => $refNumber,
            "status" => $status,
        ]
    ]);

} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log("Create invoice error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to create invoice."
    ]);
}
