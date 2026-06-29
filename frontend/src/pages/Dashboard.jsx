import { useState } from "react";
import { useNavigate } from "react-router-dom";

// Placeholder user — replace with real auth state later
const currentUser = { name: 'Admin', role: 'admin' };

export default function Dashboard() {
    return (
        <>
            <div className="mb-6">
                <h1 className="text-xl font-bold text-gray-900">Welcome, {currentUser.name}</h1>
                <p className="text-sm text-gray-500 mt-1">Here is a quick snapshot of your business at a glance.</p>
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

        </>
    );
}