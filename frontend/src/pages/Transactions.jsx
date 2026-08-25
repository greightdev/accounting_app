import { useEffect, useState } from "react";
import api from "../api/axios";
import Toolbar from "../components/Toolbar";
import DataTable from "../components/DataTable";
import TransactionView from "../components/TransactionView";
import { adaptTransactionForView } from "../ViewAdapters";
import Toast from "../components/Toast";
import useToast from "../hooks/useToast";

const TYPE_LABELS = {
    SALES: "Invoice",
    PURCHASE: "Bill",
    RECEIPT: "Receipt",
    PAYMENT: "Payment",
    BANK_DEP: "Deposit",
    BANK_WITH: "Withdrawal",
    TDS_PAYMENT: "TDS Payment",
    JOURNAL: "Journal",
}

const STATUS_STYLES = {
    DRAFT: "bg-slate-100 text-slate-500",
    APPROVED: "bg-emerald-50 text-emerald-600",
    VOID: "bg-red-50 text-red-600",
};

export default function Transactions() {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [viewTx, setViewTx] = useState();
    const { toast, showToast, hideToast } = useToast(); 

    useEffect(() => {
        fetchTransactions();
    }, []);

    const fetchTransactions = async () => {
        setLoading(true);

        try {
            const { data } = await api.get(`/transactions/list_all.php`);
            setTransactions(data.data ?? []);
        } catch (err) {
            console.error("Failed to fetch transactions: ", err);
        } finally {
            setLoading(false);
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

    const filtered = transactions.filter((tx) => {
        const term = search.toLowerCase();
        const matchesSearch = 
            tx.ref_number.toLowerCase().includes(term) ||
            (tx.vendor_bill_no ?? "").toLowerCase().includes(term) ||
            (tx.contact_name ?? "").toLowerCase().includes(term);
        return matchesSearch;
    })

    const columns = [
        { key: "date", header: "Date" },
        { key: "ref_number", header: "Ref #", render: (tx) => tx.display_ref_number || tx.ref_number },
        { key: "type", header: "Type", render: (tx) => TYPE_LABELS[tx.type] ?? tx.type },
        { key: "contact_name", header: "Contact", render: (tx) => tx.contact_name ?? tx.bank_account_name ?? "" },
        { key: "total_amount", header: "Amount", align: "right",
            render: (tx) => Number(tx.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }),
        },
        { key: "status", header: "Status",
            render: (tx) => (
                <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${STATUS_STYLES[tx.status] ?? "bg-slate-100 text-slate-500"}`}>
                    {tx.status}
                </span>
            ),
         },
    ];

    return (
        <>
            <Toast toast={null} onClose={() => {}} />
                
            <Toolbar
                search={{ value: search, onChange: setSearch }}
            />

            <DataTable
                columns={columns}
                data={filtered}
                loading={loading}
                emptyMessage="No transactions found"
                onRowClick={handleView}
            />
            {viewTx && (
                <TransactionView
                    {...adaptTransactionForView(viewTx)}
                    onClose={() => setViewTx(null)}
                />
            )}
        </>
    );
}