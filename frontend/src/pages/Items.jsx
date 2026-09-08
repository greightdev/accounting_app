import { useEffect, useRef, useState } from "react";
import { Search, SquarePen, Trash2, ChevronDown, Plus } from "lucide-react";
import Toolbar from "../components/Toolbar";
import Tabs from "../components/Tabs";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import api from "../api/axios";
import Toast from "../components/Toast";
import useToast from "../hooks/useToast";
import { validateItemName, validateUnit, validateHsnSac, validatePrice, validateRequiredSelect, validateGenericName, filterItemNameInput, filterUnitInput, filterDigitsOnly, filterDecimalInput } from "../utils/validators";
import { useAuth } from "../context/AuthContext";
import { can } from "../permissions";

const DEFAULT_TABS = [
    { key: "All", label: "All" },
    { key: "Selling", label: "Selling" },
    { key: "Purchase", label: "Purchase" },
    { key: "Units", label: "Units" },
];

// Custom dropdown for picking an item's unit
function UnitPicker({ units, value, onChange, onAddNew, error }) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(e) {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedUnit = units.find((u) => u.symbol === value);
    const displayUnits = value && !selectedUnit
        ? [{ id: "current-inactive", symbol: value, name: "no longer active" }, ...units]
        : units;

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg border ${error ? 'border-red-400' : 'border-gray-200'} bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition`}
            >
                <span className={value ? "" : "text-gray-400"}>
                    {value ? (selectedUnit ? `${selectedUnit.symbol} - ${selectedUnit.name}` : `${value} (no longer active)`) : "Select unit"}
                </span>
                <ChevronDown size={16} className="text-gray-400 shrink-0" />
            </button>

            {open && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
                    {/* Pinned row */}
                    <button
                        type="button"
                        onClick={() => { setOpen(false); onAddNew(); }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 border-b border-gray-100"
                    >
                        <Plus size={14} /> Add New Unit
                    </button>
                    <div className="max-h-48 overflow-y-auto">
                        {displayUnits.length === 0 ? (
                            <p className="px-4 py-3 text-sm text-gray-400">No units yet</p>
                        ) : (
                            displayUnits.map((u) => (
                                <button
                                    key={u.id}
                                    type="button"
                                    onClick={() => { onChange(u.symbol); setOpen(false); }}
                                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition ${u.symbol === value ? 'bg-slate-50 font-medium text-slate-900' : 'text-gray-700'}`}
                                >
                                    {u.symbol} <span className="text-gray-400">- {u.name}</span>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

const emptyForm = {
    name: '',
    unit: '',
    hsn_sac_code: '',
    selling_price: '',
    purchase_rate: '',
    tax_type: 'VAT13',
    vendor_id: '',
    account_id: '',
}

