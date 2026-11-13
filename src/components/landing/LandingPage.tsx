import React, { useEffect, useRef, useState } from 'react';
import { authApi, GoogleAuthResponse } from '../../api/endpoints';
import { setWebUserToken } from '../../api/client';
import { BackendUserPayload } from '../../api/adapters';
import { useApp } from '../../context/AppContext';
import {
  Zap,
  ShieldCheck,
  Globe,
  Lock,
  Sparkles,
  AlertCircle,
  ExternalLink,
  Smartphone,
  ArrowRight,
  CreditCard,
  RefreshCw,
  Clock,
  ChevronDown,
  HelpCircle,
  Sun,
  Moon,
  CheckCircle2,
  Download,
  Send,
  Radio,
} from 'lucide-react';

const GOOGLE_CLIENT_ID =
  (import.meta as unknown as { env?: Record<string, string | undefined> })?.env
    ?.VITE_GOOGLE_CLIENT_ID ||
  '844840577527-7qf3v11h62n199csg65dv9s0umbqethh.apps.googleusercontent.com';

interface LandingPageProps {
  onLoginSuccess: (token: string, user: BackendUserPayload) => void;
}

interface RateItem {
  id: string;
  category: 'otp' | 'telegram' | 'smm';
  name: string;
  badge: string;
  price: string;
  speed: string;
  successRate: string;
  description: string;
  tagColor: string;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLoginSuccess }) => {
  const { theme, toggleTheme } = useApp();
  const isLight = theme === 'light';

  const heroGoogleBtnRef = useRef<HTMLDivElement>(null);
  const ctaGoogleBtnRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [activeRateCategory, setActiveRateCategory] = useState<'all' | 'otp' | 'telegram' | 'smm'>('all');

  const handleCredentialResponse = async (response: { credential?: string }) => {
    if (!response.credential) {
      setErrorMessage('Google authentication did not provide a valid credential.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res: GoogleAuthResponse = await authApi.loginWithGoogle(response.credential);
      if (res.success && res.token && res.user) {
        setWebUserToken(res.token);
        onLoginSuccess(res.token, res.user);
      } else {
        setErrorMessage(res.error || 'Failed to authenticate with Google. Please try again.');
      }
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      if (rawMsg.includes('Endpoint not found') || rawMsg.includes('404')) {
        setErrorMessage(
          'Backend server has updated files waiting on disk. Please click Restart in your Endercloud panel (nova.endercloud.in) so Python loads the new Google authentication route.'
        );
      } else {
        setErrorMessage(`Authentication error: ${rawMsg}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let checkInterval: ReturnType<typeof setInterval> | null = null;
    let initialized = false;

    const initGoogleGsi = () => {
      if (initialized) return;

      const google = (window as unknown as {
        google?: {
          accounts?: {
            id?: {
              initialize: (config: Record<string, unknown>) => void;
              renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
              prompt: () => void;
            };
          };
        };
      })?.google;

      if (google?.accounts?.id && heroGoogleBtnRef.current) {
        initialized = true;
        if (checkInterval) {
          clearInterval(checkInterval);
          checkInterval = null;
        }

        try {
          google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
          });

          if (heroGoogleBtnRef.current) {
            heroGoogleBtnRef.current.innerHTML = '';
            google.accounts.id.renderButton(heroGoogleBtnRef.current, {
              theme: isLight ? 'outline' : 'filled_black',
              size: 'large',
              text: 'continue_with',
              shape: 'pill',
              width: 320,
              logo_alignment: 'left',
            });
          }

          if (ctaGoogleBtnRef.current) {
            ctaGoogleBtnRef.current.innerHTML = '';
            google.accounts.id.renderButton(ctaGoogleBtnRef.current, {
              theme: isLight ? 'outline' : 'filled_black',
              size: 'large',
              text: 'signin_with',
              shape: 'pill',
              width: 320,
              logo_alignment: 'left',
            });
          }
        } catch (e) {
          console.error('Failed to initialize Google GSI button:', e);
        }
      }
    };

    initGoogleGsi();

    if (!initialized) {
      checkInterval = setInterval(() => {
        initGoogleGsi();
      }, 250);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [isLight]);

  const triggerGooglePrompt = () => {
    try {
      const google = (window as unknown as { google?: { accounts?: { id?: { prompt: () => void } } } })?.google;
      if (google?.accounts?.id?.prompt) {
        google.accounts.id.prompt();
      } else {
        document.getElementById('auth-box')?.scrollIntoView({ behavior: 'smooth' });
      }
    } catch {
      document.getElementById('auth-box')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const sampleRates: RateItem[] = [
    {
      id: 'tg_otp',
      category: 'otp',
      name: 'Telegram Messenger OTP',
      badge: 'High Speed Pool',
      price: '₹15 / $0.18',
      speed: '< 3s Avg',
      successRate: '99.4%',
      description: 'Instant carrier numbers for Telegram accounts & bots worldwide.',
      tagColor: 'text-[#38bdf8] bg-sky-500/10 border-sky-500/30',
    },
    {
      id: 'wa_otp',
      category: 'otp',
      name: 'WhatsApp & Business OTP',
      badge: 'Hot Demand',
      price: '₹18 / $0.22',
      speed: '< 4s Avg',
      successRate: '98.9%',
      description: 'Fresh non-recycled mobile lines for personal & business activations.',
      tagColor: 'text-[#22c55e] bg-emerald-500/10 border-emerald-500/30',
    },
    {
      id: 'ai_otp',
      category: 'otp',
      name: 'OpenAI / ChatGPT OTP',
      badge: 'Developer Tier',
      price: '₹12 / $0.15',
      speed: '< 2s Avg',
      successRate: '99.8%',
      description: 'Fast verification for ChatGPT, Claude, and developer API accounts.',
      tagColor: 'text-[#a78bfa] bg-purple-500/10 border-purple-500/30',
    },
    {
      id: 'tg_session_aged',
      category: 'telegram',
      name: 'Vintage Aged Telegram Session (2021-2024)',
      badge: '2FA Included',
      price: '₹75 / $0.90',
      speed: 'Instant DL',
      successRate: '100% Valid',
      description: 'Fully aged accounts with instant .session & TData zip downloads.',
      tagColor: 'text-[#f59e0b] bg-amber-500/10 border-amber-500/30',
    },
    {
      id: 'tg_session_fresh',
      category: 'telegram',
      name: 'Clean Virgin Telegram Session (2025)',
      badge: 'Low Price',
      price: '₹50 / $0.60',
      speed: 'Instant DL',
      successRate: '100% Valid',
      description: 'Clean history session ready for automation & channel admin tasks.',
      tagColor: 'text-[#38bdf8] bg-sky-500/10 border-sky-500/30',
    },
    {
      id: 'smm_members',
      category: 'smm',
      name: 'Telegram Channel Members',
      badge: '30-Day Refill',
      price: '₹95 / 1,000',
      speed: '10k / Day',
      successRate: 'Non-Drop',
      description: 'Real-time high retention members to scale your Telegram community.',
      tagColor: 'text-[#8b5cf6] bg-violet-500/10 border-violet-500/30',
    },
    {
      id: 'smm_views',
      category: 'smm',
      name: 'Telegram Post Views & Reactions',
      badge: 'Instant Delivery',
      price: '₹8 / 1,000',
      speed: 'Instantaneous',
      successRate: '100% Safe',
      description: 'Boost engagement and channel credibility with real post reactions.',
      tagColor: 'text-[#22c55e] bg-emerald-500/10 border-emerald-500/30',
    },
  ];

  const filteredRates = activeRateCategory === 'all'
    ? sampleRates
    : sampleRates.filter((r) => r.category === activeRateCategory);

  const faqItems = [
    {
      q: 'Do I need Telegram to use this website?',
      a: 'No! The website works completely standalone. You can log in securely using your Google account, deposit balance via UPI or Crypto USDT, purchase SMS OTP numbers, and download Telegram sessions directly in your browser.',
    },
    {
      q: 'What happens if an OTP is not received?',
      a: 'We operate on a 100% automated refund guarantee. If an SMS verification code does not arrive within the 20-minute countdown window, you can cancel anytime or let it expire to receive an immediate full refund back to your wallet balance automatically.',
    },
    {
      q: 'Which payment methods are accepted for top-ups?',
      a: 'We support instant zero-fee UPI QR codes (GPay, PhonePe, Paytm, BHIM, FamPay) and Cryptocurrency USDT (TRC-20 & BEP-20). Deposits are verified and credited automatically within seconds.',
    },
    {
      q: 'Can I access the same services and wallet balance on Telegram?',
      a: 'Yes! If you prefer using Telegram directly, you can launch our official bot @DeamonOTPbot anytime. Both platforms share the exact same high-speed carrier infrastructure, wallet balance, and order history.',
    },
    {
      q: 'What format are the Telegram accounts delivered in?',
      a: 'Server 1 and Server 2 accounts are delivered as clean 2FA-secured accounts with instant .session file downloads, TData archives, and passwords displayed right on your purchase receipt.',
    },
  ];

  return (
    <div className="w-full min-h-screen bg-[#0b0b0e] text-white flex flex-col font-sans selection:bg-[#7c3aed] selection:text-white">
      {/* Background Atmospheric Glows */}
      <div className={`fixed top-0 left-1/2 -translate-x-1/2 w-[850px] h-[550px] ${isLight ? 'bg-gradient-to-b from-[#7c3aed]/10 via-[#3b82f6]/5 opacity-40' : 'bg-gradient-to-b from-[#7c3aed]/20 via-[#3b82f6]/10'} to-transparent rounded-full blur-[140px] pointer-events-none z-0`} />
      <div className={`fixed bottom-0 right-0 w-[600px] h-[450px] ${isLight ? 'bg-[#7c3aed]/5 opacity-30' : 'bg-[#7c3aed]/10'} rounded-full blur-[140px] pointer-events-none z-0`} />

      {/* Modern Desktop & Mobile Top Navigation */}
      <header className="sticky top-0 z-50 w-full backdrop-blur-xl bg-[#0b0b0e]/80 border-b border-[#262630]/60 landing-header">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#7c3aed] to-[#3b82f6] p-0.5 shadow-lg shadow-[#7c3aed]/30 flex items-center justify-center">
              <div className="w-full h-full bg-[#121217] rounded-[14px] flex items-center justify-center p-1 landing-logo-inner">
                <img src="/deamon-logo.png" alt="Deamon OTP Logo" className="w-6 h-6 object-contain" />
              </div>
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight text-white flex items-center gap-1.5">
                Deamon OTP Store
                <span className="text-[10px] font-mono font-bold bg-[#22c55e]/15 text-[#22c55e] border border-[#22c55e]/30 px-1.5 py-0.2 rounded-full">
                  LIVE
                </span>
              </span>
              <span className="hidden sm:block text-[10px] text-[#a1a1aa] font-medium">
                Virtual Numbers &amp; Telegram Sessions
              </span>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-[#a1a1aa]">
            <a href="#services" className="hover:text-white transition-colors">Services</a>
            <a href="#rates" className="hover:text-white transition-colors">Live Rates</a>
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
            <a
              href="https://t.me/DeamonOTPbot"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[#a78bfa] hover:text-[#c4b5fd] transition-colors"
            >
              <span>Telegram Bot</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </nav>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className={`min-h-[36px] min-w-[36px] flex items-center justify-center rounded-full border transition-all cursor-pointer ${
                isLight
                  ? 'bg-white hover:bg-slate-100 border-slate-300 shadow-sm'
                  : 'bg-[#181820] hover:bg-[#20202c] border-[#262630]'
              }`}
              title={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
              aria-label="Toggle Theme"
            >
              {isLight ? (
                <Moon className="w-4 h-4 text-[#7c3aed]" />
              ) : (
                <Sun className="w-4 h-4 text-[#f59e0b]" />
              )}
            </button>

            <a
              href="https://t.me/DeamonOTPbot"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#181820] hover:bg-[#20202c] border border-[#262630] text-xs font-medium text-[#d4d4d8] transition-all"
            >
              <Smartphone className="w-3.5 h-3.5 text-[#38bdf8]" />
              <span>@DeamonOTPbot</span>
            </a>
            <button
              onClick={triggerGooglePrompt}
              className="px-4 py-2 rounded-full bg-gradient-to-r from-[#7c3aed] to-[#6366f1] hover:from-[#6d28d9] hover:to-[#4f46e5] text-xs font-bold text-white shadow-md shadow-[#7c3aed]/25 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>Sign In with Google</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Page Content */}
      <main className="relative z-10 flex-1 flex flex-col">
        {/* HERO SECTION */}
        <section className="relative pt-12 pb-16 sm:pt-20 sm:pb-24 overflow-hidden">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
              {/* Left Column: Headlines & Value Propositions */}
              <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left">
                {/* Feature Pill */}
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#181820]/90 border border-[#262630] text-[#a78bfa] text-xs font-semibold mb-6 shadow-sm">
                  <Sparkles className="w-3.5 h-3.5 text-[#f59e0b]" />
                  <span>Next-Gen OTP &amp; Session Platform</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
                </div>

                <h1 className="text-3xl sm:text-5xl lg:text-5xl font-black tracking-tight leading-[1.15] text-white">
                  Instant Virtual Numbers &amp;{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#a78bfa] via-[#38bdf8] to-[#22c55e]">
                    Verified Telegram Sessions
                  </span>
                </h1>

                <p className="mt-5 text-sm sm:text-base text-[#a1a1aa] leading-relaxed max-w-xl">
                  Receive SMS verification codes for 500+ apps worldwide, purchase aged 2FA-secured
                  Telegram sessions with instant downloads, and scale your social media with automated SMM services.
                </p>

                {/* Key Metrics Strip */}
                <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-[#262630]/80 w-full max-w-lg">
                  <div className="flex flex-col">
                    <span className="text-xl sm:text-2xl font-black font-mono text-white">50K+</span>
                    <span className="text-[11px] text-[#a1a1aa] font-medium mt-0.5">SMS Delivered</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xl sm:text-2xl font-black font-mono text-[#22c55e]">&lt; 5s</span>
                    <span className="text-[11px] text-[#a1a1aa] font-medium mt-0.5">Avg Arrival</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xl sm:text-2xl font-black font-mono text-[#38bdf8]">500+</span>
                    <span className="text-[11px] text-[#a1a1aa] font-medium mt-0.5">Global Services</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Interactive Google Sign-In Card */}
              <div className="lg:col-span-5 flex justify-center lg:justify-end" id="auth-box">
                <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-[#181820]/90 to-[#121217]/95 border border-[#2a2a36] shadow-2xl backdrop-blur-xl relative overflow-hidden landing-auth-card">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#7c3aed]/20 rounded-full blur-2xl pointer-events-none" />

                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#7c3aed] to-[#3b82f6] p-0.5 flex items-center justify-center shrink-0">
                      <div className="w-full h-full bg-[#121217] rounded-[14px] flex items-center justify-center landing-logo-inner">
                        <Lock className="w-5 h-5 text-[#a78bfa]" />
                      </div>
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">Sign In to Store</h2>
                      <p className="text-xs text-[#a1a1aa]">Instant 1-click Google access</p>
                    </div>
                  </div>

                  {errorMessage && (
                    <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">Authentication Error: </span>
                        <span>{errorMessage}</span>
                      </div>
                    </div>
                  )}

                  {/* Primary Custom Google Login Button */}
                  <div className="py-2 flex flex-col items-center w-full">
                    <div className="relative w-full max-w-[320px] h-[50px] mx-auto select-none">
                      {/* Visual Custom Button */}
                      <div
                        className={`landing-google-btn w-full h-full rounded-full flex items-center justify-center gap-3 px-5 transition-all duration-200 border ${
                          isLoading
                            ? 'bg-[#181824] border-[#7c3aed]/60 shadow-lg shadow-[#7c3aed]/20 cursor-wait'
                            : 'bg-[#151520] hover:bg-[#1d1d2c] border-[#2e2e42] hover:border-[#7c3aed]/60 shadow-lg shadow-black/40 hover:shadow-[#7c3aed]/15 cursor-pointer active:scale-[0.98]'
                        }`}
                      >
                        {isLoading ? (
                          <div className="flex items-center gap-2.5">
                            <div className="w-4 h-4 border-2 border-[#a78bfa] border-t-transparent rounded-full animate-spin" />
                            <span className="text-xs font-semibold text-[#c4b5fd]">
                              Signing in with Google...
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                              <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                            </svg>
                            <span className="text-sm font-semibold text-white tracking-[-0.01em]">
                              Continue with Google
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Invisible Google GSI Overlay that triggers native Google OAuth popup */}
                      <div
                        ref={heroGoogleBtnRef}
                        className={`absolute inset-0 overflow-hidden rounded-full cursor-pointer z-10 ${
                          isLoading ? 'pointer-events-none opacity-0' : 'opacity-[0.0001]'
                        }`}
                        style={{
                          transform: 'scale(1.04)',
                          transformOrigin: 'center',
                        }}
                      />
                    </div>

                    <p className="text-[11px] text-[#71717a] text-center mt-3">
                      Instant wallet allocation • Automatic INR &amp; USDT balance access
                    </p>
                  </div>

                  {/* Highlights inside card */}
                  <div className="mt-6 pt-5 border-t border-[#262630] space-y-2.5">
                    <div className="flex items-center gap-2 text-xs text-[#d4d4d8]">
                      <ShieldCheck className="w-4 h-4 text-[#22c55e] shrink-0" />
                      <span>Zero setup fee • Automatic instant refunds</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#d4d4d8]">
                      <Zap className="w-4 h-4 text-[#f59e0b] shrink-0" />
                      <span>Instant balance top-up via UPI &amp; Crypto</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#d4d4d8]">
                      <Globe className="w-4 h-4 text-[#38bdf8] shrink-0" />
                      <span>Carrier grade numbers for 50+ countries</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SUPPORTED PAYMENT GATEWAYS STRIP */}
        <section className="py-6 border-y border-[#262630]/60 bg-[#0e0e12]/80 backdrop-blur-md">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-[#a1a1aa]">
                <CreditCard className="w-4 h-4 text-[#22c55e]" />
                <span className="font-semibold text-white">Accepted Deposit Methods:</span>
                <span className="hidden sm:inline text-[11px]">Instant automated crediting • Zero fees</span>
              </div>

              {/* Payment Method Badges */}
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                <span className="px-3 py-1 rounded-xl bg-[#14141a] border border-[#262632] text-xs font-semibold text-[#d4d4d8] flex items-center gap-1.5 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
                  Google Pay
                </span>
                <span className="px-3 py-1 rounded-xl bg-[#14141a] border border-[#262632] text-xs font-semibold text-[#d4d4d8] flex items-center gap-1.5 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-[#8b5cf6]" />
                  PhonePe
                </span>
                <span className="px-3 py-1 rounded-xl bg-[#14141a] border border-[#262632] text-xs font-semibold text-[#d4d4d8] flex items-center gap-1.5 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-[#38bdf8]" />
                  Paytm / UPI
                </span>
                <span className="px-3 py-1 rounded-xl bg-[#14141a] border border-[#262632] text-xs font-semibold text-[#d4d4d8] flex items-center gap-1.5 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
                  USDT (TRC20 / BEP20)
                </span>
                <span className="px-3 py-1 rounded-xl bg-[#14141a] border border-[#262632] text-xs font-semibold text-[#d4d4d8] flex items-center gap-1.5 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
                  FamPay Direct
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* INTERACTIVE LIVE RATE PREVIEW WIDGET */}
        <section id="rates" className="py-16 sm:py-24 border-b border-[#1f1f2a]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
              <div>
                <span className="text-xs font-bold text-[#8b5cf6] uppercase tracking-wider">
                  Live Pricing &amp; Stock
                </span>
                <h2 className="text-2xl sm:text-4xl font-black text-white mt-1">
                  Transparent Carrier Rates
                </h2>
                <p className="text-xs sm:text-sm text-[#a1a1aa] mt-2">
                  Preview current starting rates, arrival latency, and stock availability before signing in.
                </p>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 p-1 bg-[#14141a] border border-[#262632] rounded-2xl self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setActiveRateCategory('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    activeRateCategory === 'all'
                      ? 'bg-[#7c3aed] text-white shadow-sm font-bold'
                      : 'text-[#a1a1aa] hover:text-white'
                  }`}
                >
                  All Services
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRateCategory('otp')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    activeRateCategory === 'otp'
                      ? 'bg-[#7c3aed] text-white shadow-sm font-bold'
                      : 'text-[#a1a1aa] hover:text-white'
                  }`}
                >
                  SMS OTPs
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRateCategory('telegram')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    activeRateCategory === 'telegram'
                      ? 'bg-[#7c3aed] text-white shadow-sm font-bold'
                      : 'text-[#a1a1aa] hover:text-white'
                  }`}
                >
                  Telegram Sessions
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRateCategory('smm')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    activeRateCategory === 'smm'
                      ? 'bg-[#7c3aed] text-white shadow-sm font-bold'
                      : 'text-[#a1a1aa] hover:text-white'
                  }`}
                >
                  SMM Boost
                </button>
              </div>
            </div>

            {/* Rates Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRates.map((rate) => (
                <div
                  key={rate.id}
                  className="p-4 sm:p-5 rounded-2xl bg-[#14141a] border border-[#262632] hover:border-[#7c3aed]/50 transition-all flex flex-col justify-between group shadow-sm hover:shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${rate.tagColor}`}>
                        {rate.badge}
                      </span>
                      <span className="text-[10px] font-mono text-[#22c55e] flex items-center gap-1 font-semibold">
                        <CheckCircle2 className="w-3 h-3" />
                        {rate.successRate}
                      </span>
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-[#a78bfa] transition-colors">
                      {rate.name}
                    </h3>
                    <p className="text-xs text-[#a1a1aa] mt-1.5 leading-relaxed">
                      {rate.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#262632] flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-[#71717a] block">Starting from</span>
                      <span className="text-base font-black font-mono text-[#22c55e]">
                        {rate.price}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={triggerGooglePrompt}
                      className="px-3 py-1.5 rounded-xl bg-[#1f1f2a] hover:bg-[#7c3aed] hover:text-white text-xs font-semibold text-[#d4d4d8] border border-[#262630] transition-all cursor-pointer flex items-center gap-1"
                    >
                      <span>Get Started</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ASYMMETRIC BENTO GRID: FEATURES & TRUST MATRIX */}
        <section id="features" className="py-16 sm:py-24 border-b border-[#1f1f2a] bg-[#0e0e12]/60">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <span className="text-xs font-bold text-[#8b5cf6] uppercase tracking-wider">
                Engineering &amp; Security
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-white mt-1">
                Engineered for Absolute Reliability
              </h2>
              <p className="text-xs sm:text-sm text-[#a1a1aa] mt-2">
                Cutting-edge carrier routing, automated refunds, and aged session inventory built for power users.
              </p>
            </div>

            {/* Asymmetric Bento Cards */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* Bento Card 1: 100% Automated Refund Guarantee (Span 7) */}
              <div className="md:col-span-7 p-6 sm:p-8 rounded-3xl bg-[#14141a] border border-[#262632] relative overflow-hidden flex flex-col justify-between group shadow-sm">
                <div className="absolute top-0 right-0 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

                <div>
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-5 text-[#22c55e]">
                    <RefreshCw className="w-6 h-6 group-hover:rotate-180 transition-transform duration-700" />
                  </div>
                  <span className="text-xs font-mono font-bold text-[#22c55e] uppercase tracking-wider">
                    Zero Financial Risk
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-white mt-1">
                    100% Automated Instant Refund Guarantee
                  </h3>
                  <p className="text-xs sm:text-sm text-[#a1a1aa] mt-3 leading-relaxed max-w-lg">
                    Never worry about dead numbers. If your SMS verification code doesn&apos;t arrive within the 20-minute countdown window, you can cancel with 1 click or let it expire for an instant, automated refund directly to your balance.
                  </p>
                </div>

                <div className="mt-8 pt-5 border-t border-[#262632] flex flex-wrap items-center gap-4 text-xs font-mono text-[#a1a1aa]">
                  <span className="flex items-center gap-1.5 text-[#22c55e]">
                    <CheckCircle2 className="w-4 h-4" />
                    Zero Manual Tickets
                  </span>
                  <span className="flex items-center gap-1.5 text-white">
                    <Clock className="w-4 h-4 text-[#7c3aed]" />
                    20-Min Active Countdown
                  </span>
                </div>
              </div>

              {/* Bento Card 2: Vintage Telegram Sessions & 2FA (Span 5) */}
              <div className="md:col-span-5 p-6 sm:p-8 rounded-3xl bg-[#14141a] border border-[#262632] relative overflow-hidden flex flex-col justify-between group shadow-sm">
                <div className="absolute top-0 right-0 w-44 h-44 bg-[#38bdf8]/10 rounded-full blur-3xl pointer-events-none" />

                <div>
                  <div className="w-12 h-12 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center mb-5 text-[#38bdf8]">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-mono font-bold text-[#38bdf8] uppercase tracking-wider">
                    Aged Inventory
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-white mt-1">
                    Vintage Sessions &amp; TData Downloads
                  </h3>
                  <p className="text-xs sm:text-sm text-[#a1a1aa] mt-3 leading-relaxed">
                    2021–2025 aged accounts with clean history. Receive both instant .session files and TData archives with 2FA password on delivery.
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-[#262632] flex items-center justify-between text-xs text-[#d4d4d8]">
                  <span className="flex items-center gap-1.5">
                    <Download className="w-4 h-4 text-[#38bdf8]" />
                    Direct Zip Download
                  </span>
                  <span className="font-mono text-[#22c55e] font-bold">2FA Verified</span>
                </div>
              </div>

              {/* Bento Card 3: Dual-Platform Real-Time Sync (Span 5) */}
              <div className="md:col-span-5 p-6 sm:p-8 rounded-3xl bg-[#14141a] border border-[#262632] relative overflow-hidden flex flex-col justify-between group shadow-sm">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center mb-5 text-[#a78bfa]">
                    <Radio className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-mono font-bold text-[#a78bfa] uppercase tracking-wider">
                    Omni-Channel
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-white mt-1">
                    Web &amp; Telegram Bot Dual Sync
                  </h3>
                  <p className="text-xs sm:text-sm text-[#a1a1aa] mt-3 leading-relaxed">
                    Access the platform however you prefer. Your wallet balance, active orders, and transaction history are synchronized in real-time with @DeamonOTPbot.
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-[#262632]">
                  <a
                    href="https://t.me/DeamonOTPbot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-xs font-semibold text-[#a78bfa] hover:text-white transition-colors"
                  >
                    <span>Launch @DeamonOTPbot</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Bento Card 4: Universal Dual-Currency Wallet (Span 7) */}
              <div className="md:col-span-7 p-6 sm:p-8 rounded-3xl bg-[#14141a] border border-[#262632] relative overflow-hidden flex flex-col justify-between group shadow-sm">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mb-5 text-[#f59e0b]">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-mono font-bold text-[#f59e0b] uppercase tracking-wider">
                    Instant Liquidity
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-white mt-1">
                    Dual-Currency Wallet &amp; P2P Transfers
                  </h3>
                  <p className="text-xs sm:text-sm text-[#a1a1aa] mt-3 leading-relaxed max-w-lg">
                    Store balance in Indian Rupees (₹) or USDT ($). Enjoy zero-fee instant P2P balance transfers to any other user using their Telegram or Account ID.
                  </p>
                </div>

                <div className="mt-8 pt-5 border-t border-[#262632] flex flex-wrap items-center gap-4 text-xs font-mono text-[#a1a1aa]">
                  <span className="flex items-center gap-1.5 text-white">
                    <Send className="w-4 h-4 text-[#8b5cf6]" />
                    Zero-Fee P2P Transfers
                  </span>
                  <span className="flex items-center gap-1.5 text-[#22c55e]">
                    <CheckCircle2 className="w-4 h-4" />
                    INR &amp; Crypto USDT Supported
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS SECTION */}
        <section id="how-it-works" className="py-16 sm:py-24 border-b border-[#1f1f2a]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <span className="text-xs font-bold text-[#8b5cf6] uppercase tracking-wider">
                Seamless Experience
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-white mt-1">
                Get Started in 3 Simple Steps
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
              <div className="p-6 rounded-2xl bg-[#14141a] border border-[#262632] relative">
                <div className="w-10 h-10 rounded-full bg-[#7c3aed] text-white font-black text-sm flex items-center justify-center mb-4 shadow-lg shadow-[#7c3aed]/30 landing-step-num">
                  1
                </div>
                <h3 className="text-base font-bold text-white">Sign In with Google</h3>
                <p className="text-xs text-[#a1a1aa] mt-2 leading-relaxed">
                  Click the Google button to authenticate in 2 seconds. No phone number, complex passwords, or email confirmation needed.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-[#14141a] border border-[#262632] relative">
                <div className="w-10 h-10 rounded-full bg-[#3b82f6] text-white font-black text-sm flex items-center justify-center mb-4 shadow-lg shadow-[#3b82f6]/30 landing-step-num">
                  2
                </div>
                <h3 className="text-base font-bold text-white">Deposit Wallet Balance</h3>
                <p className="text-xs text-[#a1a1aa] mt-2 leading-relaxed">
                  Scan an instant UPI QR code with any payment app or transfer USDT. Your balance reflects automatically within seconds.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-[#14141a] border border-[#262632] relative">
                <div className="w-10 h-10 rounded-full bg-[#22c55e] text-white font-black text-sm flex items-center justify-center mb-4 shadow-lg shadow-[#22c55e]/30 landing-step-num">
                  3
                </div>
                <h3 className="text-base font-bold text-white">Receive SMS or Download</h3>
                <p className="text-xs text-[#a1a1aa] mt-2 leading-relaxed">
                  Choose your desired app or country. Receive SMS codes instantly in real time or download sessions with a single click.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ SECTION */}
        <section id="faq" className="py-16 sm:py-24 border-b border-[#1f1f2a] bg-[#0e0e12]/60">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <span className="text-xs font-bold text-[#8b5cf6] uppercase tracking-wider">
                Common Questions
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-white mt-1">
                Frequently Asked Questions
              </h2>
            </div>

            <div className="space-y-3">
              {faqItems.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl bg-[#14141a] border border-[#262632] overflow-hidden transition-all"
                >
                  <button
                    onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                    className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-[#181822] transition-colors landing-faq-btn"
                  >
                    <span className="text-sm font-bold text-white flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-[#7c3aed] shrink-0" />
                      <span>{item.q}</span>
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-[#a1a1aa] transition-transform ${
                        activeFaq === idx ? 'rotate-180 text-white' : ''
                      }`}
                    />
                  </button>
                  {activeFaq === idx && (
                    <div className="px-5 pb-5 text-xs text-[#a1a1aa] leading-relaxed border-t border-[#20202c] pt-3">
                      {item.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* BOTTOM CALL TO ACTION */}
        <section className="py-20 border-b border-[#1f1f2a] relative overflow-hidden">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center relative z-10">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#7c3aed] to-[#3b82f6] p-0.5 mx-auto mb-6 shadow-xl shadow-[#7c3aed]/25 flex items-center justify-center">
              <div className="w-full h-full bg-[#121217] rounded-[22px] flex items-center justify-center p-1.5 landing-logo-inner">
                <img src="/deamon-logo.png" alt="Deamon OTP Logo" className="w-10 h-10 object-contain" />
              </div>
            </div>

            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Ready to Get Started?
            </h2>
            <p className="text-xs sm:text-sm text-[#a1a1aa] mt-3 max-w-lg mx-auto">
              Join thousands of users enjoying real-time virtual SMS OTPs, aged Telegram accounts, and social growth.
            </p>

            <div className="mt-8 flex flex-col items-center gap-4">
              <div className="relative w-full max-w-[320px] h-[50px] mx-auto select-none">
                <div
                  className={`landing-google-btn w-full h-full rounded-full flex items-center justify-center gap-3 px-5 transition-all duration-200 border ${
                    isLoading
                      ? 'bg-[#181824] border-[#7c3aed]/60 shadow-lg shadow-[#7c3aed]/20 cursor-wait'
                      : 'bg-[#151520] hover:bg-[#1d1d2c] border-[#2e2e42] hover:border-[#7c3aed]/60 shadow-lg shadow-black/40 hover:shadow-[#7c3aed]/15 cursor-pointer active:scale-[0.98]'
                  }`}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 border-2 border-[#a78bfa] border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-semibold text-[#c4b5fd]">
                        Signing in with Google...
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                        <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                      </svg>
                      <span className="text-sm font-semibold text-white tracking-[-0.01em]">
                        Sign In with Google
                      </span>
                    </div>
                  )}
                </div>

                <div
                  ref={ctaGoogleBtnRef}
                  className={`absolute inset-0 overflow-hidden rounded-full cursor-pointer z-10 ${
                    isLoading ? 'pointer-events-none opacity-0' : 'opacity-[0.0001]'
                  }`}
                  style={{
                    transform: 'scale(1.04)',
                    transformOrigin: 'center',
                  }}
                />
              </div>

              <a
                href="https://t.me/DeamonOTPbot"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs text-[#a78bfa] hover:text-white transition-colors mt-2"
              >
                <span>Prefer using the Telegram Mini App? Open @DeamonOTPbot</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* COMPREHENSIVE 4-COLUMN PROFESSIONAL FOOTER */}
      <footer className="border-t border-[#181820] pt-14 pb-8 bg-[#08080b]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-12 border-b border-[#181820]">
            {/* Column 1: Brand Overview & Security (Span 4) */}
            <div className="lg:col-span-4 flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#7c3aed] to-[#3b82f6] p-0.5 flex items-center justify-center">
                  <div className="w-full h-full bg-[#121217] rounded-[10px] flex items-center justify-center landing-logo-inner">
                    <img src="/deamon-logo.png" alt="Deamon OTP Logo" className="w-5 h-5 object-contain" />
                  </div>
                </div>
                <span className="font-extrabold text-base tracking-tight text-white">
                  Deamon OTP Store
                </span>
              </div>

              <p className="text-xs text-[#71717a] leading-relaxed max-w-sm mb-5">
                Next-generation automated infrastructure for real-time virtual SMS OTPs, aged 2FA Telegram sessions, and social media growth services.
              </p>

              {/* Status and Encryption Badges */}
              <div className="flex flex-col gap-2 text-xs">
                <div className="inline-flex items-center gap-2 text-[#22c55e] font-mono text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
                  <span>All Systems Operational (99.98% Uptime)</span>
                </div>
                <div className="inline-flex items-center gap-2 text-[#a1a1aa] text-[11px]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#38bdf8]" />
                  <span>256-Bit SSL Encrypted Transactions</span>
                </div>
              </div>
            </div>

            {/* Column 2: Products & Servers (Span 3) */}
            <div className="lg:col-span-3 flex flex-col">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">
                Products &amp; Servers
              </h4>
              <ul className="space-y-2.5 text-xs text-[#a1a1aa]">
                <li>
                  <a href="#rates" className="hover:text-white transition-colors">Server 1: LZT Market Accounts</a>
                </li>
                <li>
                  <a href="#rates" className="hover:text-white transition-colors">Server 2: Vintage Telegram Sessions</a>
                </li>
                <li>
                  <a href="#rates" className="hover:text-white transition-colors">Servers 3 &amp; 4: Virtual SMS OTPs</a>
                </li>
                <li>
                  <a href="#rates" className="hover:text-white transition-colors">Server 5: Social Media SMM Panel</a>
                </li>
                <li>
                  <a href="#rates" className="hover:text-white transition-colors">Instant TData &amp; Session Downloads</a>
                </li>
              </ul>
            </div>

            {/* Column 3: Trust & Policies (Span 2) */}
            <div className="lg:col-span-2 flex flex-col">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">
                Trust &amp; Security
              </h4>
              <ul className="space-y-2.5 text-xs text-[#a1a1aa]">
                <li className="flex items-center gap-1.5 text-[#22c55e]">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Auto-Refund Policy</span>
                </li>
                <li>
                  <span className="text-[#a1a1aa]">2FA Protection</span>
                </li>
                <li>
                  <span className="text-[#a1a1aa]">Zero-Log Retention</span>
                </li>
                <li>
                  <span className="text-[#a1a1aa]">Terms of Service</span>
                </li>
                <li>
                  <span className="text-[#a1a1aa]">Fair Use Guidelines</span>
                </li>
              </ul>
            </div>

            {/* Column 4: Channels & Support (Span 3) */}
            <div className="lg:col-span-3 flex flex-col">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">
                Channels &amp; Support
              </h4>
              <ul className="space-y-2.5 text-xs text-[#a1a1aa]">
                <li>
                  <a
                    href="https://t.me/DeamonOTPbot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[#38bdf8] hover:text-white transition-colors font-medium"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Official Bot: @DeamonOTPbot</span>
                  </a>
                </li>
                <li>
                  <a
                    href="https://t.me/DeamonOTPbot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
                  >
                    <span>24/7 Telegram Support Desk</span>
                  </a>
                </li>
                <li>
                  <span className="text-[#71717a]">Community Updates Channel</span>
                </li>
                <li>
                  <span className="text-[#71717a]">Dual Platform Synchronization</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Copyright & Compliance Line */}
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#71717a]">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#7c3aed]" />
              <span className="font-bold text-[#d4d4d8]">Deamon OTP Store</span>
              <span>• © 2026 All Rights Reserved</span>
            </div>

            <div className="flex items-center gap-4 text-[11px]">
              <span>Dual-Platform Web &amp; Telegram Architecture</span>
              <span>•</span>
              <a
                href="https://t.me/DeamonOTPbot"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                Telegram Mini App
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
