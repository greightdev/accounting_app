import { formatBsDate } from "../utils/nepaliDate";

export const RECEIVABLES_REPORTS = {
    "customer-balance": {
        title: "Customer Balance",
        endpoint: "/reports/receivables/customer_balances.php",
        extraFilters: [
            { key: "contact_id", label: "Customer", optionsEndpoint: "/contacts/list.php?type=Customer", required: false },
        ],
        columns: [
            { key: "customer_name", header: "Customer" },
            { key: "pan", header: "PAN", render: (r) => r.pan ?? "-" },
            { key: "total_invoiced", header: "Invoiced", align: "right", render: (r) => Number(r.total_invoiced || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
            { key: "total_received", header: "Received", align: "right", render: (r) => Number(r.total_received || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
            { key: "balance_due", header: "Balance Due", align: "right", render: (r) => Number(r.balance_due || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
        ],
        footerMeta: { total_invoiced: "total_invoiced", total_received: "total_received", balance_due: "total_due" },
        footerLabelColumn: "customer_name",
    },
    "receivables-ageing": {
        title: "Receivables Ageing",
        endpoint: "/reports/receivables/receivables_ageing.php",
        dateMode: "asOf",
        summaryFields: [
            { key: "total_current", label: "Current (0-30)" },
            { key: "total_30", label: "31-60 Days" },
            { key: "total_60", label: "61-90 Days" },
            { key: "total_90_plus", label: "90+ Days" },
        ],
        columns: [
            { key: "ref_number", header: "Invoice #" },
            { key: "invoice_date", header: "Date", render: (r) => formatBsDate(r.invoice_date) },
            { key: "customer_name", header: "Customer" },
            { key: "invoiced_amount", header: "Invoiced", align: "right", render: (r) => Number(r.invoiced_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
            { key: "outstanding", header: "Outstanding", align: "right", render: (r) => Number(r.outstanding || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
            { key: "days_overdue", header: "Days Overdue", align: "right" },
            { key: "bucket", header: "Bucket" },
        ],
    },
    "customer-transactions": {
        title: "Customer Transactions",
        endpoint: "/reports/receivables/customer_transactions.php",
        extraFilters: [
            { key: "contact_id", label: "Customer", optionsEndpoint: "/contacts/list.php?type=Customer", required: true },
        ],
        summaryFields: [
            { key: "total_invoiced", label: "Total Invoiced" },
            { key: "total_received", label: "Total Received" },
            { key: "balance_due", label: "Balance Due" },
        ],
        columns: [
            { key: "date", header: "Date", render: (r) => formatBsDate(r.date) },
            { key: "ref_number", header: "Ref #" },
            { key: "type", header: "Type" },
            { key: "sub_total", header: "Taxable", align: "right", render: (r) => r.sub_total ? Number(r.sub_total).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-" },
            { key: "vat_amount", header: "VAT", align: "right", render: (r) => r.vat_amount ? Number(r.vat_amount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-" },
            { key: "tds_amount", header: "TDS", align: "right", render: (r) => r.tds_amount ? Number(r.tds_amount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-" },
            { key: "total_amount", header: "Amount", align: "right", render: (r) => Number(r.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
        ],
    },
    "contact-ledger": {
        title: "Contact Ledger",
        endpoint: "/reports/receivables/contact_ledger.php",
        extraFilters: [
            {
                key: "contact_id",
                label: "Contact",
                optionsEndpoint: "/contacts/list.php",
                required: true,
            },
        ],
        summaryFields: [
            { key: "opening_balance", typeKey: "opening_balance_type", label: "Opening Balance", typeMap: { DEBIT: "Dr", CREDIT: "Cr" } },
            { key: "closing_balance", typeKey: "closing_balance_type", label: "Closing Balance" },
        ],
        columns: [
            { key: "date", header: "Date", render: (r) => formatBsDate(r.date) },
            { key: "ref_number", header: "Ref #" },
            { key: "transaction_type", header: "Type" },
            { key: "narration", header: "Narration" },
            { key: "debit", header: "Debit", align: "right", render: (r) => r.debit ? Number(r.debit).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-" },
            { key: "credit", header: "Credit", align: "right", render: (r) => r.credit ? Number(r.credit).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-" },
            {
                key: "balance", header: "Balance", align: "right",
                render: (r) => r.balance === "" || r.balance == null ? "-" : `${Number(r.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })} ${r.balance_type ?? ""}`.trim(),
            },
        ],
    },
    "transaction-summary": {
        title: "Transaction Summary",
        endpoint: "/reports/receivables/transaction_summary.php",
        extraFilters: [
            { key: "contact_id", label: "Customer", optionsEndpoint: "/contacts/list.php?type=Customer", required: false },
        ],
        summaryFields: [
            { key: "total_receipts", label: "Total Receipts" },
            { key: "total_received", label: "Total Received" },
            { key: "total_tds", label: "Total TDS" },
            { key: "net_cash_received", label: "Net Cash Received" },
        ],
        columns: [
            { key: "date", header: "Date", render: (r) => formatBsDate(r.date) },
            { key: "ref_number", header: "Ref #" },
            { key: "customer_name", header: "Customer" },
            { key: "bank_account_name", header: "Account", render: (r) => r.bank_account_name ?? "-" },
            { key: "total_amount", header: "Amount", align: "right", render: (r) => Number(r.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
            { key: "tds_amount", header: "TDS", align: "right", render: (r) => r.tds_amount ? Number(r.tds_amount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-" },
            { key: "cash_received", header: "Cash Received", align: "right", render: (r) => Number(r.cash_received || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
        ],
    },
};