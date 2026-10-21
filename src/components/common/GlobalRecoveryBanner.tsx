import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Zap, Copy, Check, QrCode, ArrowRight, CheckCircle2 } from 'lucide-react';

export const GlobalRecoveryBanner: React.FC = () => {
  const {
    activeOtpSession,
    activeInvoice,
    activeTab,
    setActiveTab,
    setSelectedServer,
    addToast,
  } = useApp();

  const [copiedOtp, setCopiedOtp] = useState(false);
  const [invoiceTimeLeft, setInvoiceTimeLeft] = useState<number>(() => {
    if (!activeInvoice) return 0;
    return Math.max(0, Math.floor((activeInvoice.expiresAt - Date.now()) / 1000));
  });

  // Real-world countdown for pending deposit invoice
  useEffect(() => {
    if (!activeInvoice) return;

    const tick = () => {
      const remaining = Math.max(0, Math.floor((activeInvoice.expiresAt - Date.now()) / 1000));
      setInvoiceTimeLeft(remaining);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeInvoice?.expiresAt]);

  const handleCopyOtp = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedOtp(true);
    try {
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }
    } catch {}
    addToast(`OTP Code ${code} copied to clipboard!`, 'success', 'Code Copied');
    setTimeout(() => setCopiedOtp(false), 2000);
  };

  const handleJumpToOtpSession = () => {
    if (!activeOtpSession) return;
    if (activeOtpSession.server === 3 || activeOtpSession.server === 4) {
      setSelectedServer(activeOtpSession.server);
      setActiveTab('store');
    } else {
      setActiveTab('home');
    }
  };

  const handleJumpToDeposit = () => {
    setActiveTab('deposit');
  };

  // 1. Highest Priority: Active OTP code received while away
  if (activeOtpSession && activeOtpSession.status === 'received' && activeOtpSession.otpCode) {
    return (
      <div className="w-full px-4 pt-2 pb-1 z-30 animate-in fade-in slide-in-from-top-2 duration-200">
        <div className="flex items-center justify-between gap-2.5 bg-gradient-to-r from-[#121217] via-[#102418] to-[#121217] border border-[#22c55e]/60 rounded-xl px-3.5 py-2.5 shadow-lg shadow-green-950/30">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[#22c55e]/20 border border-[#22c55e]/40 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 text-[#22c55e]" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-[#22c55e] uppercase tracking-wider">SMS Arrived!</span>
                <span className="text-[10px] text-[#a1a1aa] font-medium truncate">
                  {activeOtpSession.serviceName}
                </span>
              </div>
              <span className="text-sm font-mono font-extrabold text-white tracking-widest truncate">
                {activeOtpSession.otpCode}
              </span>
            </div>
          </div>

          <button
            onClick={() => handleCopyOtp(activeOtpSession.otpCode!)}
            className="flex items-center gap-1.5 bg-[#22c55e] hover:bg-[#16a34a] active:scale-95 text-black px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md shrink-0 cursor-pointer"
          >
            {copiedOtp ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedOtp ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>
    );
  }

  // 2. Second Priority: Active OTP waiting for SMS (show banner if user is on other tabs/views)
  if (
    activeOtpSession &&
    activeOtpSession.status === 'waiting' &&
    activeTab !== 'home'
  ) {
    const minutes = Math.floor(activeOtpSession.remainingSeconds / 60);
    const seconds = activeOtpSession.remainingSeconds % 60;
    const timeFormatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    return (
      <div className="w-full px-4 pt-2 pb-1 z-30 animate-in fade-in slide-in-from-top-2 duration-200">
        <div className="flex items-center justify-between gap-2 bg-[#181820]/95 backdrop-blur-md border border-[#f59e0b]/40 rounded-xl px-3 py-2 shadow-md">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2 h-2 rounded-full bg-[#f59e0b] animate-ping shrink-0" />
            <Zap className="w-3.5 h-3.5 text-[#f59e0b] shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] text-[#a1a1aa] font-semibold uppercase tracking-wider truncate">
                {activeOtpSession.serviceName} ({activeOtpSession.phone || 'Allocating...'})
              </span>
              <span className="text-xs font-bold text-white tracking-tight">
                Waiting for SMS · <span className="font-mono text-[#f59e0b]">{timeFormatted}</span>
              </span>
            </div>
          </div>

          <button
            onClick={handleJumpToOtpSession}
            className="flex items-center gap-1 bg-[#f59e0b]/15 hover:bg-[#f59e0b]/25 text-[#f59e0b] border border-[#f59e0b]/30 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 cursor-pointer"
          >
            <span>View</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  // 3. Third Priority: Active UPI deposit invoice in progress (visible when navigating away from Deposit tab)
  if (
    activeInvoice &&
    invoiceTimeLeft > 0 &&
    activeTab !== 'deposit'
  ) {
    const m = Math.floor(invoiceTimeLeft / 60);
    const s = invoiceTimeLeft % 60;
    const invoiceTimer = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

    return (
      <div className="w-full px-4 pt-2 pb-1 z-30 animate-in fade-in slide-in-from-top-2 duration-200">
        <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-[#181820] via-[#1c172e] to-[#181820] border border-[#8b5cf6]/50 rounded-xl px-3 py-2 shadow-md shadow-purple-950/20">
          <div className="flex items-center gap-2 min-w-0">
            <QrCode className="w-4 h-4 text-[#a78bfa] shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] text-[#a1a1aa] font-semibold uppercase tracking-wider">
                Pending UPI Payment
              </span>
              <span className="text-xs font-bold text-white tracking-tight">
                ₹{activeInvoice.amount} · <span className="font-mono text-[#a78bfa]">{invoiceTimer} left</span>
              </span>
            </div>
          </div>

          <button
            onClick={handleJumpToDeposit}
            className="flex items-center gap-1 bg-[#8b5cf6] hover:bg-[#7c3aed] active:scale-95 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shadow-sm shrink-0 cursor-pointer"
          >
            <span>Resume</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  return null;
};
