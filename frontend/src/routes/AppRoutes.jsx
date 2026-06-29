import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "../pages/Login";
import DashboardLayout from "../layouts/DashboardLayout";
import Dashboard from "../pages/Dashboard";
import Contacts from "../pages/Contacts";
import Services from '../pages/Services';
import Transactions from '../pages/Transactions';
import Invoices from '../pages/sales/Invoices';
import Receipts from '../pages/sales/Receipts';
import ChartofAccounts from "../pages/ChartofAccounts";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/services" element={<Services />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/sales/invoices" element={<Invoices />} />
          <Route path="/sales/receipts" element={<Receipts />} />
          <Route path="/chartofaccounts" element={<ChartofAccounts />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
