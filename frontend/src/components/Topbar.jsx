import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/contacts': 'Contacts',
  '/items': 'Items',
  '/transactions': 'Transactions',
  '/sales/invoices': 'Invoices',
  '/sales/receipts': 'Receipts',
  '/purchases/bills': 'Bills',
  '/purchases/payments': 'Payments',
  '/banking/deposits': 'Deposits',
  '/banking/withdrawals': 'Withdrawals',
  '/banking/paytds': 'Pay TDS',
  '/journal': 'Journal',
  '/chartofaccounts': 'Chart of Accounts',
  '/reports': 'Reports',
  '/users': 'Users',
  '/activitylogs': 'Activity Logs',
  '/settings': 'Settings',
};

const REPORT_TITLES = {
  "/reports/account-ledger": "Account Ledger",
  "/reports/group-ledger": "Group Ledger",
  "/reports/trial-balance": "Trial Balance",
  "/reports/profit-loss": "Profit & Loss Statement",
  "/reports/balance-sheet": "Balance Sheet",
  "/reports/cash-flow": "Cash Flow Statement",
  "/reports/day-book": "Day Book",

  "/reports/sales-register": "Sales Register",
  "/reports/sales-by-customer": "Sales By Customer",
  "/reports/sales-by-item": "Sales By Item",
  "/reports/master-sales": "Master Sales Report",

  "/reports/purchase-register": "Purchase Register",
  "/reports/purchase-by-vendor": "Purchase By Vendor",
  "/reports/purchase-by-item": "Purchase By Item",
  "/reports/master-purchase": "Master Purchase Report",

  "/reports/customer-balance": "Customer Balance",
  "/reports/receivables-ageing": "Receivables Ageing",
  "/reports/customer-transactions": "Customer Transactions",
  "/reports/contact-ledger": "Contact Ledger",
  "/reports/transaction-summary": "Transaction Summary",

  "/reports/vendor-balances": "Vendor Balances",
  "/reports/payables-ageing": "Payables Ageing",
  "/reports/vendor-transactions": "Vendor Transactions",

  "/reports/tds-receivable": "TDS Receivable",
  "/reports/tds-payable": "TDS Payable",
  "/reports/tds-expense": "TDS Expense",
  "/reports/tds-summary": "TDS Summary",
  "/reports/annexure-13": "Annexure 13",

  "/reports/sales-account-np": "बिक्री खाता (Sales Account)",
  "/reports/purchase-account-np": "खरिद खाता (Purchase Account)",
  "/reports/vat-return": "VAT Return",
  "/reports/tds-report-np": "TDS Report",
  "/reports/tds-summary-np": "TDS Summary",
};

export default function Topbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const title =
    PAGE_TITLES[location.pathname] ??
    REPORT_TITLES[location.pathname] ??
    "Overview";

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const displayName = user?.name ?? '';
  const displayRole = user?.role ?? '';

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-7 flex-shrink-0">
      <span className="text-xl font-bold text-gray-900">{title}</span>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-full bg-gray-200 text-gray-900 flex items-center justify-center text-sm font-semibold">
            {displayName.charAt(0)}
          </span>
          <div className="leading-tight">
            <p className="text-[13px] font-semibold text-gray-900">{displayName}</p>
            <p className="text-[11px] text-gray-500 capitalize">{displayRole}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="px-3.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-sm font-medium text-gray-900 hover:bg-gray-100 transition"
        >
          Logout
        </button>
      </div>
    </header>
  );
}