import { formatBsDate } from "../utils/nepaliDate";

export const TDS_REPORTS = {
    "tds-receivable": {
        title: "TDS Receivable",
        endpoint: "/reports/tds_reports/tds_receivable.php",
        extraFilters: [
            { key: "contact_id", label: "Customer", optionsEndpoint: "/contacts/list.php?type=Customer", required: false },
        ],
        summaryFields: [
            { key: "total_tds", label: "Total TDS" },
            { key: "paid_tds", label: "Paid" },
            { key: "unpaid_tds", label: "Unpaid" },
        ],
        columns: [
            { key: "date", header: "Date", render: (r) => formatBsDate(r.date) },
            { key: "ref_number", header: "Ref #" },
            { key: "customer_name", header: "Customer" },
            { key: "pan", header: "PAN", render: (r) => r.pan ?? "-" },
            { key: "fiscal_year", header: "FY" },
            { key: "tds_amount", header: "TDS Amount", align: "right", render: (r) => Number(r.tds_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
            { key: "is_paid", header: "Status", render: (r) => r.is_paid ? "Paid" : "Unpaid" },
            { key: "paid_via_ref", header: "Paid Via", render: (r) => r.paid_via_ref ?? "-" },
        ],
        rowClassName: (row) => (row.is_paid ? "" : "bg-amber-50"),
    },
    "tds-payable": {
        title: "TDS Payable",
        endpoint: "/reports/tds_reports/tds_payable.php",
        extraFilters: [
            { key: "contact_id", label: "Vendor", optionsEndpoint: "/contacts/list.php?type=Vendor", required: false },
        ],
        summaryFields: [
            { key: "total_tds", label: "Total TDS" },
            { key: "paid_tds", label: "Paid" },
            { key: "unpaid_tds", label: "Unpaid" },
        ],
        columns: [
            { key: "date", header: "Date", render: (r) => formatBsDate(r.date) },
            { key: "ref_number", header: "Ref #" },
            { key: "vendor_name", header: "Vendor" },
            { key: "pan", header: "PAN", render: (r) => r.pan ?? "-" },
            { key: "fiscal_year", header: "FY" },
            { key: "tds_amount", header: "TDS Amount", align: "right", render: (r) => Number(r.tds_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
            { key: "is_paid", header: "Status", render: (r) => r.is_paid ? "Paid" : "Unpaid" },
            { key: "paid_via_ref", header: "Paid Via", render: (r) => r.paid_via_ref ?? "-" },
        ],
        rowClassName: (row) => (row.is_paid ? "" : "bg-amber-50"),
    },
    "tds-expense": {
        title: "TDS Expense",
        endpoint: "/reports/tds_reports/tds_expense.php",
        extraFilters: [
            { key: "contact_id", label: "Customer", optionsEndpoint: "/contacts/list.php?type=Customer", required: false },
        ],
        summaryFields: [
            { key: "total_expense", label: "Total TDS Expense" },
            { key: "paid_expense", label: "Paid" },
            { key: "unpaid_expense", label: "Unpaid" },
        ],
        columns: [
            { key: "date", header: "Date", render: (r) => formatBsDate(r.date) },
            { key: "ref_number", header: "Ref #" },
            { key: "customer_name", header: "Customer" },
            { key: "pan", header: "PAN", render: (r) => r.pan ?? "-" },
            { key: "fiscal_year", header: "FY" },
            { key: "tds_amount", header: "TDS Amount", align: "right", render: (r) => Number(r.tds_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
            { key: "is_paid", header: "Status", render: (r) => r.is_paid ? "Paid" : "Unpaid" },
            { key: "paid_via_ref", header: "Paid Via", render: (r) => r.paid_via_ref ?? "-" },
        ],
        rowClassName: (row) => (row.is_paid ? "" : "bg-amber-50"),
    },
    "tds-report-np": {
        title: "TDS Report",
        endpoint: "/reports/tax_reports/tds_report.php",
        summaryFields: [
            { key: "total_receivable", label: "Receivable" },
            { key: "total_payable", label: "Payable" },
            { key: "total_expense", label: "Expense" },
        ],
        columns: [
            { key: "date", header: "Date", render: (r) => formatBsDate(r.date) },
            { key: "ref_number", header: "Ref #" },
            { key: "party_name", header: "Party" },
            { key: "pan", header: "PAN" },
            { key: "tds_type", header: "Type" },
            { key: "fiscal_year", header: "FY" },
            { key: "tds_amount", header: "TDS Amount", align: "right", render: (r) => Number(r.tds_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
            { key: "is_paid", header: "Status", render: (r) => r.is_paid ? "Paid" : "Unpaid" },
        ],
        rowClassName: (row) => (row.is_paid ? "" : "bg-amber-50"),
    },
    "tds-summary": {
        title: "TDS Summary",
        endpoint: "/reports/tds_reports/tds_summary.php",
        summaryFields: [
            { key: "receivable_total", label: "TDS Receivable" },
            { key: "payable_total", label: "TDS Payable" },
            { key: "expense_total", label: "TDS Expense" },
            { key: "net_tds_payable", label: "Net Payable to Govt" },
        ],
        columns: [
            { key: "contact_name", header: "Party" },
            { key: "party_type", header: "Type" },
            { key: "pan", header: "PAN", render: (r) => r.pan ?? "-" },
            { key: "tds_receivable", header: "Receivable", align: "right", render: (r) => r.tds_receivable ? Number(r.tds_receivable).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-" },
            { key: "tds_payable", header: "Payable", align: "right", render: (r) => r.tds_payable ? Number(r.tds_payable).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-" },
            { key: "tds_expense", header: "Expense", align: "right", render: (r) => r.tds_expense ? Number(r.tds_expense).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-" },
            { key: "total", header: "Total", align: "right", render: (r) => Number(r.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
        ],
    },
    "annexure-13": {
        title: "Annexure 13 - TDS Statement",
        endpoint: "/reports/tds_reports/annexure_13.php",
        extraFilters: [
            { key: "fiscal_year", label: "Fiscal Year", type: "text", placeholder: "e.g. 2081-82", required: true },
        ],
        summaryFields: [
            { key: "total_tds_payable", label: "TDS Payable (Vendors)" },
            { key: "total_tds_expense", label: "TDS Borne by Company" },
            { key: "total_tds_receivable", label: "TDS Receivable (Customers)" },
            { key: "net_tds_liability", label: "Net TDS Liability" },
        ],
        columns: [
            { key: "sn", header: "S.N.", align: "right" },
            { key: "party_name", header: "Party" },
            { key: "pan", header: "PAN" },
            { key: "party_type", header: "Type" },
            { key: "total_taxable", header: "Taxable Amount", align: "right", render: (r) => Number(r.total_taxable || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
            { key: "total_tds", header: "TDS Amount", align: "right", render: (r) => Number(r.total_tds || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
            { key: "effective_tds_rate", header: "Rate %", align: "right", render: (r) => `${Number(r.effective_tds_rate || 0).toFixed(2)}%` },
        ],
    },
};