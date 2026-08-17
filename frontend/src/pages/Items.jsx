import { useEffect, useState } from "react";
import { Search, SquarePen, Trash2 } from "lucide-react";
import Toolbar from "../components/Toolbar";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import api from "../api/axios";
import Toast from "../components/Toast";
import useToast from "../hooks/useToast";
import { validateItemName, validateUnit, validateHsnSac, validatePrice, filterItemNameInput, filterUnitInput, filterDigitsOnly, filterDecimalInput } from "../utils/validators";
import { useAuth } from "../context/AuthContext";
import { can } from "../permissions";

const emptyForm = {
    name: '',
    unit: '',
    hsn_sac_code: '',
    selling_price: '',
    purchase_rate: '',
    tax_type: 'VAT13',
}

export default function Items() {
    const { role } = useAuth();
    const canDelete = can(role, "canDelete");
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('All');
    const [search, setSearch] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState('selling');
    const [editingItem, setEditingItem] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [fieldErrors, setFieldErrors] = useState({});
    const [modalError, setModalError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const { toast, showToast, hideToast } = useToast();

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

    const openCreateModal = (type) => {
        setModalType(type);
        setEditingItem(null);
        setForm(emptyForm);
        setModalError('');
        setFieldErrors({});
        setIsModalOpen(true);
    };

    const openEditModal = (item) => {
        const inferredType = 
            Number(item.purchase_rate) > 0 && Number(item.selling_price) === 0
                ? 'purchase'
                : 'selling';
        setModalType(inferredType);
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
        setFieldErrors({});
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingItem(null);
        setForm(emptyForm);
        setModalError('');
        setFieldErrors({});
    };


    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;

        let nextValue = value;
        if (type === 'checkbox') {
            nextValue = checked;
        } else if (name === 'name') {
            nextValue = filterItemNameInput(value);
        } else if (name === 'unit') {
            nextValue = filterUnitInput(value);
        } else if (name === 'hsn_sac_code') {
            nextValue = filterDigitsOnly(value, 20);
        } else if (name === 'selling_price' || name === 'purchase_rate') {
            nextValue = filterDecimalInput(value);
        }
        
        setForm((prev) => ({
            ...prev,
            [name]: nextValue,
        }));

        if (fieldErrors[name]) {
            setFieldErrors((prev) => ({ ...prev, [name]: '' }));
        }
    };

    const validateForm = () => {
        const errors = {
            name: validateItemName(form.name),
            unit: validateUnit(form.unit),
            hsn_sac_code: validateHsnSac(form.hsn_sac_code),
            // selling_price: validatePrice(form.selling_price, { label: "Selling price" }),
            // purchase_rate: validatePrice(form.purchase_rate, { label: "Purchase rate" }),
        };
        if (modalType === 'selling') {
            errors.selling_price = validatePrice(form.selling_price, { label: "Selling price" });
        } else {
            errors.purchase_rate = validatePrice(form.purchase_rate, { label: "Purchase rate" });
        }
        Object.keys(errors).forEach((key) => { if (!errors[key]) delete errors[key]; });
        return errors;
    }

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
    
        const sellingPrice = modalType === 'selling'
            ? form.selling_price
            : (editingItem ? form.selling_price : '0');
        const purchaseRate = modalType === 'purchase'
            ? form.purchase_rate
            : (editingItem ? form.purchase_rate : '0');

        try {
            if (editingItem) {
                await api.put('/items/update.php', {
                    id: editingItem.id,
                    name: form.name,
                    unit: form.unit,
                    hsn_sac_code: form.hsn_sac_code,
                    selling_price: sellingPrice,
                    purchase_rate: purchaseRate,
                    tax_type: form.tax_type,
                });
                showToast("Item updated successfully.");
            } else {
                await api.post('/items/create.php', {
                    name: form.name,
                    unit: form.unit,
                    hsn_sac_code: form.hsn_sac_code,
                    selling_price: sellingPrice,
                    purchase_rate: purchaseRate,
                    tax_type: form.tax_type,
                });
                showToast("Item created successfully.");
            }
            closeModal();
            fetchItems();
        } catch (err) {
            const message = err.response?.data?.message ?? 'Something went wrong. Please try again.'
            setModalError(message);
            showToast(message, "error")
        } finally {
            setSubmitting(false);
        }
    };
    
    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this item?')) return;
    
        try {
            await api.delete('/items/delete.php', { data: { id } });
            showToast("Item deleted successfully.");
            fetchItems();
        } catch (err) {
            showToast(err.response?.data?.message ?? 'Failed to delete item.');
        }
    };

    const filteredItems = items.filter((item) => {
        const term = search.toLowerCase();

        return item.name.toLowerCase().includes(term);
    });

    const columns = [
        { key: "name", header: "Name", },
        { key: "unit", header: "Unit", },
        { key: "hsn_sac_code", header: "HSN/SAC", },
        { key: "selling_price", header: "Selling Price", },
        { key: "purchase_rate", header: "Purchase Rate", },
        { key: "tax_type", header: "Tax", },
        { key: "actions", header: "Action", render: (contact) => (
            <div className="flex items-center gap-2">
                <button
                    onClick={() => openEditModal(contact)}
                    className="p-2 rounded-md text-slate-600 hover:bg-slate-100"
                >
                    <SquarePen size={16} />
                </button>

                {canDelete && (
                    <button
                        onClick={() => handleDelete(contact.id)}
                        className="p-2 rounded-md text-slate-600 hover:bg-slate-100"
                    >
                        <Trash2 size={16} />
                    </button>
                )}
            </div>
        ) },
    ];

    const modalTitle = editingItem
        ? 'Edit Item'
        : (modalType === 'selling' ? 'Add Selling Item' : 'Add Purchase Item');

    return (
        <>
            <Toast toast={toast} onClose={hideToast} />

            <Toolbar
                search={{ value: search, onChange: setSearch }}
                actions={[
                    { label: '+ Selling Item', onClick: () => openCreateModal('selling') },
                    { label: '+ Purchase Item', onClick: () => openCreateModal('purchase') },
                ]}
            />

            <div className="bg-white rounded-lg shadow">
                <DataTable
                    columns={columns}
                    data={filteredItems}
                    loading={loading}
                    emptyMessage="No items found"
                />
            </div>

            {/* Modal */}
            {isModalOpen && (
                <Modal
                    title={modalTitle}
                    subtitle={editingItem ? 'Update item details below.' : 'Enter the item details below.'}
                    error={modalError}
                    onClose={closeModal}
                    onSubmit={handleSubmit}
                    submitting={submitting}
                    submitLabel={editingItem ? 'Save Changes' : 'Create Item'}
                >
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
                        <input
                            name="name"
                            value={form.name}
                            onChange={handleChange}
                            placeholder="e.g. Web Development Item"
                            className={`w-full px-4 py-2.5 rounded-lg border ${fieldErrors.name ? 'border-red-400' : 'border-gray-200'} bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition`}
                        />
                        {fieldErrors.name && <p className="mt-1 text-xs text-red-500">{fieldErrors.name}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Unit</label>
                            <input
                                name="unit"
                                value={form.unit}
                                onChange={handleChange}
                                placeholder="hrs, kg..."
                                className={`w-full px-4 py-2.5 rounded-lg border ${fieldErrors.unit ? 'border-red-400' : 'border-gray-200'} bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition`}
                            />
                            {fieldErrors.unit && <p className="mt-1 text-xs text-red-500">{fieldErrors.unit}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">HSN/SAC Code</label>
                            <input
                                name="hsn_sac_code"
                                value={form.hsn_sac_code}
                                onChange={handleChange}
                                placeholder="1234"
                                maxLength={20}
                                className={`w-full px-4 py-2.5 rounded-lg border ${fieldErrors.hsn_sac_code ? 'border-red-400' : 'border-gray-200'} bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition`}
                            />
                            {fieldErrors.hsn_sac_code && <p className="mt-1 text-xs text-red-500">{fieldErrors.hsn_sac_code}</p>}
                        </div>
                    </div>

                    {/* <div className="grid grid-cols-2 gap-4"> */}
                    {modalType === 'selling' ? (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Selling Price</label>
                            <input
                                name="selling_price"
                                type="text"
                                inputMode="decimal"
                                value={form.selling_price}
                                onChange={handleChange}
                                placeholder="0.00"
                                className={`w-full px-4 py-2.5 rounded-lg border ${fieldErrors.selling_price ? 'border-red-400' : 'border-gray-200'} bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition`}
                            />
                            {fieldErrors.selling_price && <p className="mt-1 text-xs text-red-500">{fieldErrors.selling_price}</p>}
                        </div>
                    ) : (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Purchase Rate</label>
                            <input
                                name="purchase_rate"
                                type="text"
                                inputMode="decimal"
                                value={form.purchase_rate}
                                onChange={handleChange}
                                placeholder="0.00"
                                className={`w-full px-4 py-2.5 rounded-lg border ${fieldErrors.purchase_rate ? 'border-red-400' : 'border-gray-200'} bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition`}
                            />
                            {fieldErrors.purchase_rate && <p className="mt-1 text-xs text-red-500">{fieldErrors.purchase_rate}</p>}
                        </div>
                    )}

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
                </Modal>
            )}
        </>
    );
}