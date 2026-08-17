import { useEffect, useState } from "react";
import { SquarePen, Trash2, Check, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { can } from "../permissions";
import Tabs from "../components/Tabs";
import Toolbar from "../components/Toolbar";
import api from "../api/axios";
import DataTable from "../components/DataTable";
import JournalForm from "../components/JournalForm";
import useToast from "../hooks/useToast";
import Toast from "../components/Toast";

export default function Journal() {
    const { role } = useAuth();
    const canApprove = can(role, "canApprove");
    const canVoid = can(role, "canVoid");
    const canEditTx = can(role, "canEditTransactions");
    const [journals, setJournals] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [contacts, setContacts] = useState([]);
    const [editingJournal, setEditingJournal] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState("approved");
    const [search, setSearch] = useState("");
    const [showForm, setShowForm] = useState(false);
    const { toast, showToast, hideToast } = useToast();

    useEffect(() => {
        fetchJournals();
    }, [tab]);

    useEffect(() => {
        fetchAccounts();
        fetchContacts();
    }, []);

    const fetchJournals = async () => {
        setLoading(true);
        try {
            const { data } = await api.get(`/journal/list.php?status=${tab}`);
            setJournals(data.data ?? []);
        } catch (err) {
            console.error("Failed to fetch journal entries: ", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchAccounts = async () => {
        try {
            const { data } = await api.get("/accounts/list.php");
            setAccounts(data.data ?? []);
        } catch (err) {
            console.log(err);
        }
    };

        const fetchContacts = async () => {
        try {
            const { data } = await api.get("/contacts/list.php");
            setContacts(data.data ?? []);
        } catch (err) {
            console.log(err);
        }
    };

    const filtered = journals.filter((j) => {
        const term = search.toLowerCase();
        const matchesSearch = (
            j.ref_number.toLowerCase().includes(term) ||
            (j.notes ?? "").toLowerCase().includes(term)
        );
        return matchesSearch;
    });

    const handleNew = () => {
        setEditingJournal(null);
        setShowForm(true);
    };

    const handleEdit = async (journal) => {
        try {
            const { data } = await api.get(`/journal/get.php?id=${journal.id}`);
            setEditingJournal(data.data);
            setShowForm(true);
        } catch (err) {
            showToast("Failed to load journal entry details.", "error");
        }
    };

    const closeForm = () => {
        setShowForm(false);
        setEditingJournal(null);
    };

    const handleSubmit = async (payload) => {
        try {
            if (editingJournal) {
                await api.put("/journal/update.php", { id: editingJournal.id, ...payload });
                showToast("Journal entry updated successfully.");
            } else {
                await api.post("/journal/create.php", payload);
                showToast(
                    payload.status === "APPROVED" ? "Journal entry created and approved." : "Journal entry saved as draft."
                );
            }
            closeForm();
            fetchJournals();
        } catch (err) {
            console.error(err);
            showToast(err.response?.data?.message ?? "Failed to save journal entry.", "error");
        }
    };

    const handleApprove = async (id) => {
        if (!window.confirm("Approve this journal entry? This will post it to the ledger and it can no longer be edited.")) return;
        try {
            await api.put("/journal/approve.php", { id });
            showToast("Journal entry approved successfully.");
            fetchJournals();
        } catch (err) {
            showToast(err.response?.data?.message ?? "Failed to approve journal entry.", "error");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to void this journal entry?")) return;
        try {
            await api.delete("/transactions/void.php", { data: { id, void_reason: "Voided by user." } });
            showToast("Journal entry voided successfully.");
            fetchJournals();
        } catch (err) {
            showToast(err.response?.data?.message ?? "Failed to void journal entry.", "error");
        }
    };

    const baseColumns = [
        { key: "date", header: "Date", },
        { key: "ref_number", header: "#", },
        { key: "notes", header: "Notes", },
        { key: "total_amount", header: "Amount",
            render: (journal) => journal.total_amount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
            }),
        },
    ];

    const approvedActions = {
        key: "actions",
        header: "Action",
        render: (journal) => (
            <div className="flex items-center gap-2">
                <button
                    onClick={() => handleDelete(journal.id)}
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
        render: (journal) => (
            <button
                onClick={() => handleEdit(journal)}
                className="p-2 rounded-md text-slate-600 hover:bg-slate-100"
            >
                <SquarePen size={16} />
            </button>
        ),
    };

    const approvalColumn = {
        key: "approve",
        header: "Approve / Reject",
        render: (journal) => (
            <div className="flex items-center gap-2">
                <button
                    onClick={() => handleApprove(journal.id)}
                    className="p-2 rounded-md text-emerald-600 hover:bg-emerald-100 transition-colors"
                    title="Approve"
                >
                    <Check size={16} />
                </button>

                <button
                    onClick={() => handleDelete(journal.id)}
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

    const fmt = (n) => Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 });

    return (
        <>
            <Toast toast={toast} onClose={hideToast} />
            {showForm ? (
                <JournalForm
                    draftNumber={editingJournal ? editingJournal.ref_number : `JNL-${String(journals.length + 1).padStart(5, "0")}`}
                    initialData={editingJournal}
                    accounts={accounts}
                    contacts={contacts}
                    onClose={closeForm}
                    onCreate={handleSubmit}
                />
            ) : (
                <>
                    <Toolbar
                        search={{ value: search, onChange: setSearch }}
                        actions={[{ label: "+ New Journal Entry", onClick: handleNew }]}
                    />

                    <Tabs active={tab} onChange={setTab} />

                    <div className="bg-white rounded-lg shadow">
                        <DataTable
                            columns={tab === "approved" ? approvedColumns : draftColumns}
                            data={filtered}
                            loading={loading}
                            emptyMessage="No journal entries found"
                        />
                    </div>
                </>
            )}
        </>
    );
}