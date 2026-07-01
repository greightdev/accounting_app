const DEFAULT_TABS = [
    { key: 'approved', label: 'Approved' },
    { key: 'draft', label: 'Draft' }
];

export default function Tabs({ tabs = DEFAULT_TABS, active, onChange }) {
    return (
        <div className="flex gap-0 border-b border-gray-200 mb-4">
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
    );
}