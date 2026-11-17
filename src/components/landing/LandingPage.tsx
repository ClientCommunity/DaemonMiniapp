import React, { useEffect, useMemo, useRef, useState } from 'react';
import { authApi, webAuthApi, GoogleAuthResponse } from '../../api/endpoints';
import { setWebUserToken } from '../../api/client';
import { BackendUserPayload } from '../../api/adapters';
import { useApp } from '../../context/AppContext';
import { OtpVerificationModal } from '../auth/OtpVerificationModal';
import { ForgotPasswordModal } from '../auth/ForgotPasswordModal';
import { ResetPasswordModal } from '../auth/ResetPasswordModal';
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
  CheckCircle2,
  Download,
  Search,
  Server,
  Zap,
  ArrowUpRight,
  Cpu,
  Plus,
  Minus,
  RotateCcw,
  Sparkles,
  Mail,
  User,
  Phone,
  Eye,
  EyeOff,
  Send,
  ShoppingBag,
  X,
} from 'lucide-react';

const GOOGLE_CLIENT_ID =
  (import.meta as unknown as { env?: Record<string, string | undefined> })?.env
    ?.VITE_GOOGLE_CLIENT_ID ||
  '844840577527-7qf3v11h62n199csg65dv9s0umbqethh.apps.googleusercontent.com';

const LOGO_URL = `${((import.meta as unknown as { env?: { BASE_URL?: string } })?.env?.BASE_URL || '/').replace(/\/$/, '')}/deamon-logo.png`;

interface LandingPageProps {
  onLoginSuccess: (token: string, user: BackendUserPayload, targetTab?: 'home' | 'store' | 'deposit' | 'history' | 'profile') => void;
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
  const { theme, setTheme } = useApp();

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

