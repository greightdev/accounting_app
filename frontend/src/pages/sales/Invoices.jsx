import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/Topbar";
import { Search, SquarePen, Trash2 } from "lucide-react";
import InvoiceForm from "./Invoiceform";
import Tabs from "../../components/Tabs";
import Toolbar from "../../components/Toolbar";

const invoices = [
    { id: 7, date: "2083.03.01", ref_number: "INV-7", customer: "Swastik", net_amount: 5650.00, status: "Fully Paid", stage: "Approved" },
    { id: 6, date: "2083.03.01", ref_number: "INV-6", customer: "Swastik", net_amount: 5650.00, status: "Fully Paid in Cash", stage: "Approved" },
    { id: 5, date: "2083.01.30", ref_number: "INV-5", customer: "Cash Customer", net_amount: 12555.43, status: "Fully Paid in Cash", stage: "Approved" },
    { id: 4, date: "2083.01.31", ref_number: "INV-4", customer: "Precision", net_amount: 15820.00, status: "Due by 38 days", stage: "Approved" },
    { id: 3, date: "2083.01.31", ref_number: "INV-3", customer: "Swastik", net_amount: 56500.00, status: "Due by 8 days", stage: "Approved" },
    { id: 2, date: "2083.01.23", ref_number: "INV-2", customer: "Precision", net_amount: 11300.00, status: "Fully Paid", stage: "Approved" },
    { id: 1, date: "2083.01.10", ref_number: "INV-1", customer: "Binnayak Furniture", net_amount: 8950.00, status: "Draft", stage: "Draft" },
];

const statusStyles = (status) => {
    if (status.startsWith("Fully Paid")) return "bg-emerald-50 text-emerald-600";
    if (status.startsWith("Due")) return "bg-amber-50 text-amber-600";
    return "bg-slate-100 text-slate-600";
};

export default function Invoices() {
    // const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('approved');
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);

    // useEffect(() => {
    //     fetchInvoices();
    // }, [tab]);

    // const fetchInvoices = async () => {
    //     setLoading(true);
    //     try {
    //         const { data } = await api.get(`/sales/invoices/list.php?status=${tab}`);
    //         setInvoices(data.data ?? []);
    //     } catch (err) {
    //         console.error('Failed to fetch invoices: ', err);
    //     } finally {
    //         setLoading(false);
    //     }
    // };

    const filtered = invoices.filter((invoice) => {
        const matchesTab = invoice.stage.toLowerCase() === tab;
        const term = search.toLowerCase();
        const matchesSearch = 
            invoice.ref_number.toLowerCase().includes(term) ||
            invoice.customer.toLowerCase().includes(term);
        return matchesTab && matchesSearch
    });

    const handleInvoiceCreated = (payload) => {
        console.log("New invoice payload", payload);
        // fetchInvoices();
        setShowForm(false);
    };
    
    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this invoice?')) return;
    
        try {
            await api.delete('/sales/invoices/delete.php', { data: { id } });
            fetchInvoices();
        } catch (err) {
            alert(err.response?.data?.message ?? 'Failed to delete invoice.');
        }
    };

    return (
        <>
            {/* <div className="flex items-center gap-2 text-sm text-slate-500 mb-5">
                <span>Sales</span>
                <span className="text-slate-300">/</span>
                <span className="text-slate-700 font-medium">Invoices</span>
            </div> */}

            {showForm ? (
                <InvoiceForm
                    draftNumber={`INV-${invoices.length + 1}`}
                    onClose={() => setShowForm(false)}
                    onCreate={handleInvoiceCreated}
                />
            ) : (
                <>
                    <Toolbar
                        search={{ value: search, onChange: setSearch }}
                        actions={[{ label: '+ New Invoice', onClick: () => setShowForm(true) }]}
                    />

                    <Tabs active={tab} onChange={setTab} />

                    <div className="bg-white rounded-lg shadow">
                        {/* Approved */}
                        {tab === 'approved' && (
                            <table className="w-full overflow-hidden rounded-xl bg-white shadow-sm">
                                <thead>
                                    <tr className="bg-slate-700 text-white">
                                        <th className="px-4 py-3 text-left font-semibold">Date</th>
                                        <th className="px-4 py-3 text-left font-semibold">#</th>
                                        <th className="px-4 py-3 text-left font-semibold">Customer</th>
                                        <th className="px-4 py-3 text-left font-semibold">Net Amount</th>
                                        <th className="px-4 py-3 text-left font-semibold">Status</th>
                                        <th className="px-4 py-3 text-left font-semibold">Action</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {filtered.map((invoice, index) => (
                                        <tr
                                            key={invoice.id}
                                            className={`
                                                ${index % 2 === 0 ? "bg-white" : "bg-slate-50"}
                                                border-b border-slate-100
                                                hover:bg-slate-100 transition-colors
                                            `}
                                        >
                                            <td className="px-4 py-3">{invoice.date}</td>
                                            <td className="px-4 py-3">{invoice.ref_number}</td>
                                            <td className="px-4 py-3">{invoice.customer}</td>
                                            <td className="px-4 py-3">{invoice.net_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${statusStyles(invoice.status)}`}>
                                                    {invoice.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 flex items-center gap-2">
                                                <button
                                                    className="p-2 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                                                >
                                                    <SquarePen size={16} />
                                                </button>
                                                <button
                                                    // onClick={() => handleDelete(invoice.id)}
                                                    className="p-2 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {/* Draft */}
                        {tab === 'draft' && (
                            <table className="w-full overflow-hidden rounded-xl bg-white shadow-sm">
                                <thead>
                                    <tr className="bg-slate-700 text-white">
                                        <th className="px-4 py-3 text-left font-semibold">Date</th>
                                        <th className="px-4 py-3 text-left font-semibold">#</th>
                                        <th className="px-4 py-3 text-left font-semibold">Customer</th>
                                        <th className="px-4 py-3 text-left font-semibold">Net Amount</th>
                                        <th className="px-4 py-3 text-left font-semibold">Status</th>
                                        <th className="px-4 py-3 text-left font-semibold">Action</th>
                                        <th className="px-4 py-3 text-left font-semibold">Approve/Reject</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {filtered.map((invoice, index) => (
                                        <tr
                                            key={invoice.id}
                                            className={`
                                                ${index % 2 === 0 ? "bg-white" : "bg-slate-50"}
                                                border-b border-slate-100
                                                hover:bg-slate-100 transition-colors
                                            `}
                                        >
                                            <td className="px-4 py-3">{invoice.date}</td>
                                            <td className="px-4 py-3">{invoice.ref_number}</td>
                                            <td className="px-4 py-3">{invoice.customer}</td>
                                            <td className="px-4 py-3">{invoice.net_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${statusStyles(invoice.status)}`}>
                                                    {invoice.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 flex items-center gap-2">
                                                <button
                                                    className="p-2 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                                                >
                                                    <SquarePen size={16} />
                                                </button>
                                                <button
                                                    // onClick={() => handleDelete(invoice.id)}
                                                    className="p-2 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </>
            )}
        </>
    );
}