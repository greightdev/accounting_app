import { useEffect, useState } from "react";
import api from "../api/axios";
import TreeNode from "../components/TreeNode";
import Tabs from "../components/Tabs";
import Toolbar from "../components/Toolbar";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import { SquarePen, Trash2 } from "lucide-react";
import Toast from "../components/Toast";
import useToast from "../hooks/useToast";
import { useAuth } from "../context/AuthContext";
import { can } from "../permissions";
import { validateGenericName, filterItemNameInput } from "../utils/validators";

const emptyAccountForm = { name: '', account_group_id: '' };
const emptyGroupForm = { name: '', parent_id: '' };

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
    const { role } = useAuth();
    const canDelete = can(role, "canDelete");
    const [coaTree, setCoaTree] = useState([]);
    const [groupsFlat, setGroupsFlat] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [tab, setTab] = useState('tree');
    
    // Account Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState(null);
    const [form, setForm] = useState(emptyAccountForm);
    const [fieldErrors, setFieldErrors] = useState({});
    const [modalError, setModalError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Group Modal
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState(null);
    const [groupForm, setGroupForm] = useState(emptyGroupForm);
    const [groupFieldErrors, setGroupFieldErrors] = useState({});
    const [groupModalError, setGroupModalError] = useState('');
    const [groupSubmitting, setGroupSubmitting] = useState(false);


    const { toast, showToast, hideToast } = useToast();

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
    
    // Account Modal
    const openCreateModal = () => {
        setEditingAccount(null);
        setForm(emptyAccountForm);
        setModalError('');
        setFieldErrors({});
        setIsModalOpen(true);
    };

    const openEditModal = (account) => {
        setEditingAccount(account);
        setForm({
            name: account.name,
            account_group_id: account.account_group_id,
        });
        setModalError('');
        setFieldErrors({});
        setIsModalOpen(true);
    };
    
    const closeModal = () => {
        setIsModalOpen(false);
        setEditingAccount(null);
        setForm(emptyAccountForm);
        setModalError('');
        setFieldErrors({});
    };
    
    const handleChange = (e) => {
        const { name, value } = e.target;
        const nextValue = name === 'name' ? filterItemNameInput(value) : value;

        setForm((prev) => ({ ...prev, [name]: nextValue }));

        if (fieldErrors[name]) {
            setFieldErrors((prev) => ({ ...prev, [name]: '' }));
        }
    };

    const validateForm = () => {
        const errors = {
            name: validateGenericName(form.name, { label: "Account name", maxLen: 150 }),
            account_group_id: form.account_group_id ? "" : "Account group is required.",
        };
        Object.keys(errors).forEach((key) => { if (!errors[key]) delete errors[key]; });
        return errors;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setModalError('');

        const errors = validateForm();
        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            return;
        }
        setFieldErrors({});

        setSubmitting(true);
    
        try {
            if (editingAccount) {
                await api.put('/accounts/update.php', {
                    id: editingAccount.id,
                    ...form
                });

                showToast("Account updated successfully.")
            } else {
                await api.post('/accounts/create.php', form);
                showToast("Account created successfully.");
            }
    
            closeModal();
            fetchAll();
        } catch (err) {
            const message = err.response?.data?.message ?? 'Something went wrong. Please try again.';
            setModalError(message);
            showToast(message, "error");
        } finally {
            setSubmitting(false);
        }
    };
    
    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this account?')) return;
    
        try {
            await api.delete('/accounts/delete.php', { data: { id } });
            showToast("Account deleted successfully.");
            fetchAll();
        } catch (err) {
            showToast(err.response?.data?.message ?? 'Failed to delete account.',"error");
        }
    };

    // Group Modal
    const openCreateGroupModal = () => {
        setEditingGroup(null);
        setGroupForm(emptyGroupForm);
        setGroupModalError('');
        setGroupFieldErrors({});
        setIsGroupModalOpen(true);
    };

    const openEditGroupModal = (group) => {
        setEditingGroup(group);
        setGroupForm({
            name: group.name,
            parent_id: group.parent_id,
        });
        setGroupModalError('');
        setGroupFieldErrors({});
        setIsGroupModalOpen(true);
    };
    
    const closeGroupModal = () => {
        setIsGroupModalOpen(false);
        setEditingGroup(null);
        setGroupForm(emptyGroupForm);
        setGroupModalError('');
        setGroupFieldErrors({});
    };
    
    const handleGroupChange = (e) => {
        const { name, value } = e.target;
        const nextValue = name === 'name' ? filterItemNameInput(value) : value;

        setGroupForm((prev) => ({ ...prev, [name]: nextValue }));

        if (groupFieldErrors[name]) {
            setGroupFieldErrors((prev) => ({ ...prev, [name]: '' }));
        }
    };

    const validateGroupForm = () => {
        const errors = {
            name: validateGenericName(groupForm.name, { label: "Group name", maxLen: 100 }),
            parent_id: groupForm.parent_id ? "" : "Parent group is required.",
        };
        Object.keys(errors).forEach((key) => { if (!errors[key]) delete errors[key]; });
        return errors;
    };

    const handleGroupSubmit = async (e) => {
        e.preventDefault();
        setGroupModalError('');

        const errors = validateGroupForm();
        if (Object.keys(errors).length > 0) {
            setGroupFieldErrors(errors);
            return;
        }
        
        setGroupFieldErrors({});

        setGroupSubmitting(true);
    
        try {
            const payload = {
                name: groupForm.name,
                parent_id: groupForm.parent_id || null,
            };
            if (editingGroup) {
                await api.put('/account_group/update.php', { id: editingGroup.id, ...payload });
                showToast("Account group updated successfully.")
            } else {
                await api.post('/account_group/create.php', payload);
                showToast("Account group created successfully.");
            }
    
            closeGroupModal();
            fetchAll();
        } catch (err) {
            const message = err.response?.data?.message ?? 'Something went wrong. Please try again.';
            setGroupModalError(message);
            showToast(message, "error");
        } finally {
            setGroupSubmitting(false);
        }
    };
    
    const handleGroupDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this account group?')) return;
    
        try {
            await api.delete('/account_group/delete.php', { data: { id } });
            showToast("Account group deleted successfully.");
            fetchAll();
        } catch (err) {
            showToast(err.response?.data?.message ?? 'Failed to delete account group.', "error");
        }
    };

    const filteredTree = filterTree(coaTree, search);

    const filteredAccounts = accounts.filter((a) => {
        const term = search.toLowerCase();
        const matchesSearch = 
            a.name.toLowerCase().includes(term) ||
            a.code?.toLowerCase().includes(term) ||
            a.account_group_name?.toLowerCase().includes(term);
        return matchesSearch;
    });

    const filteredGroups = groupsFlat.filter((g) => {
        const term = search.toLowerCase();
        const matchesSearch = 
            g.name.toLowerCase().includes(term) ||
            g.code?.toLowerCase().includes(term) ||
            g.account_group_name?.toLowerCase().includes(term);
        return matchesSearch;
    });

    const anyEditableAccount = accounts.some((a) => !a.is_system);
    const anyEditableGroup = groupsFlat.some((g) => !g.is_system);

    const accountColumns = [
        { key: "code", header: "Code", },
        { key: "name", header: "Name", },
        { key: "account_group_name", header: "Group", },
        { key: "account_group_type", header: "Account Type", },
        ...(anyEditableAccount ? [{ key: "actions", header: "Action", render: (account) => (
            account.is_system ? null : (
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => openEditModal(account)}
                        className="p-2 rounded-md text-slate-600 hover:bg-slate-100"
                    >
                        <SquarePen size={16} />
                    </button>

                    {canDelete && (
                        <button
                            onClick={() => handleDelete(account.id)}
                            className="p-2 rounded-md text-slate-600 hover:bg-slate-100"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>
            )
        ) }] : []),
    ];

    const groupColumns = [
        { key: "code", header: "Code", },
        { key: "name", header: "Name", },
        { key: "parent_name", header: "Parent Group", },
        { key: "type", header: "Group Type", },
        ...(anyEditableGroup ? [{ key: "actions", header: "Action", render: (group) => (
            group.is_system ? null : (
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => openEditGroupModal(group)}
                        className="p-2 rounded-md text-slate-600 hover:bg-slate-100"
                    >
                        <SquarePen size={16} />
                    </button>

                    {canDelete && (
                        <button
                            onClick={() => handleGroupDelete(group.id)}
                            className="p-2 rounded-md text-slate-600 hover:bg-slate-100"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>
            )
        ) }] : []),
    ];

    return (
        <>
            <Toast toast={toast} onClose={hideToast} />

            <Toolbar
                search={{ value: search, onChange: setSearch }}
                actions={[
                    { label: '+ Add Group', onClick: openCreateGroupModal },
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
                            <div className="flex justify-center items-center py-20 text-slate-500">
                                Loading COA Tree...
                            </div>
                        ) : filteredTree.length === 0 ? (
                            <div className="flex justify-center items-center py-20 text-slate-500">
                                {search.trim() ? 'No account match your search.' : 'No account groups found.'}
                            </div>
                        ) : (
                            filteredTree.map((node, index) => (
                                <TreeNode
                                    key={node.code}
                                    node={node}
                                    isLast={index === filteredTree.length -1}
                                    onEdit={openEditModal}
                                    onDelete={canDelete ? handleDelete: undefined}
                                    onEditGroup={openEditGroupModal}
                                    onDeleteGroup={canDelete ? handleGroupDelete: undefined}
                                    forceExpand={!!search.trim()}
                                />
                            ))
                        )}
                    </div>
                )}
                
                {/* Accounts Table */}
                {tab === 'accounts' && (
                    <DataTable
                        columns={accountColumns}
                        data={filteredAccounts}
                        loading={loading}
                        emptyMessage="No accounts found."
                    />
                )}

                {/* Groups Table */}
                {tab === 'groups' && (
                    <DataTable
                        columns={groupColumns}
                        data={filteredGroups}
                        loading={loading}
                        emptyMessage="No groups found"
                    />
                )}

            </div>

            {/* Account Modal */}
            {isModalOpen && (
                <Modal
                    title={editingAccount ? 'Edit Account' : 'Add Account'}
                    subtitle={editingAccount ? 'Update account details below.' : 'Create a new account.'}
                    warning={editingAccount?.is_system ? 'This is a system account - its name and group cannot be changed.' : null}
                    error={modalError}
                    onClose={closeModal}
                    onSubmit={handleSubmit}
                    submitting={submitting}
                    submitLabel={editingAccount ? 'Save Changes' : 'Create Account'}
                >
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Account Name</label>
                        <input
                            name="name"
                            value={form.name}
                            onChange={handleChange}
                            disabled={editingAccount?.is_system}
                            placeholder="e.g. Office Rent"
                            className={`w-full px-4 py-2.5 rounded-lg border ${fieldErrors.name ? 'border-red-400' : 'border-gray-200'} bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition disabled:opacity-60 disabled:cursor-not-allowed`}
                        />
                        {fieldErrors.name && <p className="mt-1 text-xs text-red-500">{fieldErrors.name}</p>}
                    </div>
    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Account Group</label>
                        <select
                            name="account_group_id"
                            value={form.account_group_id}
                            onChange={handleChange}
                            disabled={editingAccount?.is_system}
                            className={`w-full px-4 py-2.5 rounded-lg border ${fieldErrors.account_group_id ? 'border-red-400' : 'border-gray-200'} bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition disabled:opacity-60 disabled:cursor-not-allowed`}
                        >
                        <option value="">Select a group</option>
                            {groupsFlat.map((group) => (
                                <option key={group.id} value={group.id}>{group.name}</option>
                            ))}
                        </select>
                        {fieldErrors.account_group_id && <p className="mt-1 text-xs text-red-500">{fieldErrors.account_group_id}</p>}
                    </div>
                </Modal>
            )}

            {/* Group Modal */}
            {isGroupModalOpen && (
                <Modal
                    title={editingGroup ? 'Edit Account Group' : 'Add Account Group'}
                    subtitle={editingGroup ? 'Update group details below.' : 'Create a new account group.'}
                    error={groupModalError}
                    onClose={closeGroupModal}
                    onSubmit={handleGroupSubmit}
                    submitting={groupSubmitting}
                    submitLabel={editingGroup ? 'Save Changes' : 'Create Group'}
                >
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Group Name</label>
                        <input
                            name="name"
                            value={groupForm.name}
                            onChange={handleGroupChange}
                            placeholder="e.g. Fixed Assets"
                            className={`w-full px-4 py-2.5 rounded-lg border ${groupFieldErrors.name ? 'border-red-400' : 'border-gray-200'} bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition`}
                        />
                        {groupFieldErrors.name && <p className="mt-1 text-xs text-red-500">{groupFieldErrors.name}</p>}
                    </div>
    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Parent Group</label>
                        <select
                            name="parent_id"
                            value={groupForm.parent_id}
                            onChange={handleGroupChange}
                            className={`w-full px-4 py-2.5 rounded-lg border ${groupFieldErrors.parent_id ? 'border-red-400' : 'border-gray-200'} bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition`}
                        >
                        <option value="">Select parent group</option>
                            {groupsFlat
                                .filter((group) => !editingGroup || group.id !== editingGroup.id)
                                .map((group) => (
                                    <option key={group.id} value={group.id}>{group.name}</option>
                            ))}
                        </select>
                        {groupFieldErrors.parent_id && <p className="mt-1 text-xs text-red-500">{groupFieldErrors.parent_id}</p>}
                    </div>
                </Modal>
            )}
        </>
    );
}