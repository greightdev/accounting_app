import { useEffect, useState } from "react";
import api from "../api/axios";
import TreeNode from "../components/TreeNode";
import Tabs from "../components/Tabs";
import Toolbar from "../components/Toolbar";
import { Search, SquarePen, Trash2 } from "lucide-react";

const emptyForm = {
    name: '',
    account_group_id: '',
}

const mergeAccountsIntoTree = (tree, accounts) => {
    const accountsByGroup = {};
    accounts.forEach((acc) => {
        if (!accountsByGroup[acc.account_group_id]) {
            accountsByGroup[acc.account_group_id] = [];
        }
        accountsByGroup[acc.account_group_id].push({
            ...acc,
            isAccount: true,
        });
    });

    const attach = (nodes) =>
        nodes.map((node) => ({
            ...node,
            children: [
                ...attach(node.children ?? []),
                ...(accountsByGroup[node.id] ?? []),
            ],
        }));
    
    return attach(tree);
}

const filterTree = (nodes, query) => {
    if (!query.trim()) return nodes;
    const q = query.toLowerCase();

    const filterNode = (node) => {
        if (node.isAccount) {
            return node.name.toLowerCase().includes(q) ||
                   node.code?.toLowerCase().includes(q)
                   ? node : null;
        }

        const groupMatches = node.name.toLowerCase().includes(q);

        // If group matches send it along with its children
        if (groupMatches) return node;

        // Otherwise keep only the children
        const filteredChildren = node.children
            .map(filterNode)
            .filter(Boolean);

        // Keep this group if it matches by name OR has matching descendants
        if (filteredChildren.length > 0 || node.name.toLowerCase().includes(q)) {
            return { ...node, children: filteredChildren };
        }
        return null;
    };

    return nodes.map(filterNode).filter(Boolean);
};

const COA_TABS = [
    { key: 'tree', label: 'COA Tree' },
    { key: 'accounts', label: 'Accounts' },
    { key: 'groups', label: 'Groups' },
];

