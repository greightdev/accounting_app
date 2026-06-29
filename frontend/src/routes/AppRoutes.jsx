import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "../pages/Login";
import DashboardLayout from "../layouts/DashboardLayout";
import Dashboard from "../pages/Dashboard";
import Contacts from "../pages/Contacts";
import Services from '../pages/Services';
import Transactions from '../pages/Transactions';
import Invoices from '../pages/sales/Invoices';
import Receipts from '../pages/sales/Receipts';
import Expenses from "../pages/purchases/Expenses";
import Deposits from "../pages/banking/Deposits";
import Withdrawal from "../pages/banking/Withdrawal";
import Journal from "../pages/Journal";
import ChartofAccounts from "../pages/ChartofAccounts";
import AccountReports from "../pages/AccountReports";
import Settings from "../pages/Settings";

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
          <Route path="/purchases/expenses" element={<Expenses />} />
          <Route path="/banking/deposits" element={<Deposits />} />
          <Route path="/banking/withdrawal" element={<Withdrawal />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="/chartofaccounts" element={<ChartofAccounts />} />
          <Route path="/reports" element={<AccountReports />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
