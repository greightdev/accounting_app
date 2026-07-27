import { useEffect, useState } from "react";
import { Search, SquarePen, Trash2 } from "lucide-react";
import api from "../api/axios"; 
import Toolbar from "../components/Toolbar";
import Tabs from "../components/Tabs";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import Toast from "../components/Toast";
import useToast from "../hooks/useToast";

const DEFAULT_TABS = [
    { key: 'All', label: 'All' },
    { key: 'Customer', label: 'Customer' },
    { key: 'Vendor', label: 'Vendor' },
    { key: 'Employee', label: 'Employee' },
];

const emptyForm = {
    name: '',
    type: '',
    pan: '',
    phone: '',
    email: '',
    address: '',
    tds_deducted: false,
}

export default function Contacts() {
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [tab, setTab] = useState('All')

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingContact, setEditingContact] = useState(null);
    const [form, setForm] = useState(emptyForm)
    const [modalError, setModalError] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const { toast, showToast, hideToast } = useToast();

    useEffect(() => {
        fetchContacts();
    }, [tab]);

    const fetchContacts = async () => {
        setLoading(true);
        try {
            const { data } = await api.get(`/contacts/list.php?type=${tab}`);
            setContacts(data.data ?? []);
        } catch (err) {
            console.error('Failed to fetch contacts: ', err);
        } finally {
            setLoading(false);
        }
    };

    const openCreateModal = () => {
        setEditingContact(null);
        setForm(emptyForm);
        setModalError('');
        setIsModalOpen(true);
    };

    const filtered = contacts.filter((contact) => {
        const term = search.toLowerCase();
        return (
            contact.name.toLowerCase().includes(term) ||
            (contact.email ?? "").toLowerCase().includes(term) ||
            (contact.phone ?? "").toLowerCase().includes(term) ||
            (contact.type ?? "").toLowerCase().includes(term)
        );
    });

    const openEditModal = (contact) => {
        setEditingContact(contact);
        setForm({
            name: contact.name,
            type: contact.type,
            pan: contact.pan ?? '',
            phone: contact.phone ?? '',
            email: contact.email ?? '',
            address: contact.address ?? '',
            tds_deducted: contact.tds_deducted,
        });
        setModalError('');
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingContact(null);
        setForm(emptyForm);
        setModalError('');
    };


    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setModalError('');
        setSubmitting(true);
    
        try {
            if (editingContact) {
                await api.put('/contacts/update.php', {
                    id: editingContact.id,
                    name: form.name,
                    type: form.type,
                    pan: form.pan,
                    phone: form.phone,
                    email: form.email,
                    address: form.address,
                    tds_deducted: form.tds_deducted,
                });

                showToast("Contact updated successfully.");
            } else {
                await api.post('/contacts/create.php', {
                    name: form.name,
                    type: form.type,
                    pan: form.pan,
                    phone: form.phone,
                    email: form.email,
                    address: form.address,
                    tds_deducted: form.tds_deducted,
                });

                showToast("Contact added successfully.");
            }
            closeModal();
            fetchContacts();
        } catch (err) {
            const message = err.response?.data?.message ?? 'Something went wrong. Please try again.';
            setModalError(message);
            showToast(message, "error");
        } finally {
            setSubmitting(false);
        }
    };
    
    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this contact?')) return;
    
        try {
            await api.delete('/contacts/delete.php', { data: { id } });
            showToast("Contact deleted successfully");
            fetchContacts();
        } catch (err) {
            showToast(err.response?.data?.message ?? 'Failed to delete contact.');
        }
    };

    const columns = [
        { key: "name", header: "Name", },
        { key: "email", header: "Email", },
        { key: "phone", header: "Phone", },
        { key: "type", header: "Type", },
        { key: "actions", header: "Action", render: (contact) => (
            <div className="flex items-center gap-2">
                <button
                    onClick={() => openEditModal(contact)}
                    className="p-2 rounded-md text-slate-600 hover:bg-slate-100"
                >
                    <SquarePen size={16} />
                </button>

                <button
                    onClick={() => handleDelete(contact.id)}
                    className="p-2 rounded-md text-slate-600 hover:bg-slate-100"
                >
                    <Trash2 size={16} />
                </button>
            </div>
        ) },
    ];

    return (
        <>
            <Toast toast={toast} onClose={hideToast} />

            <Toolbar
                search={{ value: search, onChange: setSearch }}
                // filters={{ options: ['All', 'Customer', 'Vendor', 'Employee'], active: filter, onChange: setFilter }}
                actions={[{ label: '+ New Contact', onClick: openCreateModal }]}
            />

            <Tabs tabs={DEFAULT_TABS} active={tab} onChange={setTab} />

            <div className="bg-white rounded-lg shadow">
                <DataTable
                    columns={columns}
                    data={filtered}
                    loading={loading}
                    emptyMessage="No contacts found"
                />
            </div>

            {/* Modal */}
            {isModalOpen && (
                <Modal
                    title={editingContact ? 'Edit Contact' : 'Add Contact'}
                    subtitle={editingContact ? 'Update contact details below.' : 'Enter the contact details below.'}
                    error={modalError}
                    onClose={closeModal}
                    onSubmit={handleSubmit}
                    submitting={submitting}
                    submitLabel={editingContact ? 'Save Changes' : 'Create Contact'}
                >
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
                        <input
                            name="name"
                            value={form.name}
                            onChange={handleChange}
                            placeholder="e.g. Kathmandu Traders Pvt. Ltd."
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
                            <select
                                name="type"
                                value={form.type}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition"
                            >
                                <option value="">Select</option>
                                <option value="Customer">Customer</option>
                                <option value="Vendor">Vendor</option>
                                <option value="Employee">Employee</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">PAN</label>
                            <input
                                name="pan"
                                value={form.pan}
                                onChange={handleChange}
                                placeholder="123456789"
                                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                            <input
                                name="phone"
                                value={form.phone}
                                onChange={handleChange}
                                placeholder="98XXXXXXXX"
                                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                            <input
                                name="email"
                                type="email"
                                value={form.email}
                                onChange={handleChange}
                                placeholder="contact@example.com"
                                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Address</label>
                        <input
                            name="address"
                            value={form.address}
                            onChange={handleChange}
                            placeholder="Kathmandu, Nepal"
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition"
                        />
                    </div>

                    <label className="flex items-center gap-2.5 py-1">
                        <input
                            type="checkbox"
                            name="tds_deducted"
                            checked={form.tds_deducted}
                            onChange={handleChange}
                            className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-300"
                        />
                        <span className="text-sm text-gray-700">TDS deducted</span>
                    </label>
                </Modal>
            )}        
        </>
    );
}