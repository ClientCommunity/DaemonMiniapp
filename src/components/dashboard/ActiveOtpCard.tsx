import React from 'react';
import { useApp } from '../../context/AppContext';
import { Copy, Check, Clock, Radio, XCircle, CheckCircle2 } from 'lucide-react';
import { PlatformIcon } from '../common/PlatformIcon';

export const ActiveOtpCard: React.FC = () => {
  const { activeOtpSession, cancelActiveOtp, finishActiveOtp, addToast } = useApp();
  const [copiedPhone, setCopiedPhone] = React.useState(false);
  const [copiedOtp, setCopiedOtp] = React.useState(false);

  if (!activeOtpSession) return null;

  const { orderId, serviceName, country, phone, status, otpCode, remainingSeconds } = activeOtpSession;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeFormatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const handleCopyPhone = () => {
    navigator.clipboard?.writeText(phone);
    setCopiedPhone(true);
    addToast(`Phone number ${phone} copied!`, 'info', 'Copied');
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const handleCopyOtp = () => {
    if (!otpCode) return;
    navigator.clipboard?.writeText(otpCode);
    setCopiedOtp(true);
    addToast(`OTP Code ${otpCode} copied!`, 'success', 'Copied');
    setTimeout(() => setCopiedOtp(false), 2000);
  };

  const isReceived = status === 'received';

  return (
    <div className={`my-3 p-4 rounded-2xl border transition-all shadow-xl relative overflow-hidden ${
      isReceived
        ? 'bg-[#121217] border-[#22c55e]/50 shadow-green-glow/20'
        : 'bg-[#181820] border-[#f59e0b]/40 shadow-amber-glow/15'
    }`}>
      {/* Background ambient pulse */}
      <div className={`absolute top-0 right-0 w-32 h-32 rounded-full filter blur-3xl pointer-events-none ${
        isReceived ? 'bg-[#22c55e]/15' : 'bg-[#f59e0b]/10'
      }`} />

      {/* Header bar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
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
          <span className="text-xs font-bold text-white tracking-wide uppercase">
            {serviceName} ({country})
          </span>
        </div>

        {/* Countdown Timer */}
        <div className={`flex items-center gap-1 text-xs font-mono font-bold px-2 py-0.5 rounded-full border ${
          isReceived
            ? 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30'
            : 'bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/30 animate-pulse'
        }`}>
          <Clock className="w-3.5 h-3.5" />
          <span>{timeFormatted}</span>
        </div>
      </div>

      {/* Phone Number Display + 1-Click Copy */}
      <div className="flex items-center justify-between bg-[#0b0b0e] border border-[#262630] rounded-xl px-3.5 py-2.5 mb-3">
        <div className="flex flex-col">
          <span className="text-[10px] text-[#a1a1aa] uppercase font-semibold">Assigned Number</span>
          <span className="text-base font-mono font-bold text-white tracking-wider">
            {phone}
          </span>
        </div>
        <button
          onClick={handleCopyPhone}
          className="flex items-center gap-1.5 bg-[#1f1f2a] hover:bg-[#262630] text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[#262630] transition-colors active:scale-95 text-white"
        >
          {copiedPhone ? <Check className="w-3.5 h-3.5 text-[#22c55e]" /> : <Copy className="w-3.5 h-3.5 text-[#8b5cf6]" />}
          <span>{copiedPhone ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      {/* SMS Status Box */}
      {isReceived && otpCode ? (
        <div className="bg-[#22c55e]/10 border-2 border-dashed border-[#22c55e] rounded-xl p-3.5 text-center mb-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#22c55e] mb-1">
            🎉 SMS Code Received
          </div>
          <div className="text-2xl font-mono font-extrabold text-white tracking-widest my-1 drop-shadow-[0_0_10px_rgba(34,197,94,0.6)]">
            {otpCode}
          </div>
          <div className="flex items-center justify-center gap-2 mt-2">
            <button
              onClick={handleCopyOtp}
              className="flex items-center gap-1.5 bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold text-xs px-3.5 py-1.5 rounded-lg shadow-sm transition-all active:scale-95"
            >
              {copiedOtp ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedOtp ? 'Copied Code' : 'Copy OTP Code'}</span>
            </button>
            <button
              onClick={() => finishActiveOtp(orderId)}
              className="flex items-center gap-1.5 bg-[#1f1f2a] hover:bg-[#262630] text-white text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#262630] transition-all active:scale-95"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-[#22c55e]" />
              <span>Finish Order</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-[#f59e0b]/5 border-2 border-dashed border-[#f59e0b]/40 rounded-xl p-3 text-center mb-3">
          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-[#f59e0b] mb-1">
            <Radio className="w-4 h-4 animate-spin text-[#f59e0b]" />
            <span>Waiting for incoming SMS code...</span>
          </div>
          <p className="text-[11px] text-[#a1a1aa]">
            Auto-detecting OTP from service (typically 3-10 seconds)
          </p>
        </div>
      )}

      {/* Footer controls: Cancel & Refund */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] text-[#a1a1aa] font-mono">Order: {orderId}</span>
        {!isReceived && (
          <button
            onClick={() => cancelActiveOtp(orderId)}
            className="flex items-center gap-1 text-[11px] font-semibold text-[#ef4444] hover:text-red-400 hover:underline transition-colors"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Cancel & Instant Refund</span>
          </button>
        )}
      </div>
    </div>
  );
};
