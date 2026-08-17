import { useEffect, useState } from "react";
import api from "../../api/axios";
import Toast from "../../components/Toast";
import useToast from "../../hooks/useToast";

const toLocalDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const labelCls = "block text-sm font-medium text-gray-700 mb-1.5";
const inputCls = "w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition";

export default function PayTds() {
    const [entries, setEntries] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [bankAccounts, setBankAccounts] = useState([]);
    const [bankAccountId, setBankAccountId] = useState("");
    const [fiscalYear, setFiscalYear] = useState("");
    const [date, setDate] = useState(toLocalDate(new Date()));
    const [notes, setNotes] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const { toast, showToast, hideToast } = useToast();

    useEffect(() => {
        fetchBankAccounts();
    }, []);

    useEffect(() => {
        fetchUnpaidEntries();
        setSelectedIds([]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fiscalYear]);

    const fetchBankAccounts = async () => {
        try {
            const { data } = await api.get("/bank_account/list.php");
            setBankAccounts(data.data ?? []);
        } catch (err) {
            console.log(err);
        }
    };

    const fetchUnpaidEntries = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ is_paid: "false" });
            if (fiscalYear) params.set("fiscal_year", fiscalYear);
            const { data } = await api.get(`/tds/list.php?${params.toString()}`);
            // Only PAYABLE and EXPENSE can ever be paid — RECEIVABLE is claimed, not paid
            setEntries((data.data ?? []).filter((e) => e.tds_type !== "RECEIVABLE"));
        } catch (err) {
            console.error("Failed to fetch unpaid TDS entries:", err);
        } finally {
            setLoading(false);
        }
    };

    const toggleEntry = (id) => {
        setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    const toggleAll = () => {
        setSelectedIds(selectedIds.length === entries.length ? [] : entries.map((e) => e.id));
    };

    const selectedTotal = entries
        .filter((e) => selectedIds.includes(e.id))
        .reduce((sum, e) => sum + Number(e.tds_amount || 0), 0);

    const fmt = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });

    const handleSubmit = async () => {
        if (!date) return showToast("Date is required.", "error");
        if (!bankAccountId) return showToast("Bank account is required.", "error");
        if (!fiscalYear) return showToast("Fiscal year is required.", "error");
        if (selectedIds.length === 0) return showToast("Select at least one TDS entry to pay.", "error");

        if (!window.confirm(`Pay Rs. ${fmt(selectedTotal)} to government, settling ${selectedIds.length} TDS entr${selectedIds.length !== 1 ? "ies" : "y"}?`)) return;

        setSubmitting(true);
        try {
            await api.post("/tds/pay.php", {
                date,
                bank_account_id: parseInt(bankAccountId),
                tds_entry_ids: selectedIds,
                fiscal_year: fiscalYear,
                notes,
            });
            showToast("TDS payment recorded successfully.");
            setSelectedIds([]);
            fetchUnpaidEntries();
        } catch (err) {
            showToast(err.response?.data?.message ?? "Failed to record TDS payment.", "error");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <Toast toast={toast} onClose={hideToast} />

            <div className="bg-white rounded-2xl shadow-sm">
                <div className="px-7 py-5 border-b border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-900">Pay TDS to Government</h2>
                </div>

                <div className="px-7 py-6 space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className={labelCls}>
                                <span className="text-red-500 mr-0.5">*</span>Date
                            </label>
                            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>
                                <span className="text-red-500 mr-0.5">*</span>Bank Account
                            </label>
                            <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} className={inputCls}>
                                <option value="">Select account</option>
                                {bankAccounts.map((ba) => (
                                    <option key={ba.id} value={ba.id}>{ba.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>
                                <span className="text-red-500 mr-0.5">*</span>Fiscal Year
                            </label>
                            <input
                                type="text"
                                value={fiscalYear}
                                onChange={(e) => setFiscalYear(e.target.value)}
                                placeholder="e.g. 2081-82"
                                className={inputCls}
                            />
                        </div>
                    </div>

                    {!fiscalYear ? (
                        <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg">
                            Enter a fiscal year to see unpaid TDS entries.
                        </div>
                    ) : loading ? (
                        <div className="text-center py-12 text-slate-500">Loading unpaid entries...</div>
                    ) : entries.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg">
                            No unpaid TDS entries for fiscal year {fiscalYear}.
                        </div>
                    ) : (
                        <div className="overflow-x-auto border border-gray-100 rounded-lg">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-700 text-white">
                                        <th className="px-3 py-2 w-8">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.length === entries.length}
                                                onChange={toggleAll}
                                            />
                                        </th>
                                        <th className="px-4 py-2 text-left">Date</th>
                                        <th className="px-4 py-2 text-left">Party</th>
                                        <th className="px-4 py-2 text-left">Type</th>
                                        <th className="px-4 py-2 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {entries.map((entry, idx) => (
                                        <tr
                                            key={entry.id}
                                            onClick={() => toggleEntry(entry.id)}
                                            className={`cursor-pointer ${idx % 2 === 0 ? "bg-white" : "bg-slate-50"} border-b border-slate-100 hover:bg-slate-100`}
                                        >
                                            <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                                                <input type="checkbox" checked={selectedIds.includes(entry.id)} onChange={() => toggleEntry(entry.id)} />
                                            </td>
                                            <td className="px-4 py-2">{entry.date}</td>
                                            <td className="px-4 py-2">{entry.contact_name}</td>
                                            <td className="px-4 py-2">{entry.tds_type}</td>
                                            <td className="px-4 py-2 text-right">{fmt(entry.tds_amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div>
                        <label className={labelCls}>Notes</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Internal notes..."
                            rows={3}
                            className={`${inputCls} resize-none`}
                        />
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                        <div className="text-sm">
                            <span className="text-gray-500">Selected: </span>
                            <span className="font-semibold text-gray-900">{selectedIds.length} entries — Rs. {fmt(selectedTotal)}</span>
                        </div>
                        <button
                            onClick={handleSubmit}
                            disabled={submitting || selectedIds.length === 0}
                            className="px-6 py-2.5 rounded-lg bg-slate-700 text-white text-sm font-semibold hover:bg-slate-800 transition disabled:opacity-60"
                        >
                            {submitting ? "Processing..." : "Record TDS Payment"}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}