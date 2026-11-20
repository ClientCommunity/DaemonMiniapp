import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAdmin } from '../context/AdminContext';
import { BadgeCheck, ArrowLeftRight, RefreshCw, ShieldAlert, Sparkles, Store, Sun, Moon, ChevronDown, Bell } from 'lucide-react';
import { hapticFeedback } from '../utils/haptics';
import { ProfileDropdownCard } from './common/ProfileDropdownCard';
import { useWebsiteNotifications } from '../context/WebsiteNotificationsContext';

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
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const isLight = theme === 'light';

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

  const {
    isEnabled: isWebNotificationsEnabled,
    unreadCount,
    openInbox,
  } = useWebsiteNotifications();

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
    <header className={`sticky top-0 z-40 w-full backdrop-blur-md border-b pt-[max(10px,env(safe-area-inset-top))] pb-2.5 px-2.5 sm:px-4 transition-colors duration-200 ${
      isLight ? 'bg-white/90 border-[#E5DCF4]' : 'bg-[#121217]/95 border-[#262630]'
    }`}>
      <div className={`flex items-center justify-between gap-1 sm:gap-2 w-full ${isWeb ? 'max-w-7xl mx-auto' : 'max-w-full'}`}>
        {/* Left Side: Brand Logo & Title for Web, or User Profile for Mobile/Telegram */}
        {isWeb ? (
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-black flex items-center justify-center p-1 sm:p-1.5 shadow-sm shrink-0 overflow-hidden border border-[#262630]">
              <img
                src={LOGO_URL}
                alt="Deamon OTP Logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.src.endsWith('deamon-logo.webp')) {
                    target.src = './deamon-logo.webp';
                  }
                }}
              />
            </div>
            <div className="flex flex-col min-w-0">
              <span className={`font-extrabold text-sm sm:text-base tracking-tight flex items-center gap-1.5 truncate ${
                isLight ? 'text-[#211536]' : 'text-white'
              }`}>
                <span className="truncate">Deamon OTP</span>
                <span className="hidden sm:inline-flex text-[9px] font-mono font-bold bg-[#22c55e]/15 text-[#22c55e] border border-[#22c55e]/30 px-1.5 py-0.2 rounded-full shrink-0">
                  STORE
                </span>
              </span>
              <span className={`hidden sm:block text-[10px] font-medium truncate ${
                isLight ? 'text-[#74638B]' : 'text-[#a1a1aa]'
              }`}>
                Virtual Numbers &amp; Telegram Sessions
              </span>
            </div>
          </div>
        ) : (
          /* User Info (Left for Mobile / Telegram Shell) */
          <div className="relative flex-1 min-w-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsProfileMenuOpen((prev) => !prev);
              }}
              className="flex items-center gap-2 min-w-0 text-left rounded-xl p-1 -ml-1 transition-all hover:bg-white/5 active:scale-95 cursor-pointer"
              title="Account & Settings"
            >
              <div className="relative shrink-0">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-tr from-[#7c3aed] to-[#3b82f6] flex items-center justify-center font-bold text-xs text-white shadow-md ring-2 ring-[#262630] overflow-hidden">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.firstName} className="w-full h-full object-cover" />
                  ) : (
                    user.firstName.substring(0, 2).toUpperCase()
                  )}
                </div>
              </div>

              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-xs sm:text-sm text-white tracking-tight truncate max-w-[95px] xs:max-w-[125px] sm:max-w-[170px] md:max-w-[280px]">
                    {user.firstName}
                  </span>
                  <BadgeCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#22c55e] shrink-0" />
                  <ChevronDown className={`w-3 h-3 text-[#a1a1aa] transition-transform duration-200 ${isProfileMenuOpen ? 'rotate-180' : ''}`} />
                </div>
                <div className="flex items-center gap-1 text-[11px] text-[#a1a1aa]">
                  {user.username ? (
                    <span className="font-mono truncate max-w-[85px] xs:max-w-[105px] sm:max-w-[130px] md:max-w-[200px]">@{user.username}</span>
                  ) : (
                    <span className="font-sans text-[11px] text-[#71717a] truncate max-w-[85px] xs:max-w-[105px] sm:max-w-[130px] md:max-w-[200px]">No username</span>
                  )}
                  <span className="hidden sm:inline">•</span>
                  <span className="hidden sm:inline font-mono">ID: {user.telegramId}</span>
                </div>
              </div>
            </button>

            <ProfileDropdownCard
              isOpen={isProfileMenuOpen}
              onClose={() => setIsProfileMenuOpen(false)}
              align="left"
            />
          </div>
        )}

        {/* Right Actions: Admin + Unified Wallet Chip + Theme + Notifications + (Web Profile) */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Persistent Admin Mode Toggle Pill for Verified Admins */}
          {isAdmin && (
            <button
              type="button"
              onClick={handleToggleAdmin}
              className={`h-9 flex items-center gap-1 px-2 sm:px-2.5 rounded-xl text-[10px] font-semibold transition-all active:scale-95 shadow-sm cursor-pointer border ${
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

          {/* Unified Wallet & Currency Chip */}
          <div
            className={`h-9 flex items-center rounded-xl border transition-all shadow-sm ${
              isLight
                ? 'bg-[#FAF8FF] border-[#E5DCF4]'
                : 'bg-[#181820] border-[#262630]'
            }`}
          >
            {/* Balance Portion: Click to Sync */}
            <button
              type="button"
              onClick={handleSyncBalance}
              disabled={isSyncingBalance}
              className={`h-full flex items-center gap-1.5 px-2.5 text-left transition-colors cursor-pointer group active:scale-[0.98] ${
                isLight ? 'hover:bg-violet-50/80 rounded-l-xl' : 'hover:bg-[#20202c] rounded-l-xl'
              }`}
              title="Click to sync balance"
              aria-label="Wallet Balance - Click to sync"
            >
              <RefreshCw
                className={`w-3 h-3 transition-colors shrink-0 ${
                  isSyncingBalance
                    ? 'animate-spin text-[#8b5cf6]'
                    : isLight
                    ? 'text-[#74638B] group-hover:text-[#7c3aed]'
                    : 'text-[#71717a] group-hover:text-[#a78bfa]'
                }`}
              />
              <span className="text-xs font-black font-mono text-[#22c55e] tracking-tight whitespace-nowrap">
                {formatPrice(user.balance)}
              </span>
            </button>

            {/* Subtle Divider */}
            <div className={`h-4 w-px shrink-0 ${isLight ? 'bg-[#E5DCF4]' : 'bg-[#2a2a38]'}`} />

            {/* Currency Switcher Portion */}
            <button
              type="button"
              onClick={handleToggleCurrency}
              className={`h-full flex items-center justify-center gap-1 px-2 transition-colors cursor-pointer group active:scale-[0.98] ${
                isLight ? 'hover:bg-violet-50/80 rounded-r-xl' : 'hover:bg-[#20202c] rounded-r-xl'
              }`}
              title={`Switch Currency (Current: ${currency})`}
              aria-label="Toggle currency between INR and USDT"
            >
              <span className="text-[10px] font-bold font-mono text-[#a78bfa] group-hover:text-[#c4b5fd] whitespace-nowrap">
                {currency === 'INR' ? '₹ INR' : '$ USDT'}
              </span>
              <ArrowLeftRight className="w-2.5 h-2.5 text-[#71717a] group-hover:text-white transition-colors shrink-0" />
            </button>
          </div>

          {/* Theme Switcher Toggle (Desktop only, mobile has it in Profile menu) */}
          <button
            type="button"
            onClick={handleToggleTheme}
            className={`hidden md:flex h-9 w-9 items-center justify-center active:scale-95 border rounded-xl transition-all shadow-sm cursor-pointer ${
              isLight
                ? 'bg-[#FAF8FF] hover:bg-white border-[#E5DCF4]'
                : 'bg-[#181820] hover:bg-[#1f1f2a] border-[#262630]'
            }`}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle Dark and Light theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-3.5 h-3.5 text-[#f59e0b] hover:rotate-45 transition-transform" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-[#7c3aed] hover:-rotate-12 transition-transform" />
            )}
          </button>

          {/* Desktop Website Notification Bell (hidden below md where mobile BottomNav + Account red-dot guides user) */}
          {isWeb && isWebNotificationsEnabled && (
            <button
              type="button"
              onClick={openInbox}
              className={`hidden md:flex relative h-9 w-9 items-center justify-center active:scale-95 border rounded-xl transition-all shadow-sm cursor-pointer ${
                isLight
                  ? 'bg-[#FAF8FF] hover:bg-white border-[#E5DCF4] text-[#514364] hover:text-[#7c3aed]'
                  : 'bg-[#181820] hover:bg-[#1f1f2a] border-[#262630] text-zinc-300 hover:text-white'
              }`}
              title={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
              aria-label="Open notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span
                  className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-extrabold flex items-center justify-center ring-2 animate-pulse ${
                    isLight ? 'ring-white' : 'ring-[#121217]'
                  }`}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          )}

          {/* User Profile on the Top Right for Web */}
          {isWeb && (
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsProfileMenuOpen((prev) => !prev);
                }}
                className={`h-9 flex items-center gap-1.5 sm:gap-2 px-1.5 sm:px-2 rounded-xl border transition-all cursor-pointer hover:bg-violet-500/10 active:scale-95 ${
                  isLight ? 'border-[#E5DCF4] bg-[#FAF8FF]' : 'border-[#262630] bg-[#181820]'
                }`}
                title="Account Menu"
                aria-label="User Account Menu"
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-gradient-to-tr from-[#7c3aed] to-[#3b82f6] flex items-center justify-center font-bold text-[11px] sm:text-xs text-white shadow-sm overflow-hidden`}>
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.firstName} className="w-full h-full object-cover" />
                    ) : (
                      user.firstName.substring(0, 2).toUpperCase()
                    )}
                  </div>
                </div>

                <div className="hidden sm:flex flex-col items-start min-w-0">
                  <div className="flex items-center gap-1">
                    <span className={`font-bold text-xs tracking-tight truncate max-w-[85px] md:max-w-[120px] ${
                      isLight ? 'text-[#211536]' : 'text-white'
                    }`}>
                      {user.firstName}
                    </span>
                    <BadgeCheck className="w-3 h-3 text-[#22c55e] shrink-0" />
                  </div>
                </div>

                <ChevronDown className={`w-3 h-3 text-[#a1a1aa] transition-transform duration-200 ${isProfileMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              <ProfileDropdownCard
                isOpen={isProfileMenuOpen}
                onClose={() => setIsProfileMenuOpen(false)}
                align="right"
              />
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
