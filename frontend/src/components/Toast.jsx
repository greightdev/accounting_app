import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";

const DURATION = 4000;

export default function Toast({ toast, onClose }) {
    const [progress, setProgress] = useState(100);

    useEffect(() => {
        if (!toast) return;

        setProgress(100);
        const start = Date.now();

        const interval = setInterval(() => {
            const elapsed = Date.now() - start;
            const remaining = Math.max(0, 100 - (elapsed / DURATION) * 100);
            setProgress(remaining);
            if (remaining === 0) clearInterval(interval);
        }, 30);

        const timer = setTimeout(onClose, DURATION);

        return () => {
            clearInterval(interval);
            clearTimeout(timer);
        };
    }, [toast, onClose]);

    if (!toast) return null;

    const isSuccess = toast.type === "success";
    const accent = isSuccess ? "emerald" : "red";

    return (
        <div className="fixed bottom-8 right-8 z-50 animate-in fade-in slide-in-from-right-4">
            <div className="w-80 rounded-xl bg-white shadow-xl border border-gray-100 overflow-hidden">
                <div className="flex items-start gap-3 px-4 py-3.5">
                    {isSuccess ? (
                        <CheckCircle2 size={20} className="shrink-0 mt-0.5 text-emerald-500" />
                    ) : (
                        <XCircle size={20} className="shrink-0 mt-0.5 text-red-500" />
                    )}
                    <p className="text-sm font-medium flex-1 leading-snug">
                        {toast.message}
                    </p>
                    <button
                        onClick={onClose}
                        className="shrink-0 text-gray-400 hover:text-gray-600 transition"
                    >
                        <X size={16} />
                    </button>
                </div>
                <div className="h-[3px] w-full bg-gray-100">
                    <div
                        className={`h-full ${isSuccess ? "bg-emerald-500" : "bg-red-500"} transition-[width] duration-[30ms] ease-linear`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>
        </div>
    );
}