import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, CheckCircle2, X, RefreshCw } from 'lucide-react';
import { webAuthApi } from '../../api/endpoints';

interface ResetPasswordModalProps {
  token: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  token,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifyingToken, setIsVerifyingToken] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  // Validate token validity on mount
  useEffect(() => {
    if (!isOpen || !token) return;

    let mounted = true;
    setIsVerifyingToken(true);
    setTokenError(null);

    webAuthApi
      .verifyResetToken(token)
      .then((res) => {
        if (!mounted) return;
        if (!res.success) {
          setTokenError(res.error || 'This reset link has expired or is invalid.');
        }
      })
      .catch(() => {
        if (mounted) {
          setTokenError('Unable to verify reset link. It may be expired or already used.');
        }
      })
      .finally(() => {
        if (mounted) setIsVerifyingToken(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, token]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await webAuthApi.resetPassword({ token, new_password: newPassword });
      if (res.success) {
        setIsDone(true);
      } else {
        setErrorMsg(res.error || 'Failed to update password.');
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

        {isVerifyingToken ? (
          <div className="flex flex-col items-center text-center py-12 space-y-3">
            <RefreshCw className="w-8 h-8 text-violet-600 animate-spin" />
            <span className="text-sm font-semibold text-zinc-600">Validating password reset link...</span>
          </div>
        ) : tokenError ? (
          <div className="flex flex-col items-center text-center py-6 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
              <Lock className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-[#211536]">Link Expired or Invalid</h3>
            <p className="text-xs text-zinc-600 max-w-[300px] leading-relaxed">
              {tokenError} Please request a new password reset link from the login page.
            </p>
            <button
              onClick={onClose}
              className="mt-2 py-2.5 px-6 rounded-xl font-bold text-xs text-white bg-violet-600 hover:bg-violet-700 transition-colors"
            >
              Back to Login
            </button>
          </div>
        ) : isDone ? (
          <div className="flex flex-col items-center text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-md">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-[#211536]">Password Reset Complete</h3>
            <p className="text-xs text-zinc-600 max-w-[320px] leading-relaxed">
              Your Daemon OTP password has been updated successfully. You can now log in using your new password.
            </p>
            <button
              onClick={() => {
                onSuccess();
                onClose();
              }}
              className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 transition-all shadow-md shadow-violet-600/25"
            >
              Sign In Now
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-violet-500/25 mb-3.5">
                <Lock className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold tracking-tight text-[#211536]">Set New Password</h3>
              <p className="text-xs text-zinc-500 mt-1 max-w-[320px]">
                Choose a strong password with at least 6 characters.
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
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-violet-50/40 border border-violet-200 text-sm text-[#211536] placeholder-zinc-400 focus:bg-white focus:border-violet-600 focus:outline-none focus:ring-4 focus:ring-violet-500/10 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-violet-50/40 border border-violet-200 text-sm text-[#211536] placeholder-zinc-400 focus:bg-white focus:border-violet-600 focus:outline-none focus:ring-4 focus:ring-violet-500/10 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !newPassword || newPassword !== confirmPassword}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 active:scale-[0.99] transition-all shadow-md shadow-violet-600/25 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? <span>Updating Password...</span> : <span>Save New Password</span>}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
