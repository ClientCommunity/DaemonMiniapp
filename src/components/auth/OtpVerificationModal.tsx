import React, { useState, useEffect, useRef } from 'react';
import { Mail, ArrowRight, RefreshCw, X, ShieldCheck } from 'lucide-react';
import { webAuthApi, WebAuthResponse } from '../../api/endpoints';

interface OtpVerificationModalProps {
  isOpen: boolean;
  email: string;
  onClose: () => void;
  onSuccess: (token: string, user: any) => void;
}

export const OtpVerificationModal: React.FC<OtpVerificationModalProps> = ({
  isOpen,
  email,
  onClose,
  onSuccess,
}) => {
  const getRemainingSeconds = (): number => {
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('krish_pending_otp_verification');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.expiresAt) {
            const rem = Math.floor((parsed.expiresAt - Date.now()) / 1000);
            return Math.max(0, Math.min(600, rem));
          }
        }
      }
    } catch {}
    return 600;
  };

  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(() => getRemainingSeconds());
  const [resendCooldown, setResendCooldown] = useState(60); // 60s cooldown

  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Reset & focus first input when opened
  useEffect(() => {
    if (isOpen) {
      setDigits(['', '', '', '', '', '']);
      setErrorMsg(null);
      setSuccessMsg(null);
      setCountdown(getRemainingSeconds());
      setResendCooldown(60);
      setTimeout(() => inputsRef.current[0]?.focus(), 150);
    }
  }, [isOpen]);

  // Expiry countdown timer (10 mins)
  useEffect(() => {
    if (!isOpen || countdown <= 0) return;
    const timer = setInterval(() => setCountdown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [isOpen, countdown]);

  // Resend cooldown timer (60s)
  useEffect(() => {
    if (!isOpen || resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [isOpen, resendCooldown]);

  if (!isOpen) return null;

  const handleVerifyDirect = async (code: string) => {
    if (code.length !== 6 || isVerifying) return;

    setIsVerifying(true);
    setErrorMsg(null);

    try {
      const res: WebAuthResponse = await webAuthApi.verifyOtp({ email, otp: code });
      if (res.success && res.token && res.user) {
        setSuccessMsg('Account verified successfully! Redirecting...');
        setTimeout(() => {
          onSuccess(res.token!, res.user);
        }, 600);
      } else {
        setErrorMsg(res.error || 'Failed to verify code. Please check and try again.');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDigitChange = (index: number, val: string) => {
    // Only accept digits
    const cleaned = val.replace(/\D/g, '');
    if (!cleaned) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }

    // Handle single digit
    const char = cleaned.slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    setErrorMsg(null);

    // Auto-advance to next input or auto-submit
    if (index < 5) {
      inputsRef.current[index + 1]?.focus();
    } else if (index === 5 && next.every((d) => d.length === 1)) {
      setTimeout(() => {
        handleVerifyDirect(next.join(''));
      }, 50);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const next = [...digits];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setDigits(next);
    setErrorMsg(null);

    const focusIdx = Math.min(pasted.length, 5);
    inputsRef.current[focusIdx]?.focus();

    if (pasted.length === 6) {
      setTimeout(() => {
        handleVerifyDirect(pasted);
      }, 50);
    }
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const otp = digits.join('');
    if (otp.length !== 6) {
      setErrorMsg('Please enter all 6 digits of your verification code.');
      return;
    }
    await handleVerifyDirect(otp);
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || isResending) return;

    setIsResending(true);
    setErrorMsg(null);
    try {
      const res = await webAuthApi.resendOtp({ email });
      if (res.success) {
        try {
          localStorage.setItem(
            'krish_pending_otp_verification',
            JSON.stringify({
              email,
              expiresAt: Date.now() + 10 * 60 * 1000,
            })
          );
        } catch {}
        setSuccessMsg('A new verification code has been dispatched to your email.');
        setResendCooldown(60);
        setCountdown(600);
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setErrorMsg(res.error || 'Failed to resend code.');
      }
    } catch {
      setErrorMsg('Unable to resend verification code right now.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-violet-100 flex flex-col text-[#211536]">
        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          className="absolute top-5 right-5 p-2 rounded-xl text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
          title="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-violet-500/25 mb-3.5">
            <Mail className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-bold tracking-tight text-[#211536]">Verify Your Email</h3>
          <p className="text-xs text-zinc-500 mt-1.5 max-w-[320px]">
            We sent a 6-digit confirmation code to{' '}
            <span className="font-semibold text-violet-700">{email}</span> via{' '}
            <span className="font-mono text-zinc-600">official@daemonx.in</span>.
          </p>
        </div>

        {/* Notice Alerts */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium text-center">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium text-center">
            {successMsg}
          </div>
        )}

        {/* 6-Digit OTP Inputs */}
        <form onSubmit={handleVerify} className="space-y-6">
          <div className="flex items-center justify-center gap-2 sm:gap-2.5" onPaste={handlePaste}>
            {digits.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => (inputsRef.current[idx] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                disabled={isVerifying}
                className="w-11 h-13 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-bold font-mono rounded-xl bg-violet-50/50 border-2 border-violet-200 text-violet-950 focus:border-violet-600 focus:bg-white focus:outline-none focus:ring-4 focus:ring-violet-500/10 transition-all shadow-sm"
              />
            ))}
          </div>

          {/* Countdown & Resend */}
          <div className="flex items-center justify-between text-xs px-1 text-zinc-500">
            <span>
              Expires in:{' '}
              <span className={`font-mono font-semibold ${countdown < 60 ? 'text-rose-600' : 'text-violet-700'}`}>
                {formatCountdown(countdown)}
              </span>
            </span>

            <button
              type="button"
              onClick={handleResend}
              disabled={resendCooldown > 0 || isResending}
              className="inline-flex items-center gap-1 font-semibold text-violet-700 hover:text-violet-800 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              <RefreshCw className={`w-3 h-3 ${isResending ? 'animate-spin' : ''}`} />
              <span>{resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}</span>
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isVerifying || digits.join('').length !== 6}
            className="w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 active:scale-[0.99] transition-all shadow-md shadow-violet-600/25 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isVerifying ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Verifying Code...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Confirm &amp; Access Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
