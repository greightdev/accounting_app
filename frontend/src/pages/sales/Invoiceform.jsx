import { useRef, useState } from "react";
import { X, Info, ChevronRight, ChevronDown, Plus, Trash2, User } from "lucide-react";

const MODES = ["Cash", "Bank", "Credit"];
const BANK_ACCOUNTS = ["Cash in Hand", "Petty Cash", "ABC Bank"];
 
const CONTACTS = [
    { id: 1, name: "Injol", type: "Employee" },
    { id: 2, name: "Binnayak Furniture", type: "Vendor" },
    { id: 3, name: "Swastik", type: "Customer" },
    { id: 4, name: "Precision", type: "Customer" },
];
 
const ITEMS = [
    { id: 1, name: "Digital Solutions", unit: "hrs", rate: 1850, taxType: "VAT13" },
    { id: 2, name: "Web Development", unit: "hrs", rate: 1500, taxType: "VAT13" },
    { id: 3, name: "Web Boosting", unit: "hrs", rate: 500, taxType: "Exempt" },
];
 
const toLocalDate = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
 
const emptyRow = (id) => ({
    id,
    itemId: "",
    quantity: "",
    rate: "",
    discount: "",
    taxRate: "13",
});
 
const labelCls = "block text-sm font-medium text-gray-700 mb-1.5";
const inputCls =
    "w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition";
const cellInputCls =
    "w-full px-2.5 py-2 rounded-md border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition";
 
function RequiredLabel({ children }) {
    return (
        <label className={labelCls}>
            <span className="text-red-500 mr-0.5">*</span>
            {children}
        </label>
    );
}
 
function CollapsibleRow({ label, defaultOpen = false, rightPlaceholder, children }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border border-gray-100 rounded-lg">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition rounded-lg"
            >
                <span className="flex items-center gap-2">
                    {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    {label}
                </span>
                {!open && rightPlaceholder && (
                    <span className="text-gray-400 text-sm font-normal">{rightPlaceholder}</span>
                )}
            </button>
            {open && <div className="px-4 pb-4 pt-1">{children}</div>}
        </div>
    );
}
 
