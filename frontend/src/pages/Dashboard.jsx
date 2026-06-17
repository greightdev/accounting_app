import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

export default function Dashboard() {
    return (
        <div className="flex min-h-screen bg-gray-100">

            <Sidebar />

            {/* Main column */}
            <div className="flex-1 flex flex-col min-w-0">

            <Topbar title="Overview" />

            {/* Content */}
            <main className="flex-1 p-7">
                <div className="mb-6">
                <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-sm text-gray-500 mt-1">Quick snapshot of your business at a glance.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col gap-2">
                    <span className="text-xs font-medium text-gray-500">Total Sales (this month)</span>
                    <span className="text-2xl font-bold text-gray-900">—</span>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col gap-2">
                    <span className="text-xs font-medium text-gray-500">Total Purchases (this month)</span>
                    <span className="text-2xl font-bold text-gray-900">—</span>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col gap-2">
                    <span className="text-xs font-medium text-gray-500">Bank Balance</span>
                    <span className="text-2xl font-bold text-gray-900">—</span>
                </div>
                </div>
            </main>

            </div>
        </div>
    );
}