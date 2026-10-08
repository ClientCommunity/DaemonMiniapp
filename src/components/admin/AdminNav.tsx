import React from 'react';
import { useAdmin, AdminTab } from '../../context/AdminContext';
import {
  LayoutDashboard,
  Server,
  CreditCard,
  Users,
  Megaphone,
} from 'lucide-react';

interface TabItem {
  id: AdminTab;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const TABS: TabItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    shortLabel: 'Overview',
    icon: LayoutDashboard,
  },
  {
    id: 'servers',
    label: 'Server 1–5',
    shortLabel: 'Servers',
    icon: Server,
  },
  {
    id: 'payments',
    label: 'Payments & Deposits',
    shortLabel: 'Payments',
    icon: CreditCard,
  },
  {
    id: 'users',
    label: 'Users & Wallets',
    shortLabel: 'Users',
    icon: Users,
  },
  {
    id: 'marketing',
    label: 'Marketing & Settings',
    shortLabel: 'Marketing',
    icon: Megaphone,
  },
];

export const AdminNav: React.FC = () => {
  const { activeAdminTab, setActiveAdminTab } = useAdmin();

  return (
    <nav className="w-full bg-[#121217] border-b border-[#262630] px-3 py-2.5 overflow-x-auto no-scrollbar shadow-sm">
      <div className="flex items-center gap-2 min-w-max mx-auto max-w-5xl">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeAdminTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveAdminTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all duration-150 active:scale-95 cursor-pointer select-none ${
                isActive
                  ? 'bg-gradient-to-r from-[#7c3aed] to-[#6366f1] text-white shadow-[0_0_12px_rgba(124,58,237,0.35)] border border-[#a78bfa]/40 font-semibold'
                  : 'bg-[#181820] text-[#a1a1aa] hover:text-white hover:bg-[#22222d] border border-[#262630]'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon
                className={`w-4 h-4 transition-transform ${
                  isActive ? 'text-white scale-110' : 'text-[#71717a]'
                }`}
              />
              <span className="hidden md:inline">{tab.label}</span>
              <span className="md:hidden">{tab.shortLabel}</span>
              {tab.badge && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/40 text-white font-bold ml-1">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
