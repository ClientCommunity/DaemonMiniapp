import React from 'react';
import { useApp } from '../../context/AppContext';
import { BadgeCheck, ArrowLeftRight } from 'lucide-react';

export const Header: React.FC = () => {
  const { user, currency, toggleCurrency, addToast } = useApp();

  const handleCopyId = () => {
    navigator.clipboard?.writeText(user.telegramId);
    addToast(`Telegram ID ${user.telegramId} copied to clipboard!`, 'info', 'Copied');
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#121217]/90 backdrop-blur-md border-b border-[#262630] pt-[max(12px,env(safe-area-inset-top))] pb-3 px-4">
      <div className="flex items-center justify-between gap-3">
        {/* User Info (Left) */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#7c3aed] to-[#3b82f6] flex items-center justify-center font-bold text-sm text-white shadow-md ring-2 ring-[#262630]">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.firstName} className="w-full h-full rounded-full object-cover" />
              ) : (
                user.firstName.substring(0, 2).toUpperCase()
              )}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[#22c55e] rounded-full border-2 border-[#121217]" />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <span className="font-bold text-sm text-white tracking-tight">
                {user.firstName}
              </span>
              <BadgeCheck className="w-4 h-4 text-[#22c55e]" />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#a1a1aa]">
              <span className="font-mono">@{user.username}</span>
              <span>•</span>
              <button
                onClick={handleCopyId}
                className="font-mono hover:text-white transition-colors"
                title="Click to copy ID"
              >
                ID: {user.telegramId}
              </button>
            </div>
          </div>
        </div>

        {/* Currency Switcher (Right) */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleCurrency}
            className="flex items-center gap-1.5 bg-[#181820] hover:bg-[#1f1f2a] active:scale-95 border border-[#262630] rounded-full px-3 py-1.5 transition-all shadow-sm"
            aria-label="Toggle currency between INR and USDT"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-[#8b5cf6]" />
            <span className="text-xs font-bold text-[#22c55e]">
              {currency === 'INR' ? '₹ INR' : '$ USDT'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
