<?php

function generateRegisterReport(
    PDO $pdo,
    string $type,
    ?string $dateFrom = null,
    ?string $dateTo = null,
    ?int $contactId = null
): array {

    $sql = "
        SELECT
            t.id,
            t.ref_number,
            t.vendor_bill_no,
            COALESCE(NULLIF(t.vendor_bill_no, ''), t.ref_number) AS display_ref_number,
            t.date,
            t.sub_total,
            t.vat_amount,
            t.total_amount,
            t.status,
            t.notes,
            c.id AS contact_id,
            c.name AS contact_name,
            c.pan AS contact_pan
        FROM transactions t
        JOIN contacts c ON c.id = t.contact_id
        WHERE t.type = ? AND t.status = 'APPROVED'
    ";

    $params = [$type];

    if ($dateFrom) {
        $sql .= " AND t.date >= ?";
        $params[] = $dateFrom;
    }

    if ($dateTo) {
        $sql .= " AND t.date <= ?";
        $params[] = $dateTo;
    }

    if ($contactId) {
        $sql .= " AND t.contact_id = ?";
        $params[] = $contactId;
    }

    $sql .= " ORDER BY t.date ASC, t.id ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $records = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $totalTaxable = 0;
    $totalVat = 0;
    $totalAmount = 0;

    foreach ($records as $record) {
        $totalTaxable += (float)$record['sub_total'];
        $totalVat += (float)$record['vat_amount'];
        $totalAmount += (float)$record['total_amount'];
    }

    return [
        "success" => true,
        "message" => "Data fetched successfully.",
        "data" => $records,
        "meta" => [
            "date_from" => $dateFrom,
            "date_to" => $dateTo,
            "total_records" => count($records),
            "total_taxable" => $totalTaxable,
            "total_vat" => $totalVat,
            "total_amount" => $totalAmount,
        ],
    ];
}

function generateContactSummaryReport(
    PDO $pdo,
    string $type,
    ?string $dateFrom = null,
    ?string $dateTo = null
): array {

    $sql = "
        SELECT
            c.id AS id,
            c.id AS contact_id,
            c.name AS contact_name,
            c.pan AS contact_pan,
            COUNT(t.id) AS transaction_count,
            SUM(t.sub_total) AS total_taxable,
            SUM(t.vat_amount) AS total_vat,
            SUM(t.total_amount) AS total_amount
        FROM transactions t
        JOIN contacts c ON c.id = t.contact_id
        WHERE t.type = ? AND t.status = 'APPROVED'
    ";

    $params = [$type];

    if ($dateFrom) {
        $sql .= " AND t.date >= ?";
        $params[] = $dateFrom;
    }

    if ($dateTo) {
        $sql .= " AND t.date <= ?";
        $params[] = $dateTo;
    }

    $sql .= "
        GROUP BY c.id, c.name, c.pan
        ORDER BY total_amount DESC
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $records = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $totalTaxable = 0;
    $totalVat = 0;
    $totalAmount = 0;

    foreach ($records as $record) {
        $totalTaxable += (float)$record['total_taxable'];
        $totalVat += (float)$record['total_vat'];
        $totalAmount += (float)$record['total_amount'];
    }

    return [
        "success" => true,
        "message" => "Data fetched successfully.",
        "data" => $records,
        "meta" => [
            "type" => $type,
            "date_from" => $dateFrom,
            "date_to" => $dateTo,
            "total_taxable" => $totalTaxable,
            "total_vat" => $totalVat,
            "total_amount" => $totalAmount,
        ],
    ];
}

function generateItemSummaryReport(
    PDO $pdo,
    string $type,
    ?string $dateFrom = null,
    ?string $dateTo = null
): array {

    $sql = "
        SELECT
            i.id AS id,
            i.id AS item_id,
            i.name AS item_name,
            i.unit,
            i.hsn_sac_code,
            i.tax_type,
            COUNT(DISTINCT t.id) AS transaction_count,
            SUM(ti.quantity) AS total_quantity,
            SUM(ti.taxable_amount) AS total_taxable,
            SUM(ti.vat_amount) AS total_vat,
            SUM(ti.total_amount) AS total_amount
        FROM transaction_items ti
        JOIN transactions t ON t.id = ti.transaction_id
        JOIN items i ON i.id = ti.item_id
        WHERE t.type = ? AND t.status = 'APPROVED'
    ";

    $params = [$type];

    if ($dateFrom) {
        $sql .= " AND t.date >= ?";
        $params[] = $dateFrom;
    }

    if ($dateTo) {
        $sql .= " AND t.date <= ?";
        $params[] = $dateTo;
    }

    $sql .= "
        GROUP BY
            i.id,
            i.name,
            i.unit,
            i.hsn_sac_code,
            i.tax_type
        ORDER BY total_amount DESC
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $records = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $totalTaxable = 0;
    $totalVat = 0;
    $totalAmount = 0;

    foreach ($records as $record) {
        $totalTaxable += (float)$record['total_taxable'];
        $totalVat += (float)$record['total_vat'];
        $totalAmount += (float)$record['total_amount'];
    }

    return [
        "success" => true,
        "message" => "Data fetched successfully",
        "data" => $records,
        "meta" => [
            "type" => $type,
            "date_from" => $dateFrom,
            "date_to" => $dateTo,
            "total_taxable" => $totalTaxable,
            "total_vat" => $totalVat,
            "total_amount" => $totalAmount,
        ],
    ];
}