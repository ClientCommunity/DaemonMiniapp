import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { downloadApi } from '../../api/endpoints';
import { Modal } from '../common/Modal';
import {
  CheckCircle2,
  Clock,
  XCircle,
  Copy,
  Check,
  Download,
  RefreshCw,
  Zap,
  Key,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { PlatformIcon } from '../common/PlatformIcon';

export const ReceiptDrawer: React.FC = () => {
  const { selectedReceiptItem, closeReceiptDrawer, formatPrice, addToast, fetchOtpForNumber, logoutServer2Session } = useApp();

  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copied2Fa, setCopied2Fa] = useState(false);
  const [copiedOtp, setCopiedOtp] = useState(false);
  const [copiedOrderId, setCopiedOrderId] = useState(false);
  const [isFetchingOtp, setIsFetchingOtp] = useState(false);
  const [liveOtp, setLiveOtp] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => {
    setLiveOtp(null);
    setConfirmLogout(false);
    setIsLoggingOut(false);
  }, [selectedReceiptItem?.id]);

  if (!selectedReceiptItem) return null;

  const item = selectedReceiptItem;
  const isDeposit = item.amountInr > 0;
  const isFailed = item.status === 'failed';
  const isSuccess = item.status === 'success';
  const isWaiting = item.status === 'waiting' || item.status === 'in_progress';
  const isRefunded = item.status === 'refunded' || item.status === 'cancelled';

  const handleCopy = (text: string, type: 'phone' | 'otp' | 'orderId') => {
    navigator.clipboard?.writeText(text);
    if (type === 'phone') {
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    } else if (type === 'otp') {
      setCopiedOtp(true);
      setTimeout(() => setCopiedOtp(false), 2000);
    } else {
      setCopiedOrderId(true);
      setTimeout(() => setCopiedOrderId(false), 2000);
    }
    addToast('Copied to clipboard!', 'info');
  };

  const handleDownloadSession = () => {
    if (!item.sessionDownloadUrl) {
      addToast('No session file attached to this order.', 'warning');
      return;
    }
    const isZip = item.sessionDownloadUrl.includes('_zip') || item.sessionDownloadUrl.endsWith('.zip');
    const filename = isZip ? `bulk_sessions_${item.id}.zip` : `session_${item.id}.session`;
    downloadApi.triggerDownload(item.sessionDownloadUrl, filename);
    addToast('Opening download link...', 'info', 'Saved');
  };

  const effectiveOtp = liveOtp || item.otpCode;
  const hasPhone = !!item.phone;
  const isAccountOrOtp = item.category === 'account_purchase' || item.category === 'otp_activation';
  const isServer2SingleAccount =
    !isDeposit &&
    !isRefunded &&
    !isFailed &&
    hasPhone &&
    !String(item.phone || '').includes(',') &&
    (item.server === 'Server 2' || item.title.includes('Server 2'));
  const isSessionLoggedOut = Boolean(item.sessionLoggedOut);

  const handleGetOtp = async () => {
    if (!item.phone && !item.id) return;
    setIsFetchingOtp(true);
    try {
      const code = await fetchOtpForNumber(item.phone || item.id);
      if (code) setLiveOtp(code);
    } finally {
      setIsFetchingOtp(false);
    }
  };

  const handleLogoutBotSession = async () => {
    if (isLoggingOut) return;
    if (!confirmLogout) {
      setConfirmLogout(true);
      return;
    }
    setIsLoggingOut(true);
    try {
      const ok = await logoutServer2Session(item.phone || item.id);
      if (ok) {
        setConfirmLogout(false);
      }
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <Modal
      isOpen={!!selectedReceiptItem}
      onClose={closeReceiptDrawer}
      title="Transaction Receipt"
      subtitle={`Ref: ${item.id}`}
      footer={
        <div className="flex flex-col gap-2">
          {item.sessionDownloadUrl && !isSessionLoggedOut && (
            <button
              onClick={handleDownloadSession}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#22c55e] hover:bg-[#16a34a] text-black font-extrabold text-xs shadow-green-glow transition-all active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>{item.sessionDownloadUrl.includes('_zip') ? 'Download Bulk (.ZIP Archive)' : 'Download .Session File'}</span>
            </button>
          )}
          {isServer2SingleAccount && !isSessionLoggedOut && (
            confirmLogout ? (
              <div className="grid grid-cols-2 gap-2 w-full">
                <button
                  onClick={() => setConfirmLogout(false)}
                  disabled={isLoggingOut}
                  className="py-2.5 rounded-xl bg-[#1f1f2a] border border-[#262630] text-xs font-semibold text-[#a1a1aa] hover:text-white disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogoutBotSession}
                  disabled={isLoggingOut}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs transition-all active:scale-95 disabled:opacity-50"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{isLoggingOut ? 'Logging Out...' : 'Confirm Bot Logout'}</span>
                </button>
              </div>
            ) : (
              <button
                onClick={handleLogoutBotSession}
                disabled={isLoggingOut}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-bold text-xs transition-all active:scale-95 disabled:opacity-50"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout Bot Session</span>
              </button>
            )
          )}
          {isServer2SingleAccount && isSessionLoggedOut && (
            <div className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-xs">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Bot Session Logged Out — Only Your Login Remains</span>
            </div>
          )}
          <button
            onClick={closeReceiptDrawer}
            className="w-full py-2.5 rounded-xl bg-[#1f1f2a] border border-[#262630] text-xs font-semibold text-white hover:bg-[#262630]"
          >
            Close Receipt
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-3.5">
        {/* Top Status & Amount Card */}
        <div className="p-4 rounded-2xl bg-[#0b0b0e] border border-[#262630] flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-2 bg-[#181820]">
            {isSuccess && <CheckCircle2 className="w-6 h-6 text-[#22c55e]" />}
            {isWaiting && <Clock className="w-6 h-6 text-[#f59e0b] animate-spin" />}
            {isRefunded && <RefreshCw className="w-6 h-6 text-emerald-400" />}
            {isFailed && <XCircle className="w-6 h-6 text-red-400" />}
          </div>

          <span className="text-2xl font-extrabold font-mono text-white">
            {isDeposit ? `+${formatPrice(item.amountInr)}` : formatPrice(item.amountInr)}
          </span>

          <span
            className={`text-xs px-2.5 py-0.5 rounded-full font-bold mt-2 uppercase border ${
              isFailed
                ? 'bg-red-500/15 text-red-400 border-red-500/30'
                : isSuccess
                ? 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30'
                : isWaiting
                ? 'bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/30'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
            }`}
          >
            {isFailed ? 'Failed' : isRefunded ? 'Refunded' : isWaiting ? 'In Progress' : isDeposit ? 'Credited' : 'Completed'}
          </span>
        </div>

        {/* Detailed Metadata Grid */}
        <div className="p-3.5 bg-[#181820] border border-[#262630] rounded-2xl flex flex-col gap-2.5 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-[#262630]">
            <span className="text-[#a1a1aa]">Product / Service</span>
            <div className="flex items-center gap-1.5 justify-end">
              {['telegram', 'teleg', 'server 1', 'server 2', 'whatsapp', 'wa', 'instagram', 'insta', 'youtube', 'tiktok', 'twitter', 'google'].some(p => item.title.toLowerCase().includes(p)) && (
                <PlatformIcon
                  platform={
                    item.title.toLowerCase().includes('telegram') || item.title.toLowerCase().includes('teleg') || item.title.toLowerCase().includes('server 1') || item.title.toLowerCase().includes('server 2')
                      ? 'tg'
                      : item.title.toLowerCase().includes('whatsapp') || item.title.toLowerCase().includes('wa')
                      ? 'wa'
                      : item.title.toLowerCase().includes('instagram') || item.title.toLowerCase().includes('insta')
                      ? 'ig'
                      : item.title.toLowerCase().includes('youtube')
                      ? 'yt'
                      : item.title.toLowerCase().includes('tiktok')
                      ? 'tk'
                      : item.title.toLowerCase().includes('twitter')
                      ? 'tw'
                      : 'go'
                  }
                  className="w-4 h-4 shrink-0"
                />
              )}
              <span className="font-bold text-white text-right max-w-[180px] truncate">
                {item.title
                  .replace(/^[\s\uFE0F]*[\u{1F300}-\u{1FAD6}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{FE00}-\u{FE0F}]+\s*/u, '')
                  .trim()}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-[#262630]">
            <span className="text-[#a1a1aa]">Order Reference ID</span>
            <div className="flex items-center gap-1.5 font-mono text-white">
              <span>{item.id}</span>
              <button
                onClick={() => handleCopy(item.id, 'orderId')}
                className="text-[#a1a1aa] hover:text-white"
              >
                {copiedOrderId ? <Check className="w-3.5 h-3.5 text-[#22c55e]" /> : <Copy className="w-3.5 h-3.5 text-[#8b5cf6]" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-[#262630]">
            <span className="text-[#a1a1aa]">Timestamp</span>
            <span className="text-white font-medium">{item.date}</span>
          </div>

          {item.server && (
            <div className="flex items-center justify-between pb-2 border-b border-[#262630]">
              <span className="text-[#a1a1aa]">Server Origin</span>
              <span className="text-[#8b5cf6] font-semibold">{item.server}</span>
            </div>
          )}

          {item.phone && (
            <div className="flex items-center justify-between pb-2 border-b border-[#262630]">
              <span className="text-[#a1a1aa]">
                {item.category === 'smm_order' ? 'Target Link' : 'Phone Number'}
              </span>
              <div className="flex items-center gap-1.5 font-mono font-bold text-white max-w-[200px]">
                <span className="truncate">{item.phone}</span>
                <button
                  onClick={() => handleCopy(item.phone!, 'phone')}
                  className="text-[#a1a1aa] hover:text-white"
                >
                  {copiedPhone ? <Check className="w-3.5 h-3.5 text-[#22c55e]" /> : <Copy className="w-3.5 h-3.5 text-[#8b5cf6]" />}
                </button>
              </div>
            </div>
          )}

          {effectiveOtp ? (
            <div className="flex items-center justify-between pb-2 border-b border-[#262630]">
              <span className="text-[#a1a1aa]">OTP Validation Code</span>
              <div className="flex items-center gap-1.5 font-mono font-extrabold text-[#22c55e]">
                <span>{effectiveOtp}</span>
                <button
                  onClick={() => handleCopy(effectiveOtp, 'otp')}
                  className="text-[#a1a1aa] hover:text-white"
                >
                  {copiedOtp ? <Check className="w-3.5 h-3.5 text-[#22c55e]" /> : <Copy className="w-3.5 h-3.5 text-[#8b5cf6]" />}
                </button>
              </div>
            </div>
          ) : isServer2SingleAccount && isSessionLoggedOut ? (
            <div className="pt-1 pb-2 border-b border-[#262630] flex items-center justify-between text-xs">
              <span className="text-[#a1a1aa]">Bot Session Status</span>
              <span className="text-emerald-400 font-semibold">Logged Out</span>
            </div>
          ) : isAccountOrOtp && hasPhone && !isRefunded ? (
            <div className="pt-1 pb-2 border-b border-[#262630]">
              <button
                onClick={handleGetOtp}
                disabled={isFetchingOtp}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] hover:from-[#6d28d9] hover:to-[#5b21b6] text-white font-bold text-xs shadow-violet-glow-sm transition-all active:scale-98 disabled:opacity-50"
              >
                {isFetchingOtp ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Checking for OTP Code...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                    <span>Get OTP / Telegram Code</span>
                  </>
                )}
              </button>
            </div>
          ) : null}

          {item.twoFa && (
            <div className="flex items-center justify-between pb-2 border-b border-[#262630]">
              <div className="flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[#a1a1aa]">2FA Password</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono font-bold text-amber-300">
                <span>{item.twoFa}</span>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(item.twoFa!);
                    setCopied2Fa(true);
                    setTimeout(() => setCopied2Fa(false), 2000);
                    addToast('2FA Password copied!', 'info');
                  }}
                  className="text-[#a1a1aa] hover:text-white"
                >
                  {copied2Fa ? <Check className="w-3.5 h-3.5 text-[#22c55e]" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
                </button>
              </div>
            </div>
          )}

          {item.targetLink && (
            <div className="flex items-center justify-between pb-2 border-b border-[#262630]">
              <span className="text-[#a1a1aa]">Target Link</span>
              <span className="text-white font-mono truncate max-w-[180px]">{item.targetLink}</span>
            </div>
          )}

          {item.quantity && (
            <div className="flex items-center justify-between pb-2 border-b border-[#262630]">
              <span className="text-[#a1a1aa]">
                {isSuccess ? 'Quantity Delivered' : 'Order Quantity'}
              </span>
              <span className="text-white font-bold font-mono">{item.quantity.toLocaleString()}</span>
            </div>
          )}

          {item.subtitle && (isFailed || isRefunded || item.category === 'smm_order') && (
            <div className="flex flex-col gap-1 pb-2 border-b border-[#262630]">
              <span className="text-[#a1a1aa]">Status Details</span>
              <span className="text-zinc-200 text-[11px] leading-relaxed break-words">{item.subtitle}</span>
            </div>
          )}

          {item.utr && (
            <div className="flex items-center justify-between">
              <span className="text-[#a1a1aa]">Banking UTR Hash</span>
              <span className="text-white font-mono font-bold">{item.utr}</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
