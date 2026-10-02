import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  LayoutDashboard,
  ShoppingBag,
  Wallet,
  Clock,
  User
} from 'lucide-react';

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab } = useApp();

  const navItems = [
    { id: 'home', label: 'Home', icon: LayoutDashboard },
    { id: 'store', label: 'Store', icon: ShoppingBag },
    { id: 'deposit', label: 'Deposit', icon: Wallet },
    { id: 'history', label: 'History', icon: Clock },
    { id: 'profile', label: 'Profile', icon: User },
  ] as const;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 max-w-[430px] mx-auto bg-[#121217]/95 backdrop-blur-xl border-t border-[#262630] pb-[max(10px,env(safe-area-inset-bottom))] pt-2 px-3">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`relative flex flex-col items-center justify-center flex-1 py-1 transition-all duration-200 group active:scale-95`}
              aria-label={item.label}
            >
              {/* Active Backlight Glow */}
              {isActive && (
                <div className="absolute inset-0 bg-[#7c3aed]/15 rounded-xl filter blur-sm pointer-events-none" />
              )}

              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isActive
                      ? 'text-[#8b5cf6] scale-110 drop-shadow-[0_0_10px_rgba(124,58,237,0.7)]'
                      : 'text-[#a1a1aa] group-hover:text-white'
                  }`}
                  strokeWidth={isActive ? 2.3 : 1.8}
                />
              </div>

              <span
                className={`text-[10px] mt-1 tracking-tight font-medium transition-colors ${
                  isActive ? 'text-white font-bold' : 'text-[#a1a1aa] group-hover:text-white'
                }`}
              >
                {item.label}
              </span>

              {/* Active Indicator Bar */}
              {isActive && (
                <div className="w-4 h-0.5 bg-[#7c3aed] rounded-full mt-0.5 shadow-[0_0_6px_#7c3aed]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
