import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

// Placeholder user — replace with real auth state later
const currentUser = { name: 'Admin', role: 'admin' };

const fmt = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });

function StatCard({ label, value, sub, accent = "text-gray-900", onClick }) {
    return (
        <div
            onClick={onClick}
            className={`bg-white rounded-lg shadow px-5 py-4 ${onClick ? "cursor-pointer hover:shadow-md transition" : ""}`}
        >
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
            <p className={`text-2xl font-semibold mt-1 ${accent}`}>{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
    );
}

export default function Dashboard() {
    const navigate = useNavigate();
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSummary();
    }, []);

    const fetchSummary = async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/dashboard/summary.php");
            setSummary(data.data);
        } catch (err) {
            console.error("Failed to fetch dashboard summary:", err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="text-center py-20 text-slate-500">Loading dashboard...</div>;
    }

    if (!summary) {
        return <div className="text-center py-20 text-slate-500">Failed to load dashboard.</div>;
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
                <p className="text-sm text-gray-500">
                    This month: {summary.month_start} to {summary.month_end}
                </p>
            </div>

            {/* Sales & Purchase */}
            <div>
                <h2 className="text-sm font-bold tracking-wide text-gray-500 uppercase mb-3">This Month</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="Total Sales" value={fmt(summary.total_sales)} onClick={() => navigate("/reports/sales-register")} />
                    <StatCard label="Total Purchase" value={fmt(summary.total_purchase)} onClick={() => navigate("/reports/purchase-register")} />
                    <StatCard label="Total Receipts (Net)" value={fmt(summary.total_receipts_net)} sub="After TDS" />
                    <StatCard label="Total Payments (Net)" value={fmt(summary.total_payments_net)} sub="After TDS" />
                </div>
            </div>

            {/* TDS */}
            <div>
                <h2 className="text-sm font-bold tracking-wide text-gray-500 uppercase mb-3">TDS (This Month)</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <StatCard label="TDS Deducted by Customers" value={fmt(summary.tds_from_customers)} onClick={() => navigate("/reports/tds-receivable")} />
                    <StatCard label="TDS Deducted from Vendors" value={fmt(summary.tds_from_vendors)} onClick={() => navigate("/reports/tds-payable")} />
                    <StatCard label="TDS Paid by Company" value={fmt(summary.tds_expense)} onClick={() => navigate("/reports/tds-expense")} />
                </div>
            </div>

            {/* Balances */}
            <div>
                <h2 className="text-sm font-bold tracking-wide text-gray-500 uppercase mb-3">Balances</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <StatCard
                        label="Bank Balance"
                        value={fmt(summary.total_bank_balance)}
                        sub={`${summary.bank_accounts.length} account${summary.bank_accounts.length !== 1 ? "s" : ""}`}
                    />
                    <StatCard
                        label="Outstanding Receivables"
                        value={fmt(summary.outstanding_receivables)}
                        accent="text-emerald-600"
                        onClick={() => navigate("/reports/customer-balances")}
                    />
                    <StatCard
                        label="Outstanding Payables"
                        value={fmt(summary.outstanding_payables)}
                        accent="text-red-600"
                        onClick={() => navigate("/reports/vendor-balances")}
                    />
                </div>
            </div>

            {/* Bank account breakdown */}
            {summary.bank_accounts.length > 0 && (
                <div>
                    <h2 className="text-sm font-bold tracking-wide text-gray-500 uppercase mb-3">Accounts</h2>
                    <div className="bg-white rounded-lg shadow divide-y divide-gray-100">
                        {summary.bank_accounts.map((ba) => (
                            <div key={ba.id} className="flex items-center justify-between px-5 py-3 text-sm">
                                <span className="text-gray-700">{ba.name}</span>
                                <span className="font-medium text-gray-900">{fmt(ba.balance)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}