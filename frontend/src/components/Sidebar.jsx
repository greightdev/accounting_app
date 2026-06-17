import { NavLink } from "react-router-dom";

const navItems = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Sales', path: '/dashboard/sales' },
    { label: 'Purchase', path: '/dashboard/purchase' },
    { label: 'Contacts', path: '/dashboard/contacts' },
    { label: 'Reports', path: '/dashboard/reports' },
];

export default function Sidebar() {
  return (
    <aside className="w-60 bg-gray-900 text-gray-300 flex flex-col py-5">
      <div className="flex items-center gap-2.5 px-5 mb-7">
        {/* <span className="w-8 h-8 rounded-lg bg-white text-gray-900 flex items-center justify-center text-sm font-bold">
        // for icon
        </span> */}
        <span className="text-white font-semibold text-[15px]">Accounts</span>
      </div>
 
      <nav className="flex-1 flex flex-col gap-1 px-3">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/dashboard'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                isActive
                  ? 'bg-white text-gray-900'
                  : 'hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
