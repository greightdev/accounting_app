import { useState, useEffect } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { can } from "../permissions";
import { validateRequiredDate, validateRequiredSelect, validateFiscalYear, validatePositiveNumber } from "../utils/validators";

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

const emptyLine = (id) => ({ id, accountId: "", debit: "", credit: "", narration: "", isTdsLine: false });

const TDS_EXPENSE_LINE_ID = "tds-expense-line";
const TDS_PAYABLE_LINE_ID = "tds-payable-line";

/**
 * Journal Entry form.
 *
 * @param {string}   draftNumber   display value, or ref_number when editing a draft
 * @param {object}   initialData   existing DRAFT transaction, for edit mode — expects
 *                                 { id, date, notes, lines: [{account_id, debit, credit, narration}], tds_context }
 * @param {object[]} accounts      full chart of accounts, e.g. [{id, name, code}]
 * @param {object[]} contacts      full contacts list, for the TDS Expense customer picker
 * @param {function} onCreate(payload)
 * @param {function} onClose
 */
export default function JournalForm({
    draftNumber = "DRAFT-1",
    initialData = null,
    accounts = [],
    contacts = [],
    onCreate,
    onClose,
}) {
    const { role } = useAuth();
    const canApprove = can(role, "canApprove");
    const isEditing = Boolean(initialData);

    const tdsExpenseAccount = accounts.find((a) => a.name === "TDS Expense");
    const tdsPayableAccount = accounts.find((a) => a.name === "TDS Payable");

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
                isTdsLine: false,
            }));
        }
        return [emptyLine(1), emptyLine(2)];
    });
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);

    const clearFieldError = (field) => {
        if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: "" }));
    };

    // TDS Expense linkage
    const [isTdsExpense, setIsTdsExpense] = useState(Boolean(initialData?.tds_context));
    const [tdsContactId, setTdsContactId] = useState(
        initialData?.tds_context?.contact_id ? String(initialData.tds_context.contact_id) : ""
    );
    const [tdsFiscalYear, setTdsFiscalYear] = useState(initialData?.tds_context?.fiscal_year ?? "");
    const [tdsAmount, setTdsAmount] = useState(
        initialData?.tds_context?.tds_amount ? String(initialData.tds_context.tds_amount) : ""
    );

    // Keep the two auto-populated lines in sync with the checkbox + amount, so they can never drift from what gets written to tds_entries.
    useEffect(() => {
        setLines((prev) => {
            const withoutTdsLines = prev.filter((l) => !l.isTdsLine);

            if (!isTdsExpense || !tdsExpenseAccount || !tdsPayableAccount) {
                return withoutTdsLines.length ? withoutTdsLines : [emptyLine(1), emptyLine(2)];
            }

            const amt = tdsAmount || "";
            return [
                ...withoutTdsLines,
                {
                    id: TDS_EXPENSE_LINE_ID,
                    accountId: String(tdsExpenseAccount.id),
                    debit: amt,
                    credit: "",
                    narration: "TDS Expense (customer did not deduct)",
                    isTdsLine: true,
                },
                {
                    id: TDS_PAYABLE_LINE_ID,
                    accountId: String(tdsPayableAccount.id),
                    debit: "",
                    credit: amt,
                    narration: "TDS Payable to government",
                    isTdsLine: true,
                },
            ];
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isTdsExpense, tdsAmount, tdsExpenseAccount?.id, tdsPayableAccount?.id]);

    const nextId = () => {
        const numericIds = lines.map((l) => l.id).filter((id) => typeof id === "number");
        return Math.max(0, ...numericIds) + 1;
    };


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

        const errors = {};

        const dateErr = validateRequiredDate(date, { label: "Date" });
        if (dateErr) errors.date = dateErr;

        if (isTdsExpense) {
            if (!tdsExpenseAccount || !tdsPayableAccount) {
                setError("TDS Expense / TDS Payable accounts were not found in the Chart of Accounts.");
                setFieldErrors(errors);
                return;
            }

            const tdsContactErr = validateRequiredSelect(tdsContactId, { label: "Customer" });
            if (tdsContactErr) errors.tdsContact = tdsContactErr;

            const tdsFyErr = validateFiscalYear(tdsFiscalYear);
            if (tdsFyErr) errors.tdsFiscalYear = tdsFyErr;

            const tdsAmountErr = validatePositiveNumber(tdsAmount, { label: "TDS amount" });
            if (tdsAmountErr) errors.tdsAmount = tdsAmountErr;
        }

        // Guard against a negative debit/credit slipping through manual typing (the number
        // input's min="0" only blocks the spinner, not direct keyboard entry).
        for (const l of lines) {
            if (parseFloat(l.debit) < 0 || parseFloat(l.credit) < 0) {
                errors.lines = "Debit and credit amounts cannot be negative.";
                break;
            }
        }

        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            setError(errors.lines || "");
            return;
        }
        setFieldErrors({});

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

        // Backstop: even though the two TDS lines are auto-populated, guard against them ever being hand-edited into mismatching tds_amount.
        if (isTdsExpense) {
            const tdsLineDebit = lines.find((l) => l.id === TDS_EXPENSE_LINE_ID);
            const tdsLineCredit = lines.find((l) => l.id === TDS_PAYABLE_LINE_ID);
            const expected = parseFloat(tdsAmount) || 0;

            if (
                Math.round((parseFloat(tdsLineDebit?.debit) || 0) * 100) !== Math.round(expected * 100) ||
                Math.round((parseFloat(tdsLineCredit?.credit) || 0) * 100) !== Math.round(expected * 100)
            ) {
                return setError("The TDS Expense and TDS Payable line amounts must match the TDS amount entered above.");
            }
        }

        if (!isBalanced) {
            return setError(
                `Entry is unbalanced. Total debits (Rs. ${fmt(totalDebit)}) must equal total credits (Rs. ${fmt(totalCredit)}).`
            );
        }

        setSubmitting(true);

        const selectedContact = contacts.find((c) => String(c.id) === tdsContactId);

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
            ...(isTdsExpense ? {
                tds_context: {
                    contact_id: parseInt(tdsContactId),
                    pan: selectedContact?.pan ?? null,
                    fiscal_year: tdsFiscalYear,
                    tds_amount: parseFloat(tdsAmount),
                }
            } : {}),
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
                            onChange={(e) => {
                                setDate(e.target.value);
                                clearFieldError("date");
                            }}
                            className={`${inputCls} ${fieldErrors.date ? "border-red-400" : ""}`}
                        />
                        {fieldErrors.date && <p className="mt-1 text-xs text-red-500">{fieldErrors.date}</p>}
                    </div>
                </div>

                {/* TDS Expense Linkage */}
                <div className="pt-2 border-t border-gray-100">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <input
                            type="checkbox"
                            checked={isTdsExpense}
                            onChange={(e) => {
                                const checked = e.target.checked;
                                setIsTdsExpense(checked);
                                if (checked) {
                                    setLines((prev) =>
                                        prev.filter(
                                            (l) => l.isTdsLine || l.accountId || l.debit || l.credit || l.narration
                                        )
                                    );
                                }
                            }}
                        />
                        This entry recognizes a TDS Expense
                    </label>
                    {isTdsExpense && (
                        <div className="grid grid-cols-3 gap-4 mt-3">
                            <div>
                                <RequiredLabel>Customer</RequiredLabel>
                                <select
                                    value={tdsContactId}
                                    onChange={(e) => {
                                        setTdsContactId(e.target.value);
                                        clearFieldError("tdsContact");
                                    }}
                                    className={`${inputCls} ${fieldErrors.tdsContact ? "border-red-400" : ""}`}
                                >
                                    <option value="">Select customer</option>
                                    {contacts.filter((c) => c.type === "Customer").map((c) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                                {fieldErrors.tdsContact && <p className="mt-1 text-xs text-red-500">{fieldErrors.tdsContact}</p>}
                            </div>
                            <div>
                                <RequiredLabel>Fiscal Year</RequiredLabel>
                                <input
                                    type="text"
                                    value={tdsFiscalYear}
                                    onChange={(e) => {
                                        setTdsFiscalYear(e.target.value);
                                        clearFieldError("tdsFiscalYear");
                                    }}
                                    placeholder="e.g. 2081-82"
                                    className={`${inputCls} ${fieldErrors.tdsFiscalYear ? "border-red-400" : ""}`}
                                />
                                {fieldErrors.tdsFiscalYear && <p className="mt-1 text-xs text-red-500">{fieldErrors.tdsFiscalYear}</p>}
                            </div>
                            <div>
                                <RequiredLabel>TDS Amount</RequiredLabel>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={tdsAmount}
                                    onChange={(e) => {
                                        setTdsAmount(e.target.value);
                                        clearFieldError("tdsAmount");
                                    }}
                                    className={`${inputCls} ${fieldErrors.tdsAmount ? "border-red-400" : ""}`}
                                />
                                {fieldErrors.tdsAmount && <p className="mt-1 text-xs text-red-500">{fieldErrors.tdsAmount}</p>}
                            </div>
                            <p className="col-span-3 text-xs text-gray-400 -mt-1">
                                The TDS Expense (debit) and TDS Payable (credit) lines below are filled in automatically from this amount.
                            </p>
                        </div>
                    )}
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
                                    <tr key={line.id} className={`border-t border-gray-100 align-middle ${line.isTdsLine ? "bg-amber-50/50" : ""}`}>
                                        <td className="py-2.5 pr-2">
                                            <select
                                                value={line.accountId}
                                                onChange={(e) => updateLine(line.id, "accountId", e.target.value)}
                                                disabled={line.isTdsLine}
                                                className={`${cellInputCls} ${line.isTdsLine ? "opacity-70 cursor-not-allowed" : ""}`}
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
                                                disabled={line.isTdsLine}
                                                className={`${cellInputCls} text-right ${line.isTdsLine ? "opacity-70 cursor-not-allowed" : ""}`}
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
                                                disabled={line.isTdsLine}
                                                className={`${cellInputCls} text-right ${line.isTdsLine ? "opacity-70 cursor-not-allowed" : ""}`}
                                            />
                                        </td>
                                        <td className="py-2.5 px-2">
                                            <input
                                                type="text"
                                                placeholder="Narration"
                                                value={line.narration}
                                                onChange={(e) => updateLine(line.id, "narration", e.target.value)}
                                                disabled={line.isTdsLine}
                                                className={`${cellInputCls} ${line.isTdsLine ? "opacity-70 cursor-not-allowed" : ""}`}
                                            />
                                        </td>
                                        <td className="py-2.5 pl-1">
                                            <button
                                                type="button"
                                                onClick={() => removeLine(line.id)}
                                                disabled={lines.length <= 2 || line.isTdsLine}
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
                    {!isEditing && canApprove && (
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