import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    BookOpen, Scale, TrendingUp, Landmark, ArrowLeftRight, CalendarDays,
    ShoppingCart, Package, Users, Clock, Building2, FileWarning, Globe
} from "lucide-react";
import Toolbar from "../components/Toolbar";

const REPORT_GROUPS = [
    {
        title: "Accounting Reports",
        key: "accounting",
        reports: [
            { key: "account-ledger", label: "Account Ledger", icon: BookOpen, path: "/reports/account-ledger" },
            { key: "group-ledger", label: "Group Ledger", icon: BookOpen, path: "/reports/group-ledger" },
            { key: "trial-balance", label: "Trial Balance", icon: Scale, path: "/reports/trial-balance" },
            { key: "profit-loss", label: "Profit & Loss Statement", icon: TrendingUp, path: "/reports/profit-loss" },
            { key: "balance-sheet", label: "Balance Sheet", icon: Landmark, path: "/reports/balance-sheet" },
            { key: "cash-flow", label: "Cash Flow Statement", icon: ArrowLeftRight, path: "/reports/cash-flow" },
            { key: "day-book", label: "Day Book", icon: CalendarDays, path: "/reports/day-book" },
        ],
    },
    {
        title: "Sales Reports",
        key: "sales",
        reports: [
            { key: "sales-register", label: "Sales Register", icon: ShoppingCart, path: "/reports/sales-register" },
            { key: "sales-by-customer", label: "Sales By Customer", icon: Users, path: "/reports/sales-by-customer" },
            { key: "sales-by-item", label: "Sales By Item", icon: Package, path: "/reports/sales-by-item" },
            { key: "master-sales", label: "Master Sales Report", icon: ShoppingCart, path: "/reports/master-sales" },
        ],
    },
    {
        title: "Purchase & Expense Reports",
        key: "purchase",
        reports: [
            { key: "purchase-register", label: "Purchase Register", icon: ShoppingCart, path: "/reports/purchase-register" },
            { key: "purchase-by-vendor", label: "Purchase By Vendor", icon: Users, path: "/reports/purchase-by-vendor" },
            { key: "purchase-by-item", label: "Purchase By Item", icon: Package, path: "/reports/purchase-by-item" },
            { key: "master-purchase", label: "Master Purchase Report", icon: ShoppingCart, path: "/reports/master-purchase" },
        ],
    },
    {
        title: "Receivables (Customer)",
        key: "receivables",
        reports: [
            { key: "customer-balance", label: "Customer Balance", icon: Users, path: "/reports/customer-balance" },
            { key: "receivables-ageing", label: "Receivables Ageing", icon: Clock, path: "/reports/receivables-ageing" },
            { key: "customer-transactions", label: "Customer Transactions", icon: Users, path: "/reports/customer-transactions" },
            { key: "contact-ledger-customer", label: "Contact Ledger", icon: BookOpen, path: "/reports/contact-ledger" },
            { key: "transaction-summary", label: "Transaction Summary", icon: BookOpen, path: "/reports/transaction-summary" },
        ],
    },
    {
        title: "Payables (Vendor)",
        key: "payables",
        reports: [
            { key: "vendor-balances", label: "Vendor Balances", icon: Users, path: "/reports/vendor-balances" },
            { key: "payables-ageing", label: "Payables Ageing", icon: Clock, path: "/reports/payables-ageing" },
            { key: "vendor-transactions", label: "Vendor Transactions", icon: Users, path: "/reports/vendor-transactions" },
        ],
    },
    {
        title: "TDS Reports",
        key: "tds",
        reports: [
            { key: "tds-receivable", label: "TDS Receivable", icon: FileWarning, path: "/reports/tds-receivable" },
            { key: "tds-payable", label: "TDS Payable", icon: FileWarning, path: "/reports/tds-payable" },
            { key: "tds-expense", label: "TDS Expense", icon: FileWarning, path: "/reports/tds-expense" },
            { key: "tds-summary", label: "TDS Summary", icon: FileWarning, path: "/reports/tds-summary" },
            { key: "annexure-13", label: "Annexure 13", icon: Building2, path: "/reports/annexure-13" },
        ],
    },
    {
        title: "Nepali Tax Reports",
        key: "nepali-tax",
        reports: [
            { key: "sales-account-np", label: "बिक्री खाता (Sales Account)", icon: Globe, path: "/reports/sales-account-np" },
            { key: "purchase-account-np", label: "खरिद खाता (Purchase Account)", icon: Globe, path: "/reports/purchase-account-np" },
            { key: "expense-book", label: "Expense Book", icon: Globe, path: "/reports/expense-book" },
            { key: "vat-return", label: "VAT Return", icon: Scale, path: "/reports/vat-return" },
            { key: "tds-report-np", label: "TDS Report", icon: FileWarning, path: "/reports/tds-report-np" },
            { key: "tds-summary-np", label: "TDS Summary", icon: FileWarning, path: "/reports/tds-summary-np" },
        ],
    },
];

export default function AccountReports() {
    const [search, setSearch] = useState("");
    const navigate = useNavigate();

    const term = search.toLowerCase();
    const filteredGroups = REPORT_GROUPS
        .map((group) => ({
            ...group,
            reports: group.reports.filter((r) => r.label.toLowerCase().includes(term)),
        }))
        .filter((group) => group.reports.length > 0);

    return (
        <>
            <Toolbar search={{ value: search, onChange: setSearch }} actions={[]} />

            <div className="space-y-8">
                {filteredGroups.map((group) => (
                    <div key={group.key}>
                        <h2 className="text-sm font-bold tracking-wide text-gray-500 uppercase mb-3">
                            {group.title}
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {group.reports.map((report) => {
                                const Icon = report.icon;
                                return (
                                    <button
                                        key={report.key}
                                        onClick={() => navigate(report.path)}
                                        className="flex items-center gap-3 px-4 py-4 rounded-xl bg-white shadow-sm border border-gray-100 hover:border-slate-300 hover:shadow-md transition text-left"
                                    >
                                        <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
                                            <Icon size={18} />
                                        </div>
                                        <span className="text-sm font-medium text-gray-800">{report.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}

                {filteredGroups.length === 0 && (
                    <div className="flex justify-center items-center py-20 text-slate-500">
                        No reports match your search.
                    </div>
                )}
            </div>
        </>
    );
}