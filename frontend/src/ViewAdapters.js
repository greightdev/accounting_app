const PAYMENT_MODE_LABELS = {
    CASH: "Cash",
    CHEQUE: "Cheque",
    BANK_TRANSFER: "Bank Transfer",
    CONNECT_IPS: "ConnectIPS",
    ESEWA: "eSewa",
};

function paymentModeSummaryRows(tx) {
    if (!tx.payment_mode) return [];
    const modeLabel = PAYMENT_MODE_LABELS[tx.payment_mode] ?? tx.payment_mode;
    const refLabel = tx.payment_mode === "CHEQUE" ? "Cheque No." : "Transaction ID";
    return [
        { label: "Payment Mode", value: modeLabel, raw: true },
        ...(tx.payment_ref ? [{ label: refLabel, value: tx.payment_ref, raw: true }] : []),
    ];
}

export function adaptTransactionForView(tx) {
    switch (tx.type) {
        case 'SALES':
            return adaptInvoiceForView(tx, 'Customer');
        case 'PURCHASE':
            return adaptInvoiceForView(tx, 'Vendor');
        case 'RECEIPT':
            return adaptSettlementForView(tx, true);
        case 'PAYMENT':
            return adaptSettlementForView(tx, false);
        case 'BANK_DEP':
        case 'BANK_WITH':
            return adaptBankTransferForView(tx);
        case 'JOURNAL':
            return adaptJournalForView(tx);
        default:
            return {
                documentTitle: tx.type,
                refNumber: tx.ref_number,
                date: tx.date,
                status: tx.status,
                summaryRows: [
                    { label: 'Amount', value: tx.total_amount, emphasize: true },
                    ...paymentModeSummaryRows(tx),
                ],
                notes: tx.notes,
                preparedBy: tx.created_by_name,
            };
    }
}

// Sales Invoice / Purchase Bill
export function adaptInvoiceForView(tx, contactLabel = "Customer") {
    return {
        documentTitle: tx.type === "SALES" ? "Sales Invoice" : "Purchase Bill",
        refNumber: tx.ref_number,
        date: tx.date,
        dueDate: tx.due_date,
        status: tx.status,
        party: { label: contactLabel, name: tx.contact_name, pan: tx.contact_pan, address: tx.contact_address },
        lineItems: (tx.line_items ?? []).map((li) => ({
            description: li.description || li.item_name,
            quantity: li.quantity,
            rate: li.rate,
            amount: li.total_amount ?? li.amount,
        })),
        summaryRows: [
            { label: "Subtotal", value: tx.sub_total },
            { label: "VAT", value: tx.vat_amount },
            { label: "Total", value: tx.total_amount, emphasize: true },
        ],
        notes: tx.notes,
        preparedBy: tx.created_by_name,
    };
}

// Receipt / Payment
export function adaptSettlementForView(tx, isReceipt) {
    return {
        documentTitle: isReceipt ? "Receipt" : "Payment",
        refNumber: tx.ref_number,
        date: tx.date,
        status: tx.status,
        party: { label: isReceipt ? "Customer" : "Vendor", name: tx.contact_name, pan: tx.contact_pan },
        summaryRows: [
            { label: isReceipt ? "Amount Received" : "Amount Paid", value: tx.total_amount, emphasize: true },
            ...(tx.tds_amount > 0 ? [{ label: "TDS Deducted", value: tx.tds_amount }] : []),
            ...paymentModeSummaryRows(tx),
        ],
        notes: tx.notes,
        preparedBy: tx.created_by_name,
    };
}

// Bank Deposit / Withdrawal
export function adaptBankTransferForView(tx) {
    const isDeposit = tx.type === "BANK_DEP";
    return {
        documentTitle: isDeposit ? "Bank Deposit" : "Bank Withdrawal",
        refNumber: tx.ref_number,
        date: tx.date,
        status: tx.status,
        summaryRows: [
            { label: "Amount", value: tx.total_amount, emphasize: true },
            ...paymentModeSummaryRows(tx),
        ],
        ledgerRows: [
            {
                account: isDeposit ? tx.bank_account_name : tx.contra_account_name,
                narration: tx.notes,
                debit: tx.total_amount,
                credit: null,
            },
            {
                account: isDeposit ? tx.contra_account_name : tx.bank_account_name,
                narration: tx.notes,
                debit: null,
                credit: tx.total_amount,
            },
        ],
        notes: tx.notes,
        preparedBy: tx.created_by_name,
    };
}

// Journal Entry
export function adaptJournalForView(tx) {
    return {
        documentTitle: "Journal Entry",
        refNumber: tx.ref_number,
        date: tx.date,
        status: tx.status,
        ledgerRows: (tx.lines ?? []).map((line) => ({
            account: line.account_name,
            narration: line.narration,
            debit: line.debit,
            credit: line.credit,
        })),
        summaryRows: [{ label: "Total", value: tx.total_amount, emphasize: true }],
        notes: tx.notes,
        preparedBy: tx.created_by_name,
    };
}