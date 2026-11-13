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
  Plus,
  Minus,
  RotateCcw,
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
    <div
      className={`w-full min-h-screen flex flex-col font-sans transition-colors duration-200 selection:bg-[#7c3aed] selection:text-white ${
        isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#090a0f] text-white'
      }`}
    >
      {/* Subtle Structural Top Grid Accent */}
      <div
        className={`absolute top-0 left-0 right-0 h-96 pointer-events-none z-0 ${
          isLight
            ? 'bg-[radial-gradient(ellipse_80%_40%_at_50%_-20%,rgba(124,58,237,0.08),transparent)]'
            : 'bg-[radial-gradient(ellipse_80%_40%_at_50%_-20%,rgba(124,58,237,0.12),transparent)]'
        }`}
      />

      {/* Top Header Navigation */}
      <header
        className={`sticky top-0 z-50 w-full backdrop-blur-xl border-b transition-colors duration-200 landing-header ${
          isLight
            ? 'bg-white/90 border-slate-200'
            : 'bg-[#090a0f]/90 border-[#1f202b]'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <img
              src={LOGO_URL}
              alt="Deamon OTP Logo"
              className="w-8 h-8 object-contain shrink-0"
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.src.endsWith('deamon-logo.webp')) {
                  target.src = './deamon-logo.webp';
                }
              }}
            />
            <div className="flex flex-col">
              <span
                className={`font-black text-base sm:text-lg tracking-tight ${
                  isLight ? 'text-slate-900' : 'text-white'
                }`}
              >
                Deamon OTP
              </span>
              <span
                className={`hidden sm:block text-[11px] font-medium ${
                  isLight ? 'text-slate-500' : 'text-[#71717a]'
                }`}
              >
                Virtual Numbers &amp; Telegram Sessions
              </span>
            </div>
          </div>

          {/* Direct Nav Anchor Links */}
          <nav
            className={`hidden md:flex items-center gap-7 text-xs font-semibold ${
              isLight ? 'text-slate-600' : 'text-[#94a3b8]'
            }`}
          >
            <a
              href="#rates"
              className={`transition-colors ${
                isLight ? 'hover:text-slate-900' : 'hover:text-white'
              }`}
            >
              Live Rates &amp; Stock
            </a>
            <a
              href="#servers"
              className={`transition-colors ${
                isLight ? 'hover:text-slate-900' : 'hover:text-white'
              }`}
            >
              Server Architecture
            </a>
            <a
              href="#how-it-works"
              className={`transition-colors ${
                isLight ? 'hover:text-slate-900' : 'hover:text-white'
              }`}
            >
              Order Flow
            </a>
            <a
              href="#faq"
              className={`transition-colors ${
                isLight ? 'hover:text-slate-900' : 'hover:text-white'
              }`}
            >
              FAQ
            </a>
          </nav>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-3">
            {/* Theme Switcher - Apple HIG 44px Touch Target */}
            <button
              type="button"
              onClick={toggleTheme}
              className={`w-11 h-11 flex items-center justify-center rounded-xl border transition-all cursor-pointer ${
                isLight
                  ? 'bg-white hover:bg-slate-100 border-slate-300 shadow-sm text-[#7c3aed]'
                  : 'bg-[#14151c] hover:bg-[#1a1b24] border-[#22232e] text-[#f59e0b]'
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
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6366f1] hover:from-[#6d28d9] hover:to-[#4f46e5] text-xs font-bold text-white shadow-md shadow-[#7c3aed]/25 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
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
        <section
          className={`relative pt-12 pb-16 sm:pt-20 sm:pb-24 border-b ${
            isLight ? 'border-slate-200' : 'border-[#1b1c24]'
          }`}
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-start">
              {/* Left Column: Clear Value Proposition */}
              <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left">
                <h1
                  className={`text-3xl sm:text-5xl font-black tracking-tight leading-[1.12] ${
                    isLight ? 'text-slate-900' : 'text-white'
                  }`}
                >
                  Virtual Numbers &amp;{' '}
                  <span
                    className={
                      isLight ? 'text-[#0284c7]' : 'text-[#38bdf8]'
                    }
                  >
                    Telegram Session Marketplace
                  </span>
                </h1>

                <p
                  className={`mt-5 text-sm sm:text-base leading-relaxed max-w-xl ${
                    isLight ? 'text-slate-600' : 'text-[#94a3b8]'
                  }`}
                >
                  Receive instant SMS verification codes for 500+ apps across 50+ countries. Download aged
                  2FA-secured Telegram accounts (.session &amp; TData) on demand. Instant UPI and Crypto balance with 100% automated refunds.
                </p>

                {/* Direct Action Buttons - 44px min-height touch targets */}
                <div className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-3">
                  <a
                    href="#rates"
                    className={`min-h-[44px] px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 transition-all ${
                      isLight
                        ? 'bg-slate-900 hover:bg-slate-800 text-white border border-slate-900'
                        : 'bg-[#1f202b] hover:bg-[#282a38] border border-[#2c2d3d] text-white'
                    }`}
                  >
                    <Search className="w-4 h-4 text-[#38bdf8]" />
                    <span>Explore Live Rates &amp; Stock</span>
                  </a>
                  <a
                    href="https://t.me/DeamonOTPbot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`min-h-[44px] px-5 py-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all ${
                      isLight
                        ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700 hover:text-slate-900'
                        : 'bg-[#14151c] hover:bg-[#1a1b24] border-[#22232e] text-[#a1a1aa] hover:text-white'
                    }`}
                  >
                    <Smartphone className="w-4 h-4 text-[#38bdf8]" />
                    <span>Open in Telegram (@DeamonOTPbot)</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                </div>

                {/* Engineering Benchmarks (Zero Fluff, Real Facts) */}
                <div
                  className={`grid grid-cols-2 sm:grid-cols-4 gap-4 mt-10 pt-8 border-t w-full ${
                    isLight ? 'border-slate-200' : 'border-[#1b1c24]'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className={`text-xl sm:text-2xl font-black font-mono ${isLight ? 'text-emerald-600' : 'text-[#22c55e]'}`}>
                      &lt; 4s
                    </span>
                    <span className={`text-[11px] font-medium mt-0.5 ${isLight ? 'text-slate-500' : 'text-[#71717a]'}`}>
                      Average SMS Arrival
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-xl sm:text-2xl font-black font-mono ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      500+
                    </span>
                    <span className={`text-[11px] font-medium mt-0.5 ${isLight ? 'text-slate-500' : 'text-[#71717a]'}`}>
                      Supported Services
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-xl sm:text-2xl font-black font-mono ${isLight ? 'text-[#0284c7]' : 'text-[#38bdf8]'}`}>
                      100%
                    </span>
                    <span className={`text-[11px] font-medium mt-0.5 ${isLight ? 'text-slate-500' : 'text-[#71717a]'}`}>
                      Automated Refunds
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-xl sm:text-2xl font-black font-mono ${isLight ? 'text-[#7c3aed]' : 'text-[#a78bfa]'}`}>
                      2FA
                    </span>
                    <span className={`text-[11px] font-medium mt-0.5 ${isLight ? 'text-slate-500' : 'text-[#71717a]'}`}>
                      TData &amp; .session Included
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Google Sign-In Card */}
              <div className="lg:col-span-5 flex justify-center lg:justify-end w-full" id="auth-box">
                <div
                  className={`w-full max-w-md p-6 sm:p-7 rounded-2xl border shadow-xl relative overflow-hidden transition-all duration-200 landing-auth-card ${
                    isLight
                      ? 'bg-white border-slate-200'
                      : 'bg-[#12131a] border-[#22232e]'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-5">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isLight ? 'bg-violet-50 text-[#7c3aed] border border-violet-100' : 'bg-gradient-to-tr from-[#7c3aed] to-[#3b82f6] p-0.5'
                      }`}
                    >
                      {isLight ? (
                        <Lock className="w-5 h-5 text-[#7c3aed]" />
                      ) : (
                        <div className="w-full h-full bg-[#111217] rounded-[10px] flex items-center justify-center landing-logo-inner">
                          <Lock className="w-4 h-4 text-[#a78bfa]" />
                        </div>
                      )}
                    </div>
                    <div>
                      <h2 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        Sign In to Storefront
                      </h2>
                      <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-[#a1a1aa]'}`}>
                        1-click Google authentication
                      </p>
                    </div>
                  </div>

                  {errorMessage && (
                    <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 dark:text-red-400 text-xs flex items-start gap-2">
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
                            ? isLight
                              ? 'bg-slate-100 border-[#7c3aed]/60 cursor-wait'
                              : 'bg-[#181824] border-[#7c3aed]/60 cursor-wait'
                            : isLight
                            ? 'bg-white hover:bg-slate-50 border-slate-300 hover:border-[#7c3aed] shadow-sm cursor-pointer active:scale-[0.98]'
                            : 'bg-[#181922] hover:bg-[#20212d] border-[#2a2b38] hover:border-[#7c3aed]/60 shadow-sm cursor-pointer active:scale-[0.98]'
                        }`}
                      >
                        {isLoading ? (
                          <div className="flex items-center gap-2.5">
                            <div className="w-4 h-4 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin" />
                            <span className={`text-xs font-semibold ${isLight ? 'text-[#7c3aed]' : 'text-[#c4b5fd]'}`}>
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
                            <span className={`text-sm font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
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

                    <p className={`text-[11px] text-center mt-3 ${isLight ? 'text-slate-500' : 'text-[#71717a]'}`}>
                      Instant wallet allocation in Indian Rupees (₹) &amp; USDT ($)
                    </p>
                  </div>

                  {/* Security Points */}
                  <div
                    className={`mt-5 pt-4 border-t space-y-2 ${
                      isLight ? 'border-slate-200' : 'border-[#1b1c24]'
                    }`}
                  >
                    <div className={`flex items-center gap-2 text-xs ${isLight ? 'text-slate-600' : 'text-[#a1a1aa]'}`}>
                      <ShieldCheck className={`w-3.5 h-3.5 shrink-0 ${isLight ? 'text-emerald-600' : 'text-[#22c55e]'}`} />
                      <span>Zero setup fee • Automatic refunds if code doesn&apos;t arrive</span>
                    </div>
                    <div className={`flex items-center gap-2 text-xs ${isLight ? 'text-slate-600' : 'text-[#a1a1aa]'}`}>
                      <CreditCard className={`w-3.5 h-3.5 shrink-0 ${isLight ? 'text-[#0284c7]' : 'text-[#38bdf8]'}`} />
                      <span>Instant deposit via UPI (GPay/PhonePe/Paytm) &amp; USDT</span>
                    </div>
                    <div className={`flex items-center gap-2 text-xs ${isLight ? 'text-slate-600' : 'text-[#a1a1aa]'}`}>
                      <Radio className={`w-3.5 h-3.5 shrink-0 ${isLight ? 'text-[#7c3aed]' : 'text-[#a78bfa]'}`} />
                      <span>Synced in real-time with @DeamonOTPbot</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ACCEPTED DEPOSIT GATEWAYS STRIP */}
        <section
          className={`py-5 border-b transition-colors duration-200 ${
            isLight
              ? 'bg-slate-100/70 border-slate-200'
              : 'bg-[#0c0d12] border-[#1b1c24]'
          }`}
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
              <div
                className={`flex items-center gap-2 ${
                  isLight ? 'text-slate-600' : 'text-[#71717a]'
                }`}
              >
                <CreditCard className={`w-4 h-4 ${isLight ? 'text-emerald-600' : 'text-[#22c55e]'}`} />
                <span className={`font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Accepted Deposit Methods:
                </span>
                <span className="hidden sm:inline">Zero processing fee • Instant automated balance crediting</span>
              </div>

              {/* Badges with Real Brand Icons */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                {/* Google Pay */}
                <span
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-2 transition-all ${
                    isLight
                      ? 'bg-white border-slate-200 text-slate-800 shadow-sm'
                      : 'bg-[#14151c] border-[#22232e] text-[#d4d4d8]'
                  }`}
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                  </svg>
                  <span>Google Pay</span>
                </span>

                {/* PhonePe */}
                <span
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-2 transition-all ${
                    isLight
                      ? 'bg-white border-slate-200 text-slate-800 shadow-sm'
                      : 'bg-[#14151c] border-[#22232e] text-[#d4d4d8]'
                  }`}
                >
                  <svg className="w-4 h-4 shrink-0 rounded-full" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="12" fill="#5F259F"/>
                    <path d="M16.5 7.5h-3.4c-.3 0-.6.2-.7.5l-.2.8h4.2c.3 0 .6.3.6.6s-.3.6-.6.6h-4.5l-.8 3.5c-.1.5.3.9.7.9h2.7c.3 0 .6.3.6.6s-.3.6-.6.6h-2.9c-1.2 0-2.2-.9-2.5-2.1L9 9.3H7c-.3 0-.6-.3-.6-.6s.3-.6.6-.6h2.4l.3-1.1c.3-1.2 1.3-2.1 2.5-2.1h4.3c.3 0 .6.3.6.6s-.3.6-.6.6z" fill="#ffffff"/>
                    <path d="M13.2 14.5L10 19.5c-.3.4-.8.5-1.2.2-.4-.3-.5-.8-.2-1.2l3.4-4.8c.2.3.5.6.8.8h.4z" fill="#ffffff"/>
                  </svg>
                  <span>PhonePe</span>
                </span>

                {/* Paytm / BHIM UPI */}
                <span
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-2 transition-all ${
                    isLight
                      ? 'bg-white border-slate-200 text-slate-800 shadow-sm'
                      : 'bg-[#14151c] border-[#22232e] text-[#d4d4d8]'
                  }`}
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
                    <path d="M13.5 3L6 21H10.5L18 3H13.5Z" fill="#097939"/>
                    <path d="M18 3L10.5 21H15L22.5 3H18Z" fill="#ED7524"/>
                  </svg>
                  <span>Paytm / BHIM UPI</span>
                </span>

                {/* USDT (Tether) */}
                <span
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-2 transition-all ${
                    isLight
                      ? 'bg-white border-slate-200 text-slate-800 shadow-sm'
                      : 'bg-[#14151c] border-[#22232e] text-[#d4d4d8]'
                  }`}
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="12" fill="#26A17B"/>
                    <path d="M12.9 11.2c-.1 0-.6 0-1 0-.3 0-.8 0-1 0-2.3-.1-4-.6-4-1.2 0-.6 1.7-1.1 4-1.2.2 0 .7 0 1 0 .4 0 .9 0 1 0 2.3.1 4 .6 4 1.2 0 .6-1.7 1.1-4 1.2zm0-3V6.5h3.6V4.7H7.5v1.8h3.6v1.7c-2.8.1-4.9.8-4.9 1.7 0 .9 2.1 1.6 4.9 1.7v5.3h1.8v-5.3c2.8-.1 4.9-.8 4.9-1.7 0-.9-2.1-1.6-4.9-1.7zm0 4.1v-.1c1.9-.1 3.5-.5 3.9-.9v2.2c-.9.5-2.3.8-3.9.9v-2.1zm-1.8 0v2.1c-1.6-.1-3-.4-3.9-.9v-2.2c.4.4 2 .8 3.9.9v.1z" fill="#ffffff"/>
                  </svg>
                  <span>USDT (TRC-20 &amp; BEP-20)</span>
                </span>

                {/* FamPay Direct */}
                <span
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-2 transition-all ${
                    isLight
                      ? 'bg-white border-slate-200 text-slate-800 shadow-sm'
                      : 'bg-[#14151c] border-[#22232e] text-[#d4d4d8]'
                  }`}
                >
                  <svg className="w-4 h-4 shrink-0 rounded-[4px]" viewBox="0 0 24 24" fill="none">
                    <rect width="24" height="24" rx="4" fill="#FFA000"/>
                    <path d="M14.8 21.5a.2.2 0 0 1-.2 0c-.6-.4-3.9-2.6-6.1-5.3-1.3-1.7 3.8-4.2 3.8-3.8 0 1.8.5 6.5 2.6 8.7.1.2 0 .3 0 .4l-.1 0zm-1.3-10.9l4.7-2.1a4.4 4.4 0 0 0 2.5-2.6l.6-1.6a.2.2 0 0 0-.1-.2l-1.7-.5a4.4 4.4 0 0 0-3 .1l-7.4 3.1a4.4 4.4 0 0 0-2.4 2.2l-.9 1.8a.2.2 0 0 0 .2.2h1.8a4.4 4.4 0 0 0 3.3-1.5z" fill="#111217"/>
                  </svg>
                  <span>FamPay Direct</span>
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* INTERACTIVE LIVE SERVICE & RATE TERMINAL */}
        <section
          id="rates"
          className={`py-16 sm:py-20 border-b ${
            isLight ? 'border-slate-200' : 'border-[#1b1c24]'
          }`}
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
              <div>
                <span
                  className={`text-xs font-bold uppercase tracking-wider font-mono ${
                    isLight ? 'text-[#0284c7]' : 'text-[#38bdf8]'
                  }`}
                >
                  Live Terminal
                </span>
                <h2
                  className={`text-2xl sm:text-3xl font-black mt-1 ${
                    isLight ? 'text-slate-900' : 'text-white'
                  }`}
                >
                  Service Rates &amp; Stock Availability
                </h2>
                <p className={`text-xs sm:text-sm mt-1 ${isLight ? 'text-slate-600' : 'text-[#a1a1aa]'}`}>
                  Search live starting prices, carriers, and delivery formats before signing in.
                </p>
              </div>

              {/* Category Filter Chips - 40px height touch targets */}
              <div
                className={`flex flex-wrap items-center gap-1.5 p-1 rounded-xl border self-start sm:self-auto ${
                  isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#12131a] border-[#22232e]'
                }`}
                role="tablist"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedCategory === 'all'}
                  onClick={() => setSelectedCategory('all')}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                    selectedCategory === 'all'
                      ? 'bg-[#7c3aed] text-white shadow-sm font-bold'
                      : isLight
                      ? 'text-slate-600 hover:text-slate-900 font-semibold'
                      : 'text-[#a1a1aa] hover:text-white font-semibold'
                  }`}
                >
                  All ({serviceCatalog.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedCategory === 'otp'}
                  onClick={() => setSelectedCategory('otp')}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                    selectedCategory === 'otp'
                      ? 'bg-[#7c3aed] text-white shadow-sm font-bold'
                      : isLight
                      ? 'text-slate-600 hover:text-slate-900 font-semibold'
                      : 'text-[#a1a1aa] hover:text-white font-semibold'
                  }`}
                >
                  SMS OTPs
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedCategory === 'session'}
                  onClick={() => setSelectedCategory('session')}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                    selectedCategory === 'session'
                      ? 'bg-[#7c3aed] text-white shadow-sm font-bold'
                      : isLight
                      ? 'text-slate-600 hover:text-slate-900 font-semibold'
                      : 'text-[#a1a1aa] hover:text-white font-semibold'
                  }`}
                >
                  Telegram Sessions
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedCategory === 'smm'}
                  onClick={() => setSelectedCategory('smm')}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                    selectedCategory === 'smm'
                      ? 'bg-[#7c3aed] text-white shadow-sm font-bold'
                      : isLight
                      ? 'text-slate-600 hover:text-slate-900 font-semibold'
                      : 'text-[#a1a1aa] hover:text-white font-semibold'
                  }`}
                >
                  SMM Boost
                </button>
              </div>
            </div>

            {/* Interactive Search Bar & Country Filter - 44px Height Align */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-6">
              <div className="sm:col-span-8 relative">
                <Search
                  className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                    isLight ? 'text-slate-400' : 'text-[#71717a]'
                  }`}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search app (WhatsApp, Telegram, OpenAI...) or country (India, USA, UK...)"
                  className={`w-full h-11 pl-10 pr-4 rounded-xl border text-xs focus:outline-none focus:border-[#7c3aed] transition-colors ${
                    isLight
                      ? 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 shadow-sm'
                      : 'bg-[#12131a] border-[#22232e] text-white placeholder:text-[#71717a]'
                  }`}
                />
              </div>

              <div className="sm:col-span-4">
                <select
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  className={`w-full h-11 px-3.5 rounded-xl border text-xs focus:outline-none focus:border-[#7c3aed] cursor-pointer ${
                    isLight
                      ? 'bg-white border-slate-200 text-slate-900 shadow-sm'
                      : 'bg-[#12131a] border-[#22232e] text-white'
                  }`}
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
                  className={`p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                    selectedServiceId === service.id
                      ? isLight
                        ? 'bg-white border-[#7c3aed] shadow-md ring-2 ring-[#7c3aed]/20'
                        : 'bg-[#151622] border-[#7c3aed] shadow-md shadow-[#7c3aed]/10'
                      : isLight
                      ? 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                      : 'bg-[#12131a] border-[#20212c] hover:border-[#2e3040]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span
                        className={`text-xs font-medium flex items-center gap-1.5 ${
                          isLight ? 'text-slate-500' : 'text-[#a1a1aa]'
                        }`}
                      >
                        <span>{service.flag}</span>
                        <span>{service.country}</span>
                      </span>
                      <span
                        className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md border ${
                          isLight
                            ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                            : 'text-[#22c55e] bg-emerald-500/10 border-emerald-500/20'
                        }`}
                      >
                        {service.successRate}
                      </span>
                    </div>

                    <h3 className={`text-sm font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      {service.name}
                    </h3>
                    <p className={`text-xs mt-1.5 leading-relaxed ${isLight ? 'text-slate-600' : 'text-[#71717a]'}`}>
                      {service.description}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-mono">
                      <span
                        className={`px-2 py-0.5 rounded border ${
                          isLight
                            ? 'bg-slate-100 border-slate-200 text-slate-700 font-medium'
                            : 'bg-[#181924] border-[#262736] text-[#94a3b8]'
                        }`}
                      >
                        {service.format}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded border font-semibold ${
                          isLight
                            ? 'bg-sky-50 border-sky-200 text-sky-700'
                            : 'bg-sky-500/10 border-sky-500/20 text-[#38bdf8]'
                        }`}
                      >
                        {service.speed}
                      </span>
                    </div>
                  </div>

                  <div
                    className={`mt-4 pt-3.5 border-t flex items-center justify-between ${
                      isLight ? 'border-slate-100' : 'border-[#1b1c24]'
                    }`}
                  >
                    <div>
                      <span className={`text-[10px] block ${isLight ? 'text-slate-500' : 'text-[#71717a]'}`}>
                        Starting from
                      </span>
                      <span
                        className={`text-sm font-black font-mono ${
                          isLight ? 'text-emerald-600' : 'text-[#22c55e]'
                        }`}
                      >
                        ₹{service.priceInr}{' '}
                        <span className={`text-xs font-normal ${isLight ? 'text-slate-500' : 'text-[#71717a]'}`}>
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
                      className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1 ${
                        isLight
                          ? 'bg-slate-100 hover:bg-[#7c3aed] text-slate-800 hover:text-white border-slate-200 shadow-sm'
                          : 'bg-[#1c1d29] hover:bg-[#7c3aed] hover:text-white text-[#d4d4d8] border-[#2a2b3a]'
                      }`}
                    >
                      <span>Get Number</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Killer UI Empty State (Crime 7 Remediation) */}
            {filteredServices.length === 0 && (
              <div
                className={`py-12 px-6 rounded-2xl border text-center flex flex-col items-center justify-center ${
                  isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#12131a] border-[#20212c]'
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${
                    isLight ? 'bg-slate-100 text-slate-500' : 'bg-[#181924] text-[#71717a]'
                  }`}
                >
                  <Search className="w-6 h-6" />
                </div>
                <h4 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  No matching services found
                </h4>
                <p className={`text-xs mt-1.5 max-w-md ${isLight ? 'text-slate-600' : 'text-[#71717a]'}`}>
                  No carrier pools or accounts match &quot;{searchQuery}&quot; in the selected filter. Try adjusting your query or resetting all filters.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                    setSelectedCountry('all');
                  }}
                  className="mt-4 px-4 py-2 rounded-xl text-xs font-bold bg-[#7c3aed] text-white hover:bg-[#6d28d9] transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset All Filters</span>
                </button>
              </div>
            )}

            {/* Interactive Rate Estimator Bar with Quantity Stepper */}
            <div
              className={`mt-8 p-5 sm:p-6 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-5 transition-all ${
                isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#12131a] border-[#22232e]'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${
                    isLight
                      ? 'bg-sky-50 border-sky-200 text-sky-700'
                      : 'bg-[#1c1d29] border-[#282a3a] text-[#38bdf8]'
                  }`}
                >
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h4 className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    Quick Rate Calculator
                  </h4>
                  <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-600' : 'text-[#a1a1aa]'}`}>
                    Selected:{' '}
                    <span className={`font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      {activeSelectedService.name}
                    </span>{' '}
                    ({activeSelectedService.country})
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                {/* Stepper Controls */}
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-[#71717a]'}`}>Qty:</span>
                  <div
                    className={`flex items-center rounded-xl border p-0.5 ${
                      isLight ? 'bg-slate-50 border-slate-300' : 'bg-[#181924] border-[#2a2b3a]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setCalcQuantity((prev) => Math.max(1, prev - 1))}
                      className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                        isLight ? 'hover:bg-slate-200 text-slate-700' : 'hover:bg-[#252636] text-[#a1a1aa]'
                      }`}
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={calcQuantity}
                      onChange={(e) => setCalcQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className={`w-12 py-1 text-xs font-mono font-bold text-center bg-transparent focus:outline-none ${
                        isLight ? 'text-slate-900' : 'text-white'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setCalcQuantity((prev) => Math.min(100, prev + 1))}
                      className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                        isLight ? 'hover:bg-slate-200 text-slate-700' : 'hover:bg-[#252636] text-[#a1a1aa]'
                      }`}
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`text-[10px] block ${isLight ? 'text-slate-500' : 'text-[#71717a]'}`}>
                    Estimated Total
                  </span>
                  <span
                    className={`text-base sm:text-lg font-black font-mono ${
                      isLight ? 'text-emerald-600' : 'text-[#22c55e]'
                    }`}
                  >
                    ₹{activeSelectedService.priceInr * calcQuantity}{' '}
                    <span className={`text-xs font-normal ${isLight ? 'text-slate-500' : 'text-[#71717a]'}`}>
                      (${(activeSelectedService.priceUsdt * calcQuantity).toFixed(2)})
                    </span>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={triggerGooglePrompt}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-xs font-bold text-white transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  Sign In to Purchase
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 4-SERVER INFRASTRUCTURE (THE ACTUAL BACKEND PIPELINES) */}
        <section
          id="servers"
          className={`py-16 sm:py-20 border-b transition-colors duration-200 ${
            isLight
              ? 'bg-slate-100/70 border-slate-200'
              : 'bg-[#0c0d12] border-[#1b1c24]'
          }`}
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="text-xs font-bold text-[#7c3aed] uppercase tracking-wider font-mono">
                System Infrastructure
              </span>
              <h2 className={`text-2xl sm:text-3xl font-black mt-1 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                4 Specialized Service Pipelines
              </h2>
              <p className={`text-xs sm:text-sm mt-1.5 ${isLight ? 'text-slate-600' : 'text-[#a1a1aa]'}`}>
                Every server is built for a dedicated use case: verified aged sessions, live carrier OTPs, and community scaling.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Server 1: LZT Market Imported Accounts */}
              <div
                className={`p-6 rounded-2xl border flex flex-col justify-between transition-all ${
                  isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#12131a] border-[#22232e]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                        isLight
                          ? 'bg-sky-50 border border-sky-200 text-sky-700'
                          : 'bg-sky-500/10 border border-sky-500/20 text-[#38bdf8]'
                      }`}
                    >
                      <Server className="w-5 h-5" />
                    </div>
                    <span
                      className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full border ${
                        isLight
                          ? 'text-sky-700 bg-sky-50 border-sky-200'
                          : 'text-[#38bdf8] bg-sky-500/10 border-sky-500/20'
                      }`}
                    >
                      Server 1
                    </span>
                  </div>
                  <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    LZT Market Imported Accounts
                  </h3>
                  <p className={`text-xs mt-2 leading-relaxed ${isLight ? 'text-slate-600' : 'text-[#a1a1aa]'}`}>
                    Automated access to verified international Telegram accounts imported with active 2FA credentials. Pre-checked for session health and covered by replacement warranties.
                  </p>
                </div>

                <div
                  className={`mt-6 pt-4 border-t flex items-center justify-between text-xs ${
                    isLight ? 'border-slate-100 text-slate-500' : 'border-[#1b1c24] text-[#71717a]'
                  }`}
                >
                  <span>Instant Credential Delivery</span>
                  <span className={`font-mono font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                    24h Replacement Guard
                  </span>
                </div>
              </div>

              {/* Server 2: Fresh & Vintage Telegram Sessions */}
              <div
                className={`p-6 rounded-2xl border flex flex-col justify-between transition-all ${
                  isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#12131a] border-[#22232e]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                        isLight
                          ? 'bg-purple-50 border border-purple-200 text-purple-700'
                          : 'bg-purple-500/10 border border-purple-500/20 text-[#a78bfa]'
                      }`}
                    >
                      <Download className="w-5 h-5" />
                    </div>
                    <span
                      className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full border ${
                        isLight
                          ? 'text-purple-700 bg-purple-50 border-purple-200'
                          : 'text-[#a78bfa] bg-purple-500/10 border-purple-500/20'
                      }`}
                    >
                      Server 2
                    </span>
                  </div>
                  <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    Vintage Telegram Sessions (2021–2025)
                  </h3>
                  <p className={`text-xs mt-2 leading-relaxed ${isLight ? 'text-slate-600' : 'text-[#a1a1aa]'}`}>
                    Aged and virgin accounts with clean registration history. Every purchase provides both instant .session files (for Python scripts) and complete TData folders with 2FA passwords.
                  </p>
                </div>

                <div
                  className={`mt-6 pt-4 border-t flex items-center justify-between text-xs ${
                    isLight ? 'border-slate-100 text-slate-500' : 'border-[#1b1c24] text-[#71717a]'
                  }`}
                >
                  <span>.session + TData ZIP</span>
                  <span className={`font-mono font-semibold ${isLight ? 'text-emerald-700' : 'text-[#22c55e]'}`}>
                    100% Tested Valid
                  </span>
                </div>
              </div>

              {/* Server 3 & 4: Virtual SMS OTP Pools */}
              <div
                className={`p-6 rounded-2xl border flex flex-col justify-between transition-all ${
                  isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#12131a] border-[#22232e]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                        isLight
                          ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                          : 'bg-emerald-500/10 border border-emerald-500/20 text-[#22c55e]'
                      }`}
                    >
                      <RefreshCw className="w-5 h-5" />
                    </div>
                    <span
                      className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full border ${
                        isLight
                          ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                          : 'text-[#22c55e] bg-emerald-500/10 border-emerald-500/20'
                      }`}
                    >
                      Servers 3 &amp; 4
                    </span>
                  </div>
                  <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    Live Carrier Virtual SMS OTP Pools
                  </h3>
                  <p className={`text-xs mt-2 leading-relaxed ${isLight ? 'text-slate-600' : 'text-[#a1a1aa]'}`}>
                    High-throughput private carrier lines for 500+ apps. Includes a 20-minute active timer. If an SMS code is not received, the order is cancelled with a 100% automated refund to your wallet.
                  </p>
                </div>

                <div
                  className={`mt-6 pt-4 border-t flex items-center justify-between text-xs ${
                    isLight ? 'border-slate-100 text-slate-500' : 'border-[#1b1c24] text-[#71717a]'
                  }`}
                >
                  <span>20-Min Active Countdown</span>
                  <span className={`font-mono font-semibold ${isLight ? 'text-emerald-700' : 'text-[#22c55e]'}`}>
                    Automatic Refund Guard
                  </span>
                </div>
              </div>

              {/* Server 5: Social Media SMM Panel */}
              <div
                className={`p-6 rounded-2xl border flex flex-col justify-between transition-all ${
                  isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#12131a] border-[#22232e]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                        isLight
                          ? 'bg-amber-50 border border-amber-200 text-amber-700'
                          : 'bg-amber-500/10 border border-amber-500/20 text-[#f59e0b]'
                      }`}
                    >
                      <Zap className="w-5 h-5" />
                    </div>
                    <span
                      className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full border ${
                        isLight
                          ? 'text-amber-700 bg-amber-50 border-amber-200'
                          : 'text-[#f59e0b] bg-amber-500/10 border-amber-500/20'
                      }`}
                    >
                      Server 5
                    </span>
                  </div>
                  <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    SMM Social Growth Panel
                  </h3>
                  <p className={`text-xs mt-2 leading-relaxed ${isLight ? 'text-slate-600' : 'text-[#a1a1aa]'}`}>
                    Automated delivery of high-retention Telegram channel members, real post views, and custom emoji reactions. Scaled for creators and community managers with drop protection.
                  </p>
                </div>

                <div
                  className={`mt-6 pt-4 border-t flex items-center justify-between text-xs ${
                    isLight ? 'border-slate-100 text-slate-500' : 'border-[#1b1c24] text-[#71717a]'
                  }`}
                >
                  <span>30-Day Refill Guarantee</span>
                  <span className={`font-mono font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                    Instant Execution
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ORDER LIFECYCLE FLOW */}
        <section
          id="how-it-works"
          className={`py-16 sm:py-20 border-b ${
            isLight ? 'border-slate-200' : 'border-[#1b1c24]'
          }`}
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span
                className={`text-xs font-bold uppercase tracking-wider font-mono ${
                  isLight ? 'text-emerald-700' : 'text-[#22c55e]'
                }`}
              >
                Order Execution
              </span>
              <h2 className={`text-2xl sm:text-3xl font-black mt-1 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                How an Order Works in Practice
              </h2>
              <p className={`text-xs sm:text-sm mt-1.5 ${isLight ? 'text-slate-600' : 'text-[#a1a1aa]'}`}>
                Transparent step-by-step lifecycle from wallet deposit to SMS code delivery.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div
                className={`p-5 rounded-2xl border transition-all ${
                  isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#12131a] border-[#22232e]'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-[#7c3aed] text-white font-black text-xs flex items-center justify-center mb-3 landing-step-num shadow-sm">
                  1
                </div>
                <h3 className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Sign In &amp; Top Up
                </h3>
                <p className={`text-xs mt-1.5 leading-relaxed ${isLight ? 'text-slate-600' : 'text-[#a1a1aa]'}`}>
                  Authenticate with Google in 2 seconds. Scan an instant UPI QR code or transfer USDT; balance reflects automatically.
                </p>
              </div>

              <div
                className={`p-5 rounded-2xl border transition-all ${
                  isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#12131a] border-[#22232e]'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-[#38bdf8] text-white font-black text-xs flex items-center justify-center mb-3 landing-step-num shadow-sm">
                  2
                </div>
                <h3 className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Select App &amp; Country
                </h3>
                <p className={`text-xs mt-1.5 leading-relaxed ${isLight ? 'text-slate-600' : 'text-[#a1a1aa]'}`}>
                  Choose your service. A dedicated virtual carrier line is allocated immediately with an active 20:00 countdown timer.
                </p>
              </div>

              <div
                className={`p-5 rounded-2xl border transition-all ${
                  isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#12131a] border-[#22232e]'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-[#22c55e] text-white font-black text-xs flex items-center justify-center mb-3 landing-step-num shadow-sm">
                  3
                </div>
                <h3 className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Receive SMS Code
                </h3>
                <p className={`text-xs mt-1.5 leading-relaxed ${isLight ? 'text-slate-600' : 'text-[#a1a1aa]'}`}>
                  The verification code arrives directly on your screen within seconds. Copy it with 1 click to complete activation.
                </p>
              </div>

              <div
                className={`p-5 rounded-2xl border transition-all ${
                  isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#12131a] border-[#22232e]'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-[#f59e0b] text-white font-black text-xs flex items-center justify-center mb-3 landing-step-num shadow-sm">
                  4
                </div>
                <h3 className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Automated Refund Guard
                </h3>
                <p className={`text-xs mt-1.5 leading-relaxed ${isLight ? 'text-slate-600' : 'text-[#a1a1aa]'}`}>
                  If the code is not delivered before the timer runs out, the full amount is refunded automatically to your balance.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ SECTION */}
        <section
          id="faq"
          className={`py-16 sm:py-20 border-b transition-colors duration-200 ${
            isLight
              ? 'bg-slate-100/70 border-slate-200'
              : 'bg-[#0c0d12] border-[#1b1c24]'
          }`}
        >
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="text-xs font-bold text-[#7c3aed] uppercase tracking-wider font-mono">
                Support &amp; Answers
              </span>
              <h2 className={`text-2xl sm:text-3xl font-black mt-1 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Frequently Asked Questions
              </h2>
            </div>

            <div className="space-y-3">
              {faqItems.map((item, idx) => (
                <div
                  key={idx}
                  className={`rounded-2xl border overflow-hidden transition-all ${
                    isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#12131a] border-[#22232e]'
                  }`}
                >
                  <button
                    onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                    aria-expanded={activeFaq === idx}
                    className={`w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 cursor-pointer transition-colors ${
                      isLight ? 'hover:bg-slate-50' : 'hover:bg-[#161722]'
                    }`}
                  >
                    <span
                      className={`text-sm font-bold flex items-center gap-2.5 ${
                        isLight ? 'text-slate-900' : 'text-white'
                      }`}
                    >
                      <HelpCircle className="w-4 h-4 text-[#7c3aed] shrink-0" />
                      <span>{item.q}</span>
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${
                        activeFaq === idx
                          ? 'rotate-180 text-[#7c3aed]'
                          : isLight
                          ? 'text-slate-400'
                          : 'text-[#a1a1aa]'
                      }`}
                    />
                  </button>
                  {activeFaq === idx && (
                    <div
                      className={`px-5 pb-5 text-xs leading-relaxed border-t pt-3 ${
                        isLight ? 'border-slate-100 text-slate-600' : 'border-[#1b1c24] text-[#a1a1aa]'
                      }`}
                    >
                      {item.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* BOTTOM CALL TO ACTION */}
        <section
          className={`py-16 sm:py-20 border-b relative overflow-hidden ${
            isLight ? 'border-slate-200' : 'border-[#1b1c24]'
          }`}
        >
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center relative z-10">
            <img
              src={LOGO_URL}
              alt="Deamon OTP Logo"
              className="w-14 h-14 object-contain mx-auto mb-5 shrink-0"
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.src.endsWith('deamon-logo.webp')) {
                  target.src = './deamon-logo.webp';
                }
              }}
            />

            <h2 className={`text-2xl sm:text-3xl font-black tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Start Receiving OTPs &amp; Downloading Sessions
            </h2>
            <p className={`text-xs sm:text-sm mt-2 max-w-lg mx-auto ${isLight ? 'text-slate-600' : 'text-[#a1a1aa]'}`}>
              Zero setup fees. Immediate access to carrier numbers, aged accounts, and social panel tools.
            </p>

            <div className="mt-7 flex flex-col items-center gap-4">
              <div className="relative w-full max-w-[320px] h-[48px] mx-auto select-none">
                <div
                  className={`landing-google-btn w-full h-full rounded-xl flex items-center justify-center gap-3 px-5 transition-all duration-200 border ${
                    isLoading
                      ? isLight
                        ? 'bg-slate-100 border-[#7c3aed]/60 cursor-wait'
                        : 'bg-[#181824] border-[#7c3aed]/60 cursor-wait'
                      : isLight
                      ? 'bg-white hover:bg-slate-50 border-slate-300 hover:border-[#7c3aed] shadow-sm cursor-pointer active:scale-[0.98]'
                      : 'bg-[#181922] hover:bg-[#20212d] border-[#2a2b38] hover:border-[#7c3aed]/60 shadow-sm cursor-pointer active:scale-[0.98]'
                  }`}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin" />
                      <span className={`text-xs font-semibold ${isLight ? 'text-[#7c3aed]' : 'text-[#c4b5fd]'}`}>
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
                      <span className={`text-sm font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
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
                className={`inline-flex items-center gap-2 text-xs transition-colors ${
                  isLight ? 'text-slate-600 hover:text-slate-900' : 'text-[#a1a1aa] hover:text-white'
                }`}
              >
                <span>Prefer using Telegram directly? Open @DeamonOTPbot</span>
                <ExternalLink className="w-3.5 h-3.5 text-[#38bdf8]" />
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* COMPREHENSIVE 4-COLUMN PROFESSIONAL FOOTER */}
      <footer
        className={`border-t pt-12 pb-8 transition-colors duration-200 ${
          isLight ? 'bg-white border-slate-200' : 'bg-[#07070a] border-[#1b1c24]'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div
            className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 pb-10 border-b ${
              isLight ? 'border-slate-100' : 'border-[#1b1c24]'
            }`}
          >
            {/* Column 1: Brand & Operational Status (Span 4) */}
            <div className="lg:col-span-4 flex flex-col">
              <div className="flex items-center gap-3 mb-3">
                <img
                  src={LOGO_URL}
                  alt="Deamon OTP Logo"
                  className="w-6 h-6 object-contain shrink-0"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.src.endsWith('deamon-logo.webp')) {
                      target.src = './deamon-logo.webp';
                    }
                  }}
                />
                <span className={`font-extrabold text-sm tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Deamon OTP Store
                </span>
              </div>

              <p className={`text-xs leading-relaxed max-w-sm mb-4 ${isLight ? 'text-slate-600' : 'text-[#71717a]'}`}>
                High-throughput carrier infrastructure for virtual SMS OTP verification, vintage 2FA Telegram accounts, and automated social panel growth.
              </p>

              <div className="flex flex-col gap-1.5 text-xs">
                <div
                  className={`inline-flex items-center gap-2 font-mono text-[11px] ${
                    isLight ? 'text-emerald-700' : 'text-[#22c55e]'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
                  <span>All Systems Operational (99.98% Uptime)</span>
                </div>
                <div
                  className={`inline-flex items-center gap-2 text-[11px] ${
                    isLight ? 'text-slate-500' : 'text-[#a1a1aa]'
                  }`}
                >
                  <ShieldCheck className={`w-3.5 h-3.5 ${isLight ? 'text-[#0284c7]' : 'text-[#38bdf8]'}`} />
                  <span>256-Bit SSL Encrypted Transactions</span>
                </div>
              </div>
            </div>

            {/* Column 2: Products & Servers (Span 3) */}
            <div className="lg:col-span-3 flex flex-col">
              <h4
                className={`text-xs font-bold uppercase tracking-wider mb-3 font-mono ${
                  isLight ? 'text-slate-900' : 'text-white'
                }`}
              >
                Products &amp; Servers
              </h4>
              <ul className={`space-y-2 text-xs ${isLight ? 'text-slate-600' : 'text-[#a1a1aa]'}`}>
                <li>
                  <a href="#servers" className={isLight ? 'hover:text-slate-900 transition-colors' : 'hover:text-white transition-colors'}>Server 1: LZT Market Accounts</a>
                </li>
                <li>
                  <a href="#servers" className={isLight ? 'hover:text-slate-900 transition-colors' : 'hover:text-white transition-colors'}>Server 2: Vintage Telegram Sessions</a>
                </li>
                <li>
                  <a href="#servers" className={isLight ? 'hover:text-slate-900 transition-colors' : 'hover:text-white transition-colors'}>Servers 3 &amp; 4: Virtual SMS OTPs</a>
                </li>
                <li>
                  <a href="#servers" className={isLight ? 'hover:text-slate-900 transition-colors' : 'hover:text-white transition-colors'}>Server 5: Social Media SMM Panel</a>
                </li>
                <li>
                  <a href="#rates" className={isLight ? 'hover:text-slate-900 transition-colors' : 'hover:text-white transition-colors'}>Live Rate Explorer</a>
                </li>
              </ul>
            </div>

            {/* Column 3: Trust & Policies (Span 2) */}
            <div className="lg:col-span-2 flex flex-col">
              <h4
                className={`text-xs font-bold uppercase tracking-wider mb-3 font-mono ${
                  isLight ? 'text-slate-900' : 'text-white'
                }`}
              >
                Trust &amp; Security
              </h4>
              <ul className={`space-y-2 text-xs ${isLight ? 'text-slate-600' : 'text-[#a1a1aa]'}`}>
                <li className={`flex items-center gap-1.5 ${isLight ? 'text-emerald-700' : 'text-[#22c55e]'}`}>
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <a href="#how-it-works" className="hover:underline">100% Auto-Refund</a>
                </li>
                <li>
                  <a href="#servers" className={isLight ? 'hover:text-slate-900 transition-colors' : 'hover:text-white transition-colors'}>2FA Protection</a>
                </li>
                <li>
                  <a href="#servers" className={isLight ? 'hover:text-slate-900 transition-colors' : 'hover:text-white transition-colors'}>Zero-Log Retention</a>
                </li>
                <li>
                  <a href="#faq" className={isLight ? 'hover:text-slate-900 transition-colors' : 'hover:text-white transition-colors'}>Terms of Service</a>
                </li>
                <li>
                  <a href="#faq" className={isLight ? 'hover:text-slate-900 transition-colors' : 'hover:text-white transition-colors'}>Fair Use Guidelines</a>
                </li>
              </ul>
            </div>

            {/* Column 4: Telegram Bots & Support (Span 3) */}
            <div className="lg:col-span-3 flex flex-col">
              <h4
                className={`text-xs font-bold uppercase tracking-wider mb-3 font-mono ${
                  isLight ? 'text-slate-900' : 'text-white'
                }`}
              >
                Telegram Bots &amp; Support
              </h4>
              <ul className={`space-y-2 text-xs ${isLight ? 'text-slate-600' : 'text-[#a1a1aa]'}`}>
                <li>
                  <a
                    href="https://t.me/DeamonOTPbot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1.5 font-semibold transition-colors ${
                      isLight ? 'text-[#0284c7] hover:text-slate-900' : 'text-[#38bdf8] hover:text-white'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Official Bot: @DeamonOTPbot</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
                <li>
                  <a
                    href="https://t.me/patelkrish_99bot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1.5 font-medium transition-colors ${
                      isLight ? 'text-emerald-700 hover:text-slate-900' : 'text-[#22c55e] hover:text-white'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Support Bot: @patelkrish_99bot</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
                <li>
                  <a
                    href="https://t.me/DeamonOTPbot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1.5 transition-colors ${
                      isLight ? 'hover:text-slate-900' : 'hover:text-white'
                    }`}
                  >
                    <span>Dual Platform Synchronization</span>
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Copyright Line */}
          <div
            className={`pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs ${
              isLight ? 'text-slate-500' : 'text-[#71717a]'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`font-bold ${isLight ? 'text-slate-800' : 'text-[#d4d4d8]'}`}>
                Deamon OTP Store
              </span>
              <span>• © 2026 All Rights Reserved</span>
            </div>

            <div className="flex items-center gap-4 text-[11px]">
              <span>Dual-Platform Architecture (Web &amp; Telegram)</span>
              <span>•</span>
              <a
                href="https://t.me/DeamonOTPbot"
                target="_blank"
                rel="noopener noreferrer"
                className={`transition-colors ${isLight ? 'hover:text-slate-900' : 'hover:text-white'}`}
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
