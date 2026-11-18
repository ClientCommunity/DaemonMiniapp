import React, { useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { useWebsiteNotifications } from '../../context/WebsiteNotificationsContext';
import { isTelegramWebApp, setWebUserToken } from '../../api/client';
import {
  User,
  Settings,
  LogOut,
  BadgeCheck,
  ChevronRight,
  Wallet,
  Copy,
  Check,
} from 'lucide-react';

export interface ProfileDropdownCardProps {
  isOpen: boolean;
  onClose: () => void;
  align?: 'left' | 'right' | 'bottom';
  className?: string;
}

export const ProfileDropdownCard: React.FC<ProfileDropdownCardProps> = ({
  isOpen,
  onClose,
  align = 'right',
  className = '',
}) => {
  const { user, activeTab, setActiveTab, formatPrice, addToast, theme } = useApp();
  const { isEnabled: isWebNotificationsEnabled, unreadCount } = useWebsiteNotifications();
  const cardRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = React.useState(false);

  const isLight = theme === 'light';
  const isTg = isTelegramWebApp();

  // Close on click outside or Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopyId = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(String(user.telegramId));
    setCopiedId(true);
    addToast(`ID ${user.telegramId} copied!`, 'info', 'Copied');
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleNavigate = (tab: 'profile' | 'settings') => {
    setActiveTab(tab);
    onClose();
  };

  const handleLogout = () => {
    onClose();
    setWebUserToken(null);
    try {
      localStorage.removeItem('krish_web_user_token');
      sessionStorage.removeItem('krish_merge_token');
      localStorage.removeItem('krish_merge_token');
    } catch {}
    window.location.reload();
  };

  // Determine positioning classes
  let positionClasses = 'top-full mt-2.5 right-0';
  if (align === 'left') {
    positionClasses = 'top-full mt-2.5 left-0';
  } else if (align === 'bottom') {
    positionClasses = 'bottom-full mb-3 right-0 sm:right-2';
  }

  return (
    <>
      {/* Fixed backdrop to reliably capture and dismiss on outside clicks */}
      <div
        className="fixed inset-0 z-40 bg-black/15 sm:bg-transparent"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />

      <div
        ref={cardRef}
        style={{
          backgroundColor: isLight ? '#ffffff' : '#14141c',
          opacity: 1,
        }}
        className={`absolute z-50 w-72 max-w-[calc(100vw-24px)] rounded-2xl p-3 border shadow-2xl transition-all animate-in fade-in zoom-in-95 duration-150 ${positionClasses} ${
          isLight
            ? 'bg-white border-[#E5DCF4] text-[#211536] shadow-purple-950/20'
            : 'bg-[#14141c] border-[#262635] text-white shadow-black/90'
        } ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
      {/* User Info Header */}
      <div className="flex items-center gap-3 p-2 rounded-xl mb-2 bg-gradient-to-r from-violet-500/10 via-purple-500/5 to-transparent border border-violet-500/15">
        <div className="relative shrink-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#7c3aed] to-[#3b82f6] flex items-center justify-center font-extrabold text-sm text-white shadow-md ring-2 ring-violet-500/20 overflow-hidden">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.firstName} className="w-full h-full object-cover" />
            ) : (
              user.firstName.substring(0, 2).toUpperCase()
            )}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#14141c]" />
        </div>

        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className={`font-bold text-xs sm:text-sm truncate ${isLight ? 'text-[#211536]' : 'text-white'}`}>
              {user.firstName}
            </span>
            <BadgeCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          </div>

          <div className="flex items-center gap-1.5 mt-0.5">
            {user.username ? (
              <span className={`text-[11px] font-mono truncate max-w-[120px] ${isLight ? 'text-[#74638B]' : 'text-zinc-400'}`}>
                @{user.username}
              </span>
            ) : (
              <span className={`text-[10px] ${isLight ? 'text-[#74638B]' : 'text-zinc-500'}`}>
                ID: {user.telegramId}
              </span>
            )}

            <button
              type="button"
              onClick={handleCopyId}
              className={`p-0.5 rounded transition-colors ${
                isLight ? 'text-[#74638B] hover:text-[#7C3AED]' : 'text-zinc-500 hover:text-white'
              }`}
              title="Copy User ID"
            >
              {copiedId ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>

      {/* Wallet Balance Strip */}
      <div
        className={`px-3 py-2 rounded-xl mb-2 flex items-center justify-between border ${
          isLight ? 'bg-[#FAF8FF] border-[#E5DCF4]' : 'bg-[#181822] border-[#262635]'
        }`}
      >
        <div className="flex items-center gap-1.5">
          <Wallet className="w-3.5 h-3.5 text-violet-500" />
          <span className={`text-[11px] font-semibold ${isLight ? 'text-[#74638B]' : 'text-zinc-400'}`}>
            Wallet Balance
          </span>
        </div>
        <span className="text-xs font-black font-mono text-emerald-500">
          {formatPrice(user.balance)}
        </span>
      </div>

      {/* Navigation Options List */}
      <div className="space-y-1">
        {/* OPTION 1: Account */}
        <button
          type="button"
          onClick={() => handleNavigate('profile')}
          className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all cursor-pointer text-left ${
            activeTab === 'profile'
              ? 'bg-[#7C3AED] text-white shadow-md shadow-violet-500/25 font-bold'
              : isLight
              ? 'hover:bg-violet-50 text-[#514364] hover:text-[#211536]'
              : 'hover:bg-[#1f1f2b] text-zinc-300 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                activeTab === 'profile'
                  ? 'bg-white/20 text-white'
                  : isLight
                  ? 'bg-violet-100/70 text-[#7C3AED]'
                  : 'bg-[#252536] text-violet-400'
              }`}
            >
              <User className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold leading-tight">Account Overview</span>
                {!isTg && isWebNotificationsEnabled && unreadCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-extrabold leading-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    {unreadCount}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] leading-tight truncate ${
                  activeTab === 'profile' ? 'text-white/80' : isLight ? 'text-[#74638B]' : 'text-zinc-500'
                }`}
              >
                Profile, balances &amp; P2P transfers
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 opacity-60 shrink-0 ml-1" />
        </button>

        {/* OPTION 2: Settings */}
        <button
          type="button"
          onClick={() => handleNavigate('settings')}
          className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all cursor-pointer text-left ${
            activeTab === 'settings'
              ? 'bg-[#7C3AED] text-white shadow-md shadow-violet-500/25 font-bold'
              : isLight
              ? 'hover:bg-violet-50 text-[#514364] hover:text-[#211536]'
              : 'hover:bg-[#1f1f2b] text-zinc-300 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                activeTab === 'settings'
                  ? 'bg-white/20 text-white'
                  : isLight
                  ? 'bg-violet-100/70 text-[#7C3AED]'
                  : 'bg-[#252536] text-violet-400'
              }`}
            >
              <Settings className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold leading-tight">Settings &amp; Backup</span>
              <span
                className={`text-[10px] leading-tight truncate ${
                  activeTab === 'settings' ? 'text-white/80' : isLight ? 'text-[#74638B]' : 'text-zinc-500'
                }`}
              >
                1-Click merge, API &amp; security
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 opacity-60 shrink-0 ml-1" />
        </button>

        {/* OPTION 3: Logout (ONLY shown on Website version, NEVER on Mini App!) */}
        {!isTg && (
          <>
            <div className={`my-1 border-t ${isLight ? 'border-[#E5DCF4]' : 'border-[#262635]'}`} />
            <button
              type="button"
              onClick={handleLogout}
              className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all cursor-pointer text-left group ${
                isLight ? 'hover:bg-rose-50 text-rose-600' : 'hover:bg-rose-500/10 text-rose-400'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    isLight ? 'bg-rose-100 text-rose-600' : 'bg-rose-500/15 text-rose-400'
                  }`}
                >
                  <LogOut className="w-4 h-4" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold leading-tight">Log Out</span>
                  <span className={`text-[10px] leading-tight ${isLight ? 'text-rose-400' : 'text-rose-400/70'}`}>
                    Sign out of this browser
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 opacity-40 group-hover:opacity-100 shrink-0 ml-1" />
            </button>
          </>
        )}
      </div>
    </div>
    </>
  );
};
