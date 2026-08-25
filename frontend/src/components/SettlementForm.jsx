import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { validateRequiredDate, validateRequiredSelect, validatePositiveNumber, validateFiscalYear, validatePaymentMode, validatePaymentRef } from "../utils/validators";
import { PAYMENT_MODES, NON_CASH_PAYMENT_MODES, paymentModeRequiresRef, paymentRefLabel } from "../constants/paymentModes";
import NepaliDateInput from "./NepaliDateInput";

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

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Generic form for Receipts (customer pays us) and Payments (we pay vendor)
 *
 * @param {string}   mode            'receipt' | 'payment'
 * @param {object[]} contacts        full contacts list
 * @param {object[]} bankAccounts    bank accounts list
 * @param {object[]} openDocuments   open invoices (receipt) or open bills (payment) for selected contact.
 *                                   Must include sub_total (taxable amount) for TDS auto-calc to work.
 * @param {function} onFetchDocuments(contactId) — called when contact changes, to load their open invoices/bills
 * @param {string}   fiscalYear      current fiscal year e.g. "2081-82"
 * @param {function} onCreate(payload)
 * @param {function} onClose
 */

export default function SettlementForm({
    mode = "receipt",
    contacts = [],
    bankAccounts = [],
    openDocuments = [],
    onFetchDocuments,
    fiscalYear = "",
    onCreate,
    onClose,
}) {
    const isReceipt = mode === "receipt";

    const [contactId, setContactId] = useState("");
    const [documentId, setDocumentId] = useState(""); // invoice_id or bill_id
    const [date, setDate] = useState(toLocalDate(new Date()));
    const [bankAccountId, setBankAccountId] = useState("");
    const [paymentMode, setPaymentMode] = useState("");
    const [paymentRef, setPaymentRef] = useState("");

    const [amountReceived, setAmountReceived] = useState("");
    const [fiscalYearVal, setFiscalYearVal] = useState(fiscalYear);
    const [notes, setNotes] = useState("");
    const [formError, setFormError] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);

    const clearFieldError = (field) => {
        if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: "" }));
    };

    // Filter contacts by type. Contacts are strictly Customer / Vendor / Employee —
    const filteredContacts = contacts.filter((c) =>
        isReceipt ? c.type === "Customer" : c.type === "Vendor"
    );

    const selectedContact = contacts.find((c) => String(c.id) === String(contactId));
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

    // When contact changes, fetch their open invoices / bills
    useEffect(() => {
        if (contactId && onFetchDocuments) {
            onFetchDocuments(contactId);
            setDocumentId("");
        }
    }, [contactId]);

    const selectedDoc = openDocuments.find((d) => String(d.id) === String(documentId));
    const docOutstanding = selectedDoc
        ? parseFloat(selectedDoc.balance_due ?? selectedDoc.total_amount)
        : null;
    const docTotal = selectedDoc ? parseFloat(selectedDoc.total_amount ?? 0) : null;
    const docTaxable = selectedDoc ? parseFloat(selectedDoc.sub_total ?? 0) : null;

    // First receipt against invoice - tds applied
    const isFirstSettlement =
        selectedDoc && docOutstanding != null && docTotal != null &&
        Math.abs(docOutstanding - docTotal) < 0.01;

    const contactDeductsTds = Boolean(selectedContact?.tds_deducted);
    const tdsApplies = Boolean(selectedDoc) && contactDeductsTds && isFirstSettlement;
    const tdsAmount = tdsApplies ? round2(docTaxable * 0.015) : 0;

    // True remaining amount
    const netDocOutstanding = selectedDoc
        ? (tdsApplies ? round2(docOutstanding - tdsAmount) : docOutstanding)
        : null;

    useEffect(() => {
        setAmountReceived("");
    }, [documentId]);

    // Total that clears the receivable/payable this transaction
    const totalCleared = round2(parseFloat(amountReceived || 0) + tdsAmount);

    const exceedsOutstanding =
        selectedDoc && docOutstanding != null && totalCleared - docOutstanding > 0.01;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError("");

        // if (!contactId) return setError(isReceipt ? "Customer is required." : "Vendor is required.");
        // if (!date) return setError("Date is required.");
        // if (!bankAccountId) return setError("Bank / Cash account is required.");
        // if (!amountReceived || parseFloat(amountReceived) <= 0) {
        //     return setError("Amount must be greater than zero.");
        // }
        // if (tdsApplies && !fiscalYearVal) {
        //     return setError("Fiscal year is required for this TDS entry.");
        // }
        const errors = {};

        const contactErr = validateRequiredSelect(contactId, { label: isReceipt ? "Customer" : "Vendor" });
        if (contactErr) errors.contact = contactErr;

        const dateErr = validateRequiredDate(date, { label: "Date" });
        if (dateErr) errors.date = dateErr;

        const bankErr = validateRequiredSelect(bankAccountId, { label: isReceipt ? "Received into account" : "Paid from account" });
        if (bankErr) errors.bankAccount = bankErr;

        const modeErr = validatePaymentMode(paymentMode);
        if (modeErr) errors.paymentMode = modeErr;

        const refErr = validatePaymentRef(paymentRef, { mode: paymentMode, required: paymentModeRequiresRef(paymentMode) });
        if (refErr) errors.paymentRef = refErr;

        const amountErr = validatePositiveNumber(amountReceived, { label: isReceipt ? "Amount received" : "Amount paid" });
        if (amountErr) errors.amount = amountErr;

        if (tdsApplies) {
            const fyErr = validateFiscalYear(fiscalYearVal);
            if (fyErr) errors.fiscalYear = fyErr;
        // if (exceedsOutstanding) {
        //     return setError(
        }
        
        // Cross-field business rule: can't clear more than what's outstanding on the document
        if (!amountErr && exceedsOutstanding) {
            errors.amount =
                `Total clearing (Rs. ${totalCleared.toLocaleString()}) exceeds the outstanding balance ` +
                `(Rs. ${docOutstanding.toLocaleString()}) on ${selectedDoc.display_ref_number || selectedDoc.ref_number}.`;
        }

        setFieldErrors(errors);

        if (Object.keys(errors).length > 0) {
            return;
        }

        setSubmitting(true);

        const payload = {
            contact_id: parseInt(contactId),
            date,
            bank_account_id: parseInt(bankAccountId),
            payment_mode: paymentMode,
            payment_ref: paymentRef.trim() || null,
            notes,
            ...(isReceipt ? {
                amount_received: parseFloat(amountReceived),
                tds_deducted: tdsApplies,
                tds_amount: tdsApplies ? tdsAmount : 0,
                fiscal_year: tdsApplies ? fiscalYearVal : null,
                invoice_id: documentId ? parseInt(documentId) : null,
            } : {
                amount_paid: parseFloat(amountReceived),
                tds_deducted: tdsApplies,
                tds_amount: tdsApplies ? tdsAmount : 0,
                fiscal_year: tdsApplies ? fiscalYearVal : null,
                bill_id: documentId ? parseInt(documentId) : null,
            }),
        };

        try {
            await onCreate(payload);
        } catch (err) {
            setFormError(err?.message ?? "Something went wrong.");
            setSubmitting(false);
        }
    };

    const fmt = (n) => (n || n === 0 ? Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-");

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
                    {isReceipt ? "New Receipt" : "New Payment"}
                </h2>
            </div>

            <form onSubmit={handleSubmit} className="px-7 py-6 space-y-6">
                {formError && (
                    <div className="px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                        {formError}
                    </div>
                )}

                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <RequiredLabel>Date</RequiredLabel>
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

                {/* Contact */}
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <RequiredLabel>{isReceipt ? "Customer" : "Vendor"}</RequiredLabel>
                        <select
                            value={contactId}
                            onChange={(e) => {
                                setContactId(e.target.value);
                                clearFieldError("contact");
                            }}
                            className={`${inputCls} ${fieldErrors.contact ? "border-red-400" : ""}`}
                        >
                            <option value="">Select {isReceipt ? "customer" : "vendor"}</option>
                            {filteredContacts.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                        {fieldErrors.contact && <p className="mt-1 text-xs text-red-500">{fieldErrors.contact}</p>}
                        {selectedContact && contactDeductsTds && (
                            <p className="text-xs text-gray-400 mt-1">
                                {/* Deducts TDS — applied automatically on their first settlement per invoice/bill. */}
                            </p>
                        )}
                    </div>

                    {/* Open invoice / bill selector */}
                    <div>
                        <label className={labelCls}>
                            {isReceipt ? "Against Invoice" : "Against Bill"}
                        </label>
                        <select
                            value={documentId}
                            onChange={(e) => setDocumentId(e.target.value)}
                            disabled={!contactId}
                            className={`${inputCls} ${!contactId ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                            <option value="">
                                {contactId
                                    ? openDocuments.length === 0
                                        ? `No open ${isReceipt ? "invoices" : "bills"}`
                                        : `Select ${isReceipt ? "invoice" : "bill"}`
                                    : `Select ${isReceipt ? "customer" : "vendor"} first`}
                            </option>
                            {openDocuments.map((doc) => (
                                <option key={doc.id} value={doc.id}>
                                    {doc.display_ref_number || doc.ref_number} — Rs. {parseFloat(doc.balance_due ?? doc.total_amount).toLocaleString()}
                                </option>
                            ))}
                        </select>
                        {selectedDoc && (
                            <p className="text-xs text-gray-500 mt-1">
                                Outstanding {tdsApplies ? "(after TDS): " : ": "}
                                <span className="font-medium text-gray-700">
                                    Rs. {fmt(tdsApplies ? netDocOutstanding : docOutstanding)}
                                </span>
                            </p>
                        )}
                    </div>
                </div>

                {/* Bank account + Mode + Amount */}
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <RequiredLabel>{isReceipt ? "Received Into" : "Paid From"}</RequiredLabel>
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
                        <RequiredLabel>Mode</RequiredLabel>
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
                </div>

                <div className="grid grid-cols-3 gap-4">
                    {/* Amount */}
                    <div>
                        <RequiredLabel>{isReceipt ? "Amount Received" : "Amount Paid"}</RequiredLabel>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={amountReceived}
                            onChange={(e) => {
                                setAmountReceived(e.target.value);
                                clearFieldError("amount");
                            }}
                            placeholder="0.00"
                            className={`${inputCls} ${fieldErrors.amount ? "border-red-400" : ""}`}
                        />
                        {fieldErrors.amount ? (
                            <p className="mt-1 text-xs text-red-500">{fieldErrors.amount}</p>
                        ) : (
                            selectedDoc && parseFloat(amountReceived) > 0 && (
                                <p className={`text-xs mt-1 ${exceedsOutstanding ? "text-red-600 font-medium" : "text-gray-500"}`}>
                                    Total clearing: Rs. {fmt(totalCleared)}
                                    {exceedsOutstanding ? " — exceeds outstanding amount" : ""}
                                </p>
                            )
                        )}
                    </div>

                    {paymentMode && paymentMode !== "CASH" && (
                        <div>
                            {paymentModeRequiresRef(paymentMode) ? (
                                <RequiredLabel>{paymentRefLabel(paymentMode)}</RequiredLabel>
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

                    {tdsApplies && (
                        <div>
                            <RequiredLabel>Fiscal Year</RequiredLabel>
                            <input
                                type="text"
                                value={fiscalYearVal}
                                onChange={(e) => {
                                    setFiscalYearVal(e.target.value);
                                    clearFieldError("fiscalYear");
                                }}
                                placeholder="e.g. 2081-82"
                                className={`${inputCls} ${fieldErrors.fiscalYear ? "border-red-400" : ""}`}
                            />
                            {fieldErrors.fiscalYear && <p className="mt-1 text-xs text-red-500">{fieldErrors.fiscalYear}</p>}
                        </div>
                    )}
                </div>

                {/* Notes + Total summary */}
                <div className="grid grid-cols-2 gap-10 pt-2">
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

                    <div className="space-y-2.5 text-sm pt-1">
                        <div className="flex items-center justify-between text-gray-600">
                            <span>{isReceipt ? "Cash / Bank Received" : "Cash / Bank Paid"}</span>
                            <span>{fmt(amountReceived)}</span>
                        </div>

                        {tdsApplies && (
                            <div className="flex items-center justify-between text-gray-600">
                                <span>TDS Deducted</span>
                                <span>{fmt(tdsAmount)}</span>
                            </div>
                        )}

                        <div className="flex items-center justify-between text-base font-semibold text-gray-900 pt-2 border-t border-gray-100">
                            <span>Total Settled</span>
                            <span>{fmt(totalCleared)}</span>
                        </div>

                        {selectedDoc ? (
                            <div className="flex items-center justify-between text-gray-600 pt-2 border-t border-gray-100">
                                <span>Remaining After This</span>
                                <span>{fmt(round2((netDocOutstanding ?? docOutstanding ?? 0) - totalCleared + tdsAmount))}</span>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between text-gray-600 pt-2 border-t border-gray-100">
                                <span>{isReceipt ? "Advance Receipt" : "Advance Payment"} (on account)</span>
                                <span>{fmt(amountReceived)}</span>
                            </div>
                        )}
                    </div>

                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t border-gray-100">
                    <button
                        type="submit"
                        disabled={submitting}
                        className="px-6 py-2.5 rounded-lg bg-slate-700 text-white text-sm font-semibold hover:bg-slate-800 transition disabled:opacity-60 flex items-center justify-center"
                    >
                        {submitting
                            ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            : isReceipt ? "Record Receipt" : "Record Payment"}
                    </button>
                </div>
            </form>
        </div>
    );
}