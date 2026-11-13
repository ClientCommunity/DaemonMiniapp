import React, { useEffect, useMemo, useRef, useState } from 'react';
import { authApi, GoogleAuthResponse } from '../../api/endpoints';
import { setWebUserToken } from '../../api/client';
import { BackendUserPayload } from '../../api/adapters';
import { useApp } from '../../context/AppContext';
import {
  ShieldCheck,
  Lock,
  AlertCircle,
  ExternalLink,
  Smartphone,
  ArrowRight,
  CreditCard,
  RefreshCw,
  ChevronDown,
  HelpCircle,
  Sun,
  Moon,
  CheckCircle2,
  Download,
  Radio,
  Search,
  Server,
  Zap,
  ArrowUpRight,
  Cpu,
} from 'lucide-react';

const GOOGLE_CLIENT_ID =
  (import.meta as unknown as { env?: Record<string, string | undefined> })?.env
    ?.VITE_GOOGLE_CLIENT_ID ||
  '844840577527-7qf3v11h62n199csg65dv9s0umbqethh.apps.googleusercontent.com';

const LOGO_URL = `${((import.meta as unknown as { env?: { BASE_URL?: string } })?.env?.BASE_URL || '/').replace(/\/$/, '')}/deamon-logo.png`;

interface LandingPageProps {
  onLoginSuccess: (token: string, user: BackendUserPayload) => void;
}

