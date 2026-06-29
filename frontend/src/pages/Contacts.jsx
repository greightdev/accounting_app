import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, SquarePen, Trash2 } from "lucide-react";
import api from "../api/axios"; 

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
    const [filter, setFilter] = useState('All');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingContact, setEditingContact] = useState(null);
    const [form, setForm] = useState(emptyForm)
    const [modalError, setModalError] = useState('')
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        fetchContacts();
    }, [filter]);

    const fetchContacts = async () => {
        setLoading(true);
        try {
            const query = filter !== 'All' ? `?type=${filter}` : '';
            const { data } = await api.get(`/contacts/list.php${query}`);
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


    const handleChange = () => {
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
            }
            closeModal();
            fetchContacts();
        } catch (err) {
            setModalError(err.response?.data?.message ?? 'Something went wrong. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };
    
    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this contact?')) return;
    
        try {
            await api.delete('/contacts/delete.php', { data: { id } });
            fetchContacts();
        } catch (err) {
            alert(err.response?.data?.message ?? 'Failed to delete contact.');
        }
    };

    return (
        <>                
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-6">
                    {/* Search box */}
                    <div className="relative w-64">
                        <Search
                            size={18}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        />

                        <input
                            type="text"
                            placeholder="Search contacts..."
                            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                        />
                    </div>

                    {/* Filter */}
                    <div className="flex gap-2">
                        {['All', 'Customer', 'Vendor', 'Employee'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setFilter(tab)}
                                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition ${
                                filter === tab
                                    ? 'bg-slate-700 text-white'
                                    : 'bg-white text-slate-600 border-b border-slate-100 hover:bg-slate-100 tramsition-colors'
                                }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>


                {/* New Contact */}
                <button
                    onClick={openCreateModal}
                    className="px-5 py-2.5 rounded-lg bg-slate-700 text-white text-sm font-semibold shadow-sm hover:bg-slate-800 hover:shadow transition-all"
                >
                    + Add Contact
                </button>
            </div>

            <table className="w-full overflow-hidden rounded-xl bg-white shadow-sm">
                <thead>
                    <tr className="bg-slate-700 text-white">
                        <th className="px-4 py-3 text-left font-semibold">Name</th>
                        <th className="px-4 py-3 text-left font-semibold">Email</th>
                        <th className="px-4 py-3 text-left font-semibold">Phone</th>
                        <th className="px-4 py-3 text-left font-semibold">Type</th>
                        <th className="px-4 py-3 text-left font-semibold">Action</th>
                    </tr>
                </thead>

                <tbody>
                    {contacts.map((contact, index) => (
                        <tr
                            key={contact.id}
                            className={`
                                ${index % 2 === 0 ? "bg-white" : "bg-slate-50"}
                                border-b border-slate-100
                                hover:bg-slate-100 transition-colors
                            `}
                        >
                            <td className="px-4 py-3">{contact.name}</td>
                            <td className="px-4 py-3">{contact.email}</td>
                            <td className="px-4 py-3">{contact.phone}</td>
                            <td className="px-4 py-3 capitalize">
                                {contact.type}
                            </td>
                            <td className="px-4 py-3 flex items-center gap-2">
                                <button
                                    onClick={() => openEditModal(contact)}
                                    className="p-2 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                                >
                                    <SquarePen size={16} />
                                </button>
                                <button
                                    onClick={() => handleDelete(contact.id)}
                                    className="p-2 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-7">
                        <h2 className="text-lg font-semibold text-gray-900 mb-1">
                            {editingContact ? 'Edit Contact' : 'Add Contact'}
                        </h2>
                        <p className="text-sm text-gray-500 mb-6">
                            {editingContact ? 'Update contact details below.' : 'Enter the contact details below.'}
                        </p>

                        {modalError && (
                            <div className="mb-5 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                                {modalError}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
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
                                <span className="text-sm text-gray-700">This contact deducts TDS on payments to us</span>
                            </label>

                            {/* Opening balance — only settable on create, locked when editing
                            {!editingContact && (
                                <div className="pt-2 border-t border-gray-100">
                                    <p className="text-xs font-medium text-gray-500 mb-3 mt-4">Opening Balance (optional)</p>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount</label>
                                            <input
                                                name="opening_balance"
                                                type="number"
                                                min="0"
                                                value={form.opening_balance}
                                                onChange={handleChange}
                                                placeholder="0.00"
                                                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
                                            <select
                                                name="opening_balance_type"
                                                value={form.opening_balance_type}
                                                onChange={handleChange}
                                                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition"
                                            >
                                                <option value="DEBIT">Debit</option>
                                                <option value="CREDIT">Credit</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
                                            <input
                                                name="opening_date"
                                                type="date"
                                                value={form.opening_date}
                                                onChange={handleChange}
                                                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )} */}

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
                                        ) : editingContact ? 'Save Changes' : 'Create Contact'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}        
        </>
    );
}