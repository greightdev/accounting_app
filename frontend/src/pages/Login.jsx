import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { homeRouteFor } from "../permissions";

export default function Login() {
    const navigate = useNavigate();
    const { login } = useAuth();

    const [form, setForm] = useState({
        email: '',
        password: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState({});
    const [apiError, setApiError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setForm((prev) => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    }

    const validate = () => {
        const errs = {};
        if (!form.email) {
            errs.email = 'Email is required.';
        } else if (!/\S+@\S+\.\S+/.test(form.email)) {
            errs.email = 'Enter a valid email.';
        }
        if (!form.password) {
            errs.password = 'Password is required.';
        }
        return errs;
    }

    const handleSubmit = async (e) => {
        e.preventDefault();

        const errs = validate();
        if (Object.keys(errs).length) {
            setErrors(errs);
            return;
        }
        setErrors({});
        setApiError('');
        setLoading(true);

        try {
            const { data } = await api.post('/auth/login.php', {
                email: form.email,
                password: form.password,
            });

            if (data.success) {
                login(data.user);
                navigate(homeRouteFor(data.user.role));
            }
        } catch (err) {
            const status = err.response?.status;
 
            if (status === 429) {
                const retry = err.response.data?.retry_after ?? 900;
                const mins = Math.ceil(retry / 60);
                setApiError(`Too many attempts. Try again in ${mins} minute${mins !== 1 ? 's' : ''}.`);
            } else {
                setApiError(err.response?.data?.message ?? 'Something went wrong. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    }

    return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-8">

            <h1 className="text-2xl font-semibold text-center text-gray-900 tracking-tight">
                Login
            </h1>
            <p className="text-sm text-gray-500 text-center mt-1 mb-8">
                Enter your credentials to access your account.
            </p>

            {apiError && (
                <div className="mb-5 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                    {apiError}
                </div>
            )}


            <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                        Email
                    </label>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        value={form.email}
                        onChange={handleChange}
                        placeholder="abc@example.com"
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition"
                    />
                    {errors.email && (
                        <p className="mt-1.5 text-xs text-red-600">{errors.email}</p>
                    )}
                </div>

                <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                        Password
                    </label>
                    <div className="relative">
                        <input
                            id="password"
                            name="password"
                            type={showPassword ? "text" : "password"}
                            value={form.password}
                            onChange={handleChange}
                            placeholder="••••••••"
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((prev) => !prev)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-500 transition"
                            aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                            {showPassword ? (
                                <EyeOff className="w-5 h-4" />
                            ) : (
                                <Eye className="w-5 h-4" />
                            )}
                        </button>
                    </div>
                    {errors.password && (
                        <p className="mt-1.5 text-xs text-red-600">{errors.password}</p>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-black transition mt-2"
                >
                    {loading ? (
                        <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                        'Sign in'
                    )}
                </button>
            </form>

        </div>
    </div>
    );
}