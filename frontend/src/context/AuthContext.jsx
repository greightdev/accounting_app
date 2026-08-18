import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api, { setUnauthorizedHandler} from "../api/axios";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const { data } = await api.get("/auth/me.php");
                if (!cancelled && data.success) {
                    setUser(data.user);
                }
            } catch {
                // Not logged in / session expired — stay logged out, no error needed.
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        setUnauthorizedHandler(() => setUser(null));
        return () => setUnauthorizedHandler(null);
    }, []);

    const login = useCallback((userObj) => {
        setUser(userObj);
    }, []);

    const logout = useCallback(async () => {
        try {
            await api.post("/auth/logout.php");
        } catch {
            // even if the request fails, clear the user out locally
        } finally {
            setUser(null);
        }
    }, []);

    const value = {
        user,
        role: user?.role ?? null,
        isAuthenticated: !!user,
        loading,
        login,
        logout,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
    return ctx;
}