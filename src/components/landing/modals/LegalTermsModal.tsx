import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldCheck,
  X,
  CreditCard,
  AlertTriangle,
  Scale,
  Lock,
  CheckCircle2,
} from 'lucide-react';

interface LegalTermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LegalTermsModal: React.FC<LegalTermsModalProps> = ({ isOpen, onClose }) => {
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

  const content = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="relative w-full max-w-2xl bg-white rounded-3xl border shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-[#211536]"
        style={{ borderColor: '#E5DCF4' }}
      >
        {/* Header */}
        <div
          className="px-6 py-5 border-b flex items-center justify-between shrink-0"
          style={{ backgroundColor: '#FAF8FF', borderColor: '#E5DCF4' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
              style={{ backgroundColor: '#F0E9FF', color: '#6D28D9' }}
            >
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold" style={{ color: '#211536' }}>
                Terms &amp; Conditions and Usage Policies
              </h3>
              <p className="text-xs" style={{ color: '#74638B' }}>
                Official Service Agreement · Daemon OTP Platform
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-xs leading-relaxed" style={{ color: '#514364' }}>
          {/* Section 1: 100% Automated Refund Policy */}
          <div className="p-4 rounded-2xl border" style={{ backgroundColor: '#FAF8FF', borderColor: '#E5DCF4' }}>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <h4 className="font-bold text-sm" style={{ color: '#211536' }}>
                1. 100% Automated SMS Delivery Guarantee
              </h4>
            </div>
            <p>
              When requesting temporary SMS verification numbers (Servers 3 &amp; 4), you only pay for successfully delivered OTP codes. If no SMS arrives within the allocated waiting window (typically 5 to 15 minutes), the session automatically expires and 100% of the funds are immediately restored to your account balance without requiring manual support tickets.
            </p>
          </div>

          {/* Section 2: Account Products & Session Warranty */}
          <div className="p-4 rounded-2xl border" style={{ backgroundColor: '#FAF8FF', borderColor: '#E5DCF4' }}>
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-4 h-4 text-purple-600" />
              <h4 className="font-bold text-sm" style={{ color: '#211536' }}>
                2. Account Purchases (Servers 1 &amp; 2)
              </h4>
            </div>
            <p>
              Pre-activated Telegram session accounts (.session / TData) are verified at the moment of delivery. Due to the digital nature of account credentials, purchases are final once downloaded. We guarantee that all credentials delivered match the described tier, vintage year, and 2FA status at the time of delivery.
            </p>
          </div>

          {/* Section 3: Platform Longevity & 2FA Responsibility */}
          <div className="p-4 rounded-2xl border" style={{ backgroundColor: '#FAF8FF', borderColor: '#E5DCF4' }}>
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-4 h-4 text-amber-600" />
              <h4 className="font-bold text-sm" style={{ color: '#211536' }}>
                3. Two-Step Verification (2FA) &amp; Security Notice
              </h4>
            </div>
            <p>
              Users are strictly advised to retain their provided 2FA cloud password and link a personal recovery email address immediately after taking custody of any account. Telegram platform policies, device fingerprints, and IP reputation determine account longevity; clients assume responsibility for compliant client usage.
            </p>
          </div>

          {/* Section 4: Acceptable Use & Conduct */}
          <div className="p-4 rounded-2xl border" style={{ backgroundColor: '#FAF8FF', borderColor: '#E5DCF4' }}>
            <div className="flex items-center gap-2 mb-2">
              <Scale className="w-4 h-4 text-blue-600" />
              <h4 className="font-bold text-sm" style={{ color: '#211536' }}>
                4. Acceptable Conduct &amp; Prohibited Activities
              </h4>
            </div>
            <p>
              Daemon OTP services are provided for legitimate developer testing, multi-account management, privacy preservation, and marketing operations. Misuse of virtual numbers for unlawful harassment, financial fraud, or malicious spam is strictly prohibited and subject to immediate account termination without refund.
            </p>
          </div>

          {/* Section 5: Official Support Channels */}
          <div className="p-4 rounded-2xl border" style={{ backgroundColor: '#FAF8FF', borderColor: '#E5DCF4' }}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <h4 className="font-bold text-sm" style={{ color: '#211536' }}>
                5. Official Channels &amp; Anti-Phishing Guard
              </h4>
            </div>
            <p>
              Only communicate with our verified official Telegram bot <strong className="text-violet-700">@DeamonOTPbot</strong> and verified email contacts (<code className="font-mono">official@daemonx.in</code>, <code className="font-mono">dev@daemonx.in</code>). Beware of impersonators requesting balance transfers outside the platform.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 border-t flex items-center justify-between shrink-0"
          style={{ backgroundColor: '#FAF8FF', borderColor: '#E5DCF4' }}
        >
          <span className="text-xs" style={{ color: '#74638B' }}>
            Last revised: November 2026 · daemonx.in
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-sm hover:opacity-95 cursor-pointer"
            style={{ backgroundColor: '#6D28D9' }}
          >
            I Understand &amp; Agree
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
};