export default function InvoiceForm({ draftNumber = "INV-8", onClose, onCreate }) {
    const nextRowId = useRef(1);
 
    const [date, setDate] = useState(toLocalDate(new Date()));
    const [dueDate, setDueDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 10);
        return toLocalDate(d);
    });
    const [mode, setMode] = useState("Cash");
    const [paymentAccount, setPaymentAccount] = useState("");
    const [contact, setContact] = useState("");
    const [salesman, setSalesman] = useState("");
    const [note, setNote] = useState("");
    const [expandedRows, setExpandedRows] = useState({});
    const [lineItems, setLineItems] = useState([emptyRow(nextRowId.current)]);
 
    const updateRow = (id, field, value) => {
        setLineItems((prev) =>
            prev.map((row) => {
                if (row.id !== id) return row;
                const next = { ...row, [field]: value };
                if (field === "itemId") {
                    const items = ITEMS.find((i) => String(i.id) === String(value));
                    if (item) {
                        next.rate = item.rate;
                        next.taxRate = item.taxType === "VAT13" ? "13" : "0";
                    }
                }
                return next;
            })
        );
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
        const discount = parseFloat(row.discount) || 0;
        const gross = qty * rate;
        const taxable = Math.max(gross - discount, 0);
        const tax = taxable * ((parseFloat(row.taxRate) || 0) / 100);
        return { gross, discount, taxable, tax };
    };
 
    const totals = lineItems.reduce(
        (acc, row) => {
            const c = computeRow(row);
            acc.subTotal += c.gross;
            acc.discountTotal += c.discount;
            acc.taxableAmount += c.taxable;
            acc.taxTotal += c.tax;
            return acc;
        },
        { subTotal: 0, discountTotal: 0, taxableAmount: 0, taxTotal: 0 }
    );
 
    const totalBill = totals.taxableAmount + totals.taxTotal;
    const discountPct = totals.subTotal > 0 ? (totals.discountTotal / totals.subTotal) * 100 : 0;
 
    const fmt = (n) =>
        n ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-";
 
    const customers = CONTACTS.filter((c) => c.type === "Customer" || c.type === "Both");
    const employees = CONTACTS.filter((c) => c.type === "Employee");
 
    const handleSubmit = (approve) => {
        const payload = {
            date,
            due_date: dueDate,
            mode,
            payment_account: paymentAccount,
            contact_id: contact,
            salesman_id: salesman,
            note,
            line_items: lineItems.map((row) => {
                const c = computeRow(row);
                return {
                    item_id: row.itemId,
                    quantity: row.quantity,
                    rate: row.rate,
                    discount: row.discount,
                    tax_rate: row.taxRate,
                    amount: c.gross,
                };
            }),
            sub_total: totals.subTotal,
            discount_total: totals.discountTotal,
            taxable_amount: totals.taxableAmount,
            tax_total: totals.taxTotal,
            total_amount: totalBill,
            status: approve ? "Approved" : "Draft",
        };
 
        // await api.post('/sales/invoices/create.php', payload);
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
                    <h2 className="text-lg font-semibold text-gray-900">New Invoice</h2>
                </div>
                
            </div>
 
            <div className={"px-7 py-6 space-y-6"}>
                {/* Invoice # */}
                <div className="flex items-center gap-1.5 text-sm text-gray-500">
                    <span>Invoice #</span>
                    <span className="font-semibold text-gray-700">DRAFT ({draftNumber})</span>
                    <Info size={14} className="text-gray-400" />
                </div>
 
                {/* Date / Due Date */}
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
                    <div>
                        <label className={labelCls}>Due Date</label>
                        <input
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            className={inputCls}
                        />
                    </div>
                    
                </div>
 
                {/* Mode / Payment Account */}
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <RequiredLabel>Mode</RequiredLabel>
                        <select value={mode} onChange={(e) => setMode(e.target.value)} className={inputCls}>
                            {MODES.map((m) => (
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
                            {BANK_ACCOUNTS.map((a) => (
                                <option key={a} value={a}>
                                    {a}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
 
                {/* Contact */}
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <RequiredLabel>Contact</RequiredLabel>
                        <select value={contact} onChange={(e) => setContact(e.target.value)} className={inputCls}>
                            <option value="">Contact</option>
                            {customers.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
 
                {/* Line items */}
                <div className="pt-2">
                    <div className="flex items-center gap-3 mb-4">
                        <h3 className="text-xs font-bold tracking-wide text-gray-500 uppercase">Line Items</h3>
                        <div className="flex-1 border-t border-gray-100" />
                    </div>
 
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
                                    <th className="text-left py-2 px-2 w-32">Discount (Rs.)</th>
                                    <th className="text-left py-2 px-2 w-32">Tax (%)</th>
                                    <th className="w-8" />
                                </tr>
                            </thead>
                            <tbody>
                                {lineItems.map((row, idx) => {
                                    const c = computeRow(row);
                                    return (
                                        <tr key={row.id} className="border-t border-gray-100 align-top">
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
                                                    className={cellInputCls}
                                                >
                                                    <option value="">Item</option>
                                                    {ITEMS.map((i) => (
                                                        <option key={i.id} value={i.id}>
                                                            {i.name}
                                                        </option>
                                                    ))}
                                                </select>
                                                {expandedRows[row.id] && (
                                                    <input
                                                        type="text"
                                                        placeholder="Description (optional)"
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
                                            <td className="py-2.5 px-2">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    placeholder="Discount"
                                                    value={row.discount}
                                                    onChange={(e) => updateRow(row.id, "discount", e.target.value)}
                                                    className={cellInputCls}
                                                />
                                            </td>
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
                        <label className={labelCls}>Internal Note/Remarks</label>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Internal Note/Remarks"
                            rows={5}
                            className={`${inputCls} resize-none`}
                        />
                    </div>
 
                    <div className="space-y-2.5 text-sm pt-1">
                        <div className="flex items-center justify-between text-gray-600">
                            <span>SubTotal</span>
                            <span>{fmt(totals.subTotal)}</span>
                        </div>
                        <div className="flex items-center justify-between text-gray-600">
                            <span>Discount ({discountPct ? discountPct.toFixed(0) : 0}%)</span>
                            <span>{fmt(totals.discountTotal)}</span>
                        </div>
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
 
                {/* Collapsible sections */}
                <div className="space-y-2">
                    <CollapsibleRow label="Notes & Footer" rightPlaceholder="Load from saved Note...">
                        <select className={inputCls}>
                            <option value="">Load from saved Note...</option>
                        </select>
                    </CollapsibleRow>
 
                    <CollapsibleRow label="Attachments">
                        <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center text-sm text-gray-400">
                            Drag files here, or click to upload
                        </div>
                    </CollapsibleRow>
 
                    <CollapsibleRow label="Reporting Tags" defaultOpen>
                        <input type="text" placeholder="Add a tag and press enter" className={inputCls} />
                    </CollapsibleRow>
                </div>
 
                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={() => handleSubmit(false)}
                        className="px-6 py-2.5 rounded-lg bg-slate-700 text-white text-sm font-semibold hover:bg-slate-800 transition"
                    >
                        Create
                    </button>
                    <button
                        type="button"
                        onClick={() => handleSubmit(true)}
                        className="px-6 py-2.5 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition"
                    >
                        Create and Approve
                    </button>
                </div>
            </div>
        </div>
    );
}
 
