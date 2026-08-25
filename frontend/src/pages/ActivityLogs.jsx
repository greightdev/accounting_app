import { useEffect, useState, useCallback } from "react";
import { X } from "lucide-react";
import Toolbar from "../components/Toolbar";
import DataTable from "../components/DataTable";
import api from "../api/axios";

const ACTIONS = ["CREATE", "UPDATE", "DELETE", "VOID"];

const TABLE_LABELS = {
    transactions: "Transaction",
    contacts: "Contact",
    items: "Item",
    accounts: "Account",
    account_groups: "Account Group",
    users: "User",
};

const ACTION_STYLES = {
    CREATE: "bg-emerald-50 text-emerald-600",
    UPDATE: "bg-blue-50 text-blue-600",
    DELETE: "bg-red-50 text-red-500",
    VOID: "bg-amber-50 text-amber-600",
};

function tableLabel(name) {
    return TABLE_LABELS[name] ?? name;
}

function describeEntry(log) {
    const ref =
        log.new_value?.vendor_bill_no ??
        log.old_value?.vendor_bill_no ??
        log.new_value?.ref_number ??
        log.old_value?.ref_number ??
        log.new_value?.name ??
        log.old_value?.name ??
        log.new_value?.email ??
        log.old_value?.email ??
        `#${log.record_id}`;

    const typePrefix = log.new_value?.type ?? log.old_value?.type;
    const label = tableLabel(log.table_name);

    if (typePrefix && log.table_name === "transactions") {
        return `${typePrefix} ${ref}`;
    }
    return `${label} — ${ref}`;
}

function formatDateTime(value) {
    if (!value) return "-";
    const d = new Date(value.replace(" ", "T"));
    if (isNaN(d)) return value;
    return d.toLocaleString(undefined, {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

function DiffRow({ label, oldVal, newVal }) {
    const changed = JSON.stringify(oldVal) !== JSON.stringify(newVal);
    const display = (v) => {
        if (v === null || v === undefined) return <span className="text-gray-300">—</span>;
        if (typeof v === "object") return <span className="font-mono text-xs">{JSON.stringify(v)}</span>;
        if (typeof v === "boolean") return v ? "Yes" : "No";
        return String(v);
    };
    return (
        <tr className={changed ? "bg-amber-50/50" : ""}>
            <td className="px-3 py-2 text-xs font-medium text-gray-500 whitespace-nowrap">{label}</td>
            <td className="px-3 py-2 text-sm text-gray-500">{display(oldVal)}</td>
            <td className="px-3 py-2 text-sm text-gray-900 font-medium">{display(newVal)}</td>
        </tr>
    );
}

function DetailModal({ log, onClose }) {
    if (!log) return null;

    const keys = Array.from(
        new Set([
            ...Object.keys(log.old_value ?? {}),
            ...Object.keys(log.new_value ?? {}),
        ])
    );

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6">
                <div className="flex items-start justify-between mb-1">
                    <h2 className="text-lg font-semibold text-gray-900">{describeEntry(log)}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
                        <X size={18} />
                    </button>
                </div>
                <p className="text-sm text-gray-500 mb-5">
                    {log.action} by {log.user_name} · {formatDateTime(log.created_at)}
                </p>

                <div className="flex flex-wrap gap-4 mb-5 text-xs text-gray-500">
                    <span><span className="font-medium text-gray-700">Table:</span> {tableLabel(log.table_name)}</span>
                    <span><span className="font-medium text-gray-700">Record ID:</span> {log.record_id}</span>
                    {log.ip_address && <span><span className="font-medium text-gray-700">IP:</span> {log.ip_address}</span>}
                </div>

                {keys.length > 0 ? (
                    <table className="w-full rounded-lg overflow-hidden border border-gray-100">
                        <thead>
                            <tr className="bg-slate-700 text-white text-xs">
                                <th className="px-3 py-2 text-left font-semibold">Field</th>
                                <th className="px-3 py-2 text-left font-semibold">Before</th>
                                <th className="px-3 py-2 text-left font-semibold">After</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {keys.map((key) => (
                                <DiffRow
                                    key={key}
                                    label={key}
                                    oldVal={log.old_value?.[key]}
                                    newVal={log.new_value?.[key]}
                                />
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p className="text-sm text-gray-400 text-center py-6">No field-level details recorded.</p>
                )}
            </div>
        </div>
    );
}

export default function ActivityLogs() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedLog, setSelectedLog] = useState(null);

    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [action, setAction] = useState("");
    const [tableName, setTableName] = useState("");
    const [search, setSearch] = useState("");

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (dateFrom) params.date_from = dateFrom;
            if (dateTo) params.date_to = dateTo;
            if (action) params.action = action;
            if (tableName) params.table_name = tableName;
            if (search) params.search = search;

            const { data } = await api.get("/audit_logs/list.php", { params });
            setLogs(data.data ?? []);
        } catch (err) {
            console.error("Failed to fetch activity log:", err);
        } finally {
            setLoading(false);
        }
    }, [dateFrom, dateTo, action, tableName, search]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const columns = [
        { key: "created_at", header: "Date & Time", render: (l) => formatDateTime(l.created_at) },
        { key: "user_name", header: "User" },
        {
            key: "action", header: "Action",
            render: (l) => (
                <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${ACTION_STYLES[l.action] ?? "bg-slate-100 text-slate-600"}`}>
                    {l.action}
                </span>
            ),
        },
        { key: "table_name", header: "Module", render: (l) => tableLabel(l.table_name) },
        { key: "description", header: "Record", render: (l) => describeEntry(l) },
        // {
        //     key: "actions", header: "",
        //     render: (l) => (
        //         <button
        //             onClick={() => setSelectedLog(l)}
        //             className="text-sm font-medium text-slate-600 hover:text-slate-900 transition"
        //         >
        //             View
        //         </button>
        //     ),
        // },
    ];

    const hasActiveFilters = dateFrom || dateTo || action || tableName || search;

    return (
        <>
            <Toolbar
                search={{ value: search, onChange: setSearch }}
            />

            <div className="bg-white rounded-lg shadow">
                <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-b border-gray-100 flex-wrap">
                    <select
                        value={action}
                        onChange={(e) => setAction(e.target.value)}
                        className="px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 text-sm bg-white"
                    >
                        <option value="">All actions</option>
                        {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>

                    <select
                        value={tableName}
                        onChange={(e) => setTableName(e.target.value)}
                        className="px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 text-sm bg-white"
                    >
                        <option value="">All modules</option>
                        {Object.entries(TABLE_LABELS).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                        ))}
                    </select>
                    
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 text-sm"
                    />
                    <span className="text-gray-400 text-sm">to</span>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 text-sm"
                    />

                    {hasActiveFilters && (
                        <button
                            onClick={() => {
                                setDateFrom(""); setDateTo(""); setAction(""); setTableName(""); setSearch("");
                            }}
                            title="Clear filters"
                            className="p-2 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>

                <DataTable
                    columns={columns}
                    data={logs}
                    loading={loading}
                    emptyMessage="No activity found for the selected filters."
                    onRowClick={(l) => setSelectedLog(l)}
                />
            </div>

            <DetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
        </>
    );
}