import { useEffect, useState } from "react";
import { SquarePen, UserX, UserCheck } from "lucide-react";
import Toolbar from "../components/Toolbar";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import api from "../api/axios";
import Toast from "../components/Toast";
import useToast from "../hooks/useToast";
import { useAuth } from "../context/AuthContext";
import { validateName, validateEmail, validatePassword, filterNameInput } from "../utils/validators";

const emptyForm = {
    name: '',
    email: '',
    password: '',
    role: 'accountant',
};

const roleStyles = {
    admin: "bg-purple-50 text-purple-600",
    accountant: "bg-blue-50 text-blue-600",
    user: "bg-slate-100 text-slate-600",
};

export default function Users() {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [fieldErrors, setFieldErrors] = useState({});
    const [modalError, setModalError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const { toast, showToast, hideToast } = useToast();

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/users/list.php');
            setUsers(data.data ?? []);
        } catch (err) {
            console.error('Failed to fetch users: ', err);
        } finally {
            setLoading(false);
        }
    };

    const openCreateModal = () => {
        setEditingUser(null);
        setForm(emptyForm);
        setModalError('');
        setFieldErrors({});
        setIsModalOpen(true);
    };

    const openEditModal = (u) => {
        setEditingUser(u);
        setForm({
            name: u.name,
            email: u.email,
            password: '',
            role: u.role,
        });
        setModalError('');
        setFieldErrors({});
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingUser(null);
        setForm(emptyForm);
        setModalError('');
        setFieldErrors({});
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        const nextValue = name === 'name' ? filterNameInput(value) : value;

        setForm((prev) => ({ ...prev, [name]: nextValue }));

        if (fieldErrors[name]) {
            setFieldErrors((prev) => ({ ...prev, [name]: '' }));
        }
    };

    const validateForm = () => {
        const errors = {
            name: validateName(form.name, { required: true, label: "Name" }),
            email: validateEmail(form.email, { required: true }),
        };
        if (!editingUser) {
            errors.password = validatePassword(form.password, { required: true });
        }
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
            if (editingUser) {
                await api.put('/users/update.php', {
                    id: editingUser.id,
                    name: form.name,
                    email: form.email,
                    role: form.role,
                });
                showToast("User updated successfully.");
            } else {
                await api.post('/users/create.php', {
                    name: form.name,
                    email: form.email,
                    password: form.password,
                    role: form.role,
                });
                showToast("User created successfully.");
            }
            closeModal();
            fetchUsers();
        } catch (err) {
            const message = err.response?.data?.message ?? 'Something went wrong. Please try again.';
            setModalError(message);
            showToast(message, "error");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeactivate = async (u) => {
        if (!window.confirm(`Deactivate ${u.name}? They will no longer be able to log in.`)) return;

        try {
            await api.delete('/users/deactivate.php', { data: { id: u.id } });
            showToast("User deactivated successfully.");
            fetchUsers();
        } catch (err) {
            showToast(err.response?.data?.message ?? 'Failed to deactivate user.', "error");
        }
    };

    const handleReactivate = async (u) => {
        try {
            await api.put('/users/reactivate.php', { id: u.id });
            showToast("User reactivated successfully.");
            fetchUsers();
        } catch (err) {
            showToast(err.response?.data?.message ?? 'Failed to reactivate user.', "error");
        }
    };

    const filteredUsers = users.filter((u) => {
        const term = search.toLowerCase();
        return (
            u.name.toLowerCase().includes(term) ||
            u.email.toLowerCase().includes(term)
        );
    });

    const columns = [
        { key: "name", header: "Name" },
        { key: "email", header: "Email" },
        { key: "role", header: "Role",
            render: (u) => (
                <span className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize ${roleStyles[u.role] ?? "bg-slate-100 text-slate-600"}`}>
                    {u.role}
                </span>
            ),
        },
        { key: "is_active", header: "Status",
            render: (u) => (
                <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${u.is_active ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
                    {u.is_active ? "Active" : "Inactive"}
                </span>
            ),
        },
        { key: "actions", header: "Action",
            render: (u) => (
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => openEditModal(u)}
                        className="p-2 rounded-md text-slate-600 hover:bg-slate-100"
                        title="Edit"
                    >
                        <SquarePen size={16} />
                    </button>

                    {u.id === currentUser?.id ? null : u.is_active ? (
                        <button
                            onClick={() => handleDeactivate(u)}
                            className="p-2 rounded-md text-red-600 hover:bg-red-50"
                            title="Deactivate"
                        >
                            <UserX size={16} />
                        </button>
                    ) : (
                        <button
                            onClick={() => handleReactivate(u)}
                            className="p-2 rounded-md text-emerald-600 hover:bg-emerald-50"
                            title="Reactivate"
                        >
                            <UserCheck size={16} />
                        </button>
                    )}
                </div>
            ),
        },
    ];

    return (
        <>
            <Toast toast={toast} onClose={hideToast} />

            <Toolbar
                search={{ value: search, onChange: setSearch }}
                actions={[{ label: '+ New User', onClick: openCreateModal }]}
            />

            <div className="bg-white rounded-lg shadow">
                <DataTable
                    columns={columns}
                    data={filteredUsers}
                    loading={loading}
                    emptyMessage="No users found"
                />
            </div>

            {isModalOpen && (
                <Modal
                    title={editingUser ? 'Edit User' : 'Add User'}
                    subtitle={editingUser ? 'Update user details below.' : 'Create a new user account.'}
                    error={modalError}
                    onClose={closeModal}
                    onSubmit={handleSubmit}
                    submitting={submitting}
                    submitLabel={editingUser ? 'Save Changes' : 'Create User'}
                >
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
                        <input
                            name="name"
                            value={form.name}
                            onChange={handleChange}
                            placeholder="e.g. Sita Sharma"
                            className={`w-full px-4 py-2.5 rounded-lg border ${fieldErrors.name ? 'border-red-400' : 'border-gray-200'} bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition`}
                        />
                        {fieldErrors.name && <p className="mt-1 text-xs text-red-500">{fieldErrors.name}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                        <input
                            name="email"
                            type="email"
                            value={form.email}
                            onChange={handleChange}
                            placeholder="name@company.com"
                            className={`w-full px-4 py-2.5 rounded-lg border ${fieldErrors.email ? 'border-red-400' : 'border-gray-200'} bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition`}
                        />
                        {fieldErrors.email && <p className="mt-1 text-xs text-red-500">{fieldErrors.email}</p>}
                    </div>

                    {!editingUser && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                            <input
                                name="password"
                                type="password"
                                value={form.password}
                                onChange={handleChange}
                                placeholder="At least 8 characters"
                                className={`w-full px-4 py-2.5 rounded-lg border ${fieldErrors.password ? 'border-red-400' : 'border-gray-200'} bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition`}
                            />
                            {fieldErrors.password ? (
                                <p className="mt-1 text-xs text-red-500">{fieldErrors.password}</p>
                            ) : (
                                <p className="text-xs text-gray-400 mt-1">
                                    At least 8 characters, with uppercase, lowercase, a number, and a special character.
                                </p>
                            )}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
                        <select
                            name="role"
                            value={form.role}
                            onChange={handleChange}
                            disabled={editingUser?.id === currentUser?.id}
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            <option value="admin">Admin</option>
                            <option value="accountant">Accountant</option>
                            <option value="user">User</option>
                        </select>
                        {editingUser?.id === currentUser?.id && (
                            <p className="text-xs text-gray-400 mt-1">You cannot change your own role.</p>
                        )}
                    </div>
                </Modal>
            )}
        </>
    );
}