import { Search } from "lucide-react";

export default function Toolbar({
    search,
    filters,
    actions,
}) {
    return (
        <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-6">
                {/* Search */}
                {search && (
                    <div className="relative w-64">
                        <Search
                            size={18}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        />

                        <input
                            type="text"
                            value={search.value}
                            onChange={(e) => search.onChange(e.target.value)}
                            placeholder="Search"
                            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                        />
                    </div>
                )}

                {/* Filter */}
                {filters && (
                    <div className="flex gap-2">
                        {filters.options.map((opt) => (
                            <button
                                key={opt}
                                onClick={() => filters.onChange(opt)}
                                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition ${
                                filters.active === opt
                                    ? 'bg-slate-700 text-white'
                                    : 'bg-white text-slate-600 border-b border-slate-100 hover:bg-slate-100 transition-colors'
                                }`}
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                )}
            </div>


            {/* Actions */}
            {actions && (
                <div className="flex items-center gap-4">
                    {actions.map((action) => (
                        <button
                            key={action.label}
                            onClick={action.onClick}
                            className="px-5 py-2.5 rounded-lg bg-slate-700 text-white text-sm font-semibold shadow-sm hover:bg-slate-800 hover:shadow transition-all"
                        >
                            {action.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}