export default function ChartofAccounts() {
    const [coaTree, setCoaTree] = useState([]);
    const [groupsFlat, setGroupsFlat] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [tab, setTab] = useState('tree')
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [modalError, setModalError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchAll();
    }, []);
    
    const fetchAll = async () => {
        setLoading(true);
        try {
            const [groupsRes, accountsRes] = await Promise.all([
                api.get('/account_group/list.php'),
                api.get('/accounts/list.php'),
            ]);

            const accountList = accountsRes.data.data ?? [];

            const mergedTree = mergeAccountsIntoTree(
                groupsRes.data.data ?? [],
                accountList
            );

            setCoaTree(mergedTree);
            setAccounts(accountList);

            const flat = groupsRes.data.flat ?? [];
            const groupById = Object.fromEntries(flat.map((g) => [g.id, g.name]));
            const flatWithParent = flat.map((g) => ({
                ...g,
                parent_name: g.parent_id ? (groupById[g.parent_id] ?? '') : '',
            }));

            setGroupsFlat(flatWithParent);
        } catch (err) {
            console.error('Failed to fetch accounts:', err);
        } finally {
            setLoading(false);
        }
    };
    
    const openCreateModal = () => {
        setEditingAccount(null);
        setForm(emptyForm);
        setModalError('');
        setIsModalOpen(true);
    };

    const openEditModal = (account) => {
        setEditingAccount(account);
        setForm({
            name: account.name,
            account_group_id: account.account_group_id,
        });
        setModalError('');
        setIsModalOpen(true);
    };
    
    const closeModal = () => {
        setIsModalOpen(false);
        setEditingAccount(null);
        setForm(emptyForm);
        setModalError('');
    };
    
    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setModalError('');
        setSubmitting(true);
    
        try {
            if (editingAccount) {
                await api.put('/accounts/update.php', {
                    id: editingAccount.id,
                    name: form.name,
                    account_group_id: form.account_group_id,
                });
            } else {
                await api.post('/accounts/create.php', {
                    name: form.name,
                    account_group_id: form.account_group_id,
                });
            }
    
            closeModal();
            fetchAll();
        } catch (err) {
            setModalError(err.response?.data?.message ?? 'Something went wrong. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };
    
    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this account?')) return;
    
        try {
            await api.delete('/accounts/delete.php', { data: { id } });
            fetchAll();
        } catch (err) {
            alert(err.response?.data?.message ?? 'Failed to delete account.');
        }
    };

    const filteredTree = filterTree(coaTree, search);

    const filteredAccounts = accounts.filter((a) => 
        a.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <>                
            <Toolbar
                search={{ value: search, onChange: setSearch }}
                actions={[
                    { label: '+ Add Group', onClick: () => {} },
                    { label: '+ Add Account', onClick: openCreateModal },
                ]}
            />

            {/* Tabs */}
            <Tabs tabs={COA_TABS} active={tab} onChange={setTab} />

            <div className="bg-white rounded-lg shadow">
                {/* Tree */}
                {tab === 'tree' && (
                    <div className="bg-white rounded-lg shadow p-4">
                        {loading ? (
                            <p className="text-sm text-gray-400 text-center py-8">Loading...</p>
                        ) : filteredTree.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-8">
                                {search.trim() ? 'No account match your search.' : 'No account groups found.'}
                            </p>
                        ) : (
                            filteredTree.map((node, index) => (
                                <TreeNode
                                    key={node.code}
                                    node={node}
                                    isLast={index === filteredTree.length -1}
                                    onEdit={openEditModal}
                                    onDelete={handleDelete}
                                    forceExpand={!!search.trim()}
                                />
                            ))
                        )}
                    </div>
                )}

                {/* Accounts Table */}
                {tab === 'accounts' && (
                    <table className="w-full overflow-hidden rounded-xl bg-white shadow-sm">
                        <thead>
                            <tr className="bg-slate-700 text-white">
                                <th className="px-4 py-3 text-left font-semibold">Code</th>
                                <th className="px-4 py-3 text-left font-semibold">Name</th>
                                <th className="px-4 py-3 text-left font-semibold">Group</th>
                                <th className="px-4 py-3 text-left font-semibold">Account Type</th>
                                <th className="px-4 py-3 text-left font-semibold">Action</th>
                            </tr>
                        </thead>

                        <tbody>
                            {accounts
                                .filter((a) =>
                                    a.name.toLowerCase().includes(search.toLowerCase()) ||
                                    a.code?.toLowerCase().includes(search.toLowerCase()) ||
                                    a.account_group_name?.toLowerCase().includes(search.toLowerCase())
                                )
                                .map((a, index) => (
                                <tr
                                    key={a.id}
                                    className={`
                                        ${index % 2 === 0 ? "bg-white" : "bg-slate-50"}
                                        border-b border-slate-100
                                        hover:bg-slate-100 transition-colors
                                    `}
                                >
                                    <td className="px-4 py-3">{a.code}</td>
                                    <td className="px-4 py-3">{a.name}</td>
                                    <td className="px-4 py-3">{a.account_group_name}</td>
                                    <td className="px-4 py-3">{a.account_group_type}</td>
                                    <td className="px-4 py-3 flex items-center gap-2">
                                        <button
                                            onClick={() => openEditModal(a)}
                                            className="p-2 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                                        >
                                            <SquarePen size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(a.id)}
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

                {/* Groups Table */}
                {tab === 'groups' && (
                    <table className="w-full overflow-hidden rounded-xl bg-white shadow-sm">
                        <thead>
                            <tr className="bg-slate-700 text-white">
                                <th className="px-4 py-3 text-left font-semibold">Code</th>
                                <th className="px-4 py-3 text-left font-semibold">Name</th>
                                <th className="px-4 py-3 text-left font-semibold">Parent Group</th>
                                <th className="px-4 py-3 text-left font-semibold">Group Type</th>
                                <th className="px-4 py-3 text-left font-semibold">Action</th>
                            </tr>
                        </thead>

                        <tbody>
                            {groupsFlat
                                .filter((g) =>
                                    g.name.toLowerCase().includes(search.toLowerCase())
                                )
                                .map((g, index) => (
                                <tr
                                    key={g.id}
                                    className={`
                                        ${index % 2 === 0 ? "bg-white" : "bg-slate-50"}
                                        border-b border-slate-100
                                        hover:bg-slate-100 transition-colors
                                    `}
                                >
                                    <td className="px-4 py-3">{g.code}</td>
                                    <td className="px-4 py-3">{g.name}</td>
                                    <td className="px-4 py-3">{g.parent_name}</td>
                                    <td className="px-4 py-3">{g.type}</td>
                                    <td className="px-4 py-3 flex items-center gap-2">
                                        <button
                                            // onClick={() => openEditModal(a)}
                                            className="p-2 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                                        >
                                            <SquarePen size={16} />
                                        </button>
                                        <button
                                            // onClick={() => handleDelete(a.id)}
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

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-7">
                        <h2 className="text-lg font-semibold text-gray-900 mb-1">
                            {editingAccount ? 'Edit Account' : 'Add Account'}
                        </h2>
                        <p className="text-sm text-gray-500 mb-6">
                            {editingAccount ? 'Update account details below.' : 'Create a new account.'}
                        </p>
        
                        {editingAccount?.is_system && (
                            <div className="mb-5 px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
                                This is a system account — its name and group cannot be changed.
                            </div>
                        )}
        
                        {modalError && (
                            <div className="mb-5 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                                {modalError}
                            </div>
                        )}
        
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Account Name</label>
                                <input
                                    name="name"
                                    value={form.name}
                                    onChange={handleChange}
                                    disabled={editingAccount?.is_system}
                                    placeholder="e.g. Office Rent"
                                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition disabled:opacity-60 disabled:cursor-not-allowed"
                                />
                            </div>
            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Account Group</label>
                                <select
                                    name="account_group_id"
                                    value={form.account_group_id}
                                    onChange={handleChange}
                                    disabled={editingAccount?.is_system}
                                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                <option value="">Select a group</option>
                                    {groupsFlat.map((group) => (
                                        <option key={group.id} value={group.id}>{group.name}</option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="flex-1 py-2.5 rounded-lg border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 py-2.5 rounded-lg bg-slate-700 text-white text-sm font-semibold hover:bg-slate-800 transition disabled:opacity-60 flex items-center justify-center"
                                >
                                {submitting ? (
                                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                        ) : editingAccount ? 'Save Changes' : 'Create Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}