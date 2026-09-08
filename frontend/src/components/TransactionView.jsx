import { X, Printer } from "lucide-react";

const fmt = (n) => (n || n === 0 ? Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-");

/**
 * Modal overlay showing a print-ready view of any transaction.
 *
 * @param {string}   documentTitle   e.g. "Sales Invoice", "Bank Deposit", "Journal Entry"
 * @param {string}   refNumber
 * @param {string}   date
 * @param {string}   dueDate         optional
 * @param {string}   status          DRAFT | APPROVED | VOID
 * @param {object}   party           optional — { label, name, pan, address }
 * @param {object[]} lineItems       optional — [{ description, quantity, rate, taxRate, amount }]
 * @param {object[]} ledgerRows      optional — [{ account, debit, credit, narration }]
 * @param {object[]} summaryRows     optional — [{ label, value, emphasize?, raw? }] — raw:true renders value as plain text instead of running it through number formatting (e.g. Payment Mode, Cheque No.)
 * @param {string}   notes
 * @param {function} onClose
 */
export default function TransactionView({
    documentTitle,
    refNumber,
    date,
    dueDate = null,
    status,
    party = null,
    lineItems = null,
    ledgerRows = null,
    summaryRows = [],
    notes,
    preparedBy = null,
    onClose,
}) {
    const handlePrint = () => window.print();

    return (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-4 overflow-y-auto print-modal-overlay">
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    .print-modal-content, .print-modal-content * { visibility: visible; }
                    .print-modal-overlay {
                        position: absolute; inset: 0; background: white; padding: 0;
                    }
                    .print-modal-content {
                        position: absolute; left: 0; top: 0; width: 100%;
                        box-shadow: none; border-radius: 0; margin: 0;
                    }
                    .print-hide { display: none !important; }
                }
            `}</style>

            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl my-8 print-modal-content">
                {/* Toolbar — hidden when printing */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 print-hide">
                    <button onClick={onClose} className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition">
                        <X size={20} />
                    </button>
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 text-white text-sm font-semibold hover:bg-slate-800 transition"
                    >
                        <Printer size={16} /> Print
                    </button>
                </div>

                {/* Printable content */}
                <div className="px-10 py-8">
                    <div className="text-center mb-6 pb-4 border-b-2 border-gray-800">
                        <h1 className="text-xl font-bold text-gray-900">G R EIGHT PRIVATE LIMITED</h1>
                        <p className="text-xs text-gray-500 mt-1">Address, Lalitpur, Nepal &nbsp;|&nbsp; PAN: XXXXXXXXX</p>
                    </div>

                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide">{documentTitle}</h2>
                        {status && status !== "APPROVED" && (
                            <span className={`px-3 py-1 rounded-md text-xs font-semibold ${status === "VOID" ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"}`}>
                                {status}
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
                        <div>
                            <p className="text-gray-500">Ref #</p>
                            <p className="font-semibold text-gray-900">{refNumber}</p>
                        </div>
                        <div>
                            <p className="text-gray-500">Date</p>
                            <p className="font-semibold text-gray-900">{date}</p>
                        </div>
                        {dueDate && (
                            <div>
                                <p className="text-gray-500">Due Date</p>
                                <p className="font-semibold text-gray-900">{dueDate}</p>
                            </div>
                        )}
                        {party && (
                            <div>
                                <p className="text-gray-500">{party.label ?? "Party"}</p>
                                <p className="font-semibold text-gray-900">{party.name}</p>
                                {party.pan && <p className="text-gray-500 text-xs">PAN: {party.pan}</p>}
                                {party.address && <p className="text-gray-500 text-xs">{party.address}</p>}
                            </div>
                        )}
                    </div>

                    {lineItems && (
                        <div className="overflow-x-auto mb-6">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="border-b-2 border-gray-800">
                                    <th className="text-left py-2">#</th>
                                    <th className="text-left py-2">Description</th>
                                    <th className="text-right py-2">Qty</th>
                                    <th className="text-right py-2">Rate</th>
                                    <th className="text-right py-2">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lineItems.map((item, idx) => (
                                    <tr key={idx} className="border-b border-gray-200">
                                        <td className="py-2">{idx + 1}</td>
                                        <td className="py-2">{item.description}</td>
                                        <td className="py-2 text-right">{item.quantity}</td>
                                        <td className="py-2 text-right">{fmt(item.rate)}</td>
                                        <td className="py-2 text-right">{fmt(item.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        </div>
                    )}

                    {ledgerRows && (
                        <div className="overflow-x-auto mb-6">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="border-b-2 border-gray-800">
                                    <th className="text-left py-2">Account</th>
                                    <th className="text-left py-2">Narration</th>
                                    <th className="text-right py-2">Debit</th>
                                    <th className="text-right py-2">Credit</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ledgerRows.map((row, idx) => (
                                    <tr key={idx} className="border-b border-gray-200">
                                        <td className="py-2">{row.account}</td>
                                        <td className="py-2 text-gray-500">{row.narration}</td>
                                        <td className="py-2 text-right">{row.debit ? fmt(row.debit) : "-"}</td>
                                        <td className="py-2 text-right">{row.credit ? fmt(row.credit) : "-"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        </div>
                    )}

                    {summaryRows.length > 0 && (
                        <div className="flex justify-end mb-6">
                            <div className="w-64 space-y-1.5 text-sm">
                                {summaryRows.map((row, idx) => (
                                    <div
                                        key={idx}
                                        className={`flex items-center justify-between ${row.emphasize ? "text-base font-bold pt-2 border-t border-gray-300" : "text-gray-600"}`}
                                    >
                                        <span>{row.label}</span>
                                        <span>{row.raw ? (row.value ?? "-") : fmt(row.value)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {notes && (
                        <div className="mb-8 text-sm">
                            <p className="text-gray-500 mb-1">Notes</p>
                            <p className="text-gray-700">{notes}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-6 mt-16 text-sm">
                        <div className="border-t border-gray-400 pt-2 text-gray-500">Prepared By: {preparedBy ? `${preparedBy}` : ""}</div>
                        <div className="border-t border-gray-400 pt-2 text-gray-500 text-right">Authorized Signature</div>
                    </div>
                </div>
            </div>
        </div>
    );
}