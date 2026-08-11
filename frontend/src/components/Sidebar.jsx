import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { isRouteAllowed } from "../permissions";

const navItems = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Contacts', path: '/contacts' },
    { label: 'Items', path: '/items' },
    { label: 'Transactions', path: '/transactions' },
    { 
      label: 'Sales',
      children: [
        { label: 'Invoices', path: '/sales/invoices' },
        { label: 'Receipts', path: '/sales/receipts' },
      ],
    },
    { 
      label: 'Purchases',
      children: [
        { label: 'Bills', path: '/purchases/bills' },
        { label: 'Payments', path: '/purchases/payments' },
      ],
    },
    { 
      label: 'Banking',
      children: [
        { label: 'Deposits', path: '/banking/deposits' },
        { label: 'Withdrawals', path: '/banking/withdrawals' },
      ],
    },
    { label: 'Journal', path: '/journal' },
    { label: 'Chart of Accounts', path: '/chartofaccounts' },
    { label: 'Account Reports', path: '/reports' },
    { label: 'Settings', path: '/settings' },
];

function filterNavItems(items, role) {
  return items
    .map((item) => {
      if (item.children) {
        const children = item.children.filter((child) => isRouteAllowed(role, child.path));
        if (children.length === 0) return null;
        return { ...item, children };
      }
      return isRouteAllowed(role, item.path) ? item : null;
    })
    .filter(Boolean);
}

const STORAGE_KEY = 'sidebar_open_menus'

function getStoredOpenMenus() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export default function Sidebar() {
  const location = useLocation();
  const { role } = useAuth();
  const [ openMenus, setOpenMenus ] = useState(getStoredOpenMenus);

  const toggleMenu = (label) => {
    setOpenMenus((prev) => {
      const next = { ...prev, [label]: !prev[label] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const isChildActive = (children) => 
    children.some((child) => location.pathname.startsWith(child.path));

  const visibleNavItems = filterNavItems(navItems, role);

  return (
    <aside className="w-60 h-screen bg-slate-700 text-slate-200 flex flex-col py-5 shrink-0">
      <div className="flex items-center gap-2.5 px-5 mb-7">
        {/* <span className="w-8 h-8 rounded-lg bg-white text-gray-900 flex items-center justify-center text-sm font-bold">
        // for icon
        </span> */}
        <span className="text-white font-semibold text-[15px]">Accounts</span>
      </div>
 
      <nav className="flex-1 overflow-y-auto flex flex-col gap-1 px-3">
        {visibleNavItems.map((item) => {
          // Item with a dropdown
          if (item.children) {
            const isOpen = !!openMenus[item.label];
            const hasActiveChild = isChildActive(item.children);
 
            return (
              <div key={item.label}>
                <button
                  type="button"
                  onClick={() => toggleMenu(item.label)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                    hasActiveChild
                      ? 'bg-slate-600 text-white'
                      : 'text-slate-200 hover:bg-slate-600 hover:text-white'
                  }`}
                >
                  <span>{item.label}</span>
                  <span
                    className={`text-xs transition-transform duration-150 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  >
                    ▾
                  </span>
                </button>
 
                {isOpen && (
                  <div className="mt-1 ml-3 pl-3 border-l border-slate-600 flex flex-col gap-1">
                    {item.children.map((child) => (
                      <NavLink
                        key={child.path}
                        to={child.path}
                        className={({ isActive }) =>
                          `px-3 py-2 rounded-lg text-sm font-medium transition ${
                            isActive
                              ? 'bg-white text-slate-700'
                              : 'text-slate-300 hover:bg-slate-600 hover:text-white'
                          }`
                        }
                      >
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/dashboard'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? 'bg-white text-slate-700'
                    : 'text-slate-200 hover:bg-slate-600 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
