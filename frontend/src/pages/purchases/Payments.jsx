import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
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


export default function Payments() {
    const [payments, setPayments] = useState([]);
    const [contacts, setContacts] = useState([]);
    const [bankAccounts, setBankAccounts] = useState([]);
    const [openBills, setOpenBills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [showVoided, setShowVoided] = useState(false);
    const { toast, showToast, hideToast } = useToast();

    const [viewTx, setViewTx] = useState(null);

    useEffect(() => {
        fetchPayments();
        fetchFormData();
    }, []);

    const fetchPayments = async () => {
        setLoading(true);
        try {
            const { data } = await api.get(`/purchases/payments/list.php`);
            setPayments(data.data ?? []);
        } catch (err) {
            console.error('Failed to fetch payments: ', err);
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

    const fetchOpenBillsForContact = async (contactId) => {
        setOpenBills([]);
        try {
            const { data } = await api.get(
                `/purchases/bills/list.php?status=approved&contact_id=${contactId}`
            );
            const bills = data.data ?? [];
            setOpenBills(bills.filter((inv) => inv.payment_status !== "Fully Paid"));
        } catch (err) {
            console.error("Failed to fetch open bills: ", err);
            showToast("Failed to load this vendor's open bills.", "error");
        }
    };

    const filtered = payments.filter((payment) => {
        const term = search.toLowerCase();
        const matchesSearch = 
            (payment.ref_number ?? "").toLowerCase().includes(term) ||
            (payment.vendor_name ?? "").toLowerCase().includes(term);
        const matchesVoidFilter = showVoided || payment.status !== "VOID";
        return matchesSearch && matchesVoidFilter;
    });

    const closeForm = () => {
        setShowForm(false);
        setOpenBills([]);
    };

    const handleCreatePayment = async (payload) => {
        try {
            await api.post("/purchases/payments/create.php", payload);
            showToast("Payment recorded successfully.");
            closeForm();
            fetchPayments();
        } catch (err) {
            showToast(err.response?.data?.message ?? "Failed to record payment.", "error");
            throw err;
        }
    };
    
    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this payment?')) return;
    
        try {
            await api.delete('/transactions/void.php', { data: { id } });
            showToast("Payment voided successfully.");
            fetchPayments();
        } catch (err) {
            showToast(err.response?.data?.message ?? 'Failed to void payment.', "error");
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
        { key: "vendor_name", header: "Vendor", },
        { key: "total_amount", header: "Total Cleared",
            render: (payment) => payment.total_amount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
            }),
        },
        { key: "status", header: "Status",
            render: (payment) => (
                <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${statusStyles(payment.status)}`}>
                    {payment.status}
                </span>
            ),
        },
        {
            key: "actions", header: "Action", stopRowClick: true, render: (payment) => (
                <div className="flex items-center gap-2">
                    {payment.status !== "VOID" && (
                        <button
                            onClick={() => handleDelete(payment.id)}
                            className="p-2 rounded-md text-slate-600 hover:bg-slate-100"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>
            ),
        }
    ];

    return (
        <>
            <Toast toast={toast} onClose={hideToast} />
            {showForm ? (
                <SettlementForm
                    mode="payment"
                    contacts={contacts}
                    bankAccounts={bankAccounts}
                    openDocuments={openBills}
                    onFetchDocuments={fetchOpenBillsForContact}
                    fiscalYear={currentFiscalYear()}
                    onClose={closeForm}
                    onCreate={handleCreatePayment}
                />
            ) : (
                <>
                    <Toolbar
                        search={{ value: search, onChange: setSearch }}
                        actions={[{ label: '+ New Payment', onClick: () => setShowForm(true) }]}
                    />

                    <Tabs tabs={[]} toggle={{
                        label: "Show voided payments",
                        checked: showVoided,
                        onChange: () => setShowVoided((v) => !v),
                    }}/>
                    
                    <div className="bg-white rounded-lg shadow">
                        <DataTable
                            columns={columns}
                            data={filtered}
                            loading={loading}
                            emptyMessage="No payments found"
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