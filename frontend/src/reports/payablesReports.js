import { formatBsDate } from "../utils/nepaliDate";

export const PAYABLES_REPORTS = {
    "vendor-balances": {
        title: "Vendor Balances",
        endpoint: "/reports/payables/vendor_balances.php",
        extraFilters: [
            { key: "contact_id", label: "Vendor", optionsEndpoint: "/contacts/list.php?type=Vendor", required: false },
        ],
        columns: [
            { key: "vendor_name", header: "Vendor" },
            { key: "pan", header: "PAN", render: (r) => r.pan ?? "-" },
            { key: "total_billed", header: "Billed", align: "right", render: (r) => Number(r.total_billed || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
            { key: "total_paid", header: "Paid", align: "right", render: (r) => Number(r.total_paid || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
            { key: "balance_due", header: "Balance Due", align: "right", render: (r) => Number(r.balance_due || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
        ],
        footerMeta: { total_billed: "total_billed", total_paid: "total_paid", balance_due: "total_due" },
        footerLabelColumn: "vendor_name",
    },
    "payables-ageing": {
        title: "Payables Ageing",
        endpoint: "/reports/payables/payables_ageing.php",
        dateMode: "asOf",
        summaryFields: [
            { key: "total_current", label: "Current (0-30)" },
            { key: "total_30", label: "31-60 Days" },
            { key: "total_60", label: "61-90 Days" },
            { key: "total_90_plus", label: "90+ Days" },
        ],
        columns: [
            { key: "ref_number", header: "Bill #" },
            { key: "bill_date", header: "Date", render: (r) => formatBsDate(r.bill_date) },
            { key: "vendor_name", header: "Vendor" },
            { key: "billed_amount", header: "Billed", align: "right", render: (r) => Number(r.billed_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
            { key: "outstanding", header: "Outstanding", align: "right", render: (r) => Number(r.outstanding || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
            { key: "days_overdue", header: "Days Overdue", align: "right" },
            { key: "bucket", header: "Bucket" },
        ],
    },
    "vendor-transactions": {
        title: "Vendor Transactions",
        endpoint: "/reports/payables/vendor_transactions.php",
        extraFilters: [
            { key: "contact_id", label: "Vendor", optionsEndpoint: "/contacts/list.php?type=Vendor", required: true },
        ],
        summaryFields: [
            { key: "total_billed", label: "Total Billed" },
            { key: "total_paid", label: "Total Paid" },
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
};