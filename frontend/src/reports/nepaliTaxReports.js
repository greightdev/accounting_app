import { formatBsDate } from "../utils/nepaliDate";

export const NEPALI_TAX_REPORTS = {
    "sales-account-np": {
        title: "बिक्री खाता (Sales Account)",
        endpoint: "/reports/tax_reports/bikri_khata.php",
        datesRequired: true,
        columns: [
            { key: "sn", header: "S.N.", align: "right" },
            { key: "bill_date", header: "Date", render: (r) => formatBsDate(r.bill_date) },
            { key: "invoice_number", header: "Invoice #" },
            { key: "customer_name", header: "Customer" },
            { key: "customer_pan", header: "PAN" },
            { key: "unit", header: "Unit" },
            { key: "vatable_sales", header: "Vatable Sales", align: "right", render: (r) => Number(r.vatable_sales || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
            { key: "exempt_sales", header: "Exempt Sales", align: "right", render: (r) => Number(r.exempt_sales || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
            { key: "vat_amount", header: "VAT", align: "right", render: (r) => Number(r.vat_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
            { key: "total_amount", header: "Total", align: "right", render: (r) => Number(r.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
            { key: "tds_amount", header: "TDS 1.5%", align: "right", render: (r) => r.tds_amount ? Number(r.tds_amount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-" },
            { key: "paid_status", header: "Status", render: (r) => r.paid_status },
        ],
        footerMeta: { vatable_sales: "total_vatable", exempt_sales: "total_exempt", vat_amount: "total_vat", total_amount: "total_amount", tds_amount: "total_tds" },
        footerLabelColumn: "customer_name",
    },
    "purchase-account-np": {
        title: "खरिद खाता (Purchase Account)",
        endpoint: "/reports/tax_reports/kharid_khata.php",
        datesRequired: true,
        columns: [
            { key: "sn", header: "S.N.", align: "right" },
            { key: "bill_date", header: "Date", render: (r) => formatBsDate(r.bill_date) },
            { key: "bill_number", header: "Bill #" },
            { key: "vendor_name", header: "Vendor" },
            { key: "vendor_pan", header: "PAN" },
            { key: "unit", header: "Unit" },
            { key: "vatable_purchase", header: "Vatable Purchase", align: "right", render: (r) => Number(r.vatable_purchase || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
            { key: "exempt_purchase", header: "Exempt Purchase", align: "right", render: (r) => Number(r.exempt_purchase || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
            { key: "vat_amount", header: "VAT", align: "right", render: (r) => Number(r.vat_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
            { key: "total_amount", header: "Total", align: "right", render: (r) => Number(r.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
            { key: "tds_deducted", header: "Deduct" },
            { key: "tds_amount", header: "TDS 1.5%", align: "right", render: (r) => r.tds_amount ? Number(r.tds_amount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-" },
        ],
        footerMeta: { vatable_purchase: "total_vatable", exempt_purchase: "total_exempt", vat_amount: "total_vat", total_amount: "total_amount", tds_amount: "total_tds" },
        footerLabelColumn: "vendor_name",
    },
    "vat-return": {
        title: "VAT Return",
        endpoint: "/reports/tax_reports/vat_return.php",
        datesRequired: true,
        summaryFields: [
            { key: "net_vat", label: "Net VAT" },
        ],
        columns: [
            { key: "section", header: "Section" },
            { key: "label", header: "Item" },
            { key: "amount", header: "Amount", align: "right", render: (r) => Number(r.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
        ],
        rowClassName: (row) => (row.is_subtotal ? "font-semibold bg-slate-100" : ""),
    },
    "tds-summary-np": {
        title: "TDS Summary",
        endpoint: "/reports/tds_reports/tds_summary.php", // same endpoint as the English one
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
        ],    },
};