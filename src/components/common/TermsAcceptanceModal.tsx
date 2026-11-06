import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldCheck,
  Check,
  ExternalLink,
  CreditCard,
  AlertTriangle,
  Scale,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { hapticFeedback } from '../../utils/haptics';

interface TermsAcceptanceModalProps {
  isOpen: boolean;
  onAccept: () => void;
}

export const TermsAcceptanceModal: React.FC<TermsAcceptanceModalProps> = ({
  isOpen,
  onAccept,
}) => {
  const [isChecked, setIsChecked] = useState(false);

  // Prevent background scrolling while modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOpenTermsLink = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    hapticFeedback.light();
    const url = 'https://t.me/deamonotpbot/terms';
    try {
      if (window.Telegram?.WebApp?.openTelegramLink) {
        window.Telegram.WebApp.openTelegramLink(url);
        return;
      }
    } catch {}
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleToggleCheckbox = () => {
    hapticFeedback.light();
    setIsChecked((prev) => !prev);
  };

  const handleContinue = () => {
    if (!isChecked) return;
    hapticFeedback.success();
    onAccept();
  };

  const modalNode = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none">
      {/* Modal Card */}
      <div className="relative w-full max-w-[420px] bg-[#121218] border border-[#272738] rounded-3xl p-5 shadow-2xl flex flex-col text-white max-h-[92vh] overflow-hidden animate-slide-up">
        {/* Top glowing accent line */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-[2px] bg-gradient-to-r from-transparent via-[#7c3aed] to-transparent rounded-full" />

        {/* Header Emblem & Title */}
        <div className="flex flex-col items-center text-center pt-1 shrink-0">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#7c3aed]/25 to-[#6366f1]/10 border border-[#7c3aed]/40 flex items-center justify-center shadow-violet-glow-sm mb-2.5">
            <ShieldCheck className="w-6 h-6 text-[#a78bfa]" />
          </div>
          <h2 className="text-base font-bold text-white tracking-tight">
            Terms, Conditions & Policies
          </h2>
          <p className="text-[11px] text-[#a1a1aa] mt-0.5 max-w-[320px]">
            Please review our official service rules and policies before using Deamon OTP.
          </p>
        </div>

        {/* Scrollable Policy Highlights */}
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 my-3 pr-0.5">
          {/* Card 1: Non-Refundable */}
          <div className="p-2.5 rounded-xl bg-[#171722] border border-[#262635] flex items-start gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 shrink-0 mt-0.5">
              <CreditCard className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold text-white">
                Non-Refundable Payments
              </span>
              <span className="text-[10px] text-[#a1a1aa] leading-relaxed">
                All deposits and purchases are final and non-refundable. Cheap quality accounts carry zero warranty.
              </span>
            </div>
          </div>

          {/* Card 2: Platform Risk */}
          <div className="p-2.5 rounded-xl bg-[#171722] border border-[#262635] flex items-start gap-2.5">
            <div className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/25 shrink-0 mt-0.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold text-white">
                Account Longevity & Platform Risk
              </span>
              <span className="text-[10px] text-[#a1a1aa] leading-relaxed">
                Telegram account bans, freezes, or logouts depend on your usage and device environment. Use at your own risk.
              </span>
            </div>
          </div>

          {/* Card 3: Anti-Abuse Conduct */}
          <div className="p-2.5 rounded-xl bg-[#171722] border border-[#262635] flex items-start gap-2.5">
            <div className="p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/25 shrink-0 mt-0.5">
              <Scale className="w-3.5 h-3.5 text-[#a78bfa]" />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold text-white">
                Strict Conduct & Anti-Abuse
              </span>
              <span className="text-[10px] text-[#a1a1aa] leading-relaxed">
                Abusive language, false scam accusations, or malicious disputes towards admin/support will result in permanent ban and balance removal.
              </span>
            </div>
          </div>

          {/* Card 4: Mandatory 2FA */}
          <div className="p-2.5 rounded-xl bg-[#171722] border border-[#262635] flex items-start gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 shrink-0 mt-0.5">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold text-white">
                Account Security Notice
              </span>
              <span className="text-[10px] text-[#a1a1aa] leading-relaxed">
                Always enable Two-Step Verification (2FA) and bind your recovery Gmail immediately upon receiving any account.
              </span>
            </div>
          </div>

          {/* Full Link Card */}
          <div className="p-2.5 rounded-xl bg-[#161622] border border-[#27273a] flex items-center justify-between text-xs">
            <span className="text-[11px] text-[#a1a1aa]">View full document:</span>
            <button
              onClick={handleOpenTermsLink}
              className="text-[#a78bfa] hover:text-[#c4b5fd] text-[11px] font-semibold inline-flex items-center gap-1 hover:underline cursor-pointer active:scale-95 transition-all"
            >
              <span>Terms and Condition</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Checkbox Section */}
        <div
          onClick={handleToggleCheckbox}
          className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 shrink-0 ${
            isChecked
              ? 'bg-[#181826] border-[#7c3aed]/50'
              : 'bg-[#14141d] border-[#262635] hover:border-[#38384d]'
          }`}
        >
          {/* Custom Checkbox */}
          <div
            className={`w-5 h-5 mt-0.5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
              isChecked
                ? 'bg-[#7c3aed] border-[#7c3aed] text-white shadow-violet-glow-sm'
                : 'border-[#3f3f52] bg-[#0f0f15]'
            }`}
          >
            {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
          </div>

          <label className="text-[11px] sm:text-xs text-[#d4d4d8] leading-tight cursor-pointer select-none">
            I have read, understood, and accept all the{' '}
            <span
              onClick={handleOpenTermsLink}
              className="text-[#a78bfa] underline font-semibold hover:text-[#c4b5fd]"
            >
              terms and condition
            </span>{' '}
            and usage policies.
          </label>
        </div>

        {/* Action Button */}
        <div className="pt-3 shrink-0">
          <button
            onClick={handleContinue}
            disabled={!isChecked}
            className={`w-full py-3 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
              isChecked
                ? 'bg-gradient-to-r from-[#7c3aed] to-[#6366f1] text-white shadow-violet-glow hover:brightness-110 active:scale-[0.98] cursor-pointer'
                : 'bg-[#1a1a24] text-[#52525b] border border-[#262635] cursor-not-allowed opacity-60'
            }`}
          >
            <span>{isChecked ? 'Accept & Continue' : 'Check Box to Continue'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalNode, document.body)
    : null;
};
