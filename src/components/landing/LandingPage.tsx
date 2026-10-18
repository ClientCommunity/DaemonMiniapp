import React, { useEffect, useRef, useState } from 'react';
import { authApi, GoogleAuthResponse } from '../../api/endpoints';
import { setWebUserToken } from '../../api/client';
import { BackendUserPayload } from '../../api/adapters';
import {
  Zap,
  ShieldCheck,
  Globe,
  Lock,
  Sparkles,
  AlertCircle,
  ExternalLink,
  Smartphone,
  Layers,
  ArrowRight,
  TrendingUp,
  CreditCard,
  RefreshCw,
  Clock,
  ChevronDown,
  HelpCircle,
} from 'lucide-react';

const GOOGLE_CLIENT_ID =
  (import.meta as unknown as { env?: Record<string, string | undefined> })?.env
    ?.VITE_GOOGLE_CLIENT_ID ||
  '844840577527-7qf3v11h62n199csg65dv9s0umbqethh.apps.googleusercontent.com';

interface LandingPageProps {
  onLoginSuccess: (token: string, user: BackendUserPayload) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLoginSuccess }) => {
  const heroGoogleBtnRef = useRef<HTMLDivElement>(null);
  const ctaGoogleBtnRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

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
      const msg = err instanceof Error ? err.message : 'Network connection failed';
      setErrorMessage(`Authentication error: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let checkInterval: ReturnType<typeof setInterval> | null = null;

    const initGoogleGsi = () => {
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

      if (google?.accounts?.id) {
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        if (heroGoogleBtnRef.current) {
          heroGoogleBtnRef.current.innerHTML = '';
          google.accounts.id.renderButton(heroGoogleBtnRef.current, {
            theme: 'filled_black',
            size: 'large',
            text: 'continue_with',
            shape: 'pill',
            width: 300,
            logo_alignment: 'left',
          });
        }

        if (ctaGoogleBtnRef.current) {
          ctaGoogleBtnRef.current.innerHTML = '';
          google.accounts.id.renderButton(ctaGoogleBtnRef.current, {
            theme: 'filled_black',
            size: 'large',
            text: 'signin_with',
            shape: 'pill',
            width: 300,
            logo_alignment: 'left',
          });
        }

        if (checkInterval) {
          clearInterval(checkInterval);
          checkInterval = null;
        }
      }
    };

    initGoogleGsi();

    checkInterval = setInterval(() => {
      const google = (window as unknown as { google?: { accounts?: { id?: unknown } } })?.google;
      if (google?.accounts?.id && (heroGoogleBtnRef.current || ctaGoogleBtnRef.current)) {
        initGoogleGsi();
      }
    }, 300);

    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, []);

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

  const faqItems = [
    {
      q: 'Do I need Telegram to use this website?',
      a: 'No! The website works completely standalone. You can log in securely using your Google account, deposit balance via UPI or Crypto USDT, purchase SMS OTP numbers, and download Telegram sessions directly in your browser.',
    },
    {
      q: 'What happens if an OTP is not received?',
      a: 'We have a 100% automated refund guarantee. If the SMS code does not arrive within the 20-minute countdown window, you can cancel anytime or let it expire to receive an immediate full refund back to your balance.',
    },
    {
      q: 'Which payment methods are accepted for top-ups?',
      a: 'We support instant zero-fee UPI QR codes, FamPay, and Cryptocurrency USDT (TRC-20 & BEP-20). Deposits are credited automatically within seconds.',
    },
    {
      q: 'Can I access the same services on Telegram?',
      a: 'Yes! If you prefer using Telegram directly, you can launch our official bot @DeamonOTPbot anytime. Both platforms share the same high-speed carrier infrastructure.',
    },
    {
      q: 'What format are the Telegram accounts delivered in?',
      a: 'Server 1 and Server 2 accounts are delivered as clean 2FA-secured accounts with instant .session file downloads and TData archive links.',
    },
  ];

  return (
    <div className="w-full min-h-screen bg-[#0b0b0e] text-white flex flex-col font-sans selection:bg-[#7c3aed] selection:text-white">
      {/* Background Ambient Glows */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-b from-[#7c3aed]/15 via-[#3b82f6]/10 to-transparent rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-0 right-0 w-[600px] h-[400px] bg-[#7c3aed]/10 rounded-full blur-[140px] pointer-events-none z-0" />

      {/* Modern Desktop & Mobile Top Navigation */}
      <header className="sticky top-0 z-50 w-full backdrop-blur-xl bg-[#0b0b0e]/80 border-b border-[#262630]/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#7c3aed] to-[#3b82f6] p-0.5 shadow-lg shadow-[#7c3aed]/30 flex items-center justify-center">
              <div className="w-full h-full bg-[#121217] rounded-[14px] flex items-center justify-center">
                <Zap className="w-5 h-5 text-[#a78bfa]" />
              </div>
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight text-white flex items-center gap-1.5">
                Krish OTP Store
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

          {/* Header Action Button */}
          <div className="flex items-center gap-3">
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
        <section className="relative pt-12 pb-20 sm:pt-20 sm:pb-28 overflow-hidden">
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
                    <span className="text-[11px] text-[#a1a1aa] font-medium mt-0.5">Avg Delivery</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xl sm:text-2xl font-black font-mono text-[#38bdf8]">500+</span>
                    <span className="text-[11px] text-[#a1a1aa] font-medium mt-0.5">Global Services</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Interactive Google Sign-In Card */}
              <div className="lg:col-span-5 flex justify-center lg:justify-end" id="auth-box">
                <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-[#181820]/90 to-[#121217]/95 border border-[#2a2a36] shadow-2xl backdrop-blur-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#7c3aed]/20 rounded-full blur-2xl pointer-events-none" />

                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#7c3aed] to-[#3b82f6] p-0.5 flex items-center justify-center shrink-0">
                      <div className="w-full h-full bg-[#121217] rounded-[14px] flex items-center justify-center">
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

                  {isLoading ? (
                    <div className="py-8 flex flex-col items-center justify-center gap-3">
                      <div className="w-8 h-8 border-3 border-[#7c3aed] border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-[#a1a1aa] font-medium">
                        Verifying Google credential &amp; loading wallet...
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4 py-2">
                      <div className="w-full flex justify-center min-h-[46px]" ref={heroGoogleBtnRef} />

                      <p className="text-[11px] text-[#71717a] text-center mt-1">
                        By continuing, you agree to secure account allocation with instant INR/USDT wallet access.
                      </p>
                    </div>
                  )}

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

        {/* SERVICES SHOWCASE SECTION */}
        <section id="services" className="py-16 sm:py-24 border-t border-[#1f1f2a] bg-[#0e0e12]/60">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <span className="text-xs font-bold text-[#8b5cf6] uppercase tracking-wider">
                Full Spectrum Offerings
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-white mt-2">
                Engineered for Reliability &amp; Speed
              </h2>
              <p className="text-xs sm:text-sm text-[#a1a1aa] mt-3">
                Everything you need to activate services, secure accounts, and scale online operations.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Service 1 */}
              <div className="p-6 rounded-2xl bg-[#14141a] border border-[#262632] hover:border-[#7c3aed]/50 transition-all group flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center mb-4 text-[#a78bfa] group-hover:scale-110 transition-transform">
                    <Zap className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-white">Virtual SMS OTPs</h3>
                  <span className="text-[10px] font-mono text-[#a78bfa] bg-[#7c3aed]/10 px-2 py-0.5 rounded-full inline-block mt-1">
                    Servers 3 &amp; 4
                  </span>
                  <p className="text-xs text-[#a1a1aa] mt-3 leading-relaxed">
                    Instant carrier numbers for WhatsApp, Telegram, Google, OpenAI, Instagram, Tinder, and 500+ apps.
                  </p>
                </div>
                <div className="mt-5 pt-4 border-t border-[#20202c] text-[11px] font-medium text-[#22c55e] flex items-center gap-1">
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Instant Auto-Refund on Expiry</span>
                </div>
              </div>

              {/* Service 2 */}
              <div className="p-6 rounded-2xl bg-[#14141a] border border-[#262632] hover:border-[#3b82f6]/50 transition-all group flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center mb-4 text-[#60a5fa] group-hover:scale-110 transition-transform">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-white">Telegram Accounts</h3>
                  <span className="text-[10px] font-mono text-[#60a5fa] bg-[#3b82f6]/10 px-2 py-0.5 rounded-full inline-block mt-1">
                    Servers 1 &amp; 2
                  </span>
                  <p className="text-xs text-[#a1a1aa] mt-3 leading-relaxed">
                    Aged 2021-2025 vintage sessions, 2FA protected, clean history with instant .session &amp; TData download.
                  </p>
                </div>
                <div className="mt-5 pt-4 border-t border-[#20202c] text-[11px] font-medium text-[#60a5fa] flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" />
                  <span>2FA Password Included</span>
                </div>
              </div>

              {/* Service 3 */}
              <div className="p-6 rounded-2xl bg-[#14141a] border border-[#262632] hover:border-[#22c55e]/50 transition-all group flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-4 text-[#4ade80] group-hover:scale-110 transition-transform">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-white">SMM Panel Growth</h3>
                  <span className="text-[10px] font-mono text-[#4ade80] bg-[#22c55e]/10 px-2 py-0.5 rounded-full inline-block mt-1">
                    Server 5
                  </span>
                  <p className="text-xs text-[#a1a1aa] mt-3 leading-relaxed">
                    Automated Telegram channel members, reactions, post views, and social media engagement delivered in real time.
                  </p>
                </div>
                <div className="mt-5 pt-4 border-t border-[#20202c] text-[11px] font-medium text-[#4ade80] flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Real-Time Order Tracking</span>
                </div>
              </div>

              {/* Service 4 */}
              <div className="p-6 rounded-2xl bg-[#14141a] border border-[#262632] hover:border-[#eab308]/50 transition-all group flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center mb-4 text-[#facc15] group-hover:scale-110 transition-transform">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-white">Universal Wallet</h3>
                  <span className="text-[10px] font-mono text-[#facc15] bg-[#eab308]/10 px-2 py-0.5 rounded-full inline-block mt-1">
                    INR &amp; USDT
                  </span>
                  <p className="text-xs text-[#a1a1aa] mt-3 leading-relaxed">
                    Zero-fee deposits using any UPI app (GPay, PhonePe, Paytm, FamPay) or USDT Crypto with instant P2P transfer.
                  </p>
                </div>
                <div className="mt-5 pt-4 border-t border-[#20202c] text-[11px] font-medium text-[#facc15] flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5" />
                  <span>P2P Internal Transfers</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS SECTION */}
        <section id="how-it-works" className="py-16 sm:py-24 border-t border-[#1f1f2a]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <span className="text-xs font-bold text-[#8b5cf6] uppercase tracking-wider">
                Seamless Experience
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-white mt-2">
                Get Started in 3 Simple Steps
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
              <div className="p-6 rounded-2xl bg-[#14141a] border border-[#262632] relative">
                <div className="w-10 h-10 rounded-full bg-[#7c3aed] text-white font-black text-sm flex items-center justify-center mb-4 shadow-lg shadow-[#7c3aed]/30">
                  1
                </div>
                <h3 className="text-base font-bold text-white">Sign In with Google</h3>
                <p className="text-xs text-[#a1a1aa] mt-2 leading-relaxed">
                  Click the Google button to authenticate in 2 seconds. No phone number, complex passwords, or email confirmation needed.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-[#14141a] border border-[#262632] relative">
                <div className="w-10 h-10 rounded-full bg-[#3b82f6] text-white font-black text-sm flex items-center justify-center mb-4 shadow-lg shadow-[#3b82f6]/30">
                  2
                </div>
                <h3 className="text-base font-bold text-white">Deposit Wallet Balance</h3>
                <p className="text-xs text-[#a1a1aa] mt-2 leading-relaxed">
                  Scan an instant UPI QR code with any payment app or transfer USDT. Your balance reflects immediately.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-[#14141a] border border-[#262632] relative">
                <div className="w-10 h-10 rounded-full bg-[#22c55e] text-white font-black text-sm flex items-center justify-center mb-4 shadow-lg shadow-[#22c55e]/30">
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
        <section id="faq" className="py-16 sm:py-24 border-t border-[#1f1f2a] bg-[#0e0e12]/60">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <span className="text-xs font-bold text-[#8b5cf6] uppercase tracking-wider">
                Common Questions
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-white mt-2">
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
                    className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-[#181822] transition-colors"
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
        <section className="py-20 border-t border-[#1f1f2a] relative overflow-hidden">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center relative z-10">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#7c3aed] to-[#3b82f6] p-0.5 mx-auto mb-6 shadow-xl shadow-[#7c3aed]/25 flex items-center justify-center">
              <div className="w-full h-full bg-[#121217] rounded-[22px] flex items-center justify-center">
                <Zap className="w-8 h-8 text-[#a78bfa]" />
              </div>
            </div>

            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Ready to Get Started?
            </h2>
            <p className="text-xs sm:text-sm text-[#a1a1aa] mt-3 max-w-lg mx-auto">
              Join thousands of users enjoying real-time virtual SMS OTPs and premium Telegram accounts.
            </p>

            <div className="mt-8 flex flex-col items-center gap-4">
              <div ref={ctaGoogleBtnRef} className="min-h-[46px]" />

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

      {/* FOOTER */}
      <footer className="border-t border-[#181820] py-8 bg-[#08080b]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#71717a]">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#7c3aed]" />
            <span className="font-bold text-[#d4d4d8]">Krish OTP Store</span>
            <span>• © 2026 All Rights Reserved</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1 text-[#22c55e]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>SSL 256-Bit Encrypted</span>
            </span>
            <span>•</span>
            <a
              href="https://t.me/DeamonOTPbot"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Telegram Support
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
