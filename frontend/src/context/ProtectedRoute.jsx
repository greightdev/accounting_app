
import { Navigate, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { isRouteAllowed, homeRouteFor } from "../permissions";

export default function ProtectedRoute() {
    const { isAuthenticated, loading, role } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <span className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/" replace />;
    }

    if (!isRouteAllowed(role, location.pathname)) {
        // Signed in, but this role has no business on this page — send them
        // somewhere they're actually allowed rather than showing a blank/broken page.
        return <Navigate to={homeRouteFor(role)} replace />;
    }

    return <Outlet />;
}
