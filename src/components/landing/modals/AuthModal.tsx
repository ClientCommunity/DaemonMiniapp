import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Mail,
  Lock,
  ArrowRight,
  Send,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Eye,
  EyeOff,
  User,
  Phone,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { webAuthApi, authApi, GoogleAuthResponse } from '../../../api/endpoints';
import { setWebUserToken } from '../../../api/client';
import { ServiceItem } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'register';
  pendingBuyItem?: {
    item: ServiceItem;
    quantity: number;
  } | null;
  onLoginSuccess: (
    token: string,
    user?: unknown,
    targetTab?: 'home' | 'store' | 'deposit' | 'history' | 'profile'
  ) => void;
  onOpenOtpModal: (email: string) => void;
  onOpenForgotPassword: () => void;
  onOpenTermsModal: () => void;
}

const GOOGLE_CLIENT_ID =
  (import.meta as unknown as { env?: Record<string, string | undefined> })?.env
    ?.VITE_GOOGLE_CLIENT_ID ||
  '844840577527-7qf3v11h62n199csg65dv9s0umbqethh.apps.googleusercontent.com';

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'signin',
  pendingBuyItem,
  onLoginSuccess,
  onOpenOtpModal,
  onOpenForgotPassword,
  onOpenTermsModal,
}) => {
  const [mode, setMode] = useState<'signin' | 'register'>(initialMode);
  const [showPassword, setShowPassword] = useState(false);

  // Sign In inputs
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register inputs
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regWhatsapp, setRegWhatsapp] = useState('');
  const [regTelegram, setRegTelegram] = useState('');
  const [regAgreedTerms, setRegAgreedTerms] = useState(true);

  // States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ type: 'error' | 'success' | 'info'; text: string } | null>(null);
  const [gsiLoaded, setGsiLoaded] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  // Keep modal mode in sync with props
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      try {
        const hasMerge = Boolean(
          sessionStorage.getItem('krish_merge_token') || localStorage.getItem('krish_merge_token')
        );
        if (hasMerge) {
          setNotice({
            type: 'info',
            text: 'Fast Connect Active: Sign in or register to link your Telegram account & combine balances!',
          });
        } else {
          setNotice(null);
        }
      } catch {
        setNotice(null);
      }
    }
  }, [isOpen, initialMode]);

  // Lock body scroll
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

  // Initialize Google Sign-In inside modal
  useEffect(() => {
    if (!isOpen) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const renderGsi = () => {
      try {
        const google = (window as unknown as {
          google?: {
            accounts?: {
              id?: {
                initialize: (cfg: Record<string, unknown>) => void;
                renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
              };
            };
          };
        })?.google;

        if (google?.accounts?.id && googleBtnRef.current) {
          google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
          });

          googleBtnRef.current.innerHTML = '';
          const computedWidth = Math.min(320, Math.max(220, (typeof window !== 'undefined' ? window.innerWidth : 320) - 72));
          google.accounts.id.renderButton(googleBtnRef.current, {
            theme: 'outline',
            size: 'large',
            text: mode === 'signin' ? 'signin_with' : 'signup_with',
            shape: 'pill',
            width: computedWidth,
            logo_alignment: 'left',
          });
          setGsiLoaded(true);
          if (timer) clearInterval(timer);
        }
      } catch (e) {
        console.error('Modal Google GSI render error:', e);
      }
    };

    renderGsi();
    timer = setInterval(renderGsi, 300);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isOpen, mode]);

  const handleGoogleCredentialResponse = async (response: { credential?: string }) => {
    if (!response.credential) {
      setNotice({ type: 'error', text: 'Google authentication did not provide credentials.' });
      return;
    }
    setIsSubmitting(true);
    setNotice(null);

    try {
      const res: GoogleAuthResponse = await authApi.loginWithGoogle(response.credential);
      if (res.success && res.token && res.user) {
        const targetTab = pendingBuyItem ? 'store' : undefined;
        setWebUserToken(res.token);
        onClose();
        onLoginSuccess(res.token, { ...res.user, account_merged: (res as any).account_merged }, targetTab);
      } else {
        setNotice({ type: 'error', text: res.error || 'Failed to authenticate with Google.' });
      }
    } catch (err: unknown) {
      setNotice({
        type: 'error',
        text: err instanceof Error ? err.message : 'Google authentication network error.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setNotice({ type: 'error', text: 'Please enter both your email and password.' });
      return;
    }
    setIsSubmitting(true);
    setNotice(null);

    try {
      const res = await webAuthApi.login({
        email: loginEmail.trim(),
        password: loginPassword,
      });
      if (res.success && res.token && res.user) {
        const targetTab = pendingBuyItem ? 'store' : undefined;
        setWebUserToken(res.token);
        onClose();
        onLoginSuccess(res.token, { ...res.user, account_merged: res.account_merged }, targetTab);
      } else if (res.requires_verification) {
        onClose();
        onOpenOtpModal(res.email || loginEmail.trim());
      } else {
        setNotice({
          type: 'error',
          text: res.error || 'Invalid email or password. Please try again.',
        });
      }
    } catch (err: unknown) {
      setNotice({
        type: 'error',
        text: err instanceof Error ? err.message : 'Network error during sign in.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regEmail.trim() || !regPassword.trim()) {
      setNotice({ type: 'error', text: 'Please enter your Email and Password.' });
      return;
    }
    // Strict 8-character rule matching placeholder & CRO standard
    if (regPassword.length < 8) {
      setNotice({
        type: 'error',
        text: 'Password must be at least 8 characters long.',
      });
      return;
    }
    if (!regAgreedTerms) {
      setNotice({
        type: 'error',
        text: 'Please agree to the Terms & Conditions to create an account.',
      });
      return;
    }

    setIsSubmitting(true);
    setNotice(null);

    try {
      // Include telegram_username field to eliminate silent data drop
      const cleanTelegram = regTelegram.trim().replace(/^@/, '');
      const res = await webAuthApi.register({
        email: regEmail.trim(),
        password: regPassword,
        whatsapp: regWhatsapp.trim(),
        telegram_username: cleanTelegram,
        username: cleanTelegram || regEmail.split('@')[0],
      });

      if (res.success) {
        onClose();
        onOpenOtpModal(res.email || regEmail.trim());
      } else {
        setNotice({
          type: 'error',
          text: res.error || 'Registration failed. Please check your information.',
        });
      }
    } catch (err: unknown) {
      setNotice({
        type: 'error',
        text: err instanceof Error ? err.message : 'Network error during registration.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const modalNode = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in select-none">
      <div
        className="relative w-full max-w-md bg-white rounded-3xl border shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-[#211536]"
        style={{ borderColor: '#E5DCF4' }}
      >
        {/* Modal Header */}
        <div
          className="px-6 pt-5 pb-4 border-b shrink-0 flex items-center justify-between"
          style={{ backgroundColor: '#FAF8FF', borderColor: '#E5DCF4' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
              style={{ backgroundColor: '#F0E9FF', color: '#6D28D9' }}
            >
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold leading-tight" style={{ color: '#211536' }}>
                {mode === 'signin' ? 'Welcome Back' : 'Create Free Account'}
              </h3>
              <p className="text-[11px]" style={{ color: '#74638B' }}>
                {pendingBuyItem
                  ? `Sign in to confirm: ${pendingBuyItem.item.name} (${pendingBuyItem.quantity}x)`
                  : 'Fast 1-click access to all 5 server pools'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Purchase Intent Context Banner (if triggered by clicking Buy Now) */}
        {pendingBuyItem && (
          <div
            className="px-6 py-2.5 border-b text-xs flex items-center justify-between"
            style={{ backgroundColor: '#F6F2FF', borderColor: '#E5DCF4' }}
          >
            <div className="flex items-center gap-2 truncate">
              <span className="text-base">{pendingBuyItem.item.flag}</span>
              <span className="font-semibold truncate" style={{ color: '#211536' }}>
                {pendingBuyItem.item.name}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-white border-[#DDD0FF] text-[#6D28D9]">
                {pendingBuyItem.quantity}x
              </span>
            </div>
            <span className="font-mono font-bold text-emerald-700 shrink-0">
              ₹{pendingBuyItem.item.priceInr * pendingBuyItem.quantity}
            </span>
          </div>
        )}

        {/* Tab Switcher */}
        <div
          className="flex items-center border-b shrink-0 px-6 pt-2 bg-white"
          style={{ borderColor: '#E5DCF4' }}
        >
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setNotice(null);
            }}
            className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              mode === 'signin'
                ? 'border-[#6D28D9] text-[#6D28D9]'
                : 'border-transparent text-[#74638B] hover:text-[#211536]'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setNotice(null);
            }}
            className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              mode === 'register'
                ? 'border-[#6D28D9] text-[#6D28D9]'
                : 'border-transparent text-[#74638B] hover:text-[#211536]'
            }`}
          >
            Register (New User)
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Notifications */}
          {notice && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                notice.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                  : notice.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-violet-50 border-violet-200 text-violet-700'
              }`}
            >
              {notice.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{notice.text}</span>
            </div>
          )}

          {/* 1-Click Google Sign In */}
          <div className="flex flex-col items-center justify-center pt-1">
            <div ref={googleBtnRef} className="min-h-[44px] flex justify-center w-full" />
            {!gsiLoaded && (
              <p className="text-[10px] text-zinc-400 mt-1">Loading Google authentication...</p>
            )}
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center py-1">
            <div className="border-t w-full" style={{ borderColor: '#E5DCF4' }} />
            <span
              className="bg-white px-3 text-[10px] uppercase font-bold tracking-wider relative"
              style={{ color: '#74638B' }}
            >
              Or with email
            </span>
          </div>

          {/* SIGN IN FORM */}
          {mode === 'signin' && (
            <form onSubmit={handleLoginSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#211536' }}>
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-xs bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all"
                    style={{ borderColor: '#E5DCF4', color: '#211536' }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold" style={{ color: '#211536' }}>
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenForgotPassword();
                    }}
                    className="text-[11px] font-semibold text-[#6D28D9] hover:underline cursor-pointer"
                  >
                    Forgot?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border text-xs bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all"
                    style={{ borderColor: '#E5DCF4', color: '#211536' }}
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

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl font-bold text-xs text-white flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-60 cursor-pointer mt-2"
                style={{
                  backgroundColor: '#6D28D9',
                  boxShadow: '0 4px 14px 0 rgba(109, 40, 217, 0.28)',
                }}
              >
                {isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Sign In &amp; Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* REGISTER FORM */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#211536' }}>
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-xs bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all"
                    style={{ borderColor: '#E5DCF4', color: '#211536' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#211536' }}>
                  Password <span className="text-rose-500">*</span>{' '}
                  <span className="text-[10px] font-normal" style={{ color: '#74638B' }}>
                    (Min. 8 characters)
                  </span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    required
                    minLength={8}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border text-xs bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all"
                    style={{ borderColor: '#E5DCF4', color: '#211536' }}
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

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#211536' }}>
                    Telegram Username
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                    <input
                      type="text"
                      value={regTelegram}
                      onChange={(e) => setRegTelegram(e.target.value)}
                      placeholder="@handle"
                      className="w-full pl-8 pr-2.5 py-2 rounded-xl border text-xs bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all font-mono"
                      style={{ borderColor: '#E5DCF4', color: '#211536' }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#211536' }}>
                    WhatsApp (Optional)
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                    <input
                      type="text"
                      value={regWhatsapp}
                      onChange={(e) => setRegWhatsapp(e.target.value)}
                      placeholder="+91..."
                      className="w-full pl-8 pr-2.5 py-2 rounded-xl border text-xs bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all font-mono"
                      style={{ borderColor: '#E5DCF4', color: '#211536' }}
                    />
                  </div>
                </div>
              </div>

              {/* Terms Checkbox */}
              <div className="flex items-start gap-2 pt-1">
                <input
                  type="checkbox"
                  id="reg-terms-modal"
                  checked={regAgreedTerms}
                  onChange={(e) => setRegAgreedTerms(e.target.checked)}
                  className="mt-0.5 rounded border-zinc-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
                />
                <label htmlFor="reg-terms-modal" className="text-[11px] leading-snug" style={{ color: '#514364' }}>
                  I agree to the{' '}
                  <button
                    type="button"
                    onClick={onOpenTermsModal}
                    className="font-bold underline hover:text-[#6D28D9] cursor-pointer"
                  >
                    Terms &amp; Conditions
                  </button>{' '}
                  and 100% automated refund rules.
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !regAgreedTerms}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl font-bold text-xs text-white flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-60 cursor-pointer mt-2"
                style={{
                  backgroundColor: '#6D28D9',
                  boxShadow: '0 4px 14px 0 rgba(109, 40, 217, 0.28)',
                }}
              >
                {isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Create Account (Free OTP)</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Modal Footer Assurance */}
        <div
          className="px-6 py-3 border-t shrink-0 flex items-center justify-between text-[11px]"
          style={{ backgroundColor: '#FAF8FF', borderColor: '#E5DCF4', color: '#74638B' }}
        >
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>256-Bit SSL Encrypted</span>
          </div>
          <button
            type="button"
            onClick={() => setMode(mode === 'signin' ? 'register' : 'signin')}
            className="font-bold text-[#6D28D9] hover:underline cursor-pointer"
          >
            {mode === 'signin' ? 'Need an account? Register' : 'Have an account? Sign In'}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : null;
};
