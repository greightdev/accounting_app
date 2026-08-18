import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { can } from "../permissions";
import { validateRequiredDate, validateRequiredSelect, validatePositiveNumber } from "../utils/validators";

const labelCls = "block text-sm font-medium text-gray-700 mb-1.5";
const inputCls = "w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition";

function RequiredLabel({ children }) {
    return (
        <label className={labelCls}>
            <span className="text-red-500 mr-0.5">*</span>
            {children}
        </label>
    );
}

const toLocalDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Deposit: Debit Bank, Credit Source account
 * Withdrawal: Credit Bank, Debit Destination account
 *
 * @param {string}   mode                 'deposit' | 'withdrawal'
 * @param {string}   draftNumber          display value, or ref_number when editing a draft
 * @param {object}   initialData          existing DRAFT transaction, for edit mode — expects
 *                                        { id, date, bank_account_id, contra_account_id, total_amount, notes }
 * @param {object[]} bankAccounts         [{id, name}] — the bank_accounts table
 * @param {object[]} contraAccounts       offsetting-account options for the current bank account selection
 * @param {function} onBankAccountChange(bankAccountId) — called on mount and whenever the bank
 *                                        account dropdown changes, so the parent can refetch
 *                                        contraAccounts excluding that account
 * @param {function} onCreate(payload)
 * @param {function} onClose
 */

export default function BankTransferForm({
    mode = "deposit",
    draftNumber = "DRAFT-1",
    initialData = null,
    bankAccounts = [],
    contraAccounts = [],
    onBankAccountChange,
    onCreate,
    onClose,
}) {
    const { role } = useAuth();
    const canApprove = can(role, "canApprove");
    const isDeposit = mode === "deposit";

    const isEditing = Boolean(initialData);

    const [date, setDate] = useState(initialData?.date ?? toLocalDate(new Date()));
    const [bankAccountId, setBankAccountId] = useState(initialData?.bank_account_id != null ? String(initialData.bank_account_id) : "");
    const [contraAccountId, setContraAccountId] = useState(initialData?.contra_account_id != null ? String(initialData.contra_account_id) : "");
    const [amount, setAmount] = useState(initialData?.total_amount != null ? String(initialData.total_amount) : "");
    const [notes, setNotes] = useState(initialData?.notes ?? "");
    const [formError, setFormError] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);

    const clearFieldError = (field) => {
        if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: "" }));
    };

    // Fetch contra accounts for whatever bank account is selected 
    useEffect(() => {
        onBankAccountChange?.(bankAccountId || null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleBankAccountChange = (value) => {
        setBankAccountId(value);
        setContraAccountId(""); // previous selection may no longer be valid
        clearFieldError("bankAccount");
        clearFieldError("contraAccount");
        onBankAccountChange?.(value || null);
    };

    const fmt = (n) => (n || n === 0 ? Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-");

    const handleSubmit = async (approve) => {
        setFormError("");

        const errors = {};

        const dateErr = validateRequiredDate(date, { label: "Date" });
        if (dateErr) errors.date = dateErr;

        const bankErr = validateRequiredSelect(bankAccountId, { label: "Bank account" });
        if (bankErr) errors.bankAccount = bankErr;

        const contraLabel = isDeposit ? "Source account" : "Destination account";
        const contraErr = validateRequiredSelect(contraAccountId, { label: contraLabel });
        if (contraErr) errors.contraAccount = contraErr;

        const selectedBankAccount = bankAccounts.find((ba) => String(ba.id) === String(bankAccountId));
        const bankLedgerAccountId = selectedBankAccount?.ledger_account_id;

        if (!contraErr && bankLedgerAccountId != null && String(bankLedgerAccountId) === String(contraAccountId)) {
            errors.contraAccount = "Source and destination accounts must be different.";
        }

        const amountErr = validatePositiveNumber(amount, { label: "Amount" });
        if (amountErr) errors.amount = amountErr;

        setFieldErrors(errors);

        if (Object.keys(errors).length > 0) {
            return;
        }

        setSubmitting(true);

        const payload = {
            ...(isEditing ? { id: initialData.id } : {}),
            date,
            bank_account_id: parseInt(bankAccountId),
            account_id: parseInt(contraAccountId),
            amount: parseFloat(amount),
            notes,
            ...(isEditing ? {} : { status: approve ? "APPROVED" : "DRAFT" }),
        };

        try {
            await onCreate(payload);
        } catch (err) {
            setFormError(err?.message ?? "Something went wrong.");
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
                    {isEditing
                        ? `Edit ${isDeposit ? "Deposit" : "Withdrawal"}`
                        : isDeposit ? "New Bank Deposit" : "New Bank Withdrawal"}
                </h2>
            </div>

            <div className="px-7 py-6 space-y-6">
                {formError && (
                    <div className="px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                        {formError}
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
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <RequiredLabel>Bank Account</RequiredLabel>
                        <select
                            value={bankAccountId}
                            onChange={(e) => handleBankAccountChange(e.target.value)}
                            className={`${inputCls} ${fieldErrors.bankAccount ? "border-red-400" : ""}`}
                        >
                            <option value="">Select bank account</option>
                            {bankAccounts.map((ba) => (
                                <option key={ba.id} value={ba.id}>{ba.name}</option>
                            ))}
                        </select>
                        {fieldErrors.bankAccount && <p className="mt-1 text-xs text-red-500">{fieldErrors.bankAccount}</p>}
                    </div>

                    <div>
                        <RequiredLabel>{isDeposit ? "From (Source)" : "To (Destination)"}</RequiredLabel>
                        <select
                            value={contraAccountId}
                            onChange={(e) => {
                                setContraAccountId(e.target.value);
                                clearFieldError("contraAccount");
                            }}
                            disabled={!bankAccountId}
                            className={`${inputCls} ${!bankAccountId ? "opacity-50 cursor-not-allowed" : ""} ${fieldErrors.contraAccount ? "border-red-400" : ""}`}
                        >
                            <option value="">{bankAccountId ? "Select account" : "Select bank account first"}</option>
                            {contraAccounts.map((a) => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                        </select>
                        {fieldErrors.contraAccount && <p className="mt-1 text-xs text-red-500">{fieldErrors.contraAccount}</p>}
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <RequiredLabel>Amount</RequiredLabel>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={amount}
                            onChange={(e) => {
                                setAmount(e.target.value);
                                clearFieldError("amount");
                            }}
                            placeholder="0.00"
                            className={`${inputCls} ${fieldErrors.amount ? "border-red-400" : ""}`}
                        />
                        {fieldErrors.amount && <p className="mt-1 text-xs text-red-500">{fieldErrors.amount}</p>}
                    </div>
                </div>

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