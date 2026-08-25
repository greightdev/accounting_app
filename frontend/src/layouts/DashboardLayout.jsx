import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

export default function DashboardLayout() {
    return (
        <div className="flex h-dvh bg-gray-100 overflow-hidden overscroll-none">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
                <Topbar />
                <main className="flex-1 overflow-y-auto overscroll-contain p-7 bg-gray-100">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}