import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, KeyRound } from "lucide-react";
import api from "../api/axios";
import Toast from "../components/Toast";
import useToast from "../hooks/useToast";

const labelCls = "block text-sm font-medium, text-gray-700 mb-1.5";
const inputCls = "w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition";

export default function Settings() {
    const navigate = useNavigate();
    const { toast, showToast, hideToast } = useToast();

    const [view, setView] = useState("list");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const resetPasswordFlow = () => {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setError("");
    };

    const goToList = () => {
        resetPasswordFlow();
        setView("list");
    };

    const handleContinueFromCurrent = async (e) => {
        e.preventDefault();
        setError("");

        if (!currentPassword) return setError("Current password is required.");

        setSubmitting(true);
        try {
            await api.post("/auth/change_password.php", {
                current_password: currentPassword,
            });
            setView("new");
        } catch (err) {
            const message = err.response?.data?.message ?? "Failed to verify password.";

            if (err.response?.status === 429) {
                showToast(message);
                setTimeout(() => navigate("/"), 1200);
                return;
            }
            setError(message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleBackToCurrent = () => {
        setError("");
        setView("current");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        // if (!currentPassword) return setError("Current password is required.");
        if (!newPassword) return setError("New password is required.");
        if (!confirmPassword) return setError("Please confirm your new password.");
        if (newPassword !== confirmPassword) return setError("New passwords do not match.");
        if (currentPassword === newPassword) return setError("New password must be different from current password.");

        setSubmitting(true);
        try {
            await api.post("/auth/change_password.php", {
                current_password: currentPassword,
                new_password: newPassword,
                confirm_password: confirmPassword,
            });
            
            showToast("Password changed successfully. Please log in again.");
            setTimeout(() => navigate("/"), 1200);
        } catch (err) {
            const message = err.response?.data?.message ?? "Failed to change password.";
            
            if (err.response?.status === 429) {
                showToast(message);
                setTimeout(() => navigate("/"), 1200);
                return;
            }
            
            if (err.response?.status === 401) {
                setView("current");
            }
            setError(message);
            setSubmitting(false);
        }
    };
    
    return (
        <>
            <Toast toast={toast} onClose={hideToast} />

            <div className="max-w-lg">
                {view === "list" && (
                    <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100">
                        <button
                            onClick={() => setView("current")}
                            className="w-full flex items-center justify-between px-7 py-4 hover:bg-gray-50 transition text-left"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
                                    <KeyRound size={16} />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-900">Change Password</p>
                                    <p className="text-xs text-gray-500">Update your account password</p>
                                </div>
                            </div>
                            <ChevronRight size={18} className="text-gray-400" />
                        </button>
                    </div>
                )}

                {/* Step 1: Current password */}
                {view === "current" && (
                    <div className="bg-white rounded-2xl shadow-sm">
                        <div className="flex items-center gap-3 px-7 py-5 border-b border-gray-100">
                            <button onClick={goToList} className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition">
                                <ArrowLeft size={18} />
                            </button>
                            <h2 className="text-base font-semibold text-gray-900">Change Password</h2>
                        </div>

                        <form onSubmit={handleContinueFromCurrent} className="px-7 py-6 space-y-4">
                            {error && (
                                <div className="px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className={labelCls}>
                                    <span className="text-red-500 mr-0.5">*</span>Current Password
                                </label>
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    autoFocus
                                    className={inputCls}
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-6 py-2.5 rounded-lg bg-slate-700 text-white text-sm font-semibold hover:bg-slate-800 transition"
                                >
                                    {submitting ? "Checking..." : "Continue"}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Step 2: New password + confirm */}
                {view === "new" && (
                    <div className="bg-white rounded-2xl shadow-sm">
                        <div className="flex items-center gap-3 px-7 py-5 border-b border-gray-100">
                            <button onClick={handleBackToCurrent} className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition">
                                <ArrowLeft size={18} />
                            </button>
                            <h2 className="text-base font-semibold text-gray-900">Change Password</h2>
                        </div>

                        <form onSubmit={handleSubmit} className="px-7 py-6 space-y-4">
                            {error && (
                                <div className="px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className={labelCls}>
                                    <span className="text-red-500 mr-0.5">*</span>New Password
                                </label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    autoFocus
                                    className={inputCls}
                                />
                                <p className="text-xs text-gray-400 mt-1">
                                    At least 8 characters, with uppercase, lowercase, a number, and a special character.
                                </p>
                            </div>

                            <div>
                                <label className={labelCls}>
                                    <span className="text-red-500 mr-0.5">*</span>Confirm New Password
                                </label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className={inputCls}
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-6 py-2.5 rounded-lg bg-slate-700 text-white text-sm font-semibold hover:bg-slate-800 transition disabled:opacity-60"
                                >
                                    {submitting ? "Changing..." : "Change Password"}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </>
    );
}