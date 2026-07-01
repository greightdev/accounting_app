import { useEffect, useState } from "react";
import { Search, SquarePen, Trash2 } from "lucide-react";
import Toolbar from "../components/Toolbar";
import api from "../api/axios";

const emptyForm = {
    name: '',
    unit: '',
    hsn_sac_code: '',
    selling_price: '',
    purchase_rate: '',
    taxType: 'VAT13',
}

const ITEMS_TAB = [
    { key: 'items', label: 'Items' },
    { key: 'units', label: 'Units' },
];

export default function Items() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('All');
    const [search, setSearch] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [form, setForm] = useState(emptyForm)
    const [modalError, setModalError] = useState('')
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        fetchItems();
    }, [filter]);

    const fetchItems = async () => {
        setLoading(true);
        try {
            const query = filter !== 'All' ? `?type=${filter}` : '';
            const { data } = await api.get(`/items/list.php${query}`);
            setItems(data.data ?? []);
        } catch (err) {
            console.error('Failed to fetch items: ', err);
        } finally {
            setLoading(false);
        }
    };

    const openCreateModal = () => {
        setEditingItem(null);
        setForm(emptyForm);
        setModalError('');
        setIsModalOpen(true);
    };

    const openEditModal = (item) => {
        setEditingItem(item);
        setForm({
            name: item.name,
            unit: item.unit,
            hsn_sac_code: item.hsn_sac_code,
            selling_price: item.selling_price,
            purchase_rate: item.purchase_rate,
            tax_type: item.tax_type,
        });
        setModalError('');
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingItem(null);
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
            if (editingItem) {
                await api.put('/items/update.php', {
                    id: editingItem.id,
                    name: form.name,
                    unit: form.unit,
                    hsn_sac_code: form.hsn_sac_code,
                    selling_price: form.selling_price,
                    purchase_rate: form.purchase_rate,
                    tax_type: form.tax_type,
                });
            } else {
                await api.post('/items/create.php', {
                    name: form.name,
                    unit: form.unit,
                    hsn_sac_code: form.hsn_sac_code,
                    selling_price: form.selling_price,
                    purchase_rate: form.purchase_rate,
                    tax_type: form.tax_type,
                });
            }
            closeModal();
            fetchItems();
        } catch (err) {
            setModalError(err.response?.data?.message ?? 'Something went wrong. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };
    
    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this item?')) return;
    
        try {
            await api.delete('/items/delete.php', { data: { id } });
            fetchItems();
        } catch (err) {
            alert(err.response?.data?.message ?? 'Failed to delete item.');
        }
    };

    const filteredItems = items.filter((item) => {
        const term = search.toLowerCase();

        return (
            item.name.toLowerCase().includes(term)
        );
    });

    return (
        <>
            <Toolbar
                search={{ value: search, onChange: setSearch }}
                actions={[{ label: '+ New Item', onClick: openCreateModal }]}
            />

            <table className="w-full overflow-hidden rounded-xl bg-white shadow-sm">
                <thead>
                    <tr className="bg-slate-700 text-white">
                        <th className="px-4 py-3 text-left font-semibold">Name</th>
                        <th className="px-4 py-3 text-left font-semibold">Unit</th>
                        <th className="px-4 py-3 text-left font-semibold">HSN/SAC</th>
                        <th className="px-4 py-3 text-left font-semibold">Selling Price</th>
                        <th className="px-4 py-3 text-left font-semibold">Purchase Rate</th>
                        <th className="px-4 py-3 text-left font-semibold">Tax</th>
                        <th className="px-4 py-3 text-left font-semibold">Action</th>
                    </tr>
                </thead>

                <tbody>
                    {filteredItems.map((item, index) => (
                        <tr
                            key={item.id}
                            className={`
                                ${index % 2 === 0 ? "bg-white" : "bg-slate-50"}
                                border-b border-slate-100
                                hover:bg-slate-100 transition-colors
                            `}
                        >
                            <td className="px-4 py-3">{item.name}</td>
                            <td className="px-4 py-3">{item.unit}</td>
                            <td className="px-4 py-3">{item.hsn_sac_code}</td>
                            <td className="px-4 py-3">{item.selling_price}</td>
                            <td className="px-4 py-3">{item.purchase_rate}</td>
                            <td className="px-4 py-3">{item.tax_type}</td>
                            <td className="px-4 py-3 flex items-center gap-2">
                                <button
                                    onClick={() => openEditModal(item)}
                                    className="p-2 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                                >
                                    <SquarePen size={16} />
                                </button>
                                <button
                                    onClick={() => handleDelete(item.id)}
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
                            {editingItem ? 'Edit Item' : 'Add Item'}
                        </h2>
                        <p className="text-sm text-gray-500 mb-6">
                            {editingItem ? 'Update item details below.' : 'Enter the item details below.'}
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
                                    placeholder="e.g. Web Development Item"
                                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Unit</label>
                                    <input
                                        name="unit"
                                        value={form.unit}
                                        onChange={handleChange}
                                        placeholder="hrs, kg..."
                                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">HSN/SAC Code</label>
                                    <input
                                        name="hsn_sac_code"
                                        value={form.hsn_sac_code}
                                        onChange={handleChange}
                                        placeholder="1234"
                                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Selling Price</label>
                                    <input
                                        name="selling_price"
                                        type="number"
                                        min="0"
                                        value={form.selling_price}
                                        onChange={handleChange}
                                        placeholder="0.00"
                                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Purchase Rate</label>
                                    <input
                                        name="purchase_rate"
                                        type="number"
                                        min="0"
                                        value={form.purchase_rate}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tax Type</label>
                                <select
                                    name="tax_type"
                                    value={form.tax_type}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition"
                                >
                                    <option value="">Select</option>
                                    <option value="VAT13">VAT 13%</option>
                                    <option value="Exempt">Exempt</option>
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
                                    className="flex-1 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-black transition disabled:opacity-60 flex items-center justify-center"
                                >
                                    {submitting ? (
                                        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                        ) : editingItem ? 'Save Changes' : 'Create Item'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}