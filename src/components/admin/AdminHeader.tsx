import React from 'react';
import { useAdmin } from '../../context/AdminContext';
import { useApp } from '../../context/AppContext';
import {
  Shield,
  ShoppingBag,
  LogOut,
  RefreshCw,
} from 'lucide-react';

export const AdminHeader: React.FC = () => {
  const { enterUserMode, logoutAdmin } = useAdmin();
  const {
    user,
    backendConnected,
    isCheckingBackend,
    recheckConnection,
    addToast,
  } = useApp();

  const handleCopyId = () => {
    if (user?.telegramId) {
      navigator.clipboard?.writeText(String(user.telegramId));
      addToast(`Admin ID ${user.telegramId} copied!`, 'info', 'Copied');
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#121217]/95 backdrop-blur-md border-b border-[#262630] pt-[max(12px,env(safe-area-inset-top))] pb-3 px-4 shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Top Left: Logo & Admin Branding */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#7c3aed] to-[#4f46e5] border border-[#7c3aed]/40 flex items-center justify-center text-white shrink-0 shadow-[0_0_15px_rgba(124,58,237,0.35)]">
            <Shield className="w-5 h-5 text-white" />
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white tracking-tight truncate">
                Krish Admin Dashboard
              </h1>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#7c3aed]/20 text-[#a78bfa] border border-[#7c3aed]/30 shrink-0">
                RBAC Active
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-[#a1a1aa] mt-0.5">
              <span className="truncate text-[11px] font-mono text-[#8b5cf6]">
                @{user?.username || 'admin'}
              </span>
              <span>•</span>
              <button
                onClick={handleCopyId}
                className="font-mono text-[11px] text-[#71717a] hover:text-white transition-colors cursor-pointer"
                title="Click to copy ID"
              >
                ID: {user?.telegramId || '7507183871'}
              </button>
            </div>
          </div>
        </div>

        {/* Top Right: Status Pill & Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
          {/* Connection Status Indicator */}
          <button
            onClick={() => recheckConnection(true)}
            disabled={isCheckingBackend}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all active:scale-95 shadow-sm ${
              backendConnected === true
                ? 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/30 hover:bg-[#10b981]/20'
                : backendConnected === false
                ? 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/30 hover:bg-[#ef4444]/20'
                : 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30'
            }`}
            title="Click to re-verify backend connectivity"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                backendConnected === true
                  ? 'bg-[#10b981] animate-pulse shadow-[0_0_6px_#10b981]'
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
                : 'Offline'}
            </span>
            {isCheckingBackend && <RefreshCw className="w-2.5 h-2.5 animate-spin ml-0.5" />}
          </button>

          {/* Switch to Customer Storefront (Testing Mode) */}
          <button
            onClick={enterUserMode}
            className="flex items-center gap-1.5 bg-[#22c55e]/15 hover:bg-[#22c55e]/25 active:scale-95 text-[#22c55e] hover:text-white border border-[#22c55e]/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm cursor-pointer"
            title="Switch to Storefront (Testing Mode)"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-[#22c55e]" />
            <span className="font-medium whitespace-nowrap">Storefront (Test)</span>
          </button>

          {/* Logout / Exit Admin */}
          <button
            onClick={logoutAdmin}
            className="flex items-center gap-1.5 bg-[#181820] hover:bg-[#272732] active:scale-95 text-[#a1a1aa] hover:text-[#ef4444] border border-[#262630] hover:border-[#ef4444]/40 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm cursor-pointer"
            title="Lock Admin Session & Return to Storefront"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Exit</span>
          </button>
        </div>
      </div>
    </header>
  );
};
