export default function Modal({
    title,
    subtitle,
    warning,
    error,
    onClose,
    onSubmit,
    submitting,
    submitLabel,
    children,
    maxWidth = "max-w-md",
}) {
    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className={`bg-white rounded-2xl shadow-xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto p-7`}>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">
                    {title}
                </h2>
                {subtitle && <p className="text-sm text-gray-500 mb-6">
                    {subtitle}
                </p>}

                {warning && (
                    <div className="mb-5 px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
                        {warning}
                    </div>
                )}

                {error && (
                    <div className="mb-5 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={onsubmit} className="space-y-4">
                    {children}
                    
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
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
                            ) : submitLabel}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}