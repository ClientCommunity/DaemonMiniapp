import React, { useState, useEffect } from 'react';
import { KeyRound, Mail, ArrowRight, X, CheckCircle2 } from 'lucide-react';
import { webAuthApi } from '../../api/endpoints';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  initialEmail?: string;
  onClose: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  initialEmail = '',
  onClose,
}) => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSent, setIsSent] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEmail(initialEmail);
      setErrorMsg(null);
      setIsSent(false);
    }
  }, [isOpen, initialEmail]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!clean || !clean.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const clientUrl = typeof window !== 'undefined' ? window.location.href.split('?')[0].split('#')[0] : '';
      const res = await webAuthApi.forgotPassword({ email: clean, client_url: clientUrl });
      if (res.success) {
        setIsSent(true);
      } else {
        setErrorMsg(res.error || 'Failed to request password reset.');
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
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

        {isSent ? (
          <div className="flex flex-col items-center text-center py-4 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-md">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-[#211536]">Check Your Inbox</h3>
            <p className="text-xs text-zinc-600 leading-relaxed max-w-[320px]">
              We have sent a secure password reset link to <strong className="text-violet-700">{email}</strong> via{' '}
              <span className="font-mono text-zinc-700">official@daemonx.in</span>.
            </p>
            <div className="p-3 bg-violet-50/80 rounded-xl text-[11px] text-violet-800 border border-violet-100 text-left w-full space-y-1">
              <p>&bull; The reset link is valid for <strong>30 minutes</strong>.</p>
              <p>&bull; Click the link in your email to choose your new password.</p>
            </div>
            <button
              onClick={onClose}
              className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-xs text-white bg-violet-600 hover:bg-violet-700 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-violet-500/25 mb-3.5">
                <KeyRound className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold tracking-tight text-[#211536]">Forgot Password?</h3>
              <p className="text-xs text-zinc-500 mt-1.5 max-w-[320px]">
                Enter your registered email address and we will send you a secure link to reset your password.
              </p>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium text-center">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  Account Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-violet-50/40 border border-violet-200 text-sm text-[#211536] placeholder-zinc-400 focus:bg-white focus:border-violet-600 focus:outline-none focus:ring-4 focus:ring-violet-500/10 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !email.trim()}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 active:scale-[0.99] transition-all shadow-md shadow-violet-600/25 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <span>Sending Link...</span>
                ) : (
                  <>
                    <span>Send Password Reset Link</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
