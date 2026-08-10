import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "../pages/Login";
import DashboardLayout from "../layouts/DashboardLayout";
import Dashboard from "../pages/Dashboard";
import Contacts from "../pages/Contacts";
import Items from "../pages/Items";
import Transactions from '../pages/Transactions';
import Invoices from '../pages/sales/Invoices';
import Receipts from '../pages/sales/Receipts';
import Bills from "../pages/purchases/Bills";
import Payments from "../pages/purchases/Payments";
import Deposits from "../pages/banking/Deposits";
import Withdrawals from "../pages/banking/Withdrawals";
import Journal from "../pages/Journal";
import ChartofAccounts from "../pages/ChartofAccounts";
import AccountReports from "../pages/AccountReports";
import ReportViewer from "../pages/ReportViewer";
import Settings from "../pages/Settings";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/items" element={<Items />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/sales/invoices" element={<Invoices />} />
            <Route path="/sales/receipts" element={<Receipts />} />
            <Route path="/purchases/bills" element={<Bills />} />
            <Route path="/purchases/payments" element={<Payments />} />
            <Route path="/banking/deposits" element={<Deposits />} />
            <Route path="/banking/withdrawals" element={<Withdrawals />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/chartofaccounts" element={<ChartofAccounts />} />
            <Route path="/reports" element={<AccountReports />} />
            <Route path="/reports/:reportKey" element={<ReportViewer />} />
            <Route path="/settings" element={<Settings />} />
          </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
