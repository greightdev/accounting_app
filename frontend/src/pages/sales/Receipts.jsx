import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/Topbar";
import { Search, SquarePen, Trash2 } from "lucide-react";
import ReceiptForm from "./Receiptform";
import Tabs from "../../components/Tabs";
import Toolbar from "../../components/Toolbar";

const receipts = [
    { id: 7, date: "2083.03.01", ref_number: "REC-7", customer: "Swastik", net_amount: 5650.00, stage: "Approved" },
    { id: 6, date: "2083.03.01", ref_number: "REC-6", customer: "Swastik", net_amount: 5650.00, stage: "Approved" },
    { id: 5, date: "2083.01.30", ref_number: "REC-5", customer: "Cash Customer", net_amount: 12555.43, stage: "Draft" },
    { id: 4, date: "2083.01.31", ref_number: "REC-4", customer: "Precision", net_amount: 15820.00, stage: "Approved" },
    { id: 3, date: "2083.01.31", ref_number: "REC-3", customer: "Swastik", net_amount: 56500.00, stage: "Approved" },
    { id: 2, date: "2083.01.23", ref_number: "REC-2", customer: "Precision", net_amount: 11300.00, stage: "Draft" },
    { id: 1, date: "2083.01.10", ref_number: "REC-1", customer: "Binnayak Furniture", net_amount: 8950.00, stage: "Draft" },
];

export default function Receipts() {
    // const [receipts, setReceipts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('approved');
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);

    // useEffect(() => {
    //     fetchRecipts();
    // }, [tab]);

    // const fetchReceipts = async () => {
    //     setLoading(true);
    //     try {
    //         const { data } = await api.get(`/sales/receipts/list.php?status=${tab}`);
    //         setRecipts(data.data ?? []);
    //     } catch (err) {
    //         console.error('Failed to fetch receipts: ', err);
    //     } finally {
    //         setLoading(false);
    //     }
    // };

    const filtered = receipts.filter((receipt) => {
        const matchesTab = receipt.stage.toLowerCase() === tab;
        const term = search.toLowerCase();
        const matchesSearch = 
            receipt.ref_number.toLowerCase().includes(term) ||
            receipt.customer.toLowerCase().includes(term);
        return matchesTab && matchesSearch
    });

    const handleReceiptCreated = (payload) => {
        console.log("New receipt payload", payload);
        // fetchReceipts();
        setShowForm(false);
    };
    
    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this receipt?')) return;
    
        try {
            await api.delete('/sales/receipts/delete.php', { data: { id } });
            fetchReceipts();
        } catch (err) {
            alert(err.response?.data?.message ?? 'Failed to delete receipt.');
        }
    };

    return (
        <> 
            {/* <div className="flex items-center gap-2 text-sm text-slate-500 mb-5">
                <span>Sales</span>
                <span className="text-slate-300">/</span>
                <span className="text-slate-700 font-medium">Receipts</span>
            </div> */}

            {showForm ? (
                <ReceiptForm
                    draftNumber={`REC-${receipts.length + 1}`}
                    onClose={() => setShowForm(false)}
                    onCreate={handleReceiptCreated}
                />
            ) : (
                <>
                    <Toolbar
                        search={{ value: search, onChange: setSearch }}
                        actions={[{ label: '+ New Receipt', onClick: () => setShowForm(true) }]}
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
                                        <th className="px-4 py-3 text-left font-semibold">Action</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {filtered.map((receipt, index) => (
                                        <tr
                                            key={receipt.id}
                                            className={`
                                                ${index % 2 === 0 ? "bg-white" : "bg-slate-50"}
                                                border-b border-slate-100
                                                hover:bg-slate-100 transition-colors
                                            `}
                                        >
                                            <td className="px-4 py-3">{receipt.date}</td>
                                            <td className="px-4 py-3">{receipt.ref_number}</td>
                                            <td className="px-4 py-3">{receipt.customer}</td>
                                            <td className="px-4 py-3">{receipt.net_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                            <td className="px-4 py-3 flex items-center gap-2">
                                                <button
                                                    className="p-2 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                                                >
                                                    <SquarePen size={16} />
                                                </button>
                                                <button
                                                    // onClick={() => handleDelete(receipt.id)}
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
                                        <th className="px-4 py-3 text-left font-semibold">Action</th>
                                        <th className="px-4 py-3 text-left font-semibold">Approve/Reject</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {filtered.map((receipt, index) => (
                                        <tr
                                            key={receipt.id}
                                            className={`
                                                ${index % 2 === 0 ? "bg-white" : "bg-slate-50"}
                                                border-b border-slate-100
                                                hover:bg-slate-100 transition-colors
                                            `}
                                        >
                                            <td className="px-4 py-3">{receipt.date}</td>
                                            <td className="px-4 py-3">{receipt.ref_number}</td>
                                            <td className="px-4 py-3">{receipt.customer}</td>
                                            <td className="px-4 py-3">{receipt.net_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                            <td className="px-4 py-3 flex items-center gap-2">
                                                <button
                                                    className="p-2 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                                                >
                                                    <SquarePen size={16} />
                                                </button>
                                                <button
                                                    // onClick={() => handleDelete(receipt.id)}
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