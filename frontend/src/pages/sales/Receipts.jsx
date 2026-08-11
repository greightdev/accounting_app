import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { can } from "../../permissions";
import Toolbar from "../../components/Toolbar";
import Tabs from "../../components/Tabs";
import api from "../../api/axios";
import SettlementForm from "../../components/SettlementForm";
import DataTable from "../../components/DataTable";
import useToast from "../../hooks/useToast";
import Toast from "../../components/Toast";
import TransactionView from "../../components/TransactionView";
import { adaptTransactionForView } from "../../ViewAdapters";

const statusStyles = (status) => status === "VOID" ? "bg-red-50 text-red-500" : "bg-emerald-50 text-emerald-600";

const currentFiscalYear = () => {
    const now = new Date();
    const bsStartYear = now.getMonth() > 5 || (now.getMonth() === 5 && now.getDate() >= 16)
        ? now.getFullYear() - 2056
        : now.getFullYear() - 2057;
    return `${bsStartYear}-${String((bsStartYear + 1) % 100).padStart(2, "0")}`;
};


export default function Receipts() {
    const { role } = useAuth();
    const canVoid = can(role, "canVoid");
    const [receipts, setReceipts] = useState([]);
    const [contacts, setContacts] = useState([]);
    const [bankAccounts, setBankAccounts] = useState([]);
    const [openInvoices, setOpenInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [showVoided, setShowVoided] = useState(false);
    const { toast, showToast, hideToast } = useToast();

    const [viewTx, setViewTx] = useState(null);

    useEffect(() => {
        fetchReceipts();
        fetchFormData();
    }, []);

    const fetchReceipts = async () => {
        setLoading(true);
        try {
            const { data } = await api.get(`/sales/receipts/list.php`);
            setReceipts(data.data ?? []);
        } catch (err) {
            console.error('Failed to fetch receipts: ', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchFormData = async () => {
        try {
            const [contactRes, accountsRes] = await Promise.all([
                api.get("/contacts/list.php"),
                api.get("/bank_account/list.php"),
            ]);

            setContacts(contactRes.data.data ?? []);
            setBankAccounts(accountsRes.data.data ?? []);

        } catch (err) {
            console.error("Failed to fetch form data: ", err);
        }
    };

    const fetchOpenInvoicesForContact = async (contactId) => {
        setOpenInvoices([]);
        try {
            const { data } = await api.get(
                `/sales/invoices/list.php?status=approved&contact_id=${contactId}`
            );
            const invoices = data.data ?? [];
            setOpenInvoices(invoices.filter((inv) => inv.payment_status !== "Fully Paid"));
        } catch (err) {
            console.error("Failed to fetch open invoices: ", err);
            showToast("Failed to load this customer's open invoices.", "error");
        }
    };

    const filtered = receipts.filter((receipt) => {
        const term = search.toLowerCase();
        const matchesSearch = 
            (receipt.ref_number ?? "").toLowerCase().includes(term) ||
            (receipt.customer_name ?? "").toLowerCase().includes(term);
        const matchesVoidFilter = showVoided || receipt.status !== "VOID";
        return matchesSearch && matchesVoidFilter;
    });

    const closeForm = () => {
        setShowForm(false);
        setOpenInvoices([]);
    };

    const handleCreateReceipt = async (payload) => {
        try {
            await api.post("/sales/receipts/create.php", payload);
            showToast("Receipt recorded successfully.");
            closeForm();
            fetchReceipts();
        } catch (err) {
            showToast(err.response?.data?.message ?? "Failed to record receipt.", "error");
            throw err;
        }
    };
    
    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this receipt?')) return;
    
        try {
            await api.delete('/transactions/void.php', { data: { id } });
            showToast("Receipt voided successfully.");
            fetchReceipts();
        } catch (err) {
            showToast(err.response?.data?.message ?? 'Failed to void receipt.', "error");
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

    const columns = [
        { key: "date", header: "Date", },
        { key: "ref_number", header: "#", },
        { key: "customer_name", header: "Customer", },
        { key: "total_amount", header: "Total Cleared",
            render: (receipt) => receipt.total_amount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
            }),
        },
        { key: "status", header: "Status",
            render: (receipt) => (
                <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${statusStyles(receipt.status)}`}>
                    {receipt.status}
                </span>
            ),
        },
        {
            key: "actions", header: "Action", stopRowClick: true, render: (receipt) => (
                <div className="flex items-center gap-2">
                    {receipt.status !== "VOID" && (
                        <button
                            onClick={() => handleDelete(receipt.id)}
                            className="p-2 rounded-md text-slate-600 hover:bg-slate-100"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>
            ),
        }
    ];

    const visibleColumns = canVoid ? columns : columns.filter((c) => c.key !== "actions");

    return (
        <>
            <Toast toast={toast} onClose={hideToast} />
            {showForm ? (
                <SettlementForm
                    mode="receipt"
                    contacts={contacts}
                    bankAccounts={bankAccounts}
                    openDocuments={openInvoices}
                    onFetchDocuments={fetchOpenInvoicesForContact}
                    fiscalYear={currentFiscalYear()}
                    onClose={closeForm}
                    onCreate={handleCreateReceipt}
                />
            ) : (
                <>
                    <Toolbar
                        search={{ value: search, onChange: setSearch }}
                        actions={[{ label: '+ New Receipt', onClick: () => setShowForm(true) }]}
                    />

                    <Tabs tabs={[]} toggle={{
                        label: "Show voided receipts",
                        checked: showVoided,
                        onChange: () => setShowVoided((v) => !v),
                    }}/>
                    
                    <div className="bg-white rounded-lg shadow">
                        <DataTable
                            columns={visibleColumns}
                            data={filtered}
                            loading={loading}
                            emptyMessage="No receipts found"
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