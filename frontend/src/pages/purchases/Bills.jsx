import { useEffect, useState } from "react";
import { SquarePen, Trash2, Check, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { can } from "../../permissions";
import Tabs from "../../components/Tabs";
import Toolbar from "../../components/Toolbar";
import api from "../../api/axios";
import TransactionForm from "../../components/TransactionForm";
import DataTable from "../../components/DataTable";
import useToast from "../../hooks/useToast";
import Toast from "../../components/Toast";
import TransactionView from "../../components/TransactionView";
import { adaptTransactionForView } from "../../ViewAdapters";

const paymentStatusStyles = (paymentStatus) => {
    if (!paymentStatus) return "bg-slate-100 text-slate-500"; // draft
    if (paymentStatus === "Fully Paid") return "bg-emerald-50 text-emerald-600";
    if (paymentStatus.startsWith("Overdue")) return "bg-red-50 text-red-600";
    if (paymentStatus.startsWith("Due")) return "bg-amber-50 text-amber-600";
    if (paymentStatus === "Partially Paid") return "bg-blue-50 text-blue-600";
    return "bg-slate-100 text-slate-600";
};

export default function Bills() {
    const { role } = useAuth();
    const canApprove = can(role, "canApprove");
    const canVoid = can(role, "canVoid");
    const canEditTx = can(role, "canEditTransactions");
    const [bills, setBills] = useState([]);
    const [contacts, setContacts] = useState([]);
    const [items, setItems] = useState([]);
    const [editingBill, setEditingBill] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('approved');
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const { toast, showToast, hideToast } = useToast();

    const [viewTx, setViewTx] = useState(null);

    useEffect(() => {
        fetchBills();
        fetchFormData();
    }, [tab]);

    const fetchBills = async () => {
        setLoading(true);
        try {
            const { data } = await api.get(`/purchases/bills/list.php?status=${tab}`);
            setBills(data.data ?? []);
        } catch (err) {
            console.error('Failed to fetch bills: ', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchFormData = async () => {
        try {
            const [contactRes, itemsRes] = await Promise.all([
                api.get("/contacts/list.php"),
                api.get("/items/list.php"),
            ]);

            setContacts(contactRes.data.data ?? []);
            setItems(itemsRes.data.data ?? []);
        } catch (err) {
            console.log(err)
        }
    };

    const filtered = bills.filter((bill) => {
        const term = search.toLowerCase();
        const matchesSearch = 
            bill.ref_number.toLowerCase().includes(term) ||
            bill.vendor_name.toLowerCase().includes(term);
        return matchesSearch
    });
    
    const handleEdit = async (bill) => {
        try {
            const { data } = await api.get(`/purchases/bills/get.php?id=${bill.id}`);
            setEditingBill(data.data);
            setShowForm(true);
        } catch (err) {
            showToast("Failed to load bill details.", "error");
        }
    };

    const closeForm = () => {
        setShowForm(false);
        setEditingBill(null);
    };

    const handleBillSubmit = async (payload) => {
        try {
            if (editingBill) {
                await api.put("/purchases/bills/update.php", payload);
                showToast(
                    payload.status === "Bill updated."
                );
            } else {
                await api.post("/purchases/bills/create.php", payload);
                showToast(
                    payload.status === "APPROVED" ? "Bill created and approved." : "Bill saved as draft."
                );
            }
            closeForm();
            fetchBills();
        } catch (err) {
            console.error(err);
            showToast(err.response?.data?.message ?? "Failed to save bill.", "error");
        }
    };

    const handleApprove = async (id) => {
        if (!window.confirm('Approve this bill? This will post it to the ledger and it can no longer be edited.')) return;

        try {
            await api.put('/purchases/bills/approve.php', { id });
            showToast("Bill approved successfully.");
            fetchBills();
        } catch (err) {
            showToast(err.response?.data?.message ?? 'Failed to approve bill.', "error");
        }
    };
    
    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this bill?')) return;
    
        try {
            await api.delete('/transactions/void.php', { data: { id, void_reason: 'Voided by user.' } });
            showToast("Bill voided successfully.");
            fetchBills();
        } catch (err) {
            showToast(err.response?.data?.message ?? 'Failed to delete bill.', "error");
        }
    };

    const handleView = async (tx) => {
        try {
            const { data } = await api.get(`/transactions/get.php?id=${tx.id}`);
            setViewTx(data.data);
        } catch (err) {
            showToast("Failed to load transaction.", "error");
        }
    };

    const baseColumns = [
        { key: "date", header: "Date", },
        { key: "ref_number", header: "#", },
        { key: "vendor_name", header: "Vendor", },
        { key: "total_amount", header: "Net Amount",
            render: (bill) => bill.total_amount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
            }),
        },
        { key: "payment_status", header: "Status",
            render: (bill) => (
                <span
                    className={`px-2.5 py-1 rounded-md text-xs font-medium ${paymentStatusStyles(
                        bill.payment_status
                    )}`}
                >
                    {bill.payment_status ?? "Draft"}
                </span>
            ),
        },
    ];

    const approvedActions = {
        key: "actions",
        header: "Action",
        stopRowClick: true,
        render: (bill) => (
            <div className="flex items-center gap-2">
                <button
                    onClick={() => handleDelete(bill.id)}
                    className="p-2 rounded-md text-slate-600 hover:bg-slate-100"
                >
                    <Trash2 size={16} />
                </button>
            </div>
        ),
    };

    const draftActions = {
        key: "actions",
        header: "Action",
        stopRowClick: true,
        render: (bill) => (
            <button
                onClick={() => handleEdit(bill)}
                className="p-2 rounded-md text-slate-600 hover:bg-slate-100"
            >
                <SquarePen size={16} />
            </button>
        ),
    };

    const approvalColumn = {
        key: "approve",
        header: "Approve / Reject",
        stopRowClick: true,
        render: (bill) => (
            <div className="flex items-center gap-2">
                <button
                    onClick={() => handleApprove(bill.id)}
                    className="p-2 rounded-md text-emerald-600 hover:bg-emerald-100 transition-colors"
                    title="Approve"
                >
                    <Check size={16} />
                </button>

                <button
                    onClick={() => handleDelete(bill.id)}
                    className="p-2 rounded-md text-red-600 hover:bg-red-100 transition-colors"
                    title="Reject"
                >
                    <X size={16} />
                </button>
            </div>
        ),
    };

    const approvedColumns = [
        ...baseColumns,
        ...(canVoid ? [approvedActions] : []),
    ];

    const draftColumns = [
        ...baseColumns,
        ...(canEditTx ? [draftActions] : []),
        ...(canApprove || canVoid ? [approvalColumn] : []),
    ];

    return (
        <>
            <Toast toast={toast} onClose={hideToast} />
            {showForm ? (
                <TransactionForm
                    title={editingBill ? "Edit Bill" : "New Bill"}
                    draftNumber={editingBill ? editingBill.ref_number : `BILL-${bills.length + 1}`}
                    billNumberEditable={true}
                    initialData={editingBill}
                    showDueDate={true}
                    contacts={contacts}
                    contactTypes={["Vendor"]}
                    items={items}
                    priceField="purchase_rate"
                    submitLabel={editingBill ? "Save Draft" : "Create Bill"}
                    approveLabel={editingBill ? "Save & Approve" : "Create & Approve"}
                    onClose={closeForm}
                    onCreate={handleBillSubmit}
                />
            ) : (
                <>
                    <Toolbar
                        search={{ value: search, onChange: setSearch }}
                        actions={[{ label: '+ New Bill', onClick: () => setShowForm(true) }]}
                    />

                    <Tabs active={tab} onChange={setTab} />

                    <div className="bg-white rounded-lg shadow">
                        <DataTable
                            columns={tab === "approved" ? approvedColumns : draftColumns}
                            data={filtered}
                            loading={loading}
                            emptyMessage="No bills found"
                            onRowClick={handleView}
                        />
                    </div>
                </>
            )}
            {viewTx && (
                <TransactionView
                    {...adaptTransactionForView(viewTx)}
                    onClose={() => setViewTx(null)}
                />
            )}
        </>
    );
}