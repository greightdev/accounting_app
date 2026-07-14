const DEFAULT_TABS = [
    { key: 'approved', label: 'Approved' },
    { key: 'draft', label: 'Draft' }
];

export default function Tabs({ tabs = DEFAULT_TABS, active, onChange, toggle }) {
    return (
        <div className="flex justify-between items-end border-b border-gray-200 mb-4">
            <div className="flex">
                {tabs.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => onChange(t.key)}
                        className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                            active === t.key
                            ? 'border-slate-700 text-slate-800'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {toggle && (
                <button
                    type="button"
                    onClick={toggle.onChange}
                    className="flex items-center gap-3 py-2 text-sm text-slate-600"
                >
                    <span>{toggle.label}</span>

                    <span
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            toggle.checked
                                ? "bg-slate-700"
                                : "bg-slate-300"
                        }`}
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                toggle.checked
                                    ? "translate-x-6"
                                    : "translate-x-1"
                            }`}
                        />
                    </span>
                </button>
            )}
        </div>
    );
}