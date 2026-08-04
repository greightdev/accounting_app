import { useEffect, useState } from "react";
import { SquarePen, Trash2, Check, X } from "lucide-react";
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

export default function Invoices() {
    const [invoices, setInvoices] = useState([]);
    const [contacts, setContacts] = useState([]);
    const [items, setItems] = useState([]);
    const [editingInvoice, setEditingInvoice] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('approved');
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const { toast, showToast, hideToast } = useToast();

    const [viewTx, setViewTx] = useState(null);

    useEffect(() => {
        fetchInvoices();
        fetchFormData();
    }, [tab]);

    const fetchInvoices = async () => {
        setLoading(true);
        try {
            const { data } = await api.get(`/sales/invoices/list.php?status=${tab}`);
            setInvoices(data.data ?? []);
        } catch (err) {
            console.error('Failed to fetch invoices: ', err);
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

    const filtered = invoices.filter((invoice) => {
        // const matchesTab = invoice.status.toLowerCase() === tab;
        const term = search.toLowerCase();
        const matchesSearch = 
            invoice.ref_number.toLowerCase().includes(term) ||
            invoice.customer_name.toLowerCase().includes(term);
        return matchesSearch
    });
    
    const handleEdit = async (invoice) => {
        try {
            const { data } = await api.get(`/sales/invoices/get.php?id=${invoice.id}`);
            setEditingInvoice(data.data);
            setShowForm(true);
        } catch (err) {
            showToast("Failed to load invoice details.", "error");
        }
    };

    const closeForm = () => {
        setShowForm(false);
        setEditingInvoice(null);
    };

    const handleInvoiceSubmit = async (payload) => {
        try {
            if (editingInvoice) {
                await api.put("/sales/invoices/update.php", payload);
                showToast(
                    payload.status === "Invoice updated."
                );
            } else {
                await api.post("/sales/invoices/create.php", payload);
                showToast(
                    payload.status === "APPROVED" ? "Invoice created and approved." : "Invoice saved as draft."
                );
            }
            closeForm();
            fetchInvoices();
        } catch (err) {
            console.error(err);
            showToast(err.response?.data?.message ?? "Failed to save invoice.", "error");
        }
    };

    const handleApprove = async (id) => {
        if (!window.confirm('Approve this invoice? This will post it to the ledger and it can no longer be edited.')) return;

        try {
            await api.put('/sales/invoices/approve.php', { id });
            showToast("Invoice approved successfully.");
            fetchInvoices();
        } catch (err) {
            showToast(err.response?.data?.message ?? 'Failed to approve invoice.', "error");
        }
    };
    
    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this invoice?')) return;
    
        try {
            await api.delete('/transactions/void.php', { data: { id, void_reason: 'Voided by user.' } });
            showToast("Invoice voided successfully.");
            fetchInvoices();
        } catch (err) {
            showToast(err.response?.data?.message ?? 'Failed to delete invoice.', "error");
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
        { key: "customer_name", header: "Customer", },
        { key: "total_amount", header: "Net Amount",
            render: (invoice) => invoice.total_amount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
            }),
        },
        { key: "payment_status", header: "Status",
            render: (invoice) => (
                <span
                    className={`px-2.5 py-1 rounded-md text-xs font-medium ${paymentStatusStyles(
                        invoice.payment_status
                    )}`}
                >
                    {invoice.payment_status ?? "Draft"}
                </span>
            ),
        },
    ];

    const approvedActions = {
        key: "actions",
        header: "Action",
        stopRowClick: true,
        render: (invoice) => (
            <div className="flex items-center gap-2">
                <button
                    onClick={() => handleDelete(invoice.id)}
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
        render: (invoice) => (
            <button
                onClick={() => handleEdit(invoice)}
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
        render: (invoice) => (
            <div className="flex items-center gap-2">
                <button
                    onClick={() => handleApprove(invoice.id)}
                    className="p-2 rounded-md text-emerald-600 hover:bg-emerald-100 transition-colors"
                    title="Approve"
                >
                    <Check size={16} />
                </button>

                <button
                    onClick={() => handleDelete(invoice.id)}
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
        approvedActions,
    ];

    const draftColumns = [
        ...baseColumns,
        draftActions,
        approvalColumn,
    ];

    return (
        <>
            <Toast toast={toast} onClose={hideToast} />
            {showForm ? (
                <TransactionForm
                    title={editingInvoice ? "Edit Invoice" : "New Invoice"}
                    draftNumber={editingInvoice ? editingInvoice.ref_number : `INV-${invoices.length + 1}`}
                    initialData={editingInvoice}
                    showDueDate
                    showPaymentAccount={false}
                    contacts={contacts}
                    contactTypes={["Customer"]}
                    items={items}
                    priceField="selling_price"
                    submitLabel={editingInvoice ? "Save Draft" : "Create Invoice"}
                    approveLabel={editingInvoice ? "Save" : "Create & Approve"}
                    onClose={closeForm}
                    onCreate={handleInvoiceSubmit}
                />
            ) : (
                <>
                    <Toolbar
                        search={{ value: search, onChange: setSearch }}
                        actions={[{ label: '+ New Invoice', onClick: () => setShowForm(true) }]}
                    />

                    <Tabs active={tab} onChange={setTab} />

                    <div className="bg-white rounded-lg shadow">
                        <DataTable
                            columns={tab === "approved" ? approvedColumns : draftColumns}
                            data={filtered}
                            loading={loading}
                            emptyMessage="No invoices found"
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