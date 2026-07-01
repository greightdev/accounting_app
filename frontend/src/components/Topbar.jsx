import { useNavigate, useLocation } from "react-router-dom";
import api from "../api/axios";

// Placeholder user — replace with real auth state later
const currentUser = { name: 'Admin', role: 'admin' };

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/contacts': 'Contacts',
  '/items': 'Items',
  '/transactions': 'Transactions',
  '/sales/invoices': 'Invoices',
  '/sales/receipts': 'Receipts',
  '/purchases/expenses': 'Expenses',
  '/banking/deposits': 'Deposits',
  '/banking/withdrawals': 'Withdrawals',
  '/journal': 'Journal',
  '/chartofaccounts': 'Chart of Accounts',
  '/reports': 'Reports',
  '/settings': 'Settings',
}

export default function Topbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const title = PAGE_TITLES[location.pathname] ?? 'Overview';

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout.php');
    } catch (err) {
      // even if the request fails, clear the user out locally
      console.error('Logout request failed:', err);
    } finally {
      navigate('/');
    }
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-7 flex-shrink-0">
      <span className="text-xl font-bold text-gray-900">{title}</span>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-full bg-gray-200 text-gray-900 flex items-center justify-center text-sm font-semibold">
            {currentUser.name.charAt(0)}
          </span>
          <div className="leading-tight">
            <p className="text-[13px] font-semibold text-gray-900">{currentUser.name}</p>
            <p className="text-[11px] text-gray-500 capitalize">{currentUser.role}</p>
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