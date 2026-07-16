import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";

const labelCls = "block text-sm font-medium text-gray-700 mb-1.5";
const inputCls = "w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition";
const cellInputCls = "w-full px-2.5 py-2 rounded-md border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition";

function RequiredLabel({ children }) {
    return (
        <label className={labelCls}>
            <span className="text-red-500 mr-0.5">*</span>
            {children}
        </label>
    );
}

const toLocalDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const emptyLine = (id) => ({ id, accountId: "", debit: "", credit: "", narration: "" });

/**
 * Journal Entry form. 
 *
 * @param {string}   draftNumber   display value, or ref_number when editing a draft
 * @param {object}   initialData   existing DRAFT transaction, for edit mode — expects
 *                                 { id, date, notes, lines: [{account_id, debit, credit, narration}] }
 * @param {object[]} accounts      full chart of accounts, e.g. [{id, name, code}]
 * @param {function} onCreate(payload)
 * @param {function} onClose
 */
export default function JournalForm({
    draftNumber = "DRAFT-1",
    initialData = null,
    accounts = [],
    onCreate,
    onClose,
}) {
    const isEditing = Boolean(initialData);

    const [date, setDate] = useState(initialData?.date ?? toLocalDate(new Date()));
    const [notes, setNotes] = useState(initialData?.notes ?? "");
    const [lines, setLines] = useState(() => {
        if (initialData?.lines?.length) {
            return initialData.lines.map((l, idx) => ({
                id: idx + 1,
                accountId: String(l.account_id),
                debit: Number(l.debit) > 0 ? String(l.debit) : "",
                credit: Number(l.credit) > 0 ? String(l.credit) : "",
                narration: l.narration ?? "",
            }));
        }
        return [emptyLine(1), emptyLine(2)];
    });
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const nextId = () => Math.max(0, ...lines.map((l) => l.id)) + 1;

    const updateLine = (id, field, value) => {
        setLines((prev) =>
            prev.map((line) => {
                if (line.id !== id) return line;
                const next = { ...line, [field]: value };
                // Entering a debit clears credit on that row, and vice versa
                if (field === "debit" && value) next.credit = "";
                if (field === "credit" && value) next.debit = "";
                return next;
            })
        );
    };

    const addLine = () => setLines((prev) => [...prev, emptyLine(nextId())]);

    const removeLine = (id) => {
        setLines((prev) => (prev.length > 2 ? prev.filter((l) => l.id !== id) : prev));
    };

    const totalDebit = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
    const totalCredit = lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
    const difference = Math.round((totalDebit - totalCredit + Number.EPSILON) * 100) / 100;
    const isBalanced = difference === 0 && (totalDebit > 0 || totalCredit > 0);

    const fmt = (n) => (n || n === 0 ? Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-");

    const handleSubmit = async (approve) => {
        setError("");

        if (!date) return setError("Date is required.");

        const filledLines = lines.filter((l) => l.accountId && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0));
        if (filledLines.length < 2) return setError("A journal entry needs at least two lines with an account and an amount.");

        for (const l of lines) {
            if ((l.accountId || l.debit || l.credit) && !l.accountId) {
                return setError("Every line with an amount needs an account selected.");
            }
            if (parseFloat(l.debit) > 0 && parseFloat(l.credit) > 0) {
                return setError("A line cannot have both a debit and a credit amount.");
            }
        }

        if (!isBalanced) {
            return setError(
                `Entry is unbalanced. Total debits (Rs. ${fmt(totalDebit)}) must equal total credits (Rs. ${fmt(totalCredit)}).`
            );
        }

        setSubmitting(true);

        const payload = {
            ...(isEditing ? { id: initialData.id } : {}),
            date,
            notes,
            lines: filledLines.map((l) => ({
                account_id: parseInt(l.accountId),
                debit: parseFloat(l.debit) || 0,
                credit: parseFloat(l.credit) || 0,
                narration: l.narration,
            })),
            ...(isEditing ? {} : { status: approve ? "APPROVED" : "DRAFT" }),
        };

        try {
            await onCreate(payload);
        } catch (err) {
            setError(err?.message ?? "Something went wrong.");
            setSubmitting(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm">
            {/* Header */}
            <div className="flex items-center gap-3 px-7 py-5 border-b border-gray-100">
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
                >
                    <X size={20} />
                </button>
                <h2 className="text-lg font-semibold text-gray-900">
                    {isEditing ? "Edit Journal Entry" : "New Journal Entry"}
                </h2>
            </div>

            <div className="px-7 py-6 space-y-6">
                {error && (
                    <div className="px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                        {error}
                    </div>
                )}

                <div className="text-sm text-gray-500">
                    <span className="font-semibold text-gray-700">
                        {isEditing ? draftNumber : `DRAFT (${draftNumber})`}
                    </span>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <RequiredLabel>Date</RequiredLabel>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className={inputCls}
                        />
                    </div>
                </div>

                {/* Lines */}
                <div className="pt-2">
                    <div className="flex items-center gap-3 mb-4">
                        <h3 className="text-xs font-bold tracking-wide text-gray-500 uppercase">Transactions</h3>
                        <div className="flex-1 border-t border-gray-100" />
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs font-semibold text-gray-500">
                                    <th className="text-left py-2 pr-2 min-w-[220px]">Account</th>
                                    <th className="text-right py-2 px-2 w-32">Debit</th>
                                    <th className="text-right py-2 px-2 w-32">Credit</th>
                                    <th className="text-left py-2 px-2 min-w-[180px]">Narration</th>
                                    <th className="w-8" />
                                </tr>
                            </thead>
                            <tbody>
                                {lines.map((line) => (
                                    <tr key={line.id} className="border-t border-gray-100 align-middle">
                                        <td className="py-2.5 pr-2">
                                            <select
                                                value={line.accountId}
                                                onChange={(e) => updateLine(line.id, "accountId", e.target.value)}
                                                className={cellInputCls}
                                            >
                                                <option value="">Select account</option>
                                                {accounts.map((a) => (
                                                    <option key={a.id} value={a.id}>
                                                        {a.code ? `${a.code} — ${a.name}` : a.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="py-2.5 px-2">
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                placeholder="0.00"
                                                value={line.debit}
                                                onChange={(e) => updateLine(line.id, "debit", e.target.value)}
                                                className={`${cellInputCls} text-right`}
                                            />
                                        </td>
                                        <td className="py-2.5 px-2">
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                placeholder="0.00"
                                                value={line.credit}
                                                onChange={(e) => updateLine(line.id, "credit", e.target.value)}
                                                className={`${cellInputCls} text-right`}
                                            />
                                        </td>
                                        <td className="py-2.5 px-2">
                                            <input
                                                type="text"
                                                placeholder="Narration"
                                                value={line.narration}
                                                onChange={(e) => updateLine(line.id, "narration", e.target.value)}
                                                className={cellInputCls}
                                            />
                                        </td>
                                        <td className="py-2.5 pl-1">
                                            <button
                                                type="button"
                                                onClick={() => removeLine(line.id)}
                                                disabled={lines.length <= 2}
                                                className="p-1.5 rounded-md text-gray-300 hover:bg-red-50 hover:text-red-500 transition disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-300"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <button
                        type="button"
                        onClick={addLine}
                        className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-slate-900 transition"
                    >
                        <Plus size={15} /> Add Line
                    </button>
                </div>

                {/* Notes + Totals */}
                <div className="grid grid-cols-2 gap-10 pt-2">
                    <div>
                        <label className={labelCls}>Notes</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Internal notes..."
                            rows={4}
                            className={`${inputCls} resize-none`}
                        />
                    </div>

                    <div className="space-y-2.5 text-sm pt-1">
                        <div className="flex items-center justify-between text-gray-600">
                            <span>Total Debit</span>
                            <span>{fmt(totalDebit)}</span>
                        </div>
                        <div className="flex items-center justify-between text-gray-600">
                            <span>Total Credit</span>
                            <span>{fmt(totalCredit)}</span>
                        </div>
                        <div className={`flex items-center justify-between text-base font-semibold pt-2 border-t border-gray-100 ${
                            isBalanced ? "text-emerald-600" : "text-red-500"
                        }`}>
                            <span>{isBalanced ? "Balanced" : "Difference"}</span>
                            <span>{isBalanced ? "✓" : fmt(Math.abs(difference))}</span>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={() => handleSubmit(false)}
                        disabled={submitting}
                        className="px-6 py-2.5 rounded-lg bg-slate-700 text-white text-sm font-semibold hover:bg-slate-800 transition disabled:opacity-60"
                    >
                        Save Draft
                    </button>
                    {!isEditing && (
                        <button
                            type="button"
                            onClick={() => handleSubmit(true)}
                            disabled={submitting}
                            className="px-6 py-2.5 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition disabled:opacity-60"
                        >
                            Save and Approve
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}