interface ServiceItem {
  id: string;
  name: string;
  category: 'otp' | 'session' | 'smm';
  server: string;
  country: string;
  flag: string;
  priceInr: number;
  priceUsdt: number;
  format: string;
  speed: string;
  stockText: string;
  successRate: string;
  description: string;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLoginSuccess }) => {
  const { theme, toggleTheme } = useApp();
  const isLight = theme === 'light';

  const heroGoogleBtnRef = useRef<HTMLDivElement>(null);
  const ctaGoogleBtnRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  // Live Service Explorer State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'otp' | 'session' | 'smm'>('all');
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [calcQuantity, setCalcQuantity] = useState<number>(1);
  const [selectedServiceId, setSelectedServiceId] = useState<string>('tg_in');

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

  // Comprehensive Real Service Catalog for the Live Interactive Terminal
  const serviceCatalog: ServiceItem[] = [
    {
      id: 'tg_in',
      name: 'Telegram Messenger OTP',
      category: 'otp',
      server: 'Server 3 & 4',
      country: 'India',
      flag: '🇮🇳',
      priceInr: 15,
      priceUsdt: 0.18,
      format: 'Instant SMS Code',
      speed: '< 3s Avg',
      stockText: '1,420+ Available',
      successRate: '99.4%',
      description: 'Carrier numbers for Telegram personal accounts, bot admins, and channel managers.',
    },
    {
      id: 'wa_in',
      name: 'WhatsApp & WA Business OTP',
      category: 'otp',
      server: 'Server 3 & 4',
      country: 'India',
      flag: '🇮🇳',
      priceInr: 18,
      priceUsdt: 0.22,
      format: 'Instant SMS Code',
      speed: '< 4s Avg',
      stockText: '890+ Available',
      successRate: '98.9%',
      description: 'Dedicated non-recycled mobile lines for personal and business WhatsApp registration.',
    },
    {
      id: 'ai_us',
      name: 'OpenAI / ChatGPT / Claude OTP',
      category: 'otp',
      server: 'Server 3 & 4',
      country: 'United States',
      flag: '🇺🇸',
      priceInr: 12,
      priceUsdt: 0.15,
      format: 'Instant SMS Code',
      speed: '< 2s Avg',
      stockText: '3,100+ Available',
      successRate: '99.8%',
      description: 'Fast verification for developer APIs, ChatGPT Plus, and Anthropic Claude accounts.',
    },
    {
      id: 'ig_in',
      name: 'Instagram & Facebook OTP',
      category: 'otp',
      server: 'Server 3 & 4',
      country: 'India',
      flag: '🇮🇳',
      priceInr: 10,
      priceUsdt: 0.12,
      format: 'Instant SMS Code',
      speed: '< 3s Avg',
      stockText: '2,800+ Available',
      successRate: '99.1%',
      description: 'Instant mobile lines for Meta platforms, Instagram creators, and marketing managers.',
    },
    {
      id: 'tg_aged_2022',
      name: 'Vintage Telegram Session (2021–2023)',
      category: 'session',
      server: 'Server 2',
      country: 'Global / Multi-Region',
      flag: '🌐',
      priceInr: 75,
      priceUsdt: 0.90,
      format: 'ZIP (.session + TData + 2FA)',
      speed: 'Instant Download',
      stockText: '420 In Stock',
      successRate: '100% Validated',
      description: 'Fully aged accounts with clean history. Ready for Pyrogram/Telethon automation and desktop use.',
    },
    {
      id: 'tg_virgin_2025',
      name: 'Virgin Telegram Session (2025)',
      category: 'session',
      server: 'Server 2',
      country: 'Global / Multi-Region',
      flag: '🌐',
      priceInr: 50,
      priceUsdt: 0.60,
      format: 'ZIP (.session + TData + 2FA)',
      speed: 'Instant Download',
      stockText: '850 In Stock',
      successRate: '100% Validated',
      description: 'Fresh clean-history Telegram account with full 2FA credentials and instant archive download.',
    },
    {
      id: 'tg_lzt_global',
      name: 'LZT Market Imported Telegram Account',
      category: 'session',
      server: 'Server 1',
      country: 'United States / Europe',
      flag: '🇺🇸',
      priceInr: 65,
      priceUsdt: 0.78,
      format: 'ZIP (.session + 2FA)',
      speed: 'Instant Delivery',
      stockText: '310 In Stock',
      successRate: 'Warranty Guaranteed',
      description: 'Verified international accounts with automated pre-checks and 24h replacement warranty.',
    },
    {
      id: 'smm_tg_members',
      name: 'Telegram Channel Members (Non-Drop)',
      category: 'smm',
      server: 'Server 5',
      country: 'Global Audience',
      flag: '🌐',
      priceInr: 95,
      priceUsdt: 1.15,
      format: 'Direct In-App Delivery',
      speed: '10,000 / Day',
      stockText: 'Unlimited Capacity',
      successRate: '30-Day Refill Guarantee',
      description: 'High-retention channel subscribers to scale audience credibility and broadcast reach.',
    },
    {
      id: 'smm_tg_views',
      name: 'Telegram Post Views & Reactions',
      category: 'smm',
      server: 'Server 5',
      country: 'Global Audience',
      flag: '🌐',
      priceInr: 8,
      priceUsdt: 0.10,
      format: 'Direct In-App Delivery',
      speed: 'Instantaneous',
      stockText: 'Unlimited Capacity',
      successRate: '100% Safe',
      description: 'Fast views and positive emoji reactions on your recent posts with 0 password required.',
    },
    {
      id: 'gmail_otp_us',
      name: 'Google & Gmail Verification OTP',
      category: 'otp',
      server: 'Server 3 & 4',
      country: 'United States',
      flag: '🇺🇸',
      priceInr: 16,
      priceUsdt: 0.20,
      format: 'Instant SMS Code',
      speed: '< 3s Avg',
      stockText: '1,950+ Available',
      successRate: '99.5%',
      description: 'High-trust US carrier numbers for Google Workspace, YouTube channels, and Gmail sign-ups.',
    },
    {
      id: 'crypto_otp_global',
      name: 'Binance / Bybit / Crypto Exchange OTP',
      category: 'otp',
      server: 'Server 3 & 4',
      country: 'United Kingdom',
      flag: '🇬🇧',
      priceInr: 22,
      priceUsdt: 0.26,
      format: 'Instant SMS Code',
      speed: '< 3s Avg',
      stockText: '640+ Available',
      successRate: '99.2%',
      description: 'Dedicated financial SMS lines for major international crypto exchange verification.',
    },
  ];

  // Filtered Services based on user search and filters
  const filteredServices = useMemo(() => {
    return serviceCatalog.filter((item) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        selectedCategory === 'all' || item.category === selectedCategory;

      const matchesCountry =
        selectedCountry === 'all' || item.country.toLowerCase().includes(selectedCountry.toLowerCase());

      return matchesSearch && matchesCategory && matchesCountry;
    });
  }, [searchQuery, selectedCategory, selectedCountry]);

  // Selected Service for Live Calculator
  const activeSelectedService = useMemo(() => {
    return (
      serviceCatalog.find((s) => s.id === selectedServiceId) ||
      filteredServices[0] ||
      serviceCatalog[0]
    );
  }, [selectedServiceId, filteredServices]);

  const faqItems = [
    {
      q: 'Do I need a Telegram account to use this website?',
      a: 'No. The website operates completely standalone with 1-click Google authentication. You can deposit balance via UPI or Crypto USDT, purchase SMS OTPs, and download Telegram session files directly in your web browser. If you do prefer Telegram, our official bot @DeamonOTPbot shares the exact same wallet and order history.',
    },
    {
      q: 'What happens if an SMS verification code does not arrive?',
      a: 'We operate on a 100% automated refund guarantee. Every virtual number includes an active 20-minute countdown window. If the code does not arrive, you can cancel with 1 click or let the timer expire—your wallet balance is credited back immediately and automatically. No support tickets or manual requests are ever required.',
    },
    {
      q: 'What files do I receive when purchasing Telegram sessions?',
      a: 'You receive instant downloadable ZIP packages containing the .session file (compatible with Pyrogram, Telethon, and automation scripts) as well as the complete TData folder (ready to paste directly into Telegram Desktop). The two-factor authentication (2FA) password is also displayed directly on your screen.',
    },
    {
      q: 'Which deposit methods are accepted and how fast are they credited?',
      a: 'We support instant zero-fee UPI QR codes (Google Pay, PhonePe, Paytm, BHIM, FamPay) for Indian Rupees (₹) and cryptocurrency USDT (TRC-20 and BEP-20) for US Dollars ($). Deposits are verified and added to your balance automatically within seconds.',
    },
    {
      q: 'Can I transfer wallet balance to another user?',
      a: 'Yes. Our platform includes zero-fee peer-to-peer (P2P) transfers. You can send balance instantly to any other registered user using their Account ID or Telegram ID.',
    },
  ];

  return (
    <div className="w-full min-h-screen bg-[#090a0f] text-white flex flex-col font-sans selection:bg-[#7c3aed] selection:text-white">
      {/* Subtle Structural Top Grid Accent */}
      <div className="absolute top-0 left-0 right-0 h-96 bg-[radial-gradient(ellipse_80%_40%_at_50%_-20%,rgba(124,58,237,0.12),transparent)] pointer-events-none z-0" />

      {/* Top Header Navigation */}
      <header className="sticky top-0 z-50 w-full backdrop-blur-xl bg-[#090a0f]/90 border-b border-[#1b1c24] landing-header">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#7c3aed] to-[#3b82f6] p-0.5 shadow-md shadow-[#7c3aed]/25 flex items-center justify-center shrink-0">
              <div className="w-full h-full bg-[#111217] rounded-[10px] flex items-center justify-center p-1 landing-logo-inner overflow-hidden">
                <img
                  src={LOGO_URL}
                  alt="Deamon OTP Logo"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.src.endsWith('deamon-logo.webp')) {
                      target.src = './deamon-logo.webp';
                    }
                  }}
                />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-base sm:text-lg tracking-tight text-white flex items-center gap-2">
                Deamon OTP
                <span className="text-[10px] font-mono font-bold bg-emerald-500/10 text-[#22c55e] border border-emerald-500/30 px-1.5 py-0.2 rounded-full">
                  OPERATIONAL
                </span>
              </span>
              <span className="hidden sm:block text-[10px] text-[#71717a] font-medium">
                Virtual Numbers &amp; Telegram Sessions
              </span>
            </div>
          </div>

          {/* Direct Nav Anchor Links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-[#a1a1aa]">
            <a href="#rates" className="hover:text-white transition-colors">Live Rates &amp; Stock</a>
            <a href="#servers" className="hover:text-white transition-colors">Server Architecture</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">Order Flow</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
            <a
              href="https://t.me/DeamonOTPbot"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[#38bdf8] hover:text-white transition-colors"
            >
              <span>@DeamonOTPbot</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </nav>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Theme Switcher */}
            <button
              type="button"
              onClick={toggleTheme}
              className={`min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl border transition-all cursor-pointer ${
                isLight
                  ? 'bg-white hover:bg-slate-100 border-slate-300 shadow-sm'
                  : 'bg-[#14151c] hover:bg-[#1a1b24] border-[#22232e]'
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

            <button
              onClick={triggerGooglePrompt}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6366f1] hover:from-[#6d28d9] hover:to-[#4f46e5] text-xs font-bold text-white shadow-md shadow-[#7c3aed]/25 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>Sign In with Google</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col">
        {/* HERO SECTION */}
        <section className="relative pt-12 pb-16 sm:pt-20 sm:pb-24 border-b border-[#1b1c24]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-start">
              {/* Left Column: Clear Value Proposition */}
              <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left">
                <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-[1.12] text-white">
                  Virtual Numbers &amp;{' '}
                  <span className="text-[#38bdf8]">
                    Telegram Session Marketplace
                  </span>
                </h1>

                <p className="mt-5 text-sm sm:text-base text-[#a1a1aa] leading-relaxed max-w-xl">
                  Receive instant SMS verification codes for 500+ apps across 50+ countries. Download aged
                  2FA-secured Telegram accounts (.session &amp; TData) on demand. Instant UPI and Crypto balance with 100% automated refunds.
                </p>

                {/* Direct Action Buttons */}
                <div className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-3">
                  <a
                    href="#rates"
                    className="px-5 py-2.5 rounded-xl bg-[#1f202b] hover:bg-[#282a38] border border-[#2c2d3d] text-xs font-bold text-white shadow-sm flex items-center gap-2 transition-all"
                  >
                    <Search className="w-4 h-4 text-[#38bdf8]" />
                    <span>Explore Live Rates &amp; Stock</span>
                  </a>
                  <a
                    href="https://t.me/DeamonOTPbot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-2.5 rounded-xl bg-[#14151c] hover:bg-[#1a1b24] border border-[#22232e] text-xs font-semibold text-[#a1a1aa] hover:text-white flex items-center gap-2 transition-all"
                  >
                    <Smartphone className="w-4 h-4 text-[#38bdf8]" />
                    <span>Open in Telegram (@DeamonOTPbot)</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                </div>

                {/* Engineering Benchmarks (Zero Fluff, Real Facts) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-10 pt-8 border-t border-[#1b1c24] w-full">
                  <div className="flex flex-col">
                    <span className="text-xl sm:text-2xl font-black font-mono text-[#22c55e]">&lt; 4s</span>
                    <span className="text-[11px] text-[#71717a] font-medium mt-0.5">Average SMS Arrival</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xl sm:text-2xl font-black font-mono text-white">500+</span>
                    <span className="text-[11px] text-[#71717a] font-medium mt-0.5">Supported Services</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xl sm:text-2xl font-black font-mono text-[#38bdf8]">100%</span>
                    <span className="text-[11px] text-[#71717a] font-medium mt-0.5">Automated Refunds</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xl sm:text-2xl font-black font-mono text-[#a78bfa]">2FA</span>
                    <span className="text-[11px] text-[#71717a] font-medium mt-0.5">TData &amp; .session Included</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Google Sign-In Card */}
              <div className="lg:col-span-5 flex justify-center lg:justify-end w-full" id="auth-box">
                <div className="w-full max-w-md p-6 sm:p-7 rounded-2xl bg-[#12131a] border border-[#22232e] shadow-xl relative overflow-hidden landing-auth-card">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#7c3aed] to-[#3b82f6] p-0.5 flex items-center justify-center shrink-0">
                      <div className="w-full h-full bg-[#111217] rounded-[10px] flex items-center justify-center landing-logo-inner">
                        <Lock className="w-4 h-4 text-[#a78bfa]" />
                      </div>
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white">Sign In to Storefront</h2>
                      <p className="text-xs text-[#a1a1aa]">1-click Google authentication</p>
                    </div>
                  </div>

                  {errorMessage && (
                    <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">Authentication Notice: </span>
                        <span>{errorMessage}</span>
                      </div>
                    </div>
                  )}

                  {/* Google Login Trigger */}
                  <div className="py-2 flex flex-col items-center w-full">
                    <div className="relative w-full max-w-[320px] h-[48px] mx-auto select-none">
                      <div
                        className={`landing-google-btn w-full h-full rounded-xl flex items-center justify-center gap-3 px-5 transition-all duration-200 border ${
                          isLoading
                            ? 'bg-[#181824] border-[#7c3aed]/60 cursor-wait'
                            : 'bg-[#181922] hover:bg-[#20212d] border-[#2a2b38] hover:border-[#7c3aed]/60 shadow-sm cursor-pointer active:scale-[0.98]'
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
                            <span className="text-sm font-semibold text-white">
                              Continue with Google
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Google GSI Native Popup Layer */}
                      <div
                        ref={heroGoogleBtnRef}
                        className={`absolute inset-0 overflow-hidden rounded-xl cursor-pointer z-10 ${
                          isLoading ? 'pointer-events-none opacity-0' : 'opacity-[0.0001]'
                        }`}
                        style={{
                          transform: 'scale(1.04)',
                          transformOrigin: 'center',
                        }}
                      />
                    </div>

                    <p className="text-[11px] text-[#71717a] text-center mt-3">
                      Instant wallet allocation in Indian Rupees (₹) &amp; USDT ($)
                    </p>
                  </div>

                  {/* Security Points */}
                  <div className="mt-5 pt-4 border-t border-[#1b1c24] space-y-2">
                    <div className="flex items-center gap-2 text-xs text-[#a1a1aa]">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#22c55e] shrink-0" />
                      <span>Zero setup fee • Automatic refunds if code doesn&apos;t arrive</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#a1a1aa]">
                      <CreditCard className="w-3.5 h-3.5 text-[#38bdf8] shrink-0" />
                      <span>Instant deposit via UPI (GPay/PhonePe/Paytm) &amp; USDT</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#a1a1aa]">
                      <Radio className="w-3.5 h-3.5 text-[#a78bfa] shrink-0" />
                      <span>Synced in real-time with @DeamonOTPbot</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ACCEPTED DEPOSIT GATEWAYS STRIP */}
        <section className="py-5 border-b border-[#1b1c24] bg-[#0c0d12]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-[#71717a]">
                <CreditCard className="w-4 h-4 text-[#22c55e]" />
                <span className="font-semibold text-white">Accepted Deposit Methods:</span>
                <span className="hidden sm:inline">Zero processing fee • Instant automated balance crediting</span>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-[#14151c] border border-[#22232e] text-xs font-medium text-[#d4d4d8] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                  Google Pay
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-[#14151c] border border-[#22232e] text-xs font-medium text-[#d4d4d8] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#8b5cf6]" />
                  PhonePe
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-[#14151c] border border-[#22232e] text-xs font-medium text-[#d4d4d8] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8]" />
                  Paytm / BHIM UPI
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-[#14151c] border border-[#22232e] text-xs font-medium text-[#d4d4d8] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                  USDT (TRC-20 &amp; BEP-20)
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-[#14151c] border border-[#22232e] text-xs font-medium text-[#d4d4d8] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
                  FamPay Direct
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* INTERACTIVE LIVE SERVICE & RATE TERMINAL */}
        <section id="rates" className="py-16 sm:py-20 border-b border-[#1b1c24]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
              <div>
                <span className="text-xs font-bold text-[#38bdf8] uppercase tracking-wider font-mono">
                  Live Terminal
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">
                  Service Rates &amp; Stock Availability
                </h2>
                <p className="text-xs sm:text-sm text-[#a1a1aa] mt-1">
                  Search live starting prices, carriers, and delivery formats before signing in.
                </p>
              </div>

              {/* Category Filter Chips */}
              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#12131a] border border-[#22232e] rounded-xl self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    selectedCategory === 'all'
                      ? 'bg-[#7c3aed] text-white shadow-sm font-bold'
                      : 'text-[#a1a1aa] hover:text-white'
                  }`}
                >
                  All ({serviceCatalog.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('otp')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    selectedCategory === 'otp'
                      ? 'bg-[#7c3aed] text-white shadow-sm font-bold'
                      : 'text-[#a1a1aa] hover:text-white'
                  }`}
                >
                  SMS OTPs
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('session')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    selectedCategory === 'session'
                      ? 'bg-[#7c3aed] text-white shadow-sm font-bold'
                      : 'text-[#a1a1aa] hover:text-white'
                  }`}
                >
                  Telegram Sessions
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('smm')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    selectedCategory === 'smm'
                      ? 'bg-[#7c3aed] text-white shadow-sm font-bold'
                      : 'text-[#a1a1aa] hover:text-white'
                  }`}
                >
                  SMM Boost
                </button>
              </div>
            </div>

            {/* Interactive Search Bar & Country Filter */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-6">
              <div className="sm:col-span-8 relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#71717a]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search app (WhatsApp, Telegram, OpenAI...) or country (India, USA, UK...)"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#12131a] border border-[#22232e] text-xs text-white placeholder-[#71717a] focus:outline-none focus:border-[#7c3aed] transition-colors"
                />
              </div>

              <div className="sm:col-span-4">
                <select
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#12131a] border border-[#22232e] text-xs text-white focus:outline-none focus:border-[#7c3aed] cursor-pointer"
                >
                  <option value="all">All Regions &amp; Countries</option>
                  <option value="india">India 🇮🇳</option>
                  <option value="united states">United States 🇺🇸</option>
                  <option value="united kingdom">United Kingdom 🇬🇧</option>
                  <option value="global">Global / Multi-Region 🌐</option>
                </select>
              </div>
            </div>

            {/* Service Items Table / Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredServices.map((service) => (
                <div
                  key={service.id}
                  onClick={() => setSelectedServiceId(service.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    selectedServiceId === service.id
                      ? 'bg-[#151622] border-[#7c3aed] shadow-md shadow-[#7c3aed]/10'
                      : 'bg-[#12131a] border-[#20212c] hover:border-[#2e3040]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-medium text-[#a1a1aa] flex items-center gap-1.5">
                        <span>{service.flag}</span>
                        <span>{service.country}</span>
                      </span>
                      <span className="text-[10px] font-mono font-semibold text-[#22c55e] bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                        {service.successRate}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-white tracking-tight">
                      {service.name}
                    </h3>
                    <p className="text-xs text-[#71717a] mt-1 leading-relaxed">
                      {service.description}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-mono text-[#a1a1aa]">
                      <span className="px-2 py-0.5 rounded bg-[#181924] border border-[#262736]">
                        {service.format}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#181924] border border-[#262736] text-[#38bdf8]">
                        {service.speed}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#1b1c24] flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-[#71717a] block">Starting from</span>
                      <span className="text-sm font-black font-mono text-[#22c55e]">
                        ₹{service.priceInr}{' '}
                        <span className="text-xs font-normal text-[#71717a]">
                          (${service.priceUsdt.toFixed(2)})
                        </span>
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerGooglePrompt();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#1c1d29] hover:bg-[#7c3aed] hover:text-white text-xs font-semibold text-[#d4d4d8] border border-[#2a2b3a] transition-all cursor-pointer flex items-center gap-1"
                    >
                      <span>Get Number</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {filteredServices.length === 0 && (
              <div className="py-12 text-center text-[#71717a] text-xs">
                No matching services found for &quot;{searchQuery}&quot;. Try clearing filters or searching for &quot;WhatsApp&quot; or &quot;Telegram&quot;.
              </div>
            )}

            {/* Interactive Rate Estimator Bar */}
            <div className="mt-8 p-5 rounded-xl bg-[#12131a] border border-[#22232e] flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#1c1d29] border border-[#282a3a] flex items-center justify-center shrink-0 text-[#38bdf8]">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Quick Rate Calculator
                  </h4>
                  <p className="text-xs text-[#a1a1aa]">
                    Selected:{' '}
                    <span className="text-white font-semibold">{activeSelectedService.name}</span>{' '}
                    ({activeSelectedService.country})
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#71717a]">Qty:</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={calcQuantity}
                    onChange={(e) => setCalcQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 px-2.5 py-1 rounded-lg bg-[#181924] border border-[#2a2b3a] text-xs font-mono text-center text-white focus:outline-none focus:border-[#7c3aed]"
                  />
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-[#71717a] block">Estimated Total</span>
                  <span className="text-base font-black font-mono text-[#22c55e]">
                    ₹{activeSelectedService.priceInr * calcQuantity}{' '}
                    <span className="text-xs font-normal text-[#71717a]">
                      (${(activeSelectedService.priceUsdt * calcQuantity).toFixed(2)})
                    </span>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={triggerGooglePrompt}
                  className="px-4 py-2 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-xs font-bold text-white transition-all cursor-pointer shadow-sm"
                >
                  Sign In to Purchase
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 4-SERVER INFRASTRUCTURE (THE ACTUAL BACKEND PIPELINES) */}
        <section id="servers" className="py-16 sm:py-20 border-b border-[#1b1c24] bg-[#0c0d12]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="text-xs font-bold text-[#7c3aed] uppercase tracking-wider font-mono">
                System Infrastructure
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">
                4 Specialized Service Pipelines
              </h2>
              <p className="text-xs sm:text-sm text-[#a1a1aa] mt-1.5">
                Every server is built for a dedicated use case: verified aged sessions, live carrier OTPs, and community scaling.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Server 1: LZT Market Imported Accounts */}
              <div className="p-6 rounded-2xl bg-[#12131a] border border-[#22232e] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 text-[#38bdf8] flex items-center justify-center font-bold">
                      <Server className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-mono text-[#38bdf8] bg-sky-500/10 border border-sky-500/20 px-2.5 py-0.5 rounded-full">
                      Server 1
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white">
                    LZT Market Imported Accounts
                  </h3>
                  <p className="text-xs text-[#a1a1aa] mt-2 leading-relaxed">
                    Automated access to verified international Telegram accounts imported with active 2FA credentials. Pre-checked for session health and covered by replacement warranties.
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-[#1b1c24] flex items-center justify-between text-xs text-[#71717a]">
                  <span>Instant Credential Delivery</span>
                  <span className="font-mono text-white font-semibold">24h Replacement Guard</span>
                </div>
              </div>

              {/* Server 2: Fresh & Vintage Telegram Sessions */}
              <div className="p-6 rounded-2xl bg-[#12131a] border border-[#22232e] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-[#a78bfa] flex items-center justify-center font-bold">
                      <Download className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-mono text-[#a78bfa] bg-purple-500/10 border border-purple-500/20 px-2.5 py-0.5 rounded-full">
                      Server 2
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white">
                    Vintage Telegram Sessions (2021–2025)
                  </h3>
                  <p className="text-xs text-[#a1a1aa] mt-2 leading-relaxed">
                    Aged and virgin accounts with clean registration history. Every purchase provides both instant .session files (for Python scripts) and complete TData folders with 2FA passwords.
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-[#1b1c24] flex items-center justify-between text-xs text-[#71717a]">
                  <span>.session + TData ZIP</span>
                  <span className="font-mono text-[#22c55e] font-semibold">100% Tested Valid</span>
                </div>
              </div>

              {/* Server 3 & 4: Virtual SMS OTP Pools */}
              <div className="p-6 rounded-2xl bg-[#12131a] border border-[#22232e] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[#22c55e] flex items-center justify-center font-bold">
                      <RefreshCw className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-mono text-[#22c55e] bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                      Servers 3 &amp; 4
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white">
                    Live Carrier Virtual SMS OTP Pools
                  </h3>
                  <p className="text-xs text-[#a1a1aa] mt-2 leading-relaxed">
                    High-throughput private carrier lines for 500+ apps. Includes a 20-minute active timer. If an SMS code is not received, the order is cancelled with a 100% automated refund to your wallet.
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-[#1b1c24] flex items-center justify-between text-xs text-[#71717a]">
                  <span>20-Min Active Countdown</span>
                  <span className="font-mono text-[#22c55e] font-semibold">Automatic Refund Guard</span>
                </div>
              </div>

              {/* Server 5: Social Media SMM Panel */}
              <div className="p-6 rounded-2xl bg-[#12131a] border border-[#22232e] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[#f59e0b] flex items-center justify-center font-bold">
                      <Zap className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-mono text-[#f59e0b] bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                      Server 5
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white">
                    SMM Social Growth Panel
                  </h3>
                  <p className="text-xs text-[#a1a1aa] mt-2 leading-relaxed">
                    Automated delivery of high-retention Telegram channel members, real post views, and custom emoji reactions. Scaled for creators and community managers with drop protection.
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-[#1b1c24] flex items-center justify-between text-xs text-[#71717a]">
                  <span>30-Day Refill Guarantee</span>
                  <span className="font-mono text-white font-semibold">Instant Execution</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ORDER LIFECYCLE FLOW */}
        <section id="how-it-works" className="py-16 sm:py-20 border-b border-[#1b1c24]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="text-xs font-bold text-[#22c55e] uppercase tracking-wider font-mono">
                Order Execution
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">
                How an Order Works in Practice
              </h2>
              <p className="text-xs sm:text-sm text-[#a1a1aa] mt-1.5">
                Transparent step-by-step lifecycle from wallet deposit to SMS code delivery.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-xl bg-[#12131a] border border-[#22232e]">
                <div className="w-8 h-8 rounded-lg bg-[#7c3aed] text-white font-black text-xs flex items-center justify-center mb-3 landing-step-num">
                  1
                </div>
                <h3 className="text-sm font-bold text-white">Sign In &amp; Top Up</h3>
                <p className="text-xs text-[#a1a1aa] mt-1.5 leading-relaxed">
                  Authenticate with Google in 2 seconds. Scan an instant UPI QR code or transfer USDT; balance reflects automatically.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-[#12131a] border border-[#22232e]">
                <div className="w-8 h-8 rounded-lg bg-[#38bdf8] text-white font-black text-xs flex items-center justify-center mb-3 landing-step-num">
                  2
                </div>
                <h3 className="text-sm font-bold text-white">Select App &amp; Country</h3>
                <p className="text-xs text-[#a1a1aa] mt-1.5 leading-relaxed">
                  Choose your service. A dedicated virtual carrier line is allocated immediately with an active 20:00 countdown timer.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-[#12131a] border border-[#22232e]">
                <div className="w-8 h-8 rounded-lg bg-[#22c55e] text-white font-black text-xs flex items-center justify-center mb-3 landing-step-num">
                  3
                </div>
                <h3 className="text-sm font-bold text-white">Receive SMS Code</h3>
                <p className="text-xs text-[#a1a1aa] mt-1.5 leading-relaxed">
                  The verification code arrives directly on your screen within seconds. Copy it with 1 click to complete activation.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-[#12131a] border border-[#22232e]">
                <div className="w-8 h-8 rounded-lg bg-[#f59e0b] text-white font-black text-xs flex items-center justify-center mb-3 landing-step-num">
                  4
                </div>
                <h3 className="text-sm font-bold text-white">Automated Refund Guard</h3>
                <p className="text-xs text-[#a1a1aa] mt-1.5 leading-relaxed">
                  If the code is not delivered before the timer runs out, the full amount is refunded automatically to your balance.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ SECTION */}
        <section id="faq" className="py-16 sm:py-20 border-b border-[#1b1c24] bg-[#0c0d12]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="text-xs font-bold text-[#a78bfa] uppercase tracking-wider font-mono">
                Support &amp; Answers
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">
                Frequently Asked Questions
              </h2>
            </div>

            <div className="space-y-3">
              {faqItems.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-xl bg-[#12131a] border border-[#22232e] overflow-hidden"
                >
                  <button
                    onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                    className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-[#161722] transition-colors landing-faq-btn"
                  >
                    <span className="text-sm font-bold text-white flex items-center gap-2.5">
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
                    <div className="px-5 pb-5 text-xs text-[#a1a1aa] leading-relaxed border-t border-[#1b1c24] pt-3">
                      {item.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* BOTTOM CALL TO ACTION */}
        <section className="py-16 sm:py-20 border-b border-[#1b1c24] relative overflow-hidden">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#7c3aed] to-[#3b82f6] p-0.5 mx-auto mb-5 shadow-lg shadow-[#7c3aed]/20 flex items-center justify-center shrink-0">
              <div className="w-full h-full bg-[#111217] rounded-[14px] flex items-center justify-center p-1.5 landing-logo-inner overflow-hidden">
                <img
                  src={LOGO_URL}
                  alt="Deamon OTP Logo"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.src.endsWith('deamon-logo.webp')) {
                      target.src = './deamon-logo.webp';
                    }
                  }}
                />
              </div>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Start Receiving OTPs &amp; Downloading Sessions
            </h2>
            <p className="text-xs sm:text-sm text-[#a1a1aa] mt-2 max-w-lg mx-auto">
              Zero setup fees. Immediate access to carrier numbers, aged accounts, and social panel tools.
            </p>

            <div className="mt-7 flex flex-col items-center gap-4">
              <div className="relative w-full max-w-[320px] h-[48px] mx-auto select-none">
                <div
                  className={`landing-google-btn w-full h-full rounded-xl flex items-center justify-center gap-3 px-5 transition-all duration-200 border ${
                    isLoading
                      ? 'bg-[#181824] border-[#7c3aed]/60 cursor-wait'
                      : 'bg-[#181922] hover:bg-[#20212d] border-[#2a2b38] hover:border-[#7c3aed]/60 shadow-sm cursor-pointer active:scale-[0.98]'
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
                      <span className="text-sm font-semibold text-white">
                        Sign In with Google
                      </span>
                    </div>
                  )}
                </div>

                <div
                  ref={ctaGoogleBtnRef}
                  className={`absolute inset-0 overflow-hidden rounded-xl cursor-pointer z-10 ${
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
                className="inline-flex items-center gap-2 text-xs text-[#a1a1aa] hover:text-white transition-colors"
              >
                <span>Prefer using Telegram directly? Open @DeamonOTPbot</span>
                <ExternalLink className="w-3.5 h-3.5 text-[#38bdf8]" />
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* COMPREHENSIVE 4-COLUMN PROFESSIONAL FOOTER */}
      <footer className="border-t border-[#1b1c24] pt-12 pb-8 bg-[#07070a]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 pb-10 border-b border-[#1b1c24]">
            {/* Column 1: Brand & Operational Status (Span 4) */}
            <div className="lg:col-span-4 flex flex-col">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#7c3aed] to-[#3b82f6] p-0.5 flex items-center justify-center shrink-0">
                  <div className="w-full h-full bg-[#111217] rounded-[7px] flex items-center justify-center p-1 landing-logo-inner overflow-hidden">
                    <img
                      src={LOGO_URL}
                      alt="Deamon OTP Logo"
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (!target.src.endsWith('deamon-logo.webp')) {
                          target.src = './deamon-logo.webp';
                        }
                      }}
                    />
                  </div>
                </div>
                <span className="font-extrabold text-sm tracking-tight text-white">
                  Deamon OTP Store
                </span>
              </div>

              <p className="text-xs text-[#71717a] leading-relaxed max-w-sm mb-4">
                High-throughput carrier infrastructure for virtual SMS OTP verification, vintage 2FA Telegram accounts, and automated social panel growth.
              </p>

              <div className="flex flex-col gap-1.5 text-xs">
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
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3 font-mono">
                Products &amp; Servers
              </h4>
              <ul className="space-y-2 text-xs text-[#a1a1aa]">
                <li>
                  <a href="#servers" className="hover:text-white transition-colors">Server 1: LZT Market Accounts</a>
                </li>
                <li>
                  <a href="#servers" className="hover:text-white transition-colors">Server 2: Vintage Telegram Sessions</a>
                </li>
                <li>
                  <a href="#servers" className="hover:text-white transition-colors">Servers 3 &amp; 4: Virtual SMS OTPs</a>
                </li>
                <li>
                  <a href="#servers" className="hover:text-white transition-colors">Server 5: Social Media SMM Panel</a>
                </li>
                <li>
                  <a href="#rates" className="hover:text-white transition-colors">Live Rate Explorer</a>
                </li>
              </ul>
            </div>

            {/* Column 3: Trust & Policies (Span 2) */}
            <div className="lg:col-span-2 flex flex-col">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3 font-mono">
                Trust &amp; Security
              </h4>
              <ul className="space-y-2 text-xs text-[#a1a1aa]">
                <li className="flex items-center gap-1.5 text-[#22c55e]">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <a href="#how-it-works" className="hover:underline">100% Auto-Refund</a>
                </li>
                <li>
                  <a href="#servers" className="hover:text-white transition-colors">2FA Protection</a>
                </li>
                <li>
                  <a href="#servers" className="hover:text-white transition-colors">Zero-Log Retention</a>
                </li>
                <li>
                  <a href="#faq" className="hover:text-white transition-colors">Terms of Service</a>
                </li>
                <li>
                  <a href="#faq" className="hover:text-white transition-colors">Fair Use Guidelines</a>
                </li>
              </ul>
            </div>

            {/* Column 4: Channels & Support (Span 3) */}
            <div className="lg:col-span-3 flex flex-col">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3 font-mono">
                Channels &amp; Support
              </h4>
              <ul className="space-y-2 text-xs text-[#a1a1aa]">
                <li>
                  <a
                    href="https://t.me/DeamonOTPbot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[#38bdf8] hover:text-white transition-colors font-semibold"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Official Bot: @DeamonOTPbot</span>
                    <ExternalLink className="w-3 h-3 text-[#38bdf8]" />
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
                    <ExternalLink className="w-3 h-3 text-[#71717a]" />
                  </a>
                </li>
                <li>
                  <a
                    href="https://t.me/DeamonOTPbot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
                  >
                    <span>Community Updates Channel</span>
                    <ExternalLink className="w-3 h-3 text-[#71717a]" />
                  </a>
                </li>
                <li>
                  <a
                    href="https://t.me/DeamonOTPbot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
                  >
                    <span>Dual Platform Synchronization</span>
                    <ExternalLink className="w-3 h-3 text-[#71717a]" />
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Copyright Line */}
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#71717a]">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#d4d4d8]">Deamon OTP Store</span>
              <span>• © 2026 All Rights Reserved</span>
            </div>

            <div className="flex items-center gap-4 text-[11px]">
              <span>Dual-Platform Architecture (Web &amp; Telegram)</span>
              <span>•</span>
              <a
                href="https://t.me/DeamonOTPbot"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                Launch @DeamonOTPbot
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
