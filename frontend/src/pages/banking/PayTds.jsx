import { useEffect, useState } from "react";
import api from "../../api/axios";
import Toast from "../../components/Toast";
import useToast from "../../hooks/useToast";
import { validateRequiredDate, validateRequiredSelect, validateFiscalYear, validatePaymentMode, validatePaymentRef } from "../../utils/validators";
import { PAYMENT_MODES, NON_CASH_PAYMENT_MODES, paymentModeRequiresRef, paymentRefLabel } from "../../constants/paymentModes";
import NepaliDateInput from "../../components/NepaliDateInput";

const toLocalDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const labelCls = "block text-sm font-medium text-gray-700 mb-1.5";
const inputCls = "w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition";

export default function PayTds() {
    const [entries, setEntries] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [bankAccounts, setBankAccounts] = useState([]);
    const [bankAccountId, setBankAccountId] = useState("");
    const [paymentMode, setPaymentMode] = useState("");
    const [paymentRef, setPaymentRef] = useState("");
    const [fiscalYear, setFiscalYear] = useState("");
    const [date, setDate] = useState(toLocalDate(new Date()));
    const [notes, setNotes] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({});
    const { toast, showToast, hideToast } = useToast();

    const clearFieldError = (field) => {
        if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: "" }));
    };

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
            const filtered = (data.data ?? []).filter((e) => e.tds_type !== "RECEIVABLE");
            setEntries(filtered);
            return filtered;
        } catch (err) {
            console.error("Failed to fetch unpaid TDS entries:", err);
            return [];
        } finally {
            setLoading(false);
        }
    };

    const selectedBankAccount = bankAccounts.find((ba) => String(ba.id) === String(bankAccountId));
    const isCashAccount = selectedBankAccount?.account_type === "CASH";
    const modeOptions = isCashAccount ? PAYMENT_MODES.filter((m) => m.value === "CASH") : NON_CASH_PAYMENT_MODES;

    const handleBankAccountChange = (value) => {
        setBankAccountId(value);
        clearFieldError("bankAccount");
        const account = bankAccounts.find((ba) => String(ba.id) === String(value));
        if (account?.account_type === "CASH") {
            setPaymentMode("CASH");
            setPaymentRef("");
            clearFieldError("paymentRef");
        } else if (paymentMode === "CASH") {
            setPaymentMode("");
        }
        clearFieldError("paymentMode");
    };

    const toggleEntry = (id) => {
        setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
        clearFieldError("entries");
    };

    const toggleAll = () => {
        setSelectedIds(selectedIds.length === entries.length ? [] : entries.map((e) => e.id));
        clearFieldError("entries");
    };

    const selectedTotal = entries
        .filter((e) => selectedIds.includes(e.id))
        .reduce((sum, e) => sum + Number(e.tds_amount || 0), 0);

    const fmt = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });

    const handleSubmit = async () => {
        const errors = {};

        const dateErr = validateRequiredDate(date, { label: "Date" });
        if (dateErr) errors.date = dateErr;

        const bankErr = validateRequiredSelect(bankAccountId, { label: "Bank account" });
        if (bankErr) errors.bankAccount = bankErr;

        const modeErr = validatePaymentMode(paymentMode);
        if (modeErr) errors.paymentMode = modeErr;

        const refErr = validatePaymentRef(paymentRef, { mode: paymentMode, required: paymentModeRequiresRef(paymentMode) });
        if (refErr) errors.paymentRef = refErr;

        const fiscalYearErr = validateFiscalYear(fiscalYear);
        if (fiscalYearErr) errors.fiscalYear = fiscalYearErr;

        if (selectedIds.length === 0) errors.entries = "Select at least one TDS entry to pay.";

        setFieldErrors(errors);
        if (Object.keys(errors).length > 0) return;

        setSubmitting(true);

        const freshEntries = await fetchUnpaidEntries();
        const freshIds = new Set(freshEntries.map((e) => e.id));
        const staleIds = selectedIds.filter((id) => !freshIds.has(id));

        if (staleIds.length > 0) {
            setSelectedIds((prev) => prev.filter((id) => freshIds.has(id)));
            setSubmitting(false);
            showToast(
                `${staleIds.length} selected entr${staleIds.length !== 1 ? "ies were" : "y was"} already paid elsewhere. The list has been refreshed — please review your selection.`,
                "error"
            );
            return;
        }

        const freshTotal = freshEntries
            .filter((e) => selectedIds.includes(e.id))
            .reduce((sum, e) => sum + Number(e.tds_amount || 0), 0);

        if (!window.confirm(`Pay Rs. ${fmt(freshTotal)} to government, settling ${selectedIds.length} TDS entr${selectedIds.length !== 1 ? "ies" : "y"}?`)) {
            setSubmitting(false);
            return;
        }

        try {
            await api.post("/tds/pay.php", {
                date,
                bank_account_id: parseInt(bankAccountId),
                payment_mode: paymentMode,
                payment_ref: paymentRef.trim() || null,
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
                {/* <div className="px-7 py-5 border-b border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-900">Pay TDS to Government</h2>
                </div> */}

                <div className="px-7 py-6 space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className={labelCls}>
                                <span className="text-red-500 mr-0.5">*</span>Date
                            </label>
                            <NepaliDateInput
                                value={date}
                                disableFuture
                                onChange={(v) => {
                                    setDate(v);
                                    clearFieldError("date");
                                }}
                                className={fieldErrors.date ? "border-red-400" : ""}
                            />
                            {fieldErrors.date && <p className="mt-1 text-xs text-red-500">{fieldErrors.date}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className={labelCls}>
                                <span className="text-red-500 mr-0.5">*</span>Bank Account
                            </label>
                            <select
                                value={bankAccountId}
                                onChange={(e) => handleBankAccountChange(e.target.value)}
                                className={`${inputCls} ${fieldErrors.bankAccount ? "border-red-400" : ""}`}
                            >
                                <option value="">Select account</option>
                                {bankAccounts.map((ba) => (
                                    <option key={ba.id} value={ba.id}>{ba.name}</option>
                                ))}
                            </select>
                            {fieldErrors.bankAccount && <p className="mt-1 text-xs text-red-500">{fieldErrors.bankAccount}</p>}
                        </div>
                        <div>
                            <label className={labelCls}>
                                <span className="text-red-500 mr-0.5">*</span>Mode
                            </label>
                            <select
                                value={paymentMode}
                                onChange={(e) => {
                                    setPaymentMode(e.target.value);
                                    clearFieldError("paymentMode");
                                    clearFieldError("paymentRef");
                                }}
                                disabled={!bankAccountId || isCashAccount}
                                className={`${inputCls} ${fieldErrors.paymentMode ? "border-red-400" : ""} ${(!bankAccountId || isCashAccount) ? "opacity-70 cursor-not-allowed" : ""}`}
                            >
                                <option value="">{bankAccountId ? "Select mode" : "Select account first"}</option>
                                {modeOptions.map((m) => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>
                            {fieldErrors.paymentMode && <p className="mt-1 text-xs text-red-500">{fieldErrors.paymentMode}</p>}
                        </div>
                        {paymentMode && paymentMode !== "CASH" && (
                            <div>
                                {paymentModeRequiresRef(paymentMode) ? (
                                    <label className={labelCls}>
                                        <span className="text-red-500 mr-0.5">*</span>{paymentRefLabel(paymentMode)}
                                    </label>
                                ) : (
                                    <label className={labelCls}>{paymentRefLabel(paymentMode)}</label>
                                )}
                                <input
                                    type="text"
                                    value={paymentRef}
                                    onChange={(e) => {
                                        setPaymentRef(e.target.value);
                                        clearFieldError("paymentRef");
                                    }}
                                    placeholder={paymentMode === "CHEQUE" ? "e.g. 0123456" : "e.g. TXN-98765"}
                                    maxLength={100}
                                    className={`${inputCls} ${fieldErrors.paymentRef ? "border-red-400" : ""}`}
                                />
                                {fieldErrors.paymentRef && <p className="mt-1 text-xs text-red-500">{fieldErrors.paymentRef}</p>}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className={labelCls}>
                                <span className="text-red-500 mr-0.5">*</span>Fiscal Year
                            </label>
                            <input
                                type="text"
                                value={fiscalYear}
                                onChange={(e) => {
                                    setFiscalYear(e.target.value);
                                    clearFieldError("fiscalYear");
                                }}
                                placeholder="e.g. 2081-82"
                                className={`${inputCls} ${fieldErrors.fiscalYear ? "border-red-400" : ""}`}
                            />
                            {fieldErrors.fiscalYear && <p className="mt-1 text-xs text-red-500">{fieldErrors.fiscalYear}</p>}
                        </div>
                    </div>

                    {fiscalYear && (
                        loading ? (
                            <div className="text-center py-12 text-slate-500">Loading unpaid entries...</div>
                        ) : entries.length === 0 ? (
                            <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg">
                                No unpaid TDS entries for fiscal year {fiscalYear}.
                            </div>
                        ) : (
                            // <div className="overflow-x-auto border border-gray-100 rounded-lg">
                            //     <table className="w-full text-sm">
                            //         <thead>
                            //             <tr className="bg-slate-700 text-white">
                            //                 <th className="px-3 py-2 w-8">
                            //                     <input
                            //                         type="checkbox"
                            //                         checked={selectedIds.length === entries.length}
                            //                         onChange={toggleAll}
                            //                     />
                            //                 </th>
                            //                 <th className="px-4 py-2 text-left">Date</th>
                            //                 <th className="px-4 py-2 text-left">Party</th>
                            //                 <th className="px-4 py-2 text-left">Type</th>
                            //                 <th className="px-4 py-2 text-right">Amount</th>
                            //             </tr>
                            //         </thead>
                            //         <tbody>
                            //             {entries.map((entry, idx) => (
                            //                 <tr
                            //                     key={entry.id}
                            //                     onClick={() => toggleEntry(entry.id)}
                            //                     className={`cursor-pointer ${idx % 2 === 0 ? "bg-white" : "bg-slate-50"} border-b border-slate-100 hover:bg-slate-100`}
                            //                 >
                            //                     <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                            //                         <input type="checkbox" checked={selectedIds.includes(entry.id)} onChange={() => toggleEntry(entry.id)} />
                            //                     </td>
                            //                     <td className="px-4 py-2">{entry.date}</td>
                            //                     <td className="px-4 py-2">{entry.contact_name}</td>
                            //                     <td className="px-4 py-2">{entry.tds_type}</td>
                            //                     <td className="px-4 py-2 text-right">{fmt(entry.tds_amount)}</td>
                            <div>
                                <div className={`overflow-x-auto border rounded-lg ${fieldErrors.entries ? "border-red-400" : "border-gray-100"}`}>
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
                                        {/* ))} */}
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
                                {fieldErrors.entries && <p className="mt-1 text-xs text-red-500">{fieldErrors.entries}</p>}
                            </div>
                        )
                    )}

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className={labelCls}>Notes</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Internal notes..."
                                rows={5}
                                className={`${inputCls} resize-none`}
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                        <div className="text-sm">
                            <span className="text-gray-500">Selected: </span>
                            <span className="font-semibold text-gray-900">{selectedIds.length} entries — Rs. {fmt(selectedTotal)}</span>
                        </div>
                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
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