import React from 'react';
import { useApp } from '../context/AppContext';
import { useAdmin } from '../context/AdminContext';
import { BadgeCheck, ArrowLeftRight, RefreshCw, ShieldAlert, Sparkles, Store } from 'lucide-react';

/**
 * Top navigation header with Telegram profile details, connection monitor,
 * currency preference switcher, and persistent Admin Mode toggle pill for verified administrators.
 */
export const Header: React.FC = () => {
  const {
    user,
    currency,
    toggleCurrency,
    addToast,
    backendConnected,
    isCheckingBackend,
    recheckConnection,
  } = useApp();

  const {
    isAdmin,
    isAdminMode,
    enterAdminMode,
    enterUserMode,
  } = useAdmin();

  const handleCopyId = () => {
    navigator.clipboard?.writeText(user.telegramId);
    addToast(`Telegram ID ${user.telegramId} copied to clipboard!`, 'info', 'Copied');
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#121217]/90 backdrop-blur-md border-b border-[#262630] pt-[max(12px,env(safe-area-inset-top))] pb-3 px-4">
      <div className="flex items-center justify-between gap-2">
        {/* User Info (Left) */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#7c3aed] to-[#3b82f6] flex items-center justify-center font-bold text-sm text-white shadow-md ring-2 ring-[#262630]">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.firstName} className="w-full h-full rounded-full object-cover" />
              ) : (
                user.firstName.substring(0, 2).toUpperCase()
              )}
            </div>
            <div
              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#121217] ${
                backendConnected === true
                  ? 'bg-[#22c55e]'
                  : backendConnected === false
                  ? 'bg-[#ef4444]'
                  : 'bg-[#eab308]'
              }`}
            />
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-bold text-sm text-white tracking-tight truncate max-w-[110px]">
                {user.firstName}
              </span>
              <BadgeCheck className="w-4 h-4 text-[#22c55e] shrink-0" />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#a1a1aa]">
              <span className="font-mono truncate max-w-[80px]">@{user.username}</span>
              <span>•</span>
              <button
                onClick={handleCopyId}
                className="font-mono hover:text-white transition-colors shrink-0 cursor-pointer"
                title="Click to copy ID"
              >
                ID: {user.telegramId}
              </button>
            </div>
          </div>
        </div>

        {/* Right Actions: Persistent Admin Switcher + Connection Pill + Currency Switcher */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Persistent Admin Mode Toggle Pill for Verified Admins in Storefront */}
          {isAdmin && !isAdminMode && (
            <button
              onClick={enterAdminMode}
              className="flex items-center gap-1 bg-[#7c3aed]/20 hover:bg-[#7c3aed]/30 active:scale-95 text-[#a78bfa] hover:text-white border border-[#7c3aed]/40 px-2 py-1 rounded-full text-[10px] font-semibold transition-all shadow-sm shadow-[#7c3aed]/20 cursor-pointer"
              title="Switch to Admin Panel (Testing Mode)"
              aria-label="Switch to Admin Panel"
            >
              <ShieldAlert className="w-3 h-3 text-[#a78bfa]" />
              <span className="tracking-tight font-medium">Admin</span>
              <Sparkles className="w-2.5 h-2.5 text-[#f59e0b]" />
            </button>
          )}

          {/* Persistent Storefront Toggle Pill for Verified Admins in Admin Mode */}
          {isAdmin && isAdminMode && (
            <button
              onClick={enterUserMode}
              className="flex items-center gap-1 bg-[#22c55e]/15 hover:bg-[#22c55e]/25 active:scale-95 text-[#22c55e] hover:text-white border border-[#22c55e]/30 px-2 py-1 rounded-full text-[10px] font-semibold transition-all shadow-sm cursor-pointer"
              title="Switch to Customer Storefront"
              aria-label="Switch to Customer Storefront"
            >
              <Store className="w-3 h-3 text-[#22c55e]" />
              <span className="tracking-tight font-medium">Store</span>
            </button>
          )}

          {/* Connection Status Pill */}
          <button
            onClick={() => recheckConnection(true)}
            disabled={isCheckingBackend}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all active:scale-95 shadow-sm ${
              backendConnected === true
                ? 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/30 hover:bg-[#10b981]/20'
                : backendConnected === false
                ? 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/30 hover:bg-[#ef4444]/20'
                : 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30'
            }`}
            title="Click to re-verify backend connectivity"
            aria-label="Backend Connection Status"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                backendConnected === true
                  ? 'bg-[#10b981] animate-pulse shadow-[0_0_8px_#10b981]'
                  : backendConnected === false
                  ? 'bg-[#ef4444]'
                  : 'bg-[#f59e0b] animate-ping'
              }`}
            />
            <span className="tracking-tight">
              {isCheckingBackend
                ? 'Checking...'
                : backendConnected === true
                ? 'Connected'
                : backendConnected === false
                ? 'Not Connected'
                : 'Connecting...'}
            </span>
            {isCheckingBackend && <RefreshCw className="w-2.5 h-2.5 animate-spin ml-0.5" />}
          </button>

          {/* Currency Switcher */}
          <button
            onClick={toggleCurrency}
            className="flex items-center gap-1 bg-[#181820] hover:bg-[#1f1f2a] active:scale-95 border border-[#262630] rounded-full px-2.5 py-1 transition-all shadow-sm"
            aria-label="Toggle currency between INR and USDT"
          >
            <ArrowLeftRight className="w-3 h-3 text-[#8b5cf6]" />
            <span className="text-[11px] font-bold text-[#22c55e]">
              {currency === 'INR' ? '₹' : '$'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
