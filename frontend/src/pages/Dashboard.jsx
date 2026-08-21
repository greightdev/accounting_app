import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

const fmt = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });

const ACTION_STYLES = {
    CREATE: "bg-emerald-50 text-emerald-600",
    UPDATE: "bg-blue-50 text-blue-600",
    DELETE: "bg-red-50 text-red-500",
    VOID: "bg-amber-50 text-amber-600",
};

const TABLE_LABELS = {
    transactions: "Transaction",
    contacts: "Contact",
    items: "Item",
    accounts: "Account",
    account_groups: "Account Group",
    users: "User",
};

function describeActivity(log) {
    const ref =
        log.new_value?.ref_number ??
        log.old_value?.ref_number ??
        log.new_value?.name ??
        log.old_value?.name ??
        `#${log.record_id}`;
    const typePrefix = log.new_value?.type ?? log.old_value?.type;
    if (typePrefix && log.table_name === "transactions") return `${typePrefix} ${ref}`;
    return `${TABLE_LABELS[log.table_name] ?? log.table_name} — ${ref}`;
}

function timeAgo(value) {
    if (!value) return "";
    const then = new Date(value.replace(" ", "T"));
    const diffMs = Date.now() - then.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

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
    const { role } = useAuth();
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);

    const [recentActivity, setRecentActivity] = useState([]);
    const [activityLoading, setActivityLoading] = useState(false);

    useEffect(() => {
        fetchSummary();
    }, []);

    useEffect(() => {
        if (role === "admin") fetchRecentActivity();
    }, [role]);

    const fetchRecentActivity = async () => {
        setActivityLoading(true);
        try {
            const { data } = await api.get("/audit_logs/list.php", { params: { limit: 6 } });
            setRecentActivity(data.data ?? []);
        } catch (err) {
            console.error("Failed to fetch recent activity:", err);
        } finally {
            setActivityLoading(false);
        }
    };

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
            {/* Sales & Purchase */}
            <div>
                <h2 className="text-sm font-bold tracking-wide text-gray-500 uppercase mb-3">This Month ({summary.month_start} to {summary.month_end})</h2>
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

            {/* Recent Activity — admin only */}
            {role === "admin" && (
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-bold tracking-wide text-gray-500 uppercase">Recent Activity</h2>
                        <button
                            onClick={() => navigate("/activitylogs")}
                            className="text-xs font-medium text-slate-600 hover:text-slate-900 transition"
                        >
                            View all →
                        </button>
                    </div>
                    <div className="bg-white rounded-lg shadow divide-y divide-gray-100">
                        {activityLoading ? (
                            <div className="text-center py-8 text-sm text-slate-400">Loading...</div>
                        ) : recentActivity.length === 0 ? (
                            <div className="text-center py-8 text-sm text-slate-400">No recent activity.</div>
                        ) : (
                            recentActivity.map((log) => (
                                <div
                                    key={log.id}
                                    onClick={() => navigate("/activitylogs")}
                                    className="flex items-center justify-between px-5 py-3 text-sm cursor-pointer hover:bg-slate-50 transition"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${ACTION_STYLES[log.action] ?? "bg-slate-100 text-slate-600"}`}>
                                            {log.action}
                                        </span>
                                        <span className="text-gray-700">{describeActivity(log)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-400">
                                        <span>{log.user_name}</span>
                                        <span>·</span>
                                        <span>{timeAgo(log.created_at)}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}