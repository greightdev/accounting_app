import { useEffect, useRef, useState } from "react";
import { X, ChevronRight, ChevronDown, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { can } from "../permissions";
import { validateRequiredDate, validateDateNotBefore, validateRequiredSelect, validateLineItems } from "../utils/validators";
import NepaliDateInput from "./NepaliDateInput";

// TransactionForm — generic layout for any line-item document:
// Sales Invoice, Purchase Bill, etc.

const toLocalDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const emptyRow = (id) => ({
    id,
    itemId: "",
    description: "",
    quantity: "",
    rate: "",
    // discount: "",
    taxRate: "13",
});

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

/**
 * @param {string}   title                 e.g. "New Invoice", "New Bill"
 * @param {string}   draftNumber           display value when billNumberEditable=false, or initial value for the editable input
 * @param {boolean}  billNumberEditable    Sales Invoice: false (auto, sequential, PRD 3.1). Purchase Bill: true (optional, vendor's own number, PRD 4.1)
 * @param {object}   initialData           existing transaction, for edit mode
 * @param {boolean}  showDueDate           Sales Invoice: true (PRD 3.1). Purchase Bill: false (PRD 4.1)
 * @param {boolean}  showPaymentAccount    false for Invoice/Bill — no cash/bank leg at this stage (PRD 3.1/4.1). true for Receipt/Payment.
 * @param {string[]} modes                 e.g. ["Cash","Bank","Credit"]; pass ["Credit"] for Invoice/Bill since no Mode choice exists in the PRD at this stage
 * @param {string[]} bankAccounts          options for the payment-account dropdown (only relevant when showPaymentAccount=true)
 * @param {object[]} contacts              full contact list, e.g. [{id,name,type}]
 * @param {string[]} contactTypes          Sales Invoice: ["Customer"]. Purchase Bill: ["Vendor"]
 * @param {object[]} items                 catalog for the line-item Item dropdown, e.g. [{id,name,selling_price,purchase_rate,tax_type}]
 * @param {string}   priceField            which item field to pull as the line rate: "selling_price" (Invoice) or "purchase_rate" (Bill)
 * @param {string}   submitLabel           primary button text, default "Create"
 * @param {string}   approveLabel          secondary button text, default "Create and Approve"
 * @param {function} onClose
 * @param {function} onCreate(payload)     called with the assembled payload; caller does the actual api.post(...)
 */

export default function TransactionForm({
    title = "New Document",
    draftNumber = "DRAFT-1",
    billNumberEditable = false,
    initialData = null,
    showDueDate = true,
    showPaymentAccount = false,
    modes = ["Credit"],
    bankAccounts = [],
    showSalesman = false,
    contacts = [],
    contactTypes = [],
    items = [],
    priceField = "selling_price",
    submitLabel = "Create",
    approveLabel = "Create and Approve",
    onClose,
    onCreate,
}) {
    const { role } = useAuth();
    const canApprove = can(role, "canApprove");
    const nextRowId = useRef(1);

    const [date, setDate] = useState(initialData?.date ?? toLocalDate(new Date()));
    const [dueDate, setDueDate] = useState(() => {
        if (initialData?.due_date) return initialData.due_date;
        const d = new Date();
        d.setDate(d.getDate() + 10);
        return toLocalDate(d);
    });
    const [mode, setMode] = useState(modes[0] ?? "Credit");
    const [paymentAccount, setPaymentAccount] = useState("");
    const [contact, setContact] = useState(initialData?.contact_id != null ? String(initialData.contact_id) : "");
    const [salesman, setSalesman] = useState("");
    const [notes, setNotes] = useState(initialData?.notes ?? "");
    const [vendorBillNo, setVendorBillNo] = useState(initialData?.vendor_bill_no ?? "");
    const [expandedRows, setExpandedRows] = useState({});
    const [fieldErrors, setFieldErrors] = useState({});
    const [lineItemsError, setLineItemsError] = useState("");
    const [errorRowId, setErrorRowId] = useState(null);
    const [lineItems, setLineItems] = useState(() => {
        if (initialData?.line_items?.length) {
            const rows = initialData.line_items.map((li, idx) => ({
                id: idx + 1,
                itemId: String(li.item_id),
                description: li.description ?? "",
                quantity: String(li.quantity),
                rate: String(li.rate),
                // discount: "",
                taxRate: String(li.vat_rate ?? 13),
            }));
            nextRowId.current = rows.length;
            return rows;
        }
        return [emptyRow(nextRowId.current)];
    });

    const updateRow = (id, field, value) => {
        setLineItems((prev) =>
            prev.map((row) => {
                if (row.id !== id) return row;
                const next = { ...row, [field]: value };
                if (field === "itemId") {
                    const selected = items.find((i) => String(i.id) === String(value));
                    if (selected) {
                        next.rate = selected[priceField];
                        next.taxRate = selected.tax_type === "VAT13" ? "13" : "0";
                        if (!row.quantity) {
                            next.quantity = "1";
                        }
                    }
                }
                return next;
            })
        );
        if (lineItemsError) {
            setLineItemsError("");
            setErrorRowId(null);
        }
    };

    const addRow = () => {
        nextRowId.current += 1;
        setLineItems((prev) => [...prev, emptyRow(nextRowId.current)]);
    };

    const removeRow = (id) => {
        setLineItems((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
    };

    const toggleRowDetail = (id) => {
        setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const computeRow = (row) => {
        const qty = parseFloat(row.quantity) || 0;
        const rate = parseFloat(row.rate) || 0;
        // const discount = parseFloat(row.discount) || 0;
        const gross = qty * rate;
        // const taxable = Math.max(gross - discount, 0);
        const taxable = gross;
        const tax = taxable * ((parseFloat(row.taxRate) || 0) / 100);
        return { gross, taxable, tax };
    };

    const totals = lineItems.reduce(
        (acc, row) => {
            const c = computeRow(row);
            acc.subTotal += c.gross;
            // acc.discountTotal += c.discount;
            acc.taxableAmount += c.taxable;
            acc.taxTotal += c.tax;
            return acc;
        },
        { subTotal: 0, taxableAmount: 0, taxTotal: 0 }
    );

    const totalBill = totals.taxableAmount + totals.taxTotal;
    // const discountPct = totals.subTotal > 0 ? (totals.discountTotal / totals.subTotal) * 100 : 0;

    const fmt = (n) =>
        n ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-";

    const filteredContacts = contacts.filter((c) => contactTypes.includes(c.type));
    const employees = contacts.filter((c) => c.type === "Employee");

    const availableItems = priceField === "purchase_rate"
        ? items.filter((i) => i.type === "PURCHASE" && String(i.vendor_id) === String(contact))
        : items.filter((i) => i.type !== "PURCHASE");

    useEffect(() => {
        if (priceField !== "purchase_rate") return;
        setLineItems((prev) =>
            prev.map((row) => {
                if (!row.itemId) return row;
                const stillValid = items.some(
                    (i) => String(i.id) === String(row.itemId) && String(i.vendor_id) === String(contact)
                );
                return stillValid ? row : { ...row, itemId: "", rate: "" };
            })
        );
    }, [contact, priceField]);

    const handleSubmit = (approve) => {
        const errors = {};

        const dateErr = validateRequiredDate(date, { label: "Date" });
        if (dateErr) errors.date = dateErr;

        if (showDueDate) {
            const dueDateErr =
                validateRequiredDate(dueDate, { label: "Due date" }) ||
                validateDateNotBefore(dueDate, date, { label: "Due date", compareLabel: "invoice date" });
            if (dueDateErr) errors.dueDate = dueDateErr;
        }

        const contactErr = validateRequiredSelect(contact, { label: "Contact" });
        if (contactErr) errors.contact = contactErr;

        const { rows: cleanedLineItems, error: lineErr, errorRowId: badRowId } = validateLineItems(lineItems);

        setFieldErrors(errors);
        setLineItemsError(lineErr || "");
        setErrorRowId(badRowId);

        if (Object.keys(errors).length > 0 || lineErr) {
            return;
        }

        const payload = {
            ...(initialData ? { id: initialData.id } : {}),
            date,
            ...(showDueDate ? { due_date: dueDate } : {}),
            ...(showPaymentAccount ? { mode, payment_account: paymentAccount } : {}),
            ...(billNumberEditable ? { vendor_bill_no: vendorBillNo || null } : {}),
            contact_id: contact,
            ...(showSalesman ? { salesman_id: salesman } : {}),
            notes,
            line_items: cleanedLineItems.map((row) => {
                const c = computeRow(row);
                return {
                    item_id: row.itemId,
                    description: row.description,
                    quantity: row.quantity,
                    rate: row.rate,
                    // discount: row.discount,
                    tax_rate: row.taxRate,
                    amount: c.gross,
                };
            }),
            sub_total: totals.subTotal,
            // discount_total: totals.discountTotal,
            taxable_amount: totals.taxableAmount,
            tax_total: totals.taxTotal,
            total_amount: totalBill,
            status: approve ? "APPROVED" : "DRAFT",
        };

        onCreate?.(payload);
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between px-7 py-5 border-b border-gray-100">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
                    >
                        <X size={20} />
                    </button>
                    <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                </div>
            </div>

            <div className="px-7 py-6 space-y-6">
                {/* Document # */}
                <div className="flex items-center gap-1.5 text-sm text-gray-500">
                    {billNumberEditable ? (
                        <div className="w-full max-w-xs">
                            <label className={labelCls}>Vendor Bill No.</label>
                            <input
                                type="text"
                                placeholder="e.g. HSP-2026-001"
                                value={vendorBillNo}
                                onChange={(e) => setVendorBillNo(e.target.value)}
                                className={inputCls}
                            />
                        </div>
                    ) : (
                        <>
                            <span className="font-semibold text-gray-700">
                                {initialData ? draftNumber : `DRAFT (${draftNumber})`}
                            </span>
                        </>
                    )}
                </div>

                {/* Date / Due Date */}
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <RequiredLabel>Date</RequiredLabel>
                        <NepaliDateInput
                            value={date}
                            disableFuture
                            onChange={(v) => {
                                setDate(v);
                                if (fieldErrors.date) setFieldErrors((prev) => ({ ...prev, date: "" }));
                            }}
                            className={fieldErrors.date ? "border-red-400" : ""}
                        />
                        {fieldErrors.date && <p className="mt-1 text-xs text-red-500">{fieldErrors.date}</p>}
                    </div>
                    {showDueDate && (
                        <div>
                            <label className={labelCls}>Due Date</label>
                            <NepaliDateInput
                                value={dueDate}
                                onChange={(v) => {
                                    setDueDate(v);
                                    if (fieldErrors.dueDate) setFieldErrors((prev) => ({ ...prev, dueDate: "" }));
                                }}
                                className={fieldErrors.dueDate ? "border-red-400" : ""}
                            />
                            {fieldErrors.dueDate && <p className="mt-1 text-xs text-red-500">{fieldErrors.dueDate}</p>}
                        </div>
                    )}
                </div>

                {/* Mode / Payment Account */}
                {showPaymentAccount && (
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <RequiredLabel>Mode</RequiredLabel>
                            <select value={mode} onChange={(e) => setMode(e.target.value)} className={inputCls}>
                                {modes.map((m) => (
                                    <option key={m} value={m}>
                                        {m}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Payment Account</label>
                            <select
                                value={paymentAccount}
                                onChange={(e) => setPaymentAccount(e.target.value)}
                                disabled={mode === "Credit"}
                                className={`${inputCls} ${mode === "Credit" ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                                <option value="">Account</option>
                                {bankAccounts.map((account) => (
                                    <option key={account.id} value={account.id}>
                                        {account.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}

                {/* Contact */}
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <RequiredLabel>Contact</RequiredLabel>
                        <select
                            value={contact}
                            onChange={(e) => {
                                setContact(e.target.value);
                                if (fieldErrors.contact) setFieldErrors((prev) => ({ ...prev, contact: "" }));
                            }}
                            className={`${inputCls} ${fieldErrors.contact ? "border-red-400" : ""}`}
                        >
                            <option value="">Contact</option>
                            {filteredContacts.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                        {fieldErrors.contact && <p className="mt-1 text-xs text-red-500">{fieldErrors.contact}</p>}
                    </div>
                </div>

                {/* Line items */}
                <div className="pt-2">
                    <div className="flex items-center gap-3 mb-4">
                        <h3 className="text-xs font-bold tracking-wide text-gray-500 uppercase">Line Items</h3>
                        <div className="flex-1 border-t border-gray-100" />
                    </div>

                    {lineItemsError && (
                        <div className="mb-3 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                            {lineItemsError}
                        </div>
                    )}

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs font-semibold text-gray-500">
                                    <th className="w-6" />
                                    <th className="w-6 text-left py-2">#</th>
                                    <th className="text-left py-2 pr-2 min-w-[180px]">Item</th>
                                    <th className="text-left py-2 px-2 w-28">Quantity</th>
                                    <th className="text-left py-2 px-2 w-28">Rate</th>
                                    <th className="text-right py-2 px-2 w-28">Amount</th>
                                    {/* <th className="text-left py-2 px-2 w-32">Discount (Rs.)</th> */}
                                    <th className="text-left py-2 px-2 w-32">Tax (%)</th>
                                    <th className="w-8" />
                                </tr>
                            </thead>
                            <tbody>
                                {lineItems.map((row, idx) => {
                                    const c = computeRow(row);
                                    return (
                                        <tr
                                            key={row.id}
                                            className={`border-t align-middle ${
                                                errorRowId === row.id
                                                    ? "border-red-200 bg-red-50/50"
                                                    : "border-gray-100"
                                            }`}
                                        >
                                            <td className="py-2.5">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleRowDetail(row.id)}
                                                    className="text-gray-400 hover:text-gray-600"
                                                >
                                                    {expandedRows[row.id] ? (
                                                        <ChevronDown size={14} />
                                                    ) : (
                                                        <ChevronRight size={14} />
                                                    )}
                                                </button>
                                            </td>
                                            <td className="py-2.5 text-gray-500">{idx + 1}.</td>
                                            <td className="py-2.5 pr-2">
                                                <select
                                                    value={row.itemId}
                                                    onChange={(e) => updateRow(row.id, "itemId", e.target.value)}
                                                    disabled={priceField === "purchase_rate" && !contact}
                                                    className={`${cellInputCls} ${priceField === "purchase_rate" && !contact ? "opacity-50 cursor-not-allowed" : ""}`}
                                                >
                                                    <option value="">
                                                        {priceField === "purchase_rate" && !contact
                                                            ? "Select a vendor first"
                                                            : "Item"}
                                                    </option>
                                                    {availableItems.map((i) => (
                                                        <option key={i.id} value={i.id}>
                                                            {i.name}
                                                        </option>
                                                    ))}
                                                </select>
                                                {expandedRows[row.id] && (
                                                    <input
                                                        type="text"
                                                        placeholder="Description (optional)"
                                                        value={row.description}
                                                        onChange={(e) =>
                                                            updateRow(row.id, "description", e.target.value)
                                                        }
                                                        className={`${cellInputCls} mt-2`}
                                                    />
                                                )}
                                            </td>
                                            <td className="py-2.5 px-2">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    placeholder="Quantity"
                                                    value={row.quantity}
                                                    onChange={(e) => updateRow(row.id, "quantity", e.target.value)}
                                                    className={cellInputCls}
                                                />
                                            </td>
                                            <td className="py-2.5 px-2">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    placeholder="Rate"
                                                    value={row.rate}
                                                    onChange={(e) => updateRow(row.id, "rate", e.target.value)}
                                                    className={cellInputCls}
                                                />
                                            </td>
                                            <td className="py-2.5 px-2 text-right text-gray-700">
                                                {c.gross ? (
                                                    c.gross.toLocaleString(undefined, { minimumFractionDigits: 2 })
                                                ) : (
                                                    <span className="text-gray-300">Amount</span>
                                                )}
                                            </td>
                                            {/* <td className="py-2.5 px-2">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    placeholder="Discount"
                                                    value={row.discount}
                                                    onChange={(e) => updateRow(row.id, "discount", e.target.value)}
                                                    className={cellInputCls}
                                                />
                                            </td> */}
                                            <td className="py-2.5 px-2">
                                                <select
                                                    value={row.taxRate}
                                                    onChange={(e) => updateRow(row.id, "taxRate", e.target.value)}
                                                    className={cellInputCls}
                                                >
                                                    <option value="13">VAT 13%</option>
                                                    <option value="0">Exempt</option>
                                                </select>
                                            </td>
                                            <td className="py-2.5 pl-1">
                                                <button
                                                    type="button"
                                                    onClick={() => removeRow(row.id)}
                                                    className="p-1.5 rounded-md text-gray-300 hover:bg-red-50 hover:text-red-500 transition"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <button
                        type="button"
                        onClick={addRow}
                        className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-slate-900 transition"
                    >
                        <Plus size={15} /> Add Row
                    </button>
                </div>

                {/* Notes + Totals */}
                <div className="grid grid-cols-2 gap-10 pt-2">
                    <div>
                        <label className={labelCls}>Internal Notes/Remarks</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Internal Notes/Remarks"
                            rows={5}
                            className={`${inputCls} resize-none`}
                        />
                    </div>

                    <div className="space-y-2.5 text-sm pt-1">
                        <div className="flex items-center justify-between text-gray-600">
                            <span>SubTotal</span>
                            <span>{fmt(totals.subTotal)}</span>
                        </div>
                        {/* <div className="flex items-center justify-between text-gray-600">
                            <span>Discount ({discountPct ? discountPct.toFixed(0) : 0}%)</span>
                            <span>{fmt(totals.discountTotal)}</span>
                        </div> */}
                        <div className="flex items-center justify-between text-gray-600 pt-2 border-t border-gray-100">
                            <span>Taxable amount</span>
                            <span>{fmt(totals.taxableAmount)}</span>
                        </div>
                        <div className="flex items-center justify-between text-gray-600">
                            <span>Tax</span>
                            <span>{fmt(totals.taxTotal)}</span>
                        </div>
                        <div className="flex items-center justify-between text-base font-semibold text-gray-900 pt-2 border-t border-gray-100">
                            <span>Total Bill Amount</span>
                            <span className="text-red-500">{fmt(totalBill)}</span>
                        </div>
                    </div>
                </div>

                {/* Salesman */}
                {/* {showSalesman && (
                    <div className="flex items-center gap-3 pt-2">
                        <span className="flex items-center gap-1.5 text-sm font-medium text-gray-700 w-32 shrink-0">
                            <User size={15} className="text-gray-400" />
                            Salesman
                        </span>
                        <select
                            value={salesman}
                            onChange={(e) => setSalesman(e.target.value)}
                            className={`${inputCls} max-w-xs`}
                        >
                            <option value="">Contact</option>
                            {employees.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                    </div>
                )} */}

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={() => handleSubmit(false)}
                        className="px-6 py-2.5 rounded-lg bg-slate-700 text-white text-sm font-semibold hover:bg-slate-800 transition"
                    >
                        {submitLabel}
                    </button>
                    {canApprove && (
                        <button
                            type="button"
                            onClick={() => handleSubmit(true)}
                            className="px-6 py-2.5 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition"
                        >
                            {approveLabel}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}