import React from 'react';
import { useApp } from '../context/AppContext';
import { useAdmin } from '../context/AdminContext';
import { BadgeCheck, ArrowLeftRight, RefreshCw, ShieldAlert, Sparkles, Store, Sun, Moon } from 'lucide-react';
import { hapticFeedback } from '../utils/haptics';

const LOGO_URL = `${((import.meta as unknown as { env?: { BASE_URL?: string } })?.env?.BASE_URL || '/').replace(/\/$/, '')}/deamon-logo.png`;

export interface HeaderProps {
  isWeb?: boolean;
}

/**
 * Top navigation header with Telegram profile details, connection monitor,
 * currency preference switcher, and persistent Admin Mode toggle pill for verified administrators.
 * Supports mobile layout (profile on left) and website layout (logo on left, profile on top right).
 */
export const Header: React.FC<HeaderProps> = ({ isWeb = false }) => {
  const {
    user,
    currency,
    formatPrice,
    refreshUser,
    toggleCurrency,
    addToast,
    theme,
    toggleTheme,
  } = useApp();

  const [isSyncingBalance, setIsSyncingBalance] = React.useState(false);

  const handleSyncBalance = async () => {
    hapticFeedback.light();
    try {
      setIsSyncingBalance(true);
      await refreshUser();
      hapticFeedback.success();
      addToast('Wallet balance synchronized!', 'success', 'Synced');
    } catch {
      hapticFeedback.error();
      addToast('Failed to sync balance.', 'error', 'Error');
    } finally {
      setIsSyncingBalance(false);
    }
  };

  const {
    isAdmin,
    isAdminMode,
    enterAdminMode,
    enterUserMode,
  } = useAdmin();

  const handleCopyId = () => {
    hapticFeedback.light();
    navigator.clipboard?.writeText(user.telegramId);
    hapticFeedback.success();
    addToast(`Account ID ${user.telegramId} copied to clipboard!`, 'info', 'Copied');
  };

  const handleToggleCurrency = () => {
    hapticFeedback.selection();
    toggleCurrency();
  };

  const handleToggleTheme = () => {
    hapticFeedback.selection();
    toggleTheme();
  };

  const handleToggleAdmin = () => {
    hapticFeedback.medium();
    if (isAdminMode) {
      enterUserMode();
    } else {
      enterAdminMode();
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#121217]/95 backdrop-blur-md border-b border-[#262630] pt-[max(10px,env(safe-area-inset-top))] pb-2.5 px-2.5 sm:px-4">
      <div className="flex items-center justify-between gap-1 sm:gap-2 max-w-full overflow-hidden">
        {/* Left Side: Brand Logo & Title for Web, or User Profile for Mobile/Telegram */}
        {isWeb ? (
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={LOGO_URL}
              alt="Deamon OTP Logo"
              className="w-8 h-8 sm:w-9 sm:h-9 object-contain shrink-0"
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.src.endsWith('deamon-logo.webp')) {
                  target.src = './deamon-logo.webp';
                }
              }}
            />
            <div className="flex flex-col min-w-0">
              <span className="font-extrabold text-sm sm:text-base tracking-tight text-white flex items-center gap-1.5 truncate">
                Deamon OTP
                <span className="text-[9px] font-mono font-bold bg-[#22c55e]/15 text-[#22c55e] border border-[#22c55e]/30 px-1.5 py-0.2 rounded-full">
                  STORE
                </span>
              </span>
              <span className="hidden sm:block text-[10px] text-[#a1a1aa] font-medium truncate">
                Virtual Numbers &amp; Telegram Sessions
              </span>
            </div>
          </div>
        ) : (
          /* User Info (Left for Mobile / Telegram Shell) */
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="relative shrink-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-[#7c3aed] to-[#3b82f6] flex items-center justify-center font-bold text-xs sm:text-sm text-white shadow-md ring-2 ring-[#262630] overflow-hidden">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.firstName} className="w-full h-full object-cover" />
                ) : (
                  user.firstName.substring(0, 2).toUpperCase()
                )}
              </div>
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-bold text-xs sm:text-sm text-white tracking-tight truncate max-w-[85px] xs:max-w-[110px] sm:max-w-[160px] md:max-w-[280px]">
                  {user.firstName}
                </span>
                <BadgeCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#22c55e] shrink-0" />
              </div>
              <div className="flex items-center gap-1 text-[11px] text-[#a1a1aa]">
                {user.username ? (
                  <span className="font-mono truncate max-w-[75px] xs:max-w-[95px] sm:max-w-[120px] md:max-w-[200px]">@{user.username}</span>
                ) : (
                  <span className="font-sans text-[11px] text-[#71717a] truncate max-w-[75px] xs:max-w-[95px] sm:max-w-[120px] md:max-w-[200px]">No username</span>
                )}
                <span className="hidden sm:inline">•</span>
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="hidden sm:inline font-mono hover:text-white transition-colors shrink-0 cursor-pointer"
                  title="Click to copy ID"
                >
                  ID: {user.telegramId}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Right Actions: Admin + Balance + Currency + Theme + (Web Profile) */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Persistent Admin Mode Toggle Pill for Verified Admins */}
          {isAdmin && (
            <button
              type="button"
              onClick={handleToggleAdmin}
              className={`min-h-[38px] flex items-center gap-1 px-2 py-1 sm:px-2.5 rounded-full text-[10px] font-semibold transition-all active:scale-95 shadow-sm cursor-pointer border ${
                isAdminMode
                  ? 'bg-[#22c55e]/15 hover:bg-[#22c55e]/25 text-[#22c55e] border-[#22c55e]/30'
                  : 'bg-[#7c3aed]/20 hover:bg-[#7c3aed]/30 text-[#a78bfa] border-[#7c3aed]/40'
              }`}
              title={isAdminMode ? 'Switch to Storefront' : 'Switch to Admin Panel'}
              aria-label="Toggle Admin Mode"
            >
              {isAdminMode ? (
                <>
                  <Store className="w-3.5 h-3.5 text-[#22c55e]" />
                  <span className="hidden xs:inline font-medium">Store</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-3.5 h-3.5 text-[#a78bfa]" />
                  <span className="hidden xs:inline font-medium">Admin</span>
                  <Sparkles className="w-2.5 h-2.5 text-[#f59e0b]" />
                </>
              )}
            </button>
          )}

          {/* Assets / Balance Pill with Sync */}
          <button
            type="button"
            onClick={handleSyncBalance}
            disabled={isSyncingBalance}
            className="min-h-[38px] flex items-center gap-1 sm:gap-1.5 bg-[#181820] hover:bg-[#1f1f2a] active:scale-95 border border-[#262630] rounded-full px-2.5 py-1 sm:px-3 transition-all shadow-sm cursor-pointer"
            title="Click to sync wallet balance"
            aria-label="Assets and Balance"
          >
            <span className="text-[10px] text-[#a1a1aa] font-medium hidden sm:inline">Balance:</span>
            <span className="text-xs font-bold font-mono text-[#22c55e]">
              {formatPrice(user.balance)}
            </span>
            <RefreshCw className={`w-3 h-3 text-[#a1a1aa] ${isSyncingBalance ? 'animate-spin text-[#8b5cf6]' : ''}`} />
          </button>

          {/* Currency Switcher */}
          <button
            type="button"
            onClick={handleToggleCurrency}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center gap-1 bg-[#181820] hover:bg-[#1f1f2a] active:scale-95 border border-[#262630] rounded-full px-2 py-1 transition-all shadow-sm cursor-pointer"
            title="Switch Currency (INR / USDT)"
            aria-label="Toggle currency between INR and USDT"
          >
            <ArrowLeftRight className="w-3 h-3 text-[#8b5cf6]" />
            <span className="text-xs font-bold text-[#22c55e]">
              {currency === 'INR' ? '₹' : '$'}
            </span>
          </button>

          {/* Theme Switcher Toggle */}
          <button
            type="button"
            onClick={handleToggleTheme}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center bg-[#181820] hover:bg-[#1f1f2a] active:scale-95 border border-[#262630] rounded-full transition-all shadow-sm cursor-pointer"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle Dark and Light theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-3.5 h-3.5 text-[#f59e0b] hover:rotate-45 transition-transform" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-[#7c3aed] hover:-rotate-12 transition-transform" />
            )}
          </button>

          {/* User Profile on the Top Right for Web */}
          {isWeb && (
            <div className="flex items-center gap-2 pl-2 sm:pl-2.5 border-l border-[#262630]">
              <div className="hidden sm:flex flex-col items-end min-w-0">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-xs sm:text-sm text-white tracking-tight truncate max-w-[95px] md:max-w-[150px]">
                    {user.firstName}
                  </span>
                  <BadgeCheck className="w-3.5 h-3.5 text-[#22c55e] shrink-0" />
                </div>
                <div className="flex items-center gap-1 text-[10px] text-[#a1a1aa]">
                  {user.username ? (
                    <span className="font-mono truncate max-w-[85px] md:max-w-[130px]">@{user.username}</span>
                  ) : (
                    <span className="font-sans text-[10px] text-[#71717a]">No username</span>
                  )}
                </div>
              </div>

              {/* Avatar */}
              <div className="relative shrink-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-[#7c3aed] to-[#3b82f6] flex items-center justify-center font-bold text-xs sm:text-sm text-white shadow-md ring-2 ring-[#262630] overflow-hidden">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.firstName} className="w-full h-full object-cover" />
                  ) : (
                    user.firstName.substring(0, 2).toUpperCase()
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
