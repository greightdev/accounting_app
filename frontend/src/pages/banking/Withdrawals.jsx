import { useEffect, useState } from "react";
import { SquarePen, Trash2, Check, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { can } from "../../permissions";
import Tabs from "../../components/Tabs";
import Toolbar from "../../components/Toolbar";
import api from "../../api/axios";
import BankTransferForm from "../../components/BankTransferForm";
import DataTable from "../../components/DataTable";
import useToast from "../../hooks/useToast";
import Toast from "../../components/Toast";
import TransactionView from "../../components/TransactionView";
import { adaptTransactionForView } from "../../ViewAdapters";

export default function Withdrawals() {
    const { role } = useAuth();
    const canApprove = can(role, "canApprove");
    const canVoid = can(role, "canVoid");
    const canEditTx = can(role, "canEditTransactions");
    const [transactions, setTransactions] = useState([]);
    const [bankAccounts, setBankAccounts] = useState([]);
    const [contraAccounts, setContraAccounts] = useState([]);
    const [editingTx, setEditingTx] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('approved');
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const { toast, showToast, hideToast } = useToast();

    const [viewTx, setViewTx] = useState(null);

    useEffect(() => {
        fetchTransactions();
    }, [tab]);

    useEffect(() => {
        fetchBankAccounts();
    }, []);

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const { data } = await api.get(`/banking/list.php?type=BANK_WITH&status=${tab}`);
            setTransactions(data.data ?? []);
        } catch (err) {
            console.error('Failed to fetch withdrawals: ', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchBankAccounts = async () => {
        try {
            const { data } = await api.get("/bank_account/list.php?type=BANK");
            setBankAccounts(data.data ?? []);
        } catch (err) {
            console.log(err)
        }
    };
    
    const fetchContraAccounts = async (excludeBankAccountId) => {
        try {
            const { data } = await api.get(`/banking/contra_accounts.php?type=cash_bank_or_expense${excludeBankAccountId ? `&exclude_bank_account_id=${excludeBankAccountId}` : ""}`);
            setContraAccounts(data.data ?? []);
        } catch (err) {
            console.log(err)
        }
    };

    const filtered = transactions.filter((tx) => {
        const term = search.toLowerCase();
        const matchesSearch = 
            tx.ref_number.toLowerCase().includes(term) ||
            (tx.bank_account_name ?? "").toLowerCase().includes(term) ||
            (tx.contra_account_name ?? "").toLowerCase().includes(term);
        return matchesSearch
    });

    const handleNew = () => {
        setEditingTx(null);
        fetchContraAccounts(null);
        setShowForm(true);
    }
    
    const handleEdit = async (tx) => {
        try {
            const { data } = await api.get(`/banking/get.php?id=${tx.id}`);
            setEditingTx(data.data);
            fetchContraAccounts(data.data.bank_account_id);
            setShowForm(true);
        } catch (err) {
            showToast("Failed to load withdrawal details.", "error");
        }
    };

    const closeForm = () => {
        setShowForm(false);
        setEditingTx(null);
    };

    const handleSubmit = async (payload) => {
        try {
            if (editingTx) {
                await api.put("/banking/update.php", { id: editingTx.id, ...payload });
                showToast("Withdrawal updated successfully.");
            } else {
                await api.post("/banking/create.php", { type: "BANK_WITH", ...payload});
                showToast(
                    payload.status === "APPROVED" ? "Withdrawal created and approved." : "Withdrawal saved as draft."
                );
            }
            closeForm();
            fetchTransactions();
        } catch (err) {
            console.error(err);
            showToast(err.response?.data?.message ?? "Failed to save withdrawal.", "error");
        }
    };

    const handleApprove = async (id) => {
        if (!window.confirm('Approve this withdrawal? This will post it to the ledger and it can no longer be edited.')) return;

        try {
            await api.put('/banking/approve.php', { id });
            showToast("Withdrawal approved successfully.");
            fetchTransactions();
        } catch (err) {
            showToast(err.response?.data?.message ?? 'Failed to approve withdrawal.', "error");
        }
    };
    
    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this withdrawal?')) return;
    
        try {
            await api.delete('/transactions/void.php', { data: { id, void_reason: 'Voided by user.' } });
            showToast("Withdrawal voided successfully.");
            fetchTransactions();
        } catch (err) {
            showToast(err.response?.data?.message ?? 'Failed to delete withdrawal.', "error");
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
        { key: "bank_account_name", header: "Withdrawn From", },
        { key: "contra_account_name", header: "Destination", },
        { key: "total_amount", header: "Amount",
            render: (tx) => tx.total_amount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
            }),
        },
    ];

    const approvedActions = {
        key: "actions",
        header: "Action",
        stopRowClick: true,
        render: (tx) => (
            <div className="flex items-center gap-2">
                <button
                    onClick={() => handleDelete(tx.id)}
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
        render: (tx) => (
            <button
                onClick={() => handleEdit(tx)}
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
        render: (tx) => (
            <div className="flex items-center gap-2">
                <button
                    onClick={() => handleApprove(tx.id)}
                    className="p-2 rounded-md text-emerald-600 hover:bg-emerald-100 transition-colors"
                    title="Approve"
                >
                    <Check size={16} />
                </button>

                <button
                    onClick={() => handleDelete(tx.id)}
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
                <BankTransferForm
                    mode="withdrawal"
                    draftNumber={editingTx ? editingTx.ref_number : `WITH-${String(transactions.length + 1).padStart(5, "0")}`}
                    initialData={editingTx}
                    bankAccounts={bankAccounts}
                    contraAccounts={contraAccounts}
                    onBankAccountChange={fetchContraAccounts}
                    onClose={closeForm}
                    onCreate={handleSubmit}
                />
            ) : (
                <>
                    <Toolbar
                        search={{ value: search, onChange: setSearch }}
                        actions={[{ label: '+ New Withdrawal', onClick: handleNew }]}
                    />

                    <Tabs active={tab} onChange={setTab} />

                    <div className="bg-white rounded-lg shadow">
                        <DataTable
                            columns={tab === "approved" ? approvedColumns : draftColumns}
                            data={filtered}
                            loading={loading}
                            emptyMessage="No withdrawals found"
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