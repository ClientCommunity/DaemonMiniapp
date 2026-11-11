import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ActiveNumberItem } from '../../types';
import {
  Copy,
  Check,
  Clock,
  Radio,
  XCircle,
  CheckCircle2,
  Zap,
  Key,
  RefreshCw,
  Phone,
  ShieldCheck,
  CheckCheck,
  LogOut,
} from 'lucide-react';
import { PlatformIcon } from './PlatformIcon';
import { hapticFeedback } from '../../utils/haptics';

interface ActiveNumberCardProps {
  item: ActiveNumberItem;
}

const ActiveNumberCard: React.FC<ActiveNumberCardProps> = ({ item }) => {
  const { fetchOtpForNumber, archiveActiveNumber, cancelActiveOtp, logoutServer2Session, addToast } = useApp();

  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copied2Fa, setCopied2Fa] = useState(false);
  const [copiedOtp, setCopiedOtp] = useState(false);
  const [isFetchingOtp, setIsFetchingOtp] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const {
    orderId,
    server,
    serviceName,
    country,
    phone,
    twoFa,
    otpCode,
    status,
    remainingSeconds,
  } = item;

  const isReceived = status === 'received' || !!otpCode;
  const has2Fa = !!(twoFa && twoFa.trim() !== '' && twoFa.toLowerCase() !== 'none');

  // Isolated local countdown timer per card — prevents root AppContext re-render thrashing
  const [localRemaining, setLocalRemaining] = useState<number>(() => {
    return remainingSeconds && remainingSeconds > 0 ? remainingSeconds : 0;
  });

  React.useEffect(() => {
    if (isReceived) return;
    const interval = setInterval(() => {
      setLocalRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isReceived]);

  React.useEffect(() => {
    if (remainingSeconds !== undefined && remainingSeconds > 0) {
      setLocalRemaining(remainingSeconds);
    }
  }, [remainingSeconds]);

  const handleCopyPhone = () => {
    hapticFeedback.light();
    navigator.clipboard?.writeText(phone);
    setCopiedPhone(true);
    addToast(`Phone number ${phone} copied!`, 'info', 'Copied');
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const handleCopy2Fa = () => {
    if (!twoFa) return;
    hapticFeedback.light();
    navigator.clipboard?.writeText(twoFa);
    setCopied2Fa(true);
    addToast(`2FA Password copied!`, 'info', 'Copied');
    setTimeout(() => setCopied2Fa(false), 2000);
  };

  const handleCopyOtp = () => {
    if (!otpCode) return;
    hapticFeedback.light();
    navigator.clipboard?.writeText(otpCode);
    setCopiedOtp(true);
    addToast(`OTP Code ${otpCode} copied!`, 'success', 'Copied');
    setTimeout(() => setCopiedOtp(false), 2000);
  };

  const handleGetOtp = async () => {
    if (cooldown > 0 || isFetchingOtp) return;
    hapticFeedback.medium();
    setIsFetchingOtp(true);
    setCooldown(8);

    const interval = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    try {
      await fetchOtpForNumber(orderId || phone);
    } finally {
      setIsFetchingOtp(false);
    }
  };

  const isServer2SingleAccount = server === 2 && Boolean(phone) && !phone.includes(',');

  const handleLogoutBotSession = async () => {
    if (isLoggingOut) return;
    if (!confirmLogout) {
      hapticFeedback.warning();
      setConfirmLogout(true);
      return;
    }
    hapticFeedback.medium();
    setIsLoggingOut(true);
    try {
      const ok = await logoutServer2Session(phone || orderId);
      if (ok) {
        setConfirmLogout(false);
      }
    } finally {
      setIsLoggingOut(false);
    }
  };

  const formatRemaining = (sec?: number) => {
    if (!sec || sec <= 0) return '00:00';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getServerBadge = () => {
    switch (server) {
      case 1:
        return { label: 'Server 1 · Global 2FA', color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' };
      case 2:
        return { label: 'Server 2 · Aged Session', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
      case 3:
        return { label: 'Server 3 · Fast OTP', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' };
      case 4:
        return { label: 'Server 4 · Carrier Number', color: 'bg-green-500/15 text-green-400 border-green-500/30' };
      default:
        return { label: `Server ${server}`, color: 'bg-zinc-800 text-zinc-300 border-zinc-700' };
    }
  };

  const serverBadge = getServerBadge();

  return (
    <div
      className={`p-4 rounded-2xl border transition-all shadow-xl relative overflow-hidden flex flex-col gap-3 ${
        isReceived
          ? 'bg-[#121217] border-[#22c55e]/50 shadow-green-glow/20'
          : 'bg-[#181820] border-[#8b5cf6]/40 shadow-violet-glow-sm'
      }`}
    >
      {/* Background ambient glow */}
      <div
        className={`absolute top-0 right-0 w-32 h-32 rounded-full filter blur-3xl pointer-events-none ${
          isReceived ? 'bg-[#22c55e]/15' : 'bg-[#7c3aed]/15'
        }`}
      />

      {/* Header bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <PlatformIcon
            platform={
              serviceName.toLowerCase().includes('telegram')
                ? 'tg'
                : serviceName.toLowerCase().includes('whatsapp')
                ? 'wa'
                : serviceName.toLowerCase().includes('instagram')
                ? 'ig'
                : serviceName.toLowerCase().includes('google')
                ? 'go'
                : 'spam'
            }
            className="w-4 h-4 shrink-0"
          />
          <span className="text-xs font-bold text-white tracking-wide truncate">
            {country} {serviceName !== country ? `(${serviceName})` : ''}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${serverBadge.color}`}>
            {serverBadge.label}
          </span>
          {server >= 3 && remainingSeconds !== undefined && (
            <span className="flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300">
              <Clock className="w-3 h-3 text-[#f59e0b]" />
              {formatRemaining(localRemaining)}
            </span>
          )}
        </div>
      </div>

      {/* Assigned Phone Number with 1-Tap Copy */}
      <div className="flex items-center justify-between bg-[#0b0b0e] border border-[#262630] rounded-xl px-3.5 py-2.5">
        <div className="flex items-center gap-2.5">
          <Phone className="w-4 h-4 text-[#8b5cf6] shrink-0" />
          <div className="flex flex-col">
            <span className="text-[10px] text-[#a1a1aa] uppercase font-semibold">Assigned Phone Number</span>
            <span className="text-sm font-mono font-bold text-white tracking-wider select-all">
              {phone}
            </span>
          </div>
        </div>
        <button
          onClick={handleCopyPhone}
          className="flex items-center gap-1.5 bg-[#1f1f2a] hover:bg-[#262630] text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[#262630] transition-all active:scale-95 text-white shrink-0"
        >
          {copiedPhone ? (
            <Check className="w-3.5 h-3.5 text-[#22c55e]" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-[#8b5cf6]" />
          )}
          <span>{copiedPhone ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      {/* 2FA Password Card (Prominently displayed if enabled) */}
      {has2Fa && (
        <div className="flex items-center justify-between bg-[#f59e0b]/10 border border-[#f59e0b]/30 rounded-xl px-3.5 py-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <Key className="w-4 h-4 text-[#f59e0b] shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] text-[#f59e0b] uppercase font-bold tracking-wide">
                2FA Cloud Password (Included)
              </span>
              <span className="text-sm font-mono font-black text-amber-200 tracking-wider truncate select-all">
                {twoFa}
              </span>
            </div>
          </div>
          <button
            onClick={handleCopy2Fa}
            className="flex items-center gap-1.5 bg-[#f59e0b]/20 hover:bg-[#f59e0b]/30 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[#f59e0b]/40 transition-all active:scale-95 text-amber-200 shrink-0"
          >
            {copied2Fa ? (
              <Check className="w-3.5 h-3.5 text-[#22c55e]" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-amber-300" />
            )}
            <span>{copied2Fa ? 'Copied' : 'Copy 2FA'}</span>
          </button>
        </div>
      )}

      {/* OTP Display or "Get OTP" Trigger */}
      {isReceived && otpCode ? (
        <div className="bg-[#22c55e]/10 border-2 border-dashed border-[#22c55e] rounded-xl p-3.5 text-center">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#22c55e] mb-1 flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#22c55e]" />
            <span>Login Code (OTP) Arrived!</span>
          </div>
          <div className="text-3xl font-mono font-black text-white tracking-widest my-1 drop-shadow-[0_0_12px_rgba(34,197,94,0.6)] select-all">
            {otpCode}
          </div>

          <button
            onClick={handleCopyOtp}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-[#22c55e] to-[#16a34a] hover:from-[#16a34a] hover:to-[#15803d] text-black font-black text-xs tracking-wide shadow-green-glow transition-all active:scale-[0.98] mt-2 cursor-pointer"
          >
            {copiedOtp ? (
              <>
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Copied OTP Code ({otpCode})!</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-black stroke-black" />
                <span>Copy OTP Code ({otpCode})</span>
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="bg-[#121217] border border-[#262630] rounded-xl p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-[#8b5cf6] animate-pulse" />
              <span className="text-[11px] font-bold text-white uppercase tracking-wider">
                Telegram Login Code
              </span>
            </div>
            <span className="text-[10px] text-zinc-400">Waiting for login attempt</span>
          </div>

          {/* Prominent GET OTP Button */}
          <button
            onClick={handleGetOtp}
            disabled={isFetchingOtp || cooldown > 0}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] hover:from-[#6d28d9] hover:to-[#5b21b6] text-white font-black text-xs shadow-violet-glow-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isFetchingOtp ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Checking Telegram for Login Code...</span>
              </>
            ) : cooldown > 0 ? (
              <>
                <Clock className="w-4 h-4" />
                <span>Check Again in {cooldown}s</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                <span>Get OTP Code</span>
              </>
            )}
          </button>

          <p className="text-[10px] text-center text-[#a1a1aa] leading-tight">
            1. Enter phone into official Telegram &rarr; 2. Tap <strong>Get OTP Code</strong> above &rarr; 3. Enter 2FA if requested.
          </p>
        </div>
      )}

      {/* Footer Actions: Archive / Done / Refund / Logout Bot */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
        <span className="text-[10px] text-zinc-500 font-mono shrink-0">Ref: {orderId}</span>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {server >= 3 && !isReceived && (
            <button
              onClick={() => {
                hapticFeedback.warning();
                cancelActiveOtp(orderId);
              }}
              className="flex items-center gap-1 text-[11px] font-semibold text-rose-400 hover:text-rose-300 hover:underline transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Cancel & Refund</span>
            </button>
          )}

          {isServer2SingleAccount && (
            confirmLogout ? (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleLogoutBotSession}
                  disabled={isLoggingOut}
                  className="flex items-center gap-1 text-[11px] font-bold text-white px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 transition-colors active:scale-95 disabled:opacity-50"
                >
                  <LogOut className="w-3 h-3" />
                  <span>{isLoggingOut ? 'Logging out...' : 'Confirm Logout'}</span>
                </button>
                <button
                  onClick={() => setConfirmLogout(false)}
                  disabled={isLoggingOut}
                  className="text-[11px] font-semibold text-zinc-400 hover:text-white px-2 py-1 rounded-lg bg-[#1f1f2a] border border-[#262630]"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={handleLogoutBotSession}
                disabled={isLoggingOut}
                className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 transition-colors active:scale-95 disabled:opacity-50"
                title="Terminate the bot Telethon session on this Telegram account after you sign in"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout Bot</span>
              </button>
            )
          )}

          <button
            onClick={() => archiveActiveNumber(orderId || phone)}
            className="flex items-center gap-1 text-[11px] font-semibold text-zinc-400 hover:text-white px-2 py-1 rounded-lg bg-[#1f1f2a] border border-[#262630] transition-colors active:scale-95"
            title="Archive from active list (accessible anytime in History)"
          >
            <CheckCheck className="w-3.5 h-3.5 text-[#22c55e]" />
            <span>Done / Archive</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface ActiveNumbersSectionProps {
  expandAll?: boolean;
  showEmptyState?: boolean;
}

export const ActiveNumbersSection: React.FC<ActiveNumbersSectionProps> = ({
  expandAll = false,
  showEmptyState = false,
}) => {
  const { activeNumbers, archiveAllActiveNumbers } = useApp();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!activeNumbers || activeNumbers.length === 0) {
    if (!showEmptyState) return null;
    return (
      <div className="p-8 text-center bg-[#181820] border border-[#262630] rounded-2xl flex flex-col items-center justify-center gap-3 my-2">
        <div className="w-12 h-12 rounded-2xl bg-[#121217] border border-[#262630] flex items-center justify-center">
          <ShieldCheck className="w-6 h-6 text-[#71717a]" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-white">No Active Numbers</span>
          <span className="text-xs text-[#a1a1aa] max-w-[280px]">
            Any virtual numbers you purchase awaiting OTP will appear here with live polling and instant copy.
          </span>
        </div>
      </div>
    );
  }

  const visibleNumbers = expandAll || isExpanded || activeNumbers.length <= 2 ? activeNumbers : activeNumbers.slice(0, 2);

  return (
    <section className="w-full flex flex-col gap-2.5 my-3 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#22c55e]" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-white">
            Active Numbers & Live OTP
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {activeNumbers.length > 1 && (
            <button
              onClick={() => archiveAllActiveNumbers()}
              className="text-[10px] font-semibold text-zinc-400 hover:text-white px-2 py-0.5 rounded-lg bg-[#1f1f2a] border border-[#262630] transition-colors"
              title="Dismiss all active numbers"
            >
              Clear All
            </button>
          )}
          <span className="text-[11px] font-bold text-[#8b5cf6] bg-[#7c3aed]/15 px-2.5 py-0.5 rounded-full border border-[#7c3aed]/30 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
            <span>{activeNumbers.length} Active</span>
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {visibleNumbers.map((item) => (
          <ActiveNumberCard key={item.orderId || item.phone} item={item} />
        ))}
      </div>

      {!expandAll && activeNumbers.length > 2 && (
        <button
          onClick={() => {
            hapticFeedback.selection();
            setIsExpanded((prev) => !prev);
          }}
          className="w-full py-2 px-3 rounded-xl bg-[#181820] border border-[#262630] text-xs font-semibold text-[#a1a1aa] hover:text-white flex items-center justify-center gap-1.5 transition-colors active:scale-98"
        >
          <span>{isExpanded ? 'Show Less' : `Show All ${activeNumbers.length} Active Numbers`}</span>
          <span className="text-[10px]">{isExpanded ? '▲' : '▼'}</span>
        </button>
      )}
    </section>
  );
};