export default function Items() {
    const { role } = useAuth();
    const canDelete = can(role, "canDelete");
    const [items, setItems] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [units, setUnits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [tab, setTab] = useState("All");

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState('selling'); // 'selling' | 'purchase'
    const [editingItem, setEditingItem] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [fieldErrors, setFieldErrors] = useState({});
    const [modalError, setModalError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const { toast, showToast, hideToast } = useToast();

    useEffect(() => {
        if (tab === 'Units') return;
        fetchItems();
    }, [tab]);

    useEffect(() => {
        fetchVendors();
        fetchAccounts();
        fetchUnits();
    }, []);

    const fetchUnits = async () => {
        try {
            const { data } = await api.get('/units/list.php');
            setUnits(data.data ?? []);
        } catch (err) {
            console.error('Failed to fetch units: ', err);
        }
    };

    // Units tab
    const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
    const [editingUnit, setEditingUnit] = useState(null);
    const [unitSymbol, setUnitSymbol] = useState('');
    const [unitFullName, setUnitFullName] = useState('');
    const [unitDescription, setUnitDescription] = useState('');
    const [unitModalError, setUnitModalError] = useState('');
    const [unitSubmitting, setUnitSubmitting] = useState(false);
    const [unitModalReturnsToItemForm, setUnitModalReturnsToItemForm] = useState(false);

    const openCreateUnitModal = (fromItemForm = false) => {
        setEditingUnit(null);
        setUnitSymbol('');
        setUnitFullName('');
        setUnitDescription('');
        setUnitModalError('');
        setUnitModalReturnsToItemForm(fromItemForm);
        setIsUnitModalOpen(true);
    };

    const openEditUnitModal = (unit) => {
        setEditingUnit(unit);
        setUnitSymbol(unit.symbol);
        setUnitFullName(unit.name);
        setUnitDescription(unit.description ?? '');
        setUnitModalError('');
        setUnitModalReturnsToItemForm(false);
        setIsUnitModalOpen(true);
    };

    const closeUnitModal = () => setIsUnitModalOpen(false);

    const handleUnitSubmit = async (e) => {
        e.preventDefault();
        const symbolError = validateUnit(unitSymbol, { required: true });
        const nameError = validateGenericName(unitFullName, { label: "Name" });
        if (symbolError || nameError) {
            setUnitModalError(symbolError || nameError);
            return;
        }

        setUnitSubmitting(true);
        try {
            const payload = { symbol: unitSymbol, name: unitFullName, description: unitDescription };
            if (editingUnit) {
                await api.put('/units/update.php', { id: editingUnit.id, ...payload });
                showToast("Unit updated successfully.");
            } else {
                await api.post('/units/create.php', payload);
                showToast("Unit created successfully.");
            }
            closeUnitModal();
            await fetchUnits();
            if (unitModalReturnsToItemForm && !editingUnit) {
                setForm((prev) => ({ ...prev, unit: unitSymbol }));
            }
        } catch (err) {
            setUnitModalError(err.response?.data?.message ?? "Something went wrong.");
        } finally {
            setUnitSubmitting(false);
        }
    };

    const handleUnitDelete = async (unit) => {
        if (!window.confirm(`Delete unit "${unit.symbol}"? Items that already use this unit won't be affected.`)) return;
        try {
            await api.delete('/units/delete.php', { data: { id: unit.id } });
            showToast("Unit deleted successfully.");
            fetchUnits();
        } catch (err) {
            showToast(err.response?.data?.message ?? "Failed to delete unit.");
        }
    };

    const filteredUnits = units
        .filter((u) => u.symbol.toLowerCase().includes(search.toLowerCase()) || u.name.toLowerCase().includes(search.toLowerCase()))
        .map((u, index) => ({ ...u, sn: index + 1 }));

    const unitColumns = [
        { key: "sn", header: "S.N." },
        { key: "symbol", header: "Unit" },
        { key: "name", header: "Name" },
        { key: "description", header: "Description", render: (unit) => unit.description || <span className="text-gray-300">-</span> },
        { key: "actions", header: "Action", align: "right", render: (unit) => (
            <div className="flex items-center justify-end gap-2">
                <button onClick={() => openEditUnitModal(unit)} className="p-2 rounded-md text-slate-600 hover:bg-slate-100">
                    <SquarePen size={16} />
                </button>
                {canDelete && (
                    <button onClick={() => handleUnitDelete(unit)} className="p-2 rounded-md text-slate-600 hover:bg-slate-100">
                        <Trash2 size={16} />
                    </button>
                )}
            </div>
        ) },
    ];

    const fetchAccounts = async () => {
        try {
            const { data } = await api.get('/accounts/list.php');
            setAccounts(data.data ?? []);
        } catch (err) {
            console.error('Failed to fetch accounts: ', err);
        }
    };

    const filterToType = { All: '', Selling: 'SELLING', Purchase: 'PURCHASE' };

    const accountOptionsForType = accounts.filter((a) =>
        modalType === 'selling' ? a.account_group_type === 'Income' : ['Expense', 'Asset'].includes(a.account_group_type)
    );

    // Previously used HSN/SAC codes offered as autocomplete suggestions
    const knownHsnSacCodes = [...new Set(items.map((i) => i.hsn_sac_code).filter(Boolean))].sort();

    const fetchItems = async () => {
        setLoading(true);
        try {
            const typeParam = filterToType[tab];
            const query = typeParam ? `?type=${typeParam}` : '';
            const { data } = await api.get(`/items/list.php${query}`);
            setItems(data.data ?? []);
        } catch (err) {
            console.error('Failed to fetch items: ', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchVendors = async () => {
        try {
            const { data } = await api.get('/contacts/list.php?type=Vendor');
            setVendors(data.data ?? []);
        } catch (err) {
            console.error('Failed to fetch vendors: ', err);
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
        const inferredType = item.type === 'PURCHASE' ? 'purchase' : 'selling';
        setModalType(inferredType);
        setEditingItem(item);
        setForm({
            name: item.name,
            unit: item.unit,
            hsn_sac_code: item.hsn_sac_code,
            selling_price: item.selling_price,
            purchase_rate: item.purchase_rate,
            tax_type: item.tax_type,
            vendor_id: item.vendor_id ? String(item.vendor_id) : '',
            account_id: item.account_id ? String(item.account_id) : '',
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
            account_id: validateRequiredSelect(form.account_id, { label: "Account" }),
        };
        if (modalType === 'selling') {
            errors.selling_price = validatePrice(form.selling_price, { label: "Selling price" });
            if (!errors.selling_price && Number(form.selling_price) <= 0) {
                errors.selling_price = "Selling price must be greater than zero.";
            }
        } else {
            errors.purchase_rate = validatePrice(form.purchase_rate, { label: "Purchase rate" });
            if (!errors.purchase_rate && Number(form.purchase_rate) <= 0) {
                errors.purchase_rate = "Purchase rate must be greater than zero.";
            }
            errors.vendor_id = validateRequiredSelect(form.vendor_id, { label: "Vendor" });
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

        const itemType = modalType === 'selling' ? 'SELLING' : 'PURCHASE';
        const sellingPrice = modalType === 'selling'
            ? form.selling_price
            : (editingItem ? form.selling_price : '0');
        const purchaseRate = modalType === 'purchase'
            ? form.purchase_rate
            : (editingItem ? form.purchase_rate : '0');
        const vendorId = modalType === 'purchase' ? form.vendor_id : null;

        try {
            if (editingItem) {
                await api.put('/items/update.php', {
                    id: editingItem.id,
                    name: form.name,
                    type: itemType,
                    vendor_id: vendorId,
                    account_id: form.account_id,
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
                    type: itemType,
                    vendor_id: vendorId,
                    account_id: form.account_id,
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
        { key: "type", header: "Type",
            render: (item) => (
                <span
                    className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                        item.type === 'PURCHASE'
                            ? 'bg-amber-50 text-amber-600'
                            : 'bg-emerald-50 text-emerald-600'
                    }`}
                >
                    {item.type === 'PURCHASE' ? 'Purchase' : 'Selling'}
                </span>
            ),
        },
        { key: "vendor_name", header: "Vendor",
            render: (item) => item.vendor_name ?? <span className="text-gray-300">—</span>,
        },
        { key: "account_name", header: "Account",
            render: (item) => item.account_name
                ? <span className="text-xs text-gray-600">{item.account_code} — {item.account_name}</span>
                : <span className="text-gray-300">—</span>,
        },
        { key: "unit", header: "Unit", },
        { key: "hsn_sac_code", header: "HSN/SAC", },
        { key: "selling_price", header: "Selling Price",
            render: (item) => item.type === 'PURCHASE' ? <span className="text-gray-300">—</span> : item.selling_price,
        },
        { key: "purchase_rate", header: "Purchase Rate",
            render: (item) => item.type !== 'PURCHASE' ? <span className="text-gray-300">—</span> : item.purchase_rate,
        },
        { key: "tax_type", header: "Tax", },
        { key: "actions", header: "Action", render: (item) => (
            <div className="flex items-center gap-2">
                <button
                    onClick={() => openEditModal(item)}
                    className="p-2 rounded-md text-slate-600 hover:bg-slate-100"
                >
                    <SquarePen size={16} />
                </button>

                {canDelete && (
                    <button
                        onClick={() => handleDelete(item.id)}
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
                actions={
                    tab === 'Units'
                        ? [{ label: '+ Add Unit', onClick: openCreateUnitModal }]
                        : [
                            { label: '+ Selling Item', onClick: () => openCreateModal('selling') },
                            { label: '+ Purchase Item', onClick: () => openCreateModal('purchase') },
                        ]
                }
            />

            <Tabs tabs={DEFAULT_TABS} active={tab} onChange={setTab} />

            <div className="bg-white rounded-lg shadow">
                {tab === 'Units' ? (
                    <DataTable
                        columns={unitColumns}
                        data={filteredUnits}
                        loading={false}
                        emptyMessage="No units yet"
                    />
                ) : (
                    <DataTable
                        columns={columns}
                        data={filteredItems}
                        loading={loading}
                        emptyMessage="No items found"
                    />
                )}
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

                    {modalType === 'purchase' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Vendor</label>
                            <select
                                name="vendor_id"
                                value={form.vendor_id}
                                onChange={handleChange}
                                disabled={!!editingItem}
                                className={`w-full px-4 py-2.5 rounded-lg border ${fieldErrors.vendor_id ? 'border-red-400' : 'border-gray-200'} bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition ${editingItem ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                                <option value="">Select vendor</option>
                                {vendors.map((v) => (
                                    <option key={v.id} value={v.id}>{v.name}</option>
                                ))}
                            </select>
                            {fieldErrors.vendor_id && <p className="mt-1 text-xs text-red-500">{fieldErrors.vendor_id}</p>}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Account <span className="text-gray-400 font-normal">({modalType === 'selling' ? 'which income this posts to' : 'which expense/asset this posts to'})</span>
                        </label>
                        <select
                            name="account_id"
                            value={form.account_id}
                            onChange={handleChange}
                            className={`w-full px-4 py-2.5 rounded-lg border ${fieldErrors.account_id ? 'border-red-400' : 'border-gray-200'} bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition`}
                        >
                            <option value="">Select account</option>
                            {accountOptionsForType.map((a) => (
                                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                            ))}
                        </select>
                        {fieldErrors.account_id && <p className="mt-1 text-xs text-red-500">{fieldErrors.account_id}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Unit</label>
                            <UnitPicker
                                units={units}
                                value={form.unit}
                                onChange={(symbol) => {
                                    setForm((prev) => ({ ...prev, unit: symbol }));
                                    if (fieldErrors.unit) setFieldErrors((prev) => ({ ...prev, unit: '' }));
                                }}
                                onAddNew={() => openCreateUnitModal(true)}
                                error={fieldErrors.unit}
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
                                list="hsn-sac-suggestions"
                                className={`w-full px-4 py-2.5 rounded-lg border ${fieldErrors.hsn_sac_code ? 'border-red-400' : 'border-gray-200'} bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition`}
                            />
                            <datalist id="hsn-sac-suggestions">
                                {knownHsnSacCodes.map((code) => (
                                    <option key={code} value={code} />
                                ))}
                            </datalist>
                            {fieldErrors.hsn_sac_code && <p className="mt-1 text-xs text-red-500">{fieldErrors.hsn_sac_code}</p>}
                        </div>
                    </div>

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

            {/* Unit Modal */}
            {isUnitModalOpen && (
                <Modal
                    title={editingUnit ? 'Edit Unit' : 'Add Unit'}
                    subtitle={editingUnit ? 'Update the unit details below' : 'Add the unit details below'}
                    error={unitModalError}
                    onClose={closeUnitModal}
                    onSubmit={handleUnitSubmit}
                    submitting={unitSubmitting}
                    submitLabel={editingUnit ? 'Save Changes' : 'Add Unit'}
                >
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Unit</label>
                        <input
                            value={unitSymbol}
                            onChange={(e) => setUnitSymbol(filterUnitInput(e.target.value))}
                            placeholder="kg"
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
                        <input
                            value={unitFullName}
                            onChange={(e) => setUnitFullName(filterItemNameInput(e.target.value))}
                            placeholder="Kilogram"
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Description <span className="text-gray-400 font-normal">(optional)</span></label>
                        <textarea
                            value={unitDescription}
                            onChange={(e) => setUnitDescription(e.target.value)}
                            placeholder="Unit of mass used commonly for groceries, raw materials, etc."
                            rows={3}
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition resize-none"
                        />
                    </div>
                </Modal>
            )}
        </>
    );
}
