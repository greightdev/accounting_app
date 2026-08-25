import { formatBsDate } from "../utils/nepaliDate";

export const ACCOUNTING_REPORTS = {
    "account-ledger": {
        title: "Account Ledger",
        endpoint: "/reports/accounting_reports/account_ledger.php",
        extraFilters: [
            {
                key: "account_id",
                label: "Account",
                optionsEndpoint: "/accounts/list.php",
                required: true,
            },
        ],
        summaryFields: [
            { key: "opening_balance", typeKey: "opening_balance_type", label: "Opening Balance", typeMap: { DEBIT: "Dr", CREDIT: "Cr" } },
            { key: "closing_balance", typeKey: "closing_balance_type", label: "Closing Balance" },
        ],
        columns: [
            { key: "date", header: "Date", render: (r) => formatBsDate(r.date) },
            { key: "ref_number", header: "Ref #", render: (r) => r.display_ref_number || r.ref_number },
            { key: "transaction_type", header: "Type" },
            { key: "narration", header: "Narration" },
            { key: "debit", header: "Debit", align: "right", render: (r) => r.debit ? Number(r.debit).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-" },
            { key: "credit", header: "Credit", align: "right", render: (r) => r.credit ? Number(r.credit).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-" },
            { key: "balance", header: "Balance", align: "right", render: (r) =>
                r.balance === "" || r.balance == null
                    ? "-"
                    : `${Number(r.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })} ${r.balance_type ?? ""}`.trim(), },
        ],
    },
    "group-ledger": {
        title: "Group Ledger",
        endpoint: "/reports/accounting_reports/group_ledger.php",
        extraFilters: [
            {
                key: "group_id",
                label: "Account Group",
                optionsEndpoint: "/account_group/list.php",
                optionsKey: "flat",
                required: true,
            },
        ],
        columns: [
            { key: "account_code", header: "Code" },
            { key: "account_name", header: "Account" },
            { key: "date", header: "Date", render: (r) => formatBsDate(r.date) },
            { key: "ref_number", header: "Ref #", render: (r) => r.display_ref_number || r.ref_number },
            { key: "narration", header: "Narration" },
            { key: "debit", header: "Debit", align: "right", render: (r) => r.debit ? Number(r.debit).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-" },
            { key: "credit", header: "Credit", align: "right", render: (r) => r.credit ? Number(r.credit).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-" },
            { key: "balance", header: "Balance", align: "right", render: (r) =>
                r.balance === "" || r.balance == null
                    ? "-"
                    : `${Number(r.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })} ${r.balance_type ?? ""}`.trim(), },
        ],
        footerMeta: { debit: "total_debit", credit: "total_credit" },
        footerLabelColumn: "account_name",
    },
    "trial-balance": {
        title: "Trial Balance",
        endpoint: "/reports/accounting_reports/trial_balance.php",
        columns: [
            { key: "account_code", header: "Code" },
            { key: "account_name", header: "Account" },
            { key: "group_name", header: "Group" },
            { key: "debit", header: "Debit", align: "right", render: (r) => Number(r.debit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
            { key: "credit", header: "Credit", align: "right", render: (r) => Number(r.credit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
        ],
        footerMeta: { debit: "total_debit", credit: "total_credit" },
        footerLabelColumn: "account_name",
    },
    "profit-loss": {
        title: "Profit & Loss Statement",
        endpoint: "/reports/accounting_reports/profit_loss.php",
        columns: [
            { key: "account_code", header: "Code" },
            { key: "account_name", header: "Account" },
            { key: "section", header: "Section" },
            { key: "amount", header: "Amount", align: "right", render: (r) => r.amount === "" || r.amount == null ? "-" : Number(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
        ],
        summaryFields: [
            { key: "net_profit", label: "Net Profit / (Loss)" },
        ],
        rowClassName: (row) => (row.is_subtotal ? "font-semibold bg-slate-100" : ""),
    },
    "balance-sheet": {
        title: "Balance Sheet",
        endpoint: "/reports/accounting_reports/balance_sheet.php",
        dateMode: "asOf",
        columns: [
            { key: "account_code", header: "Code" },
            { key: "account_name", header: "Account" },
            { key: "section", header: "Section" },
            { key: "amount", header: "Amount", align: "right", render: (r) => r.amount === "" || r.amount == null ? "-" : Number(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
        ],
        rowClassName: (row) => (row.is_subtotal ? "font-semibold bg-slate-100" : ""),
    },
    "cash-flow": {
        title: "Cash Flow Statement",
        endpoint: "/reports/accounting_reports/cash_flow.php",
        columns: [
            { key: "section", header: "Section" },
            { key: "label", header: "Item" },
            { key: "amount", header: "Amount", align: "right", render: (r) => r.amount === "" || r.amount == null ? "-" : Number(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
        ],
        summaryFields: [
            { key: "opening_cash", label: "Opening Cash & Bank" },
            { key: "closing_cash", label: "Closing Cash & Bank" },
        ],
        rowClassName: (row) => (row.is_subtotal ? "font-semibold bg-slate-100" : ""),
    },
    "day-book": {
        title: "Day Book",
        endpoint: "/reports/accounting_reports/day_book.php",
        columns: [
            { key: "date", header: "Date", render: (r) => formatBsDate(r.date) },
            { key: "ref_number", header: "Ref #", render: (r) => r.display_ref_number || r.ref_number },
            { key: "transaction_type", header: "Type" },
            { key: "account_name", header: "Account" },
            { key: "contact_name", header: "Contact", render: (r) => r.contact_name ?? "-" },
            { key: "narration", header: "Narration" },
            { key: "debit", header: "Debit", align: "right", render: (r) => r.debit ? Number(r.debit).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-" },
            { key: "credit", header: "Credit", align: "right", render: (r) => r.credit ? Number(r.credit).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-" },
        ],
        footerMeta: { debit: "total_debit", credit: "total_credit" },
        footerLabelColumn: "account_name",
    },
};