  // Dual-Auth State: Google & Email/Normal Login
  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginRememberMe, setLoginRememberMe] = useState(true);

  // Registration Form State (Krich Specifications)
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regWhatsapp, setRegWhatsapp] = useState('');
  const [regTelegram, setRegTelegram] = useState('');
  const [regRememberMe, setRegRememberMe] = useState(true);

  const [emailAuthNotice, setEmailAuthNotice] = useState<{ type: 'error' | 'success' | 'info'; text: string } | null>(null);
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);

  // Modals for Email OTP Verification, Forgot Password, and Reset Password
  const PENDING_OTP_KEY = 'krish_pending_otp_verification';

  const [initialPendingOtp] = useState<{ email: string; expiresAt: number } | null>(() => {
    try {
      if (typeof window === 'undefined') return null;
      const raw = localStorage.getItem(PENDING_OTP_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed.email && parsed.expiresAt && parsed.expiresAt > Date.now()) {
        return parsed;
      }
      localStorage.removeItem(PENDING_OTP_KEY);
    } catch {}
    return null;
  });

  const [isOtpModalOpen, setIsOtpModalOpen] = useState<boolean>(() => !!initialPendingOtp);
  const [otpEmail, setOtpEmail] = useState<string>(() => initialPendingOtp?.email || '');

  const openOtpModal = (email: string) => {
    const clean = email.trim();
    try {
      localStorage.setItem(
        PENDING_OTP_KEY,
        JSON.stringify({
          email: clean,
          expiresAt: Date.now() + 10 * 60 * 1000,
        })
      );
    } catch {}
    setOtpEmail(clean);
    setIsOtpModalOpen(true);
  };

  const closeOtpModal = () => {
    try {
      localStorage.removeItem(PENDING_OTP_KEY);
    } catch {}
    setIsOtpModalOpen(false);
  };
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetToken, setResetToken] = useState('');

  // Buy Login Prompt Modal state
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
  const [buyModalItem, setBuyModalItem] = useState<{
    name: string;
    country: string;
    flag: string;
    priceInr: number;
    priceUsdt: number;
    format: string;
    qty: number;
  } | null>(null);
  const modalGoogleBtnRef = useRef<HTMLDivElement>(null);

  const handleOpenBuyModal = (service: ServiceItem, qty: number = 1) => {
    setBuyModalItem({
      name: service.name,
      country: service.country,
      flag: service.flag,
      priceInr: service.priceInr,
      priceUsdt: service.priceUsdt,
      format: service.format,
      qty,
    });
    setAuthMode('signin');
    setEmailAuthNotice(null);
    setIsBuyModalOpen(true);
  };

  // Listen for reset-password action in URL search parameters
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const params = new URLSearchParams(window.location.search);
      if (params.get('action') === 'reset-password' && params.get('token')) {
        setResetToken(params.get('token')!);
        setIsResetModalOpen(true);
      }
    } catch {}
  }, []);

  const scrollToAuth = (mode?: 'signin' | 'register') => {
    if (mode) setAuthMode(mode);
    setEmailAuthNotice(null);
    const el = document.getElementById('auth-box');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleEmailLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setEmailAuthNotice({ type: 'error', text: 'Please enter both your email and password.' });
      return;
    }
    setIsSubmittingEmail(true);
    setEmailAuthNotice(null);
    try {
      const res = await webAuthApi.login({
        email: loginEmail.trim(),
        password: loginPassword,
      });
      if (res.success && res.token && res.user) {
        const targetTab = buyModalItem ? 'store' : undefined;
        setIsBuyModalOpen(false);
        setWebUserToken(res.token);
        onLoginSuccess(res.token, res.user, targetTab);
      } else if (res.requires_verification) {
        openOtpModal(res.email || loginEmail.trim());
        setEmailAuthNotice({
          type: 'info',
          text: 'Please enter the 6-digit confirmation code sent to your email.',
        });
      } else {
        setEmailAuthNotice({
          type: 'error',
          text: res.error || 'Failed to sign in. Please verify your credentials.',
        });
      }
    } catch (err: unknown) {
      setEmailAuthNotice({
        type: 'error',
        text: err instanceof Error ? err.message : 'Network error. Please try again.',
      });
    } finally {
      setIsSubmittingEmail(false);
    }
  };

  const handleEmailRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regEmail.trim() || !regPassword.trim()) {
      setEmailAuthNotice({
        type: 'error',
        text: 'Please enter your Email and Password.',
      });
      return;
    }
    if (regPassword.length < 6) {
      setEmailAuthNotice({
        type: 'error',
        text: 'Password must be at least 6 characters.',
      });
      return;
    }
    setIsSubmittingEmail(true);
    setEmailAuthNotice(null);
    try {
      const res = await webAuthApi.register({
        email: regEmail.trim(),
        password: regPassword,
        whatsapp: regWhatsapp.trim(),
        username: regUsername.trim(),
      });
      if (res.success) {
        openOtpModal(res.email || regEmail.trim());
        setEmailAuthNotice({
          type: 'success',
          text: 'Verification code sent! Please check your inbox.',
        });
      } else {
        setEmailAuthNotice({
          type: 'error',
          text: res.error || 'Registration failed. Please try again.',
        });
      }
    } catch (err: unknown) {
      setEmailAuthNotice({
        type: 'error',
        text: err instanceof Error ? err.message : 'Network error. Please try again.',
      });
    } finally {
      setIsSubmittingEmail(false);
    }
  };

  const handleOtpSuccess = (token: string, user: BackendUserPayload) => {
    const targetTab = buyModalItem ? 'store' : undefined;
    closeOtpModal();
    setIsBuyModalOpen(false);
    setWebUserToken(token);
    onLoginSuccess(token, user, targetTab);
  };

  // Enforce light theme mode on document root for the Lavender Dream visual identity
  useEffect(() => {
    try {
      if (theme !== 'light' && typeof setTheme === 'function') {
        setTheme('light');
      }
      const root = document.documentElement;
      root.classList.remove('dark');
      root.classList.add('light');
      root.style.colorScheme = 'light';
    } catch {
      // Safe fallback
    }
  }, [theme, setTheme]);

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
        const targetTab = buyModalItem ? 'store' : undefined;
        setIsBuyModalOpen(false);
        setWebUserToken(res.token);
        onLoginSuccess(res.token, res.user, targetTab);
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
              theme: 'outline',
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
              theme: 'outline',
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
  }, []);

  // Render Google Sign-In button inside Buy Login Modal when opened
  useEffect(() => {
    if (isBuyModalOpen && modalGoogleBtnRef.current) {
      try {
        const google = (window as unknown as {
          google?: {
            accounts?: {
              id?: {
                renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
              };
            };
          };
        })?.google;
        if (google?.accounts?.id?.renderButton) {
          modalGoogleBtnRef.current.innerHTML = '';
          const computedWidth = Math.min(320, Math.max(220, (typeof window !== 'undefined' ? window.innerWidth : 320) - 64));
          google.accounts.id.renderButton(modalGoogleBtnRef.current, {
            theme: 'outline',
            size: 'large',
            text: 'continue_with',
            shape: 'pill',
            width: computedWidth,
            logo_alignment: 'left',
          });
        }
      } catch (e) {
        console.error('Failed to render modal Google button:', e);
      }
    }
  }, [isBuyModalOpen, authMode]);

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
      id: 'tg_global_2fa',
      name: 'Global 2FA Telegram Account',
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
      className="w-full min-h-screen flex flex-col font-sans selection:bg-[#6D28D9] selection:text-white"
      style={{
        backgroundColor: '#FAF8FF',
        color: '#514364',
      }}
    >
      {/* Top Header Navigation — Lavender Dream Glass */}
      <header
        className="sticky top-0 z-50 w-full backdrop-blur-md transition-all duration-200"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.88)',
          borderBottom: '1px solid #E5DCF4',
          boxShadow: '0 4px 20px -4px rgba(109, 40, 217, 0.05)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo & Brand — Clean, NO square border or background box */}
          <div className="flex items-center gap-3">
            <img
              src={LOGO_URL}
              alt="Daemon OTP Logo"
              className="w-9 h-9 object-contain shrink-0"
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.src.endsWith('deamon-logo.webp')) {
                  target.src = './deamon-logo.webp';
                }
              }}
            />
            <div className="flex flex-col">
              <span
                className="font-black text-base sm:text-lg tracking-tight"
                style={{ color: '#211536' }}
              >
                Daemon OTP
              </span>
              <span
                className="hidden sm:block text-[11px] font-medium"
                style={{ color: '#74638B' }}
              >
                Virtual Numbers &amp; Telegram Sessions
              </span>
            </div>
          </div>

          {/* Direct Nav Anchor Links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-semibold">
            <a
              href="#rates"
              className="transition-colors hover:text-[#6D28D9]"
              style={{ color: '#514364' }}
            >
              Live Rates &amp; Stock
            </a>
            <a
              href="#servers"
              className="transition-colors hover:text-[#6D28D9]"
              style={{ color: '#514364' }}
            >
              Server Architecture
            </a>
            <a
              href="#how-it-works"
              className="transition-colors hover:text-[#6D28D9]"
              style={{ color: '#514364' }}
            >
              Order Flow
            </a>
            <a
              href="#faq"
              className="transition-colors hover:text-[#6D28D9]"
              style={{ color: '#514364' }}
            >
              FAQ
            </a>
          </nav>

          {/* Header Action Buttons: Email & Google */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => scrollToAuth('signin')}
              className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border"
              style={{
                backgroundColor: '#FFFFFF',
                borderColor: '#E5DCF4',
                color: '#211536',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#6D28D9')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#E5DCF4')}
            >
              <Mail className="w-3.5 h-3.5 text-[#6D28D9]" />
              <span className="hidden sm:inline">Email</span>
              <span>Sign In</span>
            </button>

            <button
              onClick={triggerGooglePrompt}
              className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
              style={{
                backgroundColor: '#6D28D9',
                boxShadow: '0 4px 14px 0 rgba(109, 40, 217, 0.28)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#542C85')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#6D28D9')}
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24">
                <path fill="#FFFFFF" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                <path fill="#FFFFFF" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                <path fill="#FFFFFF" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                <path fill="#FFFFFF" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
              </svg>
              <span>Google Login</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col">
        {/* HERO SECTION — Atmospheric Lavender Radial Gradients */}
        <section
          className="relative pt-12 pb-16 sm:pt-20 sm:pb-24 border-b"
          style={{
            background:
              'radial-gradient(ellipse 70% 50% at 20% 15%, rgba(196, 181, 253, 0.38), transparent 50%), radial-gradient(ellipse 65% 45% at 85% 25%, rgba(221, 208, 255, 0.45), transparent 50%), radial-gradient(ellipse 50% 40% at 50% 85%, rgba(240, 233, 255, 0.6), transparent 55%), #FAF8FF',
            borderColor: '#E5DCF4',
          }}
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-start">
              {/* Left Column: Clear Value Proposition */}
              <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left">
                {/* Highlight Pill */}
                <div
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-5 shadow-sm"
                  style={{
                    backgroundColor: '#F0E9FF',
                    border: '1px solid #E5DCF4',
                    color: '#542C85',
                  }}
                >
                  <Sparkles className="w-3.5 h-3.5" style={{ color: '#6D28D9' }} />
                  <span>Next-Gen OTP &amp; Session Storefront</span>
                </div>

                <h1
                  className="text-3xl sm:text-5xl lg:text-[3.25rem] font-black tracking-tight leading-[1.12]"
                  style={{ color: '#211536' }}
                >
                  Virtual Numbers &amp;{' '}
                  <span
                    className="inline-block"
                    style={{ color: '#6D28D9' }}
                  >
                    Telegram Session Marketplace
                  </span>
                </h1>

                <p
                  className="mt-5 text-sm sm:text-base leading-relaxed max-w-xl"
                  style={{ color: '#514364' }}
                >
                  Receive instant SMS verification codes for 500+ apps across 50+ countries. Download aged
                  2FA-secured Telegram accounts (.session &amp; TData) on demand. Instant UPI and Crypto balance with 100% automated refunds.
                </p>

                {/* Direct Action Buttons — 44px min-height touch targets */}
                <div className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-3">
                  <a
                    href="#rates"
                    className="min-h-[44px] px-5 py-2.5 rounded-xl text-xs font-bold text-white flex items-center gap-2 transition-all shadow-md active:scale-95"
                    style={{
                      backgroundColor: '#6D28D9',
                      boxShadow: '0 4px 14px 0 rgba(109, 40, 217, 0.28)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#542C85')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#6D28D9')}
                  >
                    <Search className="w-4 h-4 text-white" />
                    <span>Explore Live Rates &amp; Stock</span>
                  </a>
                  <a
                    href="https://t.me/DeamonOTPbot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[44px] px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-sm"
                    style={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E5DCF4',
                      color: '#542C85',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#F0E9FF';
                      e.currentTarget.style.borderColor = '#DDD0FF';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#FFFFFF';
                      e.currentTarget.style.borderColor = '#E5DCF4';
                    }}
                  >
                    <Smartphone className="w-4 h-4" style={{ color: '#6D28D9' }} />
                    <span>Open in Telegram (@DeamonOTPbot)</span>
                    <ArrowUpRight className="w-3.5 h-3.5" style={{ color: '#74638B' }} />
                  </a>
                </div>

                {/* Engineering Benchmarks Strip */}
                <div
                  className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-10 pt-8 border-t w-full"
                  style={{ borderColor: '#E5DCF4' }}
                >
                  <div className="flex flex-col">
                    <span className="text-xl sm:text-2xl font-black font-mono text-emerald-700">
                      &lt; 4s
                    </span>
                    <span className="text-[11px] font-medium mt-0.5" style={{ color: '#74638B' }}>
                      Average SMS Arrival
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xl sm:text-2xl font-black font-mono" style={{ color: '#211536' }}>
                      500+
                    </span>
                    <span className="text-[11px] font-medium mt-0.5" style={{ color: '#74638B' }}>
                      Supported Services
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xl sm:text-2xl font-black font-mono" style={{ color: '#6D28D9' }}>
                      100%
                    </span>
                    <span className="text-[11px] font-medium mt-0.5" style={{ color: '#74638B' }}>
                      Automated Refunds
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xl sm:text-2xl font-black font-mono" style={{ color: '#542C85' }}>
                      2FA
                    </span>
                    <span className="text-[11px] font-medium mt-0.5" style={{ color: '#74638B' }}>
                      TData &amp; .session Included
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Dual-Auth Card (Google & Email/Password) — Crisp White with Soft Lavender Shadows */}
              <div className="lg:col-span-5 flex justify-center lg:justify-end w-full" id="auth-box">
                <div
                  className="w-full max-w-md p-6 sm:p-7 rounded-2xl relative overflow-hidden transition-all duration-200"
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E5DCF4',
                    boxShadow: '0 12px 32px -4px rgba(109, 40, 217, 0.08), 0 4px 12px -2px rgba(109, 40, 217, 0.04)',
                  }}
                >
                  {/* Card Header & Tab Switcher */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: '#F0E9FF',
                          border: '1px solid #E5DCF4',
                          color: '#6D28D9',
                        }}
                      >
                        <Lock className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold" style={{ color: '#211536' }}>
                          {authMode === 'signin' ? 'Sign In to Storefront' : 'Create Web Account'}
                        </h2>
                        <p className="text-xs" style={{ color: '#74638B' }}>
                          Google &amp; Email Authentication
                        </p>
                      </div>
                    </div>

                    {/* Mode Toggle Pill */}
                    <div
                      className="p-1 rounded-xl flex items-center gap-1 text-[11px] font-semibold"
                      style={{ backgroundColor: '#F0E9FF', border: '1px solid #E5DCF4' }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('signin');
                          setEmailAuthNotice(null);
                        }}
                        className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                          authMode === 'signin'
                            ? 'bg-white shadow-xs font-bold'
                            : 'hover:text-[#211536]'
                        }`}
                        style={{
                          color: authMode === 'signin' ? '#6D28D9' : '#74638B',
                        }}
                      >
                        Sign In
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('register');
                          setEmailAuthNotice(null);
                        }}
                        className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                          authMode === 'register'
                            ? 'bg-white shadow-xs font-bold'
                            : 'hover:text-[#211536]'
                        }`}
                        style={{
                          color: authMode === 'register' ? '#6D28D9' : '#74638B',
                        }}
                      >
                        Register
                      </button>
                    </div>
                  </div>

                  {errorMessage && (
                    <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">Authentication Notice: </span>
                        <span>{errorMessage}</span>
                      </div>
                    </div>
                  )}

                  {emailAuthNotice && (
                    <div
                      className={`mb-4 p-3 rounded-xl border text-xs flex items-start gap-2 ${
                        emailAuthNotice.type === 'error'
                          ? 'bg-red-50 border-red-200 text-red-600'
                          : emailAuthNotice.type === 'success'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-[#F0E9FF] border-[#E5DCF4] text-[#542C85]'
                      }`}
                    >
                      {emailAuthNotice.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      )}
                      <div>{emailAuthNotice.text}</div>
                    </div>
                  )}

                  {/* 1-Click Fast Path: Google Login Trigger */}
                  <div className="pt-1 flex flex-col items-center w-full">
                    <div className="relative w-full h-[46px] mx-auto select-none">
                      <div
                        className="landing-google-btn w-full h-full rounded-xl flex items-center justify-center gap-3 px-5 transition-all duration-200 border cursor-pointer active:scale-[0.98]"
                        style={{
                          backgroundColor: isLoading ? '#F7F3FF' : '#FFFFFF',
                          borderColor: '#E5DCF4',
                          boxShadow: '0 2px 8px -2px rgba(109, 40, 217, 0.08)',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#6D28D9')}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#E5DCF4')}
                      >
                        {isLoading ? (
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                              style={{ borderColor: '#6D28D9', borderTopColor: 'transparent' }}
                            />
                            <span className="text-xs font-semibold" style={{ color: '#6D28D9' }}>
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
                            <span className="text-xs sm:text-sm font-semibold" style={{ color: '#211536' }}>
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
                  </div>

                  {/* Atmospheric Divider */}
                  <div className="relative my-4 flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t" style={{ borderColor: '#E5DCF4' }} />
                    </div>
                    <div
                      className="relative px-3 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider rounded-full"
                      style={{ backgroundColor: '#FFFFFF', color: '#74638B' }}
                    >
                      {authMode === 'signin' ? 'Or sign in with email' : 'Or register with email'}
                    </div>
                  </div>

                  {/* TAB 1: EMAIL SIGN IN FORM */}
                  {authMode === 'signin' && (
                    <form onSubmit={handleEmailLoginSubmit} className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: '#514364' }}>
                          Gmail or Email Address
                        </label>
                        <div className="relative">
                          <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#74638B' }} />
                          <input
                            type="email"
                            required
                            value={loginEmail}
                            onChange={(e) => setLoginEmail(e.target.value)}
                            placeholder="name@gmail.com"
                            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border focus:outline-none transition-all"
                            style={{
                              backgroundColor: '#FAF8FF',
                              borderColor: '#E5DCF4',
                              color: '#211536',
                            }}
                            onFocus={(e) => (e.currentTarget.style.borderColor = '#6D28D9')}
                            onBlur={(e) => (e.currentTarget.style.borderColor = '#E5DCF4')}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: '#514364' }}>
                          Password
                        </label>
                        <div className="relative">
                          <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#74638B' }} />
                          <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full pl-9 pr-9 py-2 text-xs rounded-xl border focus:outline-none transition-all"
                            style={{
                              backgroundColor: '#FAF8FF',
                              borderColor: '#E5DCF4',
                              color: '#211536',
                            }}
                            onFocus={(e) => (e.currentTarget.style.borderColor = '#6D28D9')}
                            onBlur={(e) => (e.currentTarget.style.borderColor = '#E5DCF4')}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-0.5">
                        <label className="flex items-center gap-2 cursor-pointer select-none" style={{ color: '#514364' }}>
                          <input
                            type="checkbox"
                            checked={loginRememberMe}
                            onChange={(e) => setLoginRememberMe(e.target.checked)}
                            className="rounded border-gray-300 text-[#6D28D9] focus:ring-[#6D28D9]"
                          />
                          <span>Remember Me</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsForgotModalOpen(true)}
                          className="text-xs font-semibold hover:underline cursor-pointer"
                          style={{ color: '#6D28D9' }}
                        >
                          Forgot Password?
                        </button>
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmittingEmail}
                        className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
                        style={{
                          backgroundColor: '#6D28D9',
                          boxShadow: '0 4px 12px rgba(109, 40, 217, 0.25)',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#542C85')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#6D28D9')}
                      >
                        {isSubmittingEmail ? (
                          <span>Verifying...</span>
                        ) : (
                          <>
                            <span>Sign In to Dashboard</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>

                      <div className="text-center pt-1 text-xs" style={{ color: '#74638B' }}>
                        Don&apos;t have an account?{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setAuthMode('register');
                            setEmailAuthNotice(null);
                          }}
                          className="font-bold hover:underline cursor-pointer"
                          style={{ color: '#6D28D9' }}
                        >
                          Create one now
                        </button>
                      </div>
                    </form>
                  )}

                  {/* TAB 2: REGISTRATION FORM (KRICH SPECIFICATIONS) */}
                  {authMode === 'register' && (
                    <form onSubmit={handleEmailRegisterSubmit} className="space-y-2.5">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#514364' }}>
                            Full Name / Display Name
                          </label>
                          <span className="text-[10px] font-medium" style={{ color: '#74638B' }}>Optional</span>
                        </div>
                        <div className="relative">
                          <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#74638B' }} />
                          <input
                            type="text"
                            value={regUsername}
                            onChange={(e) => setRegUsername(e.target.value)}
                            placeholder="John Doe"
                            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border focus:outline-none transition-all"
                            style={{
                              backgroundColor: '#FAF8FF',
                              borderColor: '#E5DCF4',
                              color: '#211536',
                            }}
                            onFocus={(e) => (e.currentTarget.style.borderColor = '#6D28D9')}
                            onBlur={(e) => (e.currentTarget.style.borderColor = '#E5DCF4')}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: '#514364' }}>
                          Gmail or Email Address
                        </label>
                        <div className="relative">
                          <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#74638B' }} />
                          <input
                            type="email"
                            required
                            value={regEmail}
                            onChange={(e) => setRegEmail(e.target.value)}
                            placeholder="name@gmail.com"
                            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border focus:outline-none transition-all"
                            style={{
                              backgroundColor: '#FAF8FF',
                              borderColor: '#E5DCF4',
                              color: '#211536',
                            }}
                            onFocus={(e) => (e.currentTarget.style.borderColor = '#6D28D9')}
                            onBlur={(e) => (e.currentTarget.style.borderColor = '#E5DCF4')}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: '#514364' }}>
                          Password
                        </label>
                        <div className="relative">
                          <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#74638B' }} />
                          <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            value={regPassword}
                            onChange={(e) => setRegPassword(e.target.value)}
                            placeholder="Min. 8 characters"
                            className="w-full pl-9 pr-9 py-1.5 text-xs rounded-xl border focus:outline-none transition-all"
                            style={{
                              backgroundColor: '#FAF8FF',
                              borderColor: '#E5DCF4',
                              color: '#211536',
                            }}
                            onFocus={(e) => (e.currentTarget.style.borderColor = '#6D28D9')}
                            onBlur={(e) => (e.currentTarget.style.borderColor = '#E5DCF4')}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#514364' }}>
                            WhatsApp Mobile Number
                          </label>
                          <span className="text-[10px] font-medium" style={{ color: '#74638B' }}>Optional</span>
                        </div>
                        <div className="relative">
                          <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#74638B' }} />
                          <input
                            type="tel"
                            value={regWhatsapp}
                            onChange={(e) => setRegWhatsapp(e.target.value)}
                            placeholder="+91 98765 43210"
                            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border focus:outline-none transition-all"
                            style={{
                              backgroundColor: '#FAF8FF',
                              borderColor: '#E5DCF4',
                              color: '#211536',
                            }}
                            onFocus={(e) => (e.currentTarget.style.borderColor = '#6D28D9')}
                            onBlur={(e) => (e.currentTarget.style.borderColor = '#E5DCF4')}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#514364' }}>
                            Telegram Username
                          </label>
                          <span className="text-[10px] font-medium" style={{ color: '#74638B' }}>Optional</span>
                        </div>
                        <div className="relative">
                          <Send className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#74638B' }} />
                          <input
                            type="text"
                            value={regTelegram}
                            onChange={(e) => setRegTelegram(e.target.value)}
                            placeholder="@yourhandle (optional)"
                            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border focus:outline-none transition-all"
                            style={{
                              backgroundColor: '#FAF8FF',
                              borderColor: '#E5DCF4',
                              color: '#211536',
                            }}
                            onFocus={(e) => (e.currentTarget.style.borderColor = '#6D28D9')}
                            onBlur={(e) => (e.currentTarget.style.borderColor = '#E5DCF4')}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-0.5 text-xs">
                        <input
                          type="checkbox"
                          checked={regRememberMe}
                          onChange={(e) => setRegRememberMe(e.target.checked)}
                          className="rounded border-gray-300 text-[#6D28D9] focus:ring-[#6D28D9]"
                        />
                        <span style={{ color: '#514364' }}>Remember Me</span>
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmittingEmail}
                        className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
                        style={{
                          backgroundColor: '#6D28D9',
                          boxShadow: '0 4px 12px rgba(109, 40, 217, 0.25)',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#542C85')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#6D28D9')}
                      >
                        {isSubmittingEmail ? (
                          <span>Submitting...</span>
                        ) : (
                          <>
                            <span>Create Web Account</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>

                      <p className="text-[10px] text-center pt-0.5" style={{ color: '#74638B' }}>
                        OTP confirmation sent via <strong>official@daemonx.in</strong>
                      </p>

                      <div className="text-center pt-1 text-xs" style={{ color: '#74638B' }}>
                        Already have an account?{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setAuthMode('signin');
                            setEmailAuthNotice(null);
                          }}
                          className="font-bold hover:underline cursor-pointer"
                          style={{ color: '#6D28D9' }}
                        >
                          Sign in here
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Bottom Note & Security Points */}
                  <div
                    className="mt-5 pt-3.5 border-t space-y-2"
                    style={{ borderColor: '#E5DCF4' }}
                  >
                    <div
                      className="p-2.5 rounded-xl text-[11px] leading-relaxed flex items-center gap-2"
                      style={{
                        backgroundColor: '#F7F3FF',
                        border: '1px solid #E5DCF4',
                        color: '#514364',
                      }}
                    >
                      <Smartphone className="w-3.5 h-3.5 text-[#6D28D9] shrink-0" />
                      <span>
                        <strong>Telegram User?</strong> Open in Telegram to bypass login instantly with your wallet balance.
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs" style={{ color: '#514364' }}>
                      <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                      <span>Zero setup fee • Automatic refunds if code doesn&apos;t arrive</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ACCEPTED DEPOSIT GATEWAYS STRIP — Real Brand Icons with Soft Lavender Backdrop */}
        <section
          className="py-5 border-b transition-colors duration-200"
          style={{
            background: 'linear-gradient(180deg, #F7F3FF 0%, #FAF8FF 100%)',
            borderColor: '#E5DCF4',
          }}
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2" style={{ color: '#514364' }}>
                <CreditCard className="w-4 h-4 text-emerald-600" />
                <span className="font-bold" style={{ color: '#211536' }}>
                  Accepted Deposit Methods:
                </span>
                <span className="hidden sm:inline" style={{ color: '#74638B' }}>
                  Zero processing fee • Instant automated balance crediting
                </span>
              </div>

              {/* Badges with Real Authentic Brand Logos */}
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                {/* Google Pay */}
                <span
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-sm hover:shadow-md hover:border-violet-300"
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E5DCF4',
                    color: '#211536',
                  }}
                >
                  <svg className="w-5 h-4 shrink-0" viewBox="0 0 40 24" fill="none">
                    <rect width="40" height="24" rx="4" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="0.8"/>
                    {/* Google G */}
                    <path d="M14.5 12.1c0-.4-.03-.7-.1-.99H10v1.87h2.52c-.11.59-.44 1.08-.94 1.41v1.17h1.52c.89-.82 1.4-2.02 1.4-3.46z" fill="#4285F4"/>
                    <path d="M10 16.7c1.27 0 2.33-.42 3.11-1.14l-1.52-1.17c-.42.28-.96.45-1.59.45-1.22 0-2.26-.83-2.63-1.94H5.78v1.21c.78 1.55 2.38 2.59 4.22 2.59z" fill="#34A853"/>
                    <path d="M7.37 12.9c-.1-.28-.15-.59-.15-.9s.05-.62.15-.9V9.89H5.78C5.45 10.55 5.26 11.25 5.26 12s.19 1.45.52 2.11l1.59-1.21z" fill="#FBBC04"/>
                    <path d="M10 7.8c.69 0 1.31.24 1.8.7l1.35-1.35C12.33 6.38 11.27 6 10 6 8.16 6 6.56 7.04 5.78 8.59l1.59 1.21c.37-1.11 1.41-2 2.63-2z" fill="#EA4335"/>
                    {/* Pay Text */}
                    <path d="M17.5 8h-1.3v8h1.3V8zm3.5 5.1c0-.3-.04-.6-.13-.9h-2.1v1.8h1.2c-.17.5-.5.85-.94 1.1l.65 1.2c.87-.47 1.32-1.4 1.32-3.2zm-2.2-3.1c-.67 0-1.2.53-1.2 1.2s.53 1.2 1.2 1.2 1.2-.53 1.2-1.2-.53-1.2-1.2-1.2zm4.5 0c-1.1 0-1.9.8-1.9 1.9s.8 1.9 1.9 1.9 1.9-.8 1.9-1.9-.8-1.9-1.9-1.9zm0 2.9c-.53 0-.96-.43-.96-.96s.43-.96.96-.96.96.43.96.96-.43.96-.96.96z" fill="#5F6368"/>
                  </svg>
                  <span>Google Pay</span>
                </span>

                {/* PhonePe */}
                <span
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-sm hover:shadow-md hover:border-violet-300"
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E5DCF4',
                    color: '#211536',
                  }}
                >
                  <svg className="w-4 h-4 shrink-0 rounded-full shadow-xs" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="12" fill="#5F259F"/>
                    {/* Authentic PhonePe Devanagari Pe Glyph */}
                    <path d="M16.8 6.5h-4c-.3 0-.6.2-.7.5l-.2.7h4.4c.3 0 .5.2.5.5s-.2.5-.5.5h-4.8l-.8 3.5c-.1.5.3.8.7.8h2.6c.3 0 .5.2.5.5s-.2.5-.5.5h-2.8c-1.1 0-2.1-.8-2.4-1.9l-1-4.7H6.5c-.3 0-.5-.2-.5-.5s.2-.5.5-.5h2.3l.3-1c.3-1.1 1.3-1.9 2.4-1.9h4.3c.3 0 .5.2.5.5s-.2.5-.5.5z" fill="#ffffff"/>
                    <path d="M13.6 13.8l-3.3 4.9c-.2.3-.7.4-1 .2-.3-.2-.4-.7-.2-1l3.5-4.8c.2.3.4.5.7.7h.3z" fill="#ffffff"/>
                  </svg>
                  <span>PhonePe</span>
                </span>

                {/* Paytm */}
                <span
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-sm hover:shadow-md hover:border-violet-300"
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E5DCF4',
                    color: '#211536',
                  }}
                >
                  <svg className="h-3.5 w-10 shrink-0" viewBox="0 0 52 16" fill="none">
                    {/* Authentic Paytm Mark: 'Pay' in navy #002970, 'tm' in cyan #00BAF2 */}
                    <path d="M4.5 1h-3C.7 1 0 1.7 0 2.5v11c0 .8.7 1.5 1.5 1.5h1.8c.8 0 1.5-.7 1.5-1.5v-3.2h-.3c1.9 0 3.5-1.6 3.5-3.5V4.5C8 2.6 6.4 1 4.5 1zm.2 5.8c0 .8-.7 1.5-1.5 1.5H3.1V3.2h.1c.8 0 1.5.7 1.5 1.5v2.1z" fill="#002970"/>
                    <path d="M13.8 5.5h-1.8c-.8 0-1.5.7-1.5 1.5v.3c-.6-.6-1.5-1-2.5-1-1.9 0-3.5 1.6-3.5 3.5v.4c0 1.9 1.6 3.5 3.5 3.5 1 0 1.9-.4 2.5-1v.3c0 .8.7 1.5 1.5 1.5h1.8V5.5zm-3.3 4.6c0 .9-.7 1.6-1.6 1.6s-1.6-.7-1.6-1.6v-.2c0-.9.7-1.6 1.6-1.6s1.6.7 1.6 1.6v.2z" fill="#002970"/>
                    <path d="M19.2 5.5l-2.1 6.5-2.1-6.5h-2.1l3.2 8.8-1.5 3.7h2.1l5.7-12.5h-3.2z" fill="#002970"/>
                    <path d="M25 5.5v-2h-1.8v2h-1.2v1.8h1.2v4.2c0 1.1.9 2 2 2h1.5v-1.8h-1.2c-.3 0-.5-.2-.5-.5V7.3h1.7V5.5H25z" fill="#00BAF2"/>
                    <path d="M37 5.5h-1.8c-.8 0-1.5.7-1.5 1.5v.5c-.6-.7-1.5-1.1-2.5-1.1-.9 0-1.8.4-2.3 1-.5-.6-1.4-1-2.3-1-1.8 0-3.2 1.4-3.2 3.2v4.4h1.8v-4.2c0-.8.6-1.4 1.4-1.4s1.4.6 1.4 1.4v4.2h1.8v-4.2c0-.8.6-1.4 1.4-1.4s1.4.6 1.4 1.4v4.2H37V5.5z" fill="#00BAF2"/>
                  </svg>
                  <span>Paytm</span>
                </span>

                {/* BHIM UPI */}
                <span
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-sm hover:shadow-md hover:border-violet-300"
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E5DCF4',
                    color: '#211536',
                  }}
                >
                  <svg className="h-3.5 w-10 shrink-0" viewBox="0 0 46 16" fill="none">
                    {/* Official NPCI UPI Chevrons */}
                    <path d="M7.5 1L2 15h3.6l5.5-14H7.5z" fill="#097939"/>
                    <path d="M11.5 1L6 15h3.6l5.5-14h-3.6z" fill="#ED7524"/>
                    {/* UPI Text */}
                    <path d="M18 3h2.6v6.5c0 1.1.8 1.9 1.9 1.9s1.9-.8 1.9-1.9V3H27v6.5c0 2.5-2 4.5-4.5 4.5S18 12 18 9.5V3z" fill="#1B1C1E"/>
                    <path d="M29 3h4.5c2 0 3.7 1.7 3.7 3.7s-1.7 3.7-3.7 3.7h-1.9V14H29V3zm2.6 2.3v2.8h1.9c.8 0 1.4-.6 1.4-1.4s-.6-1.4-1.4-1.4h-1.9z" fill="#1B1C1E"/>
                    <path d="M39.5 3h2.6v11h-2.6V3z" fill="#1B1C1E"/>
                  </svg>
                  <span>BHIM UPI</span>
                </span>

                {/* USDT (Tether) */}
                <span
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-sm hover:shadow-md hover:border-violet-300"
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E5DCF4',
                    color: '#211536',
                  }}
                >
                  <svg className="w-4 h-4 shrink-0 rounded-full shadow-xs" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="12" fill="#26A17B"/>
                    {/* Official Tether Monogram */}
                    <path d="M13.4 11.1c-.1 0-.5 0-.9 0-.3 0-.8 0-.9 0-2.1-.1-3.7-.5-3.7-1.1 0-.6 1.6-1 3.7-1.1.2 0 .6 0 .9 0 .4 0 .8 0 .9 0 2.1.1 3.7.5 3.7 1.1 0 .5-1.6 1-3.7 1.1zm0-2.7V6.9h3.3V5.2h-7.6v1.7h3.3v1.5c-2.6.1-4.5.7-4.5 1.6 0 .8 1.9 1.5 4.5 1.6v4.9h1.7v-4.9c2.6-.1 4.5-.7 4.5-1.6 0-.8-1.9-1.5-4.5-1.6zm0 3.8v-.1c1.7-.1 3.2-.4 3.5-.8v2c-.8.4-2.1.7-3.5.8v-1.9zm-1.7 0v1.9c-1.4-.1-2.7-.4-3.5-.8v-2c.4.4 1.8.7 3.5.8v.1z" fill="#ffffff"/>
                  </svg>
                  <span>USDT (TRC-20 &amp; BEP-20)</span>
                </span>

                {/* FamPay Direct */}
                <span
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-sm hover:shadow-md hover:border-violet-300"
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E5DCF4',
                    color: '#211536',
                  }}
                >
                  <svg className="w-4 h-4 shrink-0 rounded-[4px] shadow-xs" viewBox="0 0 24 24" fill="none">
                    <rect width="24" height="24" rx="5" fill="#FFB703"/>
                    {/* Official Fam Logo Silhouette */}
                    <path d="M15 5.5l-4.5 2a2.5 2.5 0 00-1.5 2.3v1.8a2.5 2.5 0 001.5 2.3l4.5 2V5.5z" fill="#111217"/>
                    <circle cx="9" cy="17" r="2" fill="#111217"/>
                    <path d="M16.5 8.5l-1.8.8a1 1 0 00-.5.7v5a1 1 0 00.5.7l1.8.8V8.5z" fill="#111217" opacity="0.6"/>
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
          className="py-16 sm:py-20 border-b"
          style={{
            background:
              'radial-gradient(ellipse 65% 45% at 80% 20%, rgba(196, 181, 253, 0.28), transparent 50%), radial-gradient(ellipse 50% 35% at 15% 75%, rgba(221, 208, 255, 0.32), transparent 45%), #FAF8FF',
            borderColor: '#E5DCF4',
          }}
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
              <div>
                <span
                  className="text-xs font-bold uppercase tracking-wider font-mono"
                  style={{ color: '#6D28D9' }}
                >
                  Live Terminal
                </span>
                <h2
                  className="text-2xl sm:text-3xl font-black mt-1"
                  style={{ color: '#211536' }}
                >
                  Service Rates &amp; Stock Availability
                </h2>
                <p className="text-xs sm:text-sm mt-1" style={{ color: '#514364' }}>
                  Search live starting prices, carriers, and delivery formats before signing in.
                </p>
              </div>

              {/* Category Filter Chips — Soft Lavender Pills */}
              <div
                className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl border self-start sm:self-auto shadow-sm"
                style={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#E5DCF4',
                }}
                role="tablist"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedCategory === 'all'}
                  onClick={() => setSelectedCategory('all')}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer"
                  style={{
                    backgroundColor: selectedCategory === 'all' ? '#6D28D9' : 'transparent',
                    color: selectedCategory === 'all' ? '#FFFFFF' : '#514364',
                    fontWeight: selectedCategory === 'all' ? '700' : '600',
                  }}
                >
                  All ({serviceCatalog.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedCategory === 'otp'}
                  onClick={() => setSelectedCategory('otp')}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer"
                  style={{
                    backgroundColor: selectedCategory === 'otp' ? '#6D28D9' : 'transparent',
                    color: selectedCategory === 'otp' ? '#FFFFFF' : '#514364',
                    fontWeight: selectedCategory === 'otp' ? '700' : '600',
                  }}
                >
                  SMS OTPs
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedCategory === 'session'}
                  onClick={() => setSelectedCategory('session')}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer"
                  style={{
                    backgroundColor: selectedCategory === 'session' ? '#6D28D9' : 'transparent',
                    color: selectedCategory === 'session' ? '#FFFFFF' : '#514364',
                    fontWeight: selectedCategory === 'session' ? '700' : '600',
                  }}
                >
                  Telegram Sessions
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedCategory === 'smm'}
                  onClick={() => setSelectedCategory('smm')}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer"
                  style={{
                    backgroundColor: selectedCategory === 'smm' ? '#6D28D9' : 'transparent',
                    color: selectedCategory === 'smm' ? '#FFFFFF' : '#514364',
                    fontWeight: selectedCategory === 'smm' ? '700' : '600',
                  }}
                >
                  SMM Boost
                </button>
              </div>
            </div>

            {/* Interactive Search Bar & Country Filter */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-6">
              <div className="sm:col-span-8 relative">
                <Search
                  className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2"
                  style={{ color: '#74638B' }}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search app (WhatsApp, Telegram, OpenAI...) or country (India, USA, UK...)"
                  className="w-full h-11 pl-10 pr-4 rounded-xl border text-xs focus:outline-none transition-colors shadow-sm"
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E5DCF4',
                    color: '#211536',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#6D28D9')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#E5DCF4')}
                />
              </div>

              <div className="sm:col-span-4">
                <select
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border text-xs focus:outline-none cursor-pointer shadow-sm"
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E5DCF4',
                    color: '#211536',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#6D28D9')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#E5DCF4')}
                >
                  <option value="all">All Regions &amp; Countries</option>
                  <option value="india">India 🇮🇳</option>
                  <option value="united states">United States 🇺🇸</option>
                  <option value="united kingdom">United Kingdom 🇬🇧</option>
                  <option value="global">Global / Multi-Region 🌐</option>
                </select>
              </div>
            </div>

            {/* Service Items Grid — Mixed White and Soft Lavender Surfaces */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredServices.map((service) => {
                const isSelected = selectedServiceId === service.id;

                return (
                  <div
                    key={service.id}
                    onClick={() => setSelectedServiceId(service.id)}
                    className="p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between hover:-translate-y-0.5"
                    style={{
                      backgroundColor: isSelected ? '#F0E9FF' : '#FFFFFF',
                      borderColor: isSelected ? '#6D28D9' : '#E5DCF4',
                      boxShadow: isSelected
                        ? '0 8px 24px rgba(109, 40, 217, 0.12)'
                        : '0 2px 10px -2px rgba(109, 40, 217, 0.04)',
                    }}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <span
                          className="text-xs font-medium flex items-center gap-1.5"
                          style={{ color: '#74638B' }}
                        >
                          <span>{service.flag}</span>
                          <span>{service.country}</span>
                        </span>
                        <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md border text-emerald-700 bg-emerald-50 border-emerald-200">
                          {service.successRate}
                        </span>
                      </div>

                      <h3
                        className="text-sm font-bold tracking-tight"
                        style={{ color: '#211536' }}
                      >
                        {service.name}
                      </h3>
                      <p
                        className="text-xs mt-1.5 leading-relaxed"
                        style={{ color: '#514364' }}
                      >
                        {service.description}
                      </p>

                      {/* Clean Light-Themed Badges — NO BLACK BOXES! */}
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-mono">
                        <span
                          className="px-2.5 py-0.5 rounded-md border font-medium"
                          style={{
                            backgroundColor: isSelected ? '#FFFFFF' : '#F0E9FF',
                            borderColor: isSelected ? '#DDD0FF' : '#E5DCF4',
                            color: '#542C85',
                          }}
                        >
                          {service.format}
                        </span>
                        <span
                          className="px-2.5 py-0.5 rounded-md border font-semibold"
                          style={{
                            backgroundColor: '#EDE5FF',
                            borderColor: '#DDD0FF',
                            color: '#6D28D9',
                          }}
                        >
                          {service.speed}
                        </span>
                      </div>
                    </div>

                    <div
                      className="mt-4 pt-3.5 border-t flex items-center justify-between"
                      style={{ borderColor: isSelected ? '#DDD0FF' : '#F0E9FF' }}
                    >
                      <div>
                        <span className="text-[10px] block" style={{ color: '#74638B' }}>
                          Starting from
                        </span>
                        <span className="text-sm font-black font-mono text-emerald-700">
                          ₹{service.priceInr}{' '}
                          <span className="text-xs font-normal" style={{ color: '#74638B' }}>
                            (${service.priceUsdt.toFixed(2)})
                          </span>
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenBuyModal(service, 1);
                        }}
                        className="min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-sm"
                        style={{
                          backgroundColor: isSelected ? '#6D28D9' : '#FFFFFF',
                          borderColor: isSelected ? '#6D28D9' : '#E5DCF4',
                          color: isSelected ? '#FFFFFF' : '#542C85',
                          boxShadow: '0 2px 6px -1px rgba(109, 40, 217, 0.08)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#6D28D9';
                          e.currentTarget.style.color = '#FFFFFF';
                          e.currentTarget.style.borderColor = '#6D28D9';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = '#FFFFFF';
                            e.currentTarget.style.color = '#542C85';
                            e.currentTarget.style.borderColor = '#E5DCF4';
                          }
                        }}
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>Buy Now</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Empty State */}
            {filteredServices.length === 0 && (
              <div
                className="py-12 px-6 rounded-2xl border text-center flex flex-col items-center justify-center shadow-sm"
                style={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#E5DCF4',
                }}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                  style={{
                    backgroundColor: '#F0E9FF',
                    color: '#6D28D9',
                  }}
                >
                  <Search className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold" style={{ color: '#211536' }}>
                  No matching services found
                </h4>
                <p className="text-xs mt-1.5 max-w-md" style={{ color: '#514364' }}>
                  No carrier pools or accounts match &quot;{searchQuery}&quot; in the selected filter. Try adjusting your query or resetting all filters.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                    setSelectedCountry('all');
                  }}
                  className="mt-4 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
                  style={{ backgroundColor: '#6D28D9' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#542C85')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#6D28D9')}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset All Filters</span>
                </button>
              </div>
            )}

            {/* Interactive Rate Estimator Bar — Crisp White Card with Lavender Controls */}
            <div
              className="mt-8 p-5 sm:p-6 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-5 transition-all shadow-sm"
              style={{
                backgroundColor: '#FFFFFF',
                borderColor: '#E5DCF4',
                boxShadow: '0 8px 24px -4px rgba(109, 40, 217, 0.06)',
              }}
            >
              <div className="flex items-center gap-3.5">
                <div
                  className="w-11 h-11 rounded-xl border flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: '#F0E9FF',
                    borderColor: '#E5DCF4',
                    color: '#6D28D9',
                  }}
                >
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#211536' }}>
                    Quick Rate Calculator
                  </h4>
                  <p className="text-xs mt-0.5" style={{ color: '#514364' }}>
                    Selected:{' '}
                    <span className="font-semibold" style={{ color: '#211536' }}>
                      {activeSelectedService.name}
                    </span>{' '}
                    ({activeSelectedService.country})
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                {/* Stepper Controls */}
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: '#74638B' }}>Qty:</span>
                  <div
                    className="flex items-center rounded-xl border p-0.5"
                    style={{
                      backgroundColor: '#F7F3FF',
                      borderColor: '#E5DCF4',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setCalcQuantity((prev) => Math.max(1, prev - 1))}
                      className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors cursor-pointer"
                      style={{ color: '#542C85' }}
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
                      className="w-12 py-1 text-xs font-mono font-bold text-center bg-transparent focus:outline-none"
                      style={{ color: '#211536' }}
                    />
                    <button
                      type="button"
                      onClick={() => setCalcQuantity((prev) => Math.min(100, prev + 1))}
                      className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors cursor-pointer"
                      style={{ color: '#542C85' }}
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] block" style={{ color: '#74638B' }}>
                    Estimated Total
                  </span>
                  <span className="text-base sm:text-lg font-black font-mono text-emerald-700">
                    ₹{activeSelectedService.priceInr * calcQuantity}{' '}
                    <span className="text-xs font-normal" style={{ color: '#74638B' }}>
                      (${(activeSelectedService.priceUsdt * calcQuantity).toFixed(2)})
                    </span>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenBuyModal(activeSelectedService, calcQuantity)}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all cursor-pointer shadow-md active:scale-95 flex items-center gap-2"
                  style={{
                    backgroundColor: '#6D28D9',
                    boxShadow: '0 4px 14px 0 rgba(109, 40, 217, 0.28)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#542C85')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#6D28D9')}
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>
                    Buy Now ({calcQuantity > 1 ? `${calcQuantity}x · ` : ''}₹{activeSelectedService.priceInr * calcQuantity})
                  </span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 4-SERVER INFRASTRUCTURE — Varied Card Compositions */}
        <section
          id="servers"
          className="py-16 sm:py-20 border-b transition-colors duration-200"
          style={{
            background:
              'radial-gradient(ellipse 70% 50% at 15% 30%, rgba(221, 208, 255, 0.35), transparent 50%), radial-gradient(ellipse 60% 40% at 85% 70%, rgba(196, 181, 253, 0.3), transparent 50%), #F7F3FF',
            borderColor: '#E5DCF4',
          }}
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span
                className="text-xs font-bold uppercase tracking-wider font-mono"
                style={{ color: '#6D28D9' }}
              >
                System Infrastructure
              </span>
              <h2 className="text-2xl sm:text-3xl font-black mt-1" style={{ color: '#211536' }}>
                4 Specialized Service Pipelines
              </h2>
              <p className="text-xs sm:text-sm mt-1.5" style={{ color: '#514364' }}>
                Every server is built for a dedicated use case: verified aged sessions, live carrier OTPs, and community scaling.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Server 1: Global 2FA Accounts */}
              <div
                className="p-6 rounded-2xl border flex flex-col justify-between transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
                style={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#E5DCF4',
                }}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold"
                      style={{
                        backgroundColor: '#F0E9FF',
                        border: '1px solid #E5DCF4',
                        color: '#6D28D9',
                      }}
                    >
                      <Server className="w-5 h-5" />
                    </div>
                    <span
                      className="text-[11px] font-mono px-2.5 py-0.5 rounded-full border"
                      style={{
                        color: '#6D28D9',
                        backgroundColor: '#F0E9FF',
                        borderColor: '#E5DCF4',
                      }}
                    >
                      Server 1
                    </span>
                  </div>
                  <h3 className="text-base font-bold" style={{ color: '#211536' }}>
                    Global 2FA Verified Accounts
                  </h3>
                  <p className="text-xs mt-2 leading-relaxed" style={{ color: '#514364' }}>
                    Automated access to verified international Telegram accounts with active 2FA credentials. Pre-checked for session health and covered by replacement warranties.
                  </p>
                </div>

                <div
                  className="mt-6 pt-4 border-t flex items-center justify-between text-xs"
                  style={{ borderColor: '#F0E9FF', color: '#74638B' }}
                >
                  <span>Instant Credential Delivery</span>
                  <span className="font-mono font-semibold" style={{ color: '#211536' }}>
                    24h Replacement Guard
                  </span>
                </div>
              </div>

              {/* Server 2: Fresh & Vintage Telegram Sessions */}
              <div
                className="p-6 rounded-2xl border flex flex-col justify-between transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
                style={{
                  backgroundColor: '#FAF8FF',
                  borderColor: '#E5DCF4',
                }}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold"
                      style={{
                        backgroundColor: '#EDE5FF',
                        border: '1px solid #DDD0FF',
                        color: '#542C85',
                      }}
                    >
                      <Download className="w-5 h-5" />
                    </div>
                    <span
                      className="text-[11px] font-mono px-2.5 py-0.5 rounded-full border"
                      style={{
                        color: '#542C85',
                        backgroundColor: '#EDE5FF',
                        borderColor: '#DDD0FF',
                      }}
                    >
                      Server 2
                    </span>
                  </div>
                  <h3 className="text-base font-bold" style={{ color: '#211536' }}>
                    Vintage Telegram Sessions (2021–2025)
                  </h3>
                  <p className="text-xs mt-2 leading-relaxed" style={{ color: '#514364' }}>
                    Aged and virgin accounts with clean registration history. Every purchase provides both instant .session files (for Python scripts) and complete TData folders with 2FA passwords.
                  </p>
                </div>

                <div
                  className="mt-6 pt-4 border-t flex items-center justify-between text-xs"
                  style={{ borderColor: '#E5DCF4', color: '#74638B' }}
                >
                  <span>.session + TData ZIP</span>
                  <span className="font-mono font-semibold text-emerald-700">
                    100% Tested Valid
                  </span>
                </div>
              </div>

              {/* Server 3 & 4: Virtual SMS OTP Pools */}
              <div
                className="p-6 rounded-2xl border flex flex-col justify-between transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
                style={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#E5DCF4',
                }}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold"
                      style={{
                        backgroundColor: '#F0E9FF',
                        border: '1px solid #E5DCF4',
                        color: '#6D28D9',
                      }}
                    >
                      <RefreshCw className="w-5 h-5" />
                    </div>
                    <span
                      className="text-[11px] font-mono px-2.5 py-0.5 rounded-full border"
                      style={{
                        color: '#6D28D9',
                        backgroundColor: '#F0E9FF',
                        borderColor: '#E5DCF4',
                      }}
                    >
                      Servers 3 &amp; 4
                    </span>
                  </div>
                  <h3 className="text-base font-bold" style={{ color: '#211536' }}>
                    Live Carrier Virtual SMS OTP Pools
                  </h3>
                  <p className="text-xs mt-2 leading-relaxed" style={{ color: '#514364' }}>
                    High-throughput private carrier lines for 500+ apps. Includes a 20-minute active timer. If an SMS code is not received, the order is cancelled with a 100% automated refund to your wallet.
                  </p>
                </div>

                <div
                  className="mt-6 pt-4 border-t flex items-center justify-between text-xs"
                  style={{ borderColor: '#F0E9FF', color: '#74638B' }}
                >
                  <span>20-Min Active Countdown</span>
                  <span className="font-mono font-semibold text-emerald-700">
                    Automatic Refund Guard
                  </span>
                </div>
              </div>

              {/* Server 5: Social Media SMM Panel */}
              <div
                className="p-6 rounded-2xl border flex flex-col justify-between transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
                style={{
                  backgroundColor: '#FAF8FF',
                  borderColor: '#E5DCF4',
                }}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold"
                      style={{
                        backgroundColor: '#EDE5FF',
                        border: '1px solid #DDD0FF',
                        color: '#542C85',
                      }}
                    >
                      <Zap className="w-5 h-5" />
                    </div>
                    <span
                      className="text-[11px] font-mono px-2.5 py-0.5 rounded-full border"
                      style={{
                        color: '#542C85',
                        backgroundColor: '#EDE5FF',
                        borderColor: '#DDD0FF',
                      }}
                    >
                      Server 5
                    </span>
                  </div>
                  <h3 className="text-base font-bold" style={{ color: '#211536' }}>
                    SMM Social Growth Panel
                  </h3>
                  <p className="text-xs mt-2 leading-relaxed" style={{ color: '#514364' }}>
                    Automated delivery of high-retention Telegram channel members, real post views, and custom emoji reactions. Scaled for creators and community managers with drop protection.
                  </p>
                </div>

                <div
                  className="mt-6 pt-4 border-t flex items-center justify-between text-xs"
                  style={{ borderColor: '#E5DCF4', color: '#74638B' }}
                >
                  <span>30-Day Refill Guarantee</span>
                  <span className="font-mono font-semibold" style={{ color: '#211536' }}>
                    Instant Execution
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ORDER LIFECYCLE FLOW — 4 Clean Sequential Cards */}
        <section
          id="how-it-works"
          className="py-16 sm:py-20 border-b"
          style={{
            background:
              'radial-gradient(ellipse 60% 45% at 50% 20%, rgba(221, 208, 255, 0.35), transparent 50%), radial-gradient(ellipse 50% 35% at 85% 85%, rgba(196, 181, 253, 0.25), transparent 45%), #FAF8FF',
            borderColor: '#E5DCF4',
          }}
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span
                className="text-xs font-bold uppercase tracking-wider font-mono"
                style={{ color: '#6D28D9' }}
              >
                Order Execution
              </span>
              <h2 className="text-2xl sm:text-3xl font-black mt-1" style={{ color: '#211536' }}>
                How an Order Works in Practice
              </h2>
              <p className="text-xs sm:text-sm mt-1.5" style={{ color: '#514364' }}>
                Transparent step-by-step lifecycle from wallet deposit to SMS code delivery.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div
                className="p-5 rounded-2xl border transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
                style={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#E5DCF4',
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg text-white font-black text-xs flex items-center justify-center mb-3 shadow-sm"
                  style={{ backgroundColor: '#6D28D9' }}
                >
                  1
                </div>
                <h3 className="text-sm font-bold" style={{ color: '#211536' }}>
                  Sign In &amp; Top Up
                </h3>
                <p className="text-xs mt-1.5 leading-relaxed" style={{ color: '#514364' }}>
                  Authenticate with Google in 2 seconds. Scan an instant UPI QR code or transfer USDT; balance reflects automatically.
                </p>
              </div>

              <div
                className="p-5 rounded-2xl border transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
                style={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#E5DCF4',
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg text-white font-black text-xs flex items-center justify-center mb-3 shadow-sm"
                  style={{ backgroundColor: '#542C85' }}
                >
                  2
                </div>
                <h3 className="text-sm font-bold" style={{ color: '#211536' }}>
                  Select App &amp; Country
                </h3>
                <p className="text-xs mt-1.5 leading-relaxed" style={{ color: '#514364' }}>
                  Choose your service. A dedicated virtual carrier line is allocated immediately with an active 20:00 countdown timer.
                </p>
              </div>

              <div
                className="p-5 rounded-2xl border transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
                style={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#E5DCF4',
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg text-white font-black text-xs flex items-center justify-center mb-3 shadow-sm"
                  style={{ backgroundColor: '#6D28D9' }}
                >
                  3
                </div>
                <h3 className="text-sm font-bold" style={{ color: '#211536' }}>
                  Receive SMS Code
                </h3>
                <p className="text-xs mt-1.5 leading-relaxed" style={{ color: '#514364' }}>
                  The verification code arrives directly on your screen within seconds. Copy it with 1 click to complete activation.
                </p>
              </div>

              <div
                className="p-5 rounded-2xl border transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
                style={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#E5DCF4',
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg text-white font-black text-xs flex items-center justify-center mb-3 shadow-sm"
                  style={{ backgroundColor: '#542C85' }}
                >
                  4
                </div>
                <h3 className="text-sm font-bold" style={{ color: '#211536' }}>
                  Automated Refund Guard
                </h3>
                <p className="text-xs mt-1.5 leading-relaxed" style={{ color: '#514364' }}>
                  If the code is not delivered before the timer runs out, the full amount is refunded automatically to your balance.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ SECTION */}
        <section
          id="faq"
          className="py-16 sm:py-20 border-b transition-colors duration-200"
          style={{
            background:
              'radial-gradient(ellipse 65% 45% at 20% 35%, rgba(221, 208, 255, 0.32), transparent 50%), radial-gradient(ellipse 55% 40% at 80% 65%, rgba(196, 181, 253, 0.25), transparent 50%), #F7F3FF',
            borderColor: '#E5DCF4',
          }}
        >
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span
                className="text-xs font-bold uppercase tracking-wider font-mono"
                style={{ color: '#6D28D9' }}
              >
                Support &amp; Answers
              </span>
              <h2 className="text-2xl sm:text-3xl font-black mt-1" style={{ color: '#211536' }}>
                Frequently Asked Questions
              </h2>
            </div>

            <div className="space-y-3">
              {faqItems.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border overflow-hidden transition-all shadow-sm"
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E5DCF4',
                  }}
                >
                  <button
                    onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                    aria-expanded={activeFaq === idx}
                    className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 cursor-pointer transition-colors"
                    style={{
                      backgroundColor: activeFaq === idx ? '#F7F3FF' : '#FFFFFF',
                    }}
                  >
                    <span
                      className="text-sm font-bold flex items-center gap-2.5"
                      style={{ color: '#211536' }}
                    >
                      <HelpCircle className="w-4 h-4 shrink-0" style={{ color: '#6D28D9' }} />
                      <span>{item.q}</span>
                    </span>
                    <ChevronDown
                      className="w-4 h-4 transition-transform"
                      style={{
                        color: activeFaq === idx ? '#6D28D9' : '#74638B',
                        transform: activeFaq === idx ? 'rotate(180deg)' : 'none',
                      }}
                    />
                  </button>
                  {activeFaq === idx && (
                    <div
                      className="px-5 pb-5 text-xs leading-relaxed border-t pt-3"
                      style={{
                        borderColor: '#E5DCF4',
                        color: '#514364',
                        backgroundColor: '#FAF8FF',
                      }}
                    >
                      {item.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* BOTTOM CALL TO ACTION — Rich Lavender Surface Glow */}
        <section
          className="py-16 sm:py-20 border-b relative overflow-hidden"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(221, 208, 255, 0.55), transparent 60%), radial-gradient(ellipse 60% 40% at 20% 80%, rgba(196, 181, 253, 0.35), transparent 50%), #F0E9FF',
            borderColor: '#E5DCF4',
          }}
        >
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center relative z-10">
            {/* Logo — Clean standing freely, NO square container */}
            <img
              src={LOGO_URL}
              alt="Daemon OTP Logo"
              className="w-14 h-14 object-contain mx-auto mb-5 shrink-0"
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.src.endsWith('deamon-logo.webp')) {
                  target.src = './deamon-logo.webp';
                }
              }}
            />

            <h2 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: '#211536' }}>
              Start Receiving OTPs &amp; Downloading Sessions
            </h2>
            <p className="text-xs sm:text-sm mt-2 max-w-lg mx-auto" style={{ color: '#514364' }}>
              Zero setup fees. Immediate access to carrier numbers, aged accounts, and social panel tools.
            </p>

            <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-lg mx-auto">
              <div className="relative w-full sm:w-[260px] h-[48px] select-none">
                <div
                  className="landing-google-btn w-full h-full rounded-xl flex items-center justify-center gap-3 px-5 transition-all duration-200 border cursor-pointer active:scale-[0.98]"
                  style={{
                    backgroundColor: isLoading ? '#F7F3FF' : '#FFFFFF',
                    borderColor: '#E5DCF4',
                    boxShadow: '0 4px 16px -2px rgba(109, 40, 217, 0.12)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#6D28D9')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#E5DCF4')}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                        style={{ borderColor: '#6D28D9', borderTopColor: 'transparent' }}
                      />
                      <span className="text-xs font-semibold" style={{ color: '#6D28D9' }}>
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
                      <span className="text-xs sm:text-sm font-semibold" style={{ color: '#211536' }}>
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

              {/* Email / Normal Login Trigger */}
              <button
                type="button"
                onClick={() => scrollToAuth('signin')}
                className="w-full sm:w-auto h-[48px] px-6 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-2"
                style={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#E5DCF4',
                  color: '#211536',
                  boxShadow: '0 2px 8px -2px rgba(109, 40, 217, 0.08)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#6D28D9')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#E5DCF4')}
              >
                <Mail className="w-4 h-4 text-[#6D28D9]" />
                <span>Continue with Email</span>
              </button>
            </div>

            <div className="mt-5">
              <a
                href="https://t.me/DeamonOTPbot"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs transition-colors font-medium hover:underline"
                style={{ color: '#542C85' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#6D28D9')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#542C85')}
              >
                <span>Prefer using Telegram directly? Open @DeamonOTPbot</span>
                <ExternalLink className="w-3.5 h-3.5" style={{ color: '#6D28D9' }} />
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* COMPREHENSIVE 4-COLUMN PROFESSIONAL FOOTER WITH OFFICIAL INBOXES */}
      <footer
        className="border-t pt-12 pb-8 transition-colors duration-200"
        style={{
          background: 'linear-gradient(180deg, #FAF8FF 0%, #FFFFFF 100%)',
          borderColor: '#E5DCF4',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 pb-10 border-b"
            style={{ borderColor: '#E5DCF4' }}
          >
            {/* Column 1: Brand & Operational Status (Span 3) */}
            <div className="lg:col-span-3 flex flex-col">
              <div className="flex items-center gap-3 mb-3">
                <img
                  src={LOGO_URL}
                  alt="Daemon OTP Logo"
                  className="w-7 h-7 object-contain shrink-0"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.src.endsWith('deamon-logo.webp')) {
                      target.src = './deamon-logo.webp';
                    }
                  }}
                />
                <span className="font-extrabold text-sm tracking-tight" style={{ color: '#211536' }}>
                  Daemon OTP
                </span>
              </div>

              <p className="text-xs leading-relaxed max-w-sm mb-4" style={{ color: '#514364' }}>
                High-throughput carrier infrastructure for virtual SMS OTP verification, vintage 2FA Telegram accounts, and automated social panel growth.
              </p>

              <div className="flex flex-col gap-1.5 text-xs">
                <div className="inline-flex items-center gap-2 font-mono text-[11px] text-emerald-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>All Systems Operational (99.98% Uptime)</span>
                </div>
                <div className="inline-flex items-center gap-2 text-[11px]" style={{ color: '#74638B' }}>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>256-Bit SSL Encrypted Transactions</span>
                </div>
              </div>
            </div>

            {/* Column 2: Products & Servers (Span 3) */}
            <div className="lg:col-span-3 flex flex-col">
              <h4
                className="text-xs font-bold uppercase tracking-wider mb-3 font-mono"
                style={{ color: '#211536' }}
              >
                Products &amp; Servers
              </h4>
              <ul className="space-y-2 text-xs" style={{ color: '#514364' }}>
                <li>
                  <a href="#servers" className="hover:text-[#6D28D9] transition-colors">Server 1: Global 2FA Accounts</a>
                </li>
                <li>
                  <a href="#servers" className="hover:text-[#6D28D9] transition-colors">Server 2: Vintage Telegram Sessions</a>
                </li>
                <li>
                  <a href="#servers" className="hover:text-[#6D28D9] transition-colors">Servers 3 &amp; 4: Virtual SMS OTPs</a>
                </li>
                <li>
                  <a href="#servers" className="hover:text-[#6D28D9] transition-colors">Server 5: Social Media SMM Panel</a>
                </li>
                <li>
                  <a href="#rates" className="hover:text-[#6D28D9] transition-colors">Live Rate Explorer</a>
                </li>
              </ul>
            </div>

            {/* Column 3: Official Inboxes & Support on daemonx.in (Span 3) */}
            <div className="lg:col-span-3 flex flex-col">
              <h4
                className="text-xs font-bold uppercase tracking-wider mb-3 font-mono"
                style={{ color: '#211536' }}
              >
                Official Inboxes &amp; Support
              </h4>
              <ul className="space-y-2.5 text-xs" style={{ color: '#514364' }}>
                <li>
                  <a
                    href="mailto:support@daemonx.in"
                    className="group block hover:text-[#6D28D9] transition-colors"
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-[#211536] group-hover:text-[#6D28D9]">
                      <Mail className="w-3.5 h-3.5 text-[#6D28D9]" />
                      <span>support@daemonx.in</span>
                    </div>
                    <span className="text-[11px] block pl-5" style={{ color: '#74638B' }}>
                      Customer service, order tickets &amp; refunds
                    </span>
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:contact@daemonx.in"
                    className="group block hover:text-[#6D28D9] transition-colors"
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-[#211536] group-hover:text-[#6D28D9]">
                      <Mail className="w-3.5 h-3.5 text-[#6D28D9]" />
                      <span>contact@daemonx.in</span>
                    </div>
                    <span className="text-[11px] block pl-5" style={{ color: '#74638B' }}>
                      Business inquiries, partnerships &amp; bulk orders
                    </span>
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:dev@daemonx.in"
                    className="group block hover:text-[#6D28D9] transition-colors"
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-[#211536] group-hover:text-[#6D28D9]">
                      <Mail className="w-3.5 h-3.5 text-[#6D28D9]" />
                      <span>dev@daemonx.in</span>
                    </div>
                    <span className="text-[11px] block pl-5" style={{ color: '#74638B' }}>
                      Developer API, technical support &amp; bugs
                    </span>
                  </a>
                </li>
                <li>
                  <div className="block pt-0.5">
                    <div className="flex items-center gap-1.5 font-semibold text-[#514364]">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>official@daemonx.in</span>
                    </div>
                    <span className="text-[11px] block pl-5" style={{ color: '#74638B' }}>
                      Automated transactional OTPs &amp; order receipts
                    </span>
                  </div>
                </li>
              </ul>
            </div>

            {/* Column 4: Telegram Bots & Community (Span 3) */}
            <div className="lg:col-span-3 flex flex-col">
              <h4
                className="text-xs font-bold uppercase tracking-wider mb-3 font-mono"
                style={{ color: '#211536' }}
              >
                Telegram Bots &amp; Community
              </h4>
              <ul className="space-y-2 text-xs" style={{ color: '#514364' }}>
                <li>
                  <a
                    href="https://t.me/DeamonOTPbot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-semibold transition-colors"
                    style={{ color: '#6D28D9' }}
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
                    className="inline-flex items-center gap-1.5 font-medium transition-colors text-emerald-700"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Support Bot: @patelkrish_99bot</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
                <li>
                  <div
                    className="inline-flex items-center gap-1.5 text-[11px]"
                    style={{ color: '#74638B' }}
                  >
                    <span>Instant Telegram Mini App auto-login</span>
                  </div>
                </li>
                <li>
                  <div
                    className="inline-flex items-center gap-1.5 text-[11px]"
                    style={{ color: '#74638B' }}
                  >
                    <span>Zero-fee P2P wallet balance transfers</span>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Copyright Line */}
          <div
            className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs"
            style={{ color: '#74638B' }}
          >
            <div className="flex items-center gap-2">
              <span className="font-bold" style={{ color: '#211536' }}>
                Daemon OTP
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
                className="transition-colors hover:text-[#6D28D9]"
              >
                Launch @DeamonOTPbot
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Auth Modals: Email OTP, Forgot Password, and Reset Password */}
      <OtpVerificationModal
        isOpen={isOtpModalOpen}
        email={otpEmail}
        onClose={closeOtpModal}
        onSuccess={handleOtpSuccess}
      />
      <ForgotPasswordModal
        isOpen={isForgotModalOpen}
        initialEmail={loginEmail}
        onClose={() => setIsForgotModalOpen(false)}
      />
      <ResetPasswordModal
        isOpen={isResetModalOpen}
        token={resetToken}
        onClose={() => {
          setIsResetModalOpen(false);
          if (typeof window !== 'undefined' && window.history?.replaceState) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }}
        onSuccess={() => {
          setIsResetModalOpen(false);
          setAuthMode('signin');
          setEmailAuthNotice({
            type: 'success',
            text: 'Password updated! Please log in with your new password.',
          });
          scrollToAuth('signin');
        }}
      />

      {/* Buy Login Prompt Modal */}
      {isBuyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="relative w-full max-w-md rounded-3xl border p-6 sm:p-7 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar"
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: '#E5DCF4',
              boxShadow: '0 20px 40px -8px rgba(109, 40, 217, 0.25)',
            }}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsBuyModalOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-[#74638B] hover:text-[#211536] hover:bg-[#F0E9FF] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Product Snapshot */}
            {buyModalItem && (
              <div
                className="mb-5 p-3.5 rounded-2xl border flex items-center justify-between"
                style={{
                  backgroundColor: '#F7F3FF',
                  borderColor: '#E5DCF4',
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-2xl shrink-0">{buyModalItem.flag}</span>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-[#211536] truncate block">
                      {buyModalItem.name}
                    </span>
                    <span className="text-[10px] text-[#74638B] block truncate">
                      {buyModalItem.country} · {buyModalItem.format}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0 pl-2">
                  <span className="text-sm font-black font-mono text-emerald-700">
                    ₹{buyModalItem.priceInr * buyModalItem.qty}
                  </span>
                  {buyModalItem.qty > 1 && (
                    <span className="text-[10px] text-[#74638B] block">
                      ({buyModalItem.qty}x items)
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Header */}
            <div className="text-center mb-4">
              <h3 className="text-lg font-extrabold text-[#211536]">
                {authMode === 'signin' ? 'Sign In to Buy' : 'Create Free Account'}
              </h3>
              <p className="text-xs text-[#514364] mt-1">
                {authMode === 'signin'
                  ? 'Sign in to access your wallet and complete your purchase.'
                  : 'Register with email or Google to get instant access to your numbers.'}
              </p>
            </div>

            {/* Mode Switcher Tabs */}
            <div
              className="p-1 rounded-xl flex items-center gap-1 text-xs font-semibold mb-4"
              style={{ backgroundColor: '#F0E9FF', border: '1px solid #E5DCF4' }}
            >
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signin');
                  setEmailAuthNotice(null);
                }}
                className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                  authMode === 'signin'
                    ? 'bg-white shadow-xs font-bold text-[#6D28D9]'
                    : 'text-[#74638B] hover:text-[#211536]'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setEmailAuthNotice(null);
                }}
                className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                  authMode === 'register'
                    ? 'bg-white shadow-xs font-bold text-[#6D28D9]'
                    : 'text-[#74638B] hover:text-[#211536]'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Notice Banner */}
            {emailAuthNotice && (
              <div
                className={`mb-4 p-3 rounded-xl text-xs flex items-start gap-2 border ${
                  emailAuthNotice.type === 'error'
                    ? 'bg-red-50 border-red-200 text-red-600'
                    : emailAuthNotice.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-purple-50 border-purple-200 text-purple-700'
                }`}
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{emailAuthNotice.text}</span>
              </div>
            )}

            {/* Google Sign-in */}
            <div className="flex flex-col items-center justify-center my-2">
              <div ref={modalGoogleBtnRef} className="flex justify-center w-full min-h-[44px]" />
            </div>

            <div className="relative my-4 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#E5DCF4]" />
              </div>
              <span className="relative bg-white px-3 text-[11px] font-mono uppercase text-[#74638B]">
                Or with Email
              </span>
            </div>

            {/* Sign-in Form */}
            {authMode === 'signin' ? (
              <form onSubmit={handleEmailLoginSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#211536] mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#74638B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#E5DCF4] bg-[#FDFBFF] text-[#211536] focus:border-[#6D28D9] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-[#211536]">Password</label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsBuyModalOpen(false);
                        setIsForgotModalOpen(true);
                      }}
                      className="text-[11px] font-medium text-[#6D28D9] hover:underline cursor-pointer"
                    >
                      Forgot?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#74638B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-9 py-2 text-xs rounded-xl border border-[#E5DCF4] bg-[#FDFBFF] text-[#211536] focus:border-[#6D28D9] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#74638B] cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingEmail}
                  className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-[#6D28D9] hover:bg-[#542C85] transition-all cursor-pointer shadow-md disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
                >
                  {isSubmittingEmail ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ArrowRight className="w-3.5 h-3.5" />
                  )}
                  <span>Sign In &amp; Continue</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleEmailRegisterSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#211536] mb-1">Username</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#74638B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                      placeholder="Choose a username"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#E5DCF4] bg-[#FDFBFF] text-[#211536] focus:border-[#6D28D9] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#211536] mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#74638B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#E5DCF4] bg-[#FDFBFF] text-[#211536] focus:border-[#6D28D9] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#211536] mb-1">Create Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#74638B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="w-full pl-9 pr-9 py-2 text-xs rounded-xl border border-[#E5DCF4] bg-[#FDFBFF] text-[#211536] focus:border-[#6D28D9] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#74638B] cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#211536] mb-1">
                    WhatsApp Number <span className="text-[10px] text-[#74638B] font-normal">(Optional)</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-[#74638B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="tel"
                      value={regWhatsapp}
                      onChange={(e) => setRegWhatsapp(e.target.value)}
                      placeholder="+91 9876543210"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#E5DCF4] bg-[#FDFBFF] text-[#211536] focus:border-[#6D28D9] focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingEmail}
                  className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-[#6D28D9] hover:bg-[#542C85] transition-all cursor-pointer shadow-md disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
                >
                  {isSubmittingEmail ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>Create Account &amp; Verify Email</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
