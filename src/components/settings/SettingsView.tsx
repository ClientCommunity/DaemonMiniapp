import React, { useState, useEffect } from 'react';
import {
  Shield,
  Key,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Check,
  Smartphone,
  Code,
  CheckCircle2,
  RefreshCw,
  Sun,
  Moon,
  ArrowLeft,
  Sliders,
  ArrowLeftRight,
  Globe,
  ExternalLink,
  Sparkles,
  Zap,
  Terminal,
  Clock,
  Mail,
  Send,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { webAuthApi, WebSettingsResponse } from '../../api/endpoints';
import { isTelegramWebApp } from '../../api/client';

export const SettingsView: React.FC = () => {
  const {
    user,
    addToast,
    formatPrice,
    refreshUser,
    theme,
    toggleTheme,
    currency,
    toggleCurrency,
    setActiveTab: setGlobalActiveTab,
  } = useApp();

  const isLight = theme === 'light';

  const [activeSubTab, setActiveSubTab] = useState<'telegram' | 'developer' | 'security' | 'profile' | 'preferences'>('telegram');

  // Profile data from backend
  const [settingsData, setSettingsData] = useState<WebSettingsResponse | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Telegram account connection state (Website view)
  const [telegramIdInput, setTelegramIdInput] = useState('');
  const [telegramOtpInput, setTelegramOtpInput] = useState('');
  const [telegramOtpSent, setTelegramOtpSent] = useState(false);
  const [isSendingTgOtp, setIsSendingTgOtp] = useState(false);
  const [isLinkingTg, setIsLinkingTg] = useState(false);
  const [tgNotice, setTgNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Mini App 3-Option Backup & Merge states
  const [isGeneratingMergeLink, setIsGeneratingMergeLink] = useState(false);
  const [generatedMergeUrl, setGeneratedMergeUrl] = useState<string | null>(null);

  const [pendingBackupEmail, setPendingBackupEmail] = useState<string | null>(null);
  const [backupEmailInput, setBackupEmailInput] = useState('');
  const [backupOtpInput, setBackupOtpInput] = useState('');
  const [backupOtpSent, setBackupOtpSent] = useState(false);
  const [isSendingBackupOtp, setIsSendingBackupOtp] = useState(false);
  const [isVerifyingBackupOtp, setIsVerifyingBackupOtp] = useState(false);
  const [backupNotice, setBackupNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isEditingBackupEmail, setIsEditingBackupEmail] = useState(false);

  const [copiedId, setCopiedId] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    setIsLoadingSettings(true);
    webAuthApi
      .getSettings()
      .then((res) => {
        if (res.success) setSettingsData(res);
      })
      .catch(() => {})
      .finally(() => setIsLoadingSettings(false));

    if (isTelegramWebApp()) {
      webAuthApi
        .getTelegramBackupStatus()
        .then((res) => {
          if (res.success) {
            if (res.pending_backup_email) {
              setPendingBackupEmail(res.pending_backup_email);
            }
            if (res.account_link) {
              setSettingsData((prev) => ({
                ...(prev || ({} as any)),
                account_link: res.account_link,
              }));
            }
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleCopyLink = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedLink(true);
    addToast('Link copied to clipboard!', 'info', 'Copied');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleGenerate1ClickLink = async () => {
    setIsGeneratingMergeLink(true);
    try {
      const res = await webAuthApi.generateTelegramMergeToken();
      if (res.success && res.merge_url) {
        setGeneratedMergeUrl(res.merge_url);
        addToast('Fast Connect link created! Opening browser...', 'info', 'Fast Connect');
        if (window.Telegram?.WebApp?.openLink) {
          window.Telegram.WebApp.openLink(res.merge_url);
        } else {
          window.open(res.merge_url, '_blank');
        }
      } else {
        addToast(res.error || 'Failed to generate fast connect link.', 'error', 'Error');
      }
    } catch (err: unknown) {
      const errMsg = (err as any)?.response?.data?.error || (err as any)?.message || 'Network error generating merge link.';
      addToast(errMsg, 'error', 'Error');
    } finally {
      setIsGeneratingMergeLink(false);
    }
  };

  const handleRequestBackupOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = backupEmailInput.trim().toLowerCase();
    if (!clean || !clean.includes('@')) {
      setBackupNotice({ type: 'error', text: 'Please enter a valid email address.' });
      return;
    }
    setIsSendingBackupOtp(true);
    setBackupNotice(null);
    try {
      const res = await webAuthApi.requestTelegramBackupEmailOtp(clean);
      if (res.success) {
        setBackupOtpSent(true);
        setBackupNotice({
          type: 'success',
          text: `Verification code sent to ${clean}. Please check your inbox.`,
        });
      } else {
        setBackupNotice({ type: 'error', text: res.error || 'Failed to send verification code.' });
      }
    } catch (err: unknown) {
      const errMsg = (err as any)?.response?.data?.error || (err as any)?.message || 'Network error requesting verification code.';
      setBackupNotice({ type: 'error', text: errMsg });
    } finally {
      setIsSendingBackupOtp(false);
    }
  };

  const handleVerifyBackupOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = backupEmailInput.trim().toLowerCase();
    const cleanOtp = backupOtpInput.trim();
    if (cleanOtp.length !== 6) {
      setBackupNotice({ type: 'error', text: 'Please enter the 6-digit verification code.' });
      return;
    }
    setIsVerifyingBackupOtp(true);
    setBackupNotice(null);
    try {
      const res = await webAuthApi.verifyTelegramBackupEmailOtp({
        email: cleanEmail,
        otp_code: cleanOtp,
      });
      if (res.success) {
        if (res.merged_now) {
          setBackupNotice({
            type: 'success',
            text: 'Matched with existing website account! Your balances and orders are now combined across both platforms.',
          });
          addToast('Accounts combined successfully!', 'success', 'Merged');
          refreshUser().catch(() => {});
          webAuthApi
            .getSettings()
            .then((sRes) => {
              if (sRes.success) setSettingsData(sRes);
            })
            .catch(() => {});
        } else {
          setPendingBackupEmail(cleanEmail);
          setBackupOtpSent(false);
          setBackupEmailInput('');
          setBackupOtpInput('');
          setIsEditingBackupEmail(false);
          setBackupNotice({
            type: 'success',
            text:
              res.message ||
              'Email verified & backed up! Whenever you create or login to an account on daemonx.in with this email, your account will be automatically linked.',
          });
          addToast('Backup email verified and saved!', 'success', 'Backed Up');
        }
      } else {
        setBackupNotice({ type: 'error', text: res.error || 'Failed to verify backup code.' });
      }
    } catch (err: unknown) {
      const errMsg = (err as any)?.response?.data?.error || (err as any)?.message || 'Network error verifying backup code.';
      setBackupNotice({ type: 'error', text: errMsg });
    } finally {
      setIsVerifyingBackupOtp(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(true);
    addToast('Copied to clipboard!', 'info', 'Copied');
    setTimeout(() => setCopiedId(false), 2000);
  };

  const hasPassword = settingsData?.has_password ?? true;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasPassword && !currentPassword) {
      setPasswordNotice({ type: 'error', text: 'Current password is required.' });
      return;
    }
    if (!newPassword) {
      setPasswordNotice({ type: 'error', text: 'New password is required.' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordNotice({ type: 'error', text: 'New password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordNotice({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    setIsChangingPassword(true);
    setPasswordNotice(null);

    try {
      const res = await webAuthApi.changePassword({
        current_password: hasPassword ? currentPassword : '',
        new_password: newPassword,
      });
      if (res.success) {
        setPasswordNotice({
          type: 'success',
          text: hasPassword
            ? 'Password updated successfully!'
            : 'Password set successfully! You can now also log in using your email and password.',
        });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        if (settingsData) {
          setSettingsData({ ...settingsData, has_password: true });
        }
      } else {
        setPasswordNotice({ type: 'error', text: res.error || 'Failed to change password.' });
      }
    } catch (err: unknown) {
      const errMsg = (err as any)?.response?.data?.error || (err as any)?.message || 'Network error. Please try again.';
      setPasswordNotice({ type: 'error', text: errMsg });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSendTelegramOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = telegramIdInput.trim();
    if (!cleanId || !/^\d+$/.test(cleanId)) {
      setTgNotice({ type: 'error', text: 'Please enter a valid numeric Telegram User ID.' });
      return;
    }
    if (cleanId === user.telegramId) {
      setTgNotice({ type: 'error', text: 'Cannot link an account to itself.' });
      return;
    }
    if (cleanId.length > 12) {
      setTgNotice({
        type: 'error',
        text: 'That is a 14-digit Website ID. Please enter your 9-10 digit Telegram User ID from @DeamonOTPbot.',
      });
      return;
    }

    setIsSendingTgOtp(true);
    setTgNotice(null);

    try {
      const res = await webAuthApi.requestTelegramLinkOtp(cleanId);
      if (res.success) {
        setTelegramOtpSent(true);
        setTgNotice({
          type: 'success',
          text: res.message || `A 6-digit verification code has been dispatched to Telegram ID ${cleanId} via @DeamonOTPbot. Check your Telegram chat!`,
        });
      } else {
        setTgNotice({
          type: 'error',
          text: res.error || 'Failed to send verification code to Telegram.',
        });
      }
    } catch (err: unknown) {
      const errMsg = (err as any)?.response?.data?.error || (err as any)?.message || 'Network error. Please try again.';
      setTgNotice({ type: 'error', text: errMsg });
    } finally {
      setIsSendingTgOtp(false);
    }
  };

  const handleVerifyTelegramLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = telegramIdInput.trim();
    const cleanOtp = telegramOtpInput.trim();
    if (cleanOtp.length !== 6) {
      setTgNotice({ type: 'error', text: 'Please enter the 6-digit code sent to your Telegram bot.' });
      return;
    }

    setIsLinkingTg(true);
    setTgNotice(null);

    try {
      const res = await webAuthApi.verifyTelegramLink({
        telegram_user_id: cleanId,
        otp_code: cleanOtp,
      });
      if (res.success) {
        setTgNotice({
          type: 'success',
          text: res.message || 'Telegram Account Linked! Balances and order history are now combined across both platforms.',
        });
        addToast('Telegram account linked successfully!', 'success', 'Linked');
        webAuthApi.getSettings().then((sRes) => {
          if (sRes.success) setSettingsData(sRes);
        }).catch(() => {});
        refreshUser().catch(() => {});
      } else {
        setTgNotice({
          type: 'error',
          text: res.error || 'Failed to link account. Please check the code.',
        });
      }
    } catch (err: unknown) {
      const errMsg = (err as any)?.response?.data?.error || (err as any)?.message || 'Network error during linking verification.';
      setTgNotice({ type: 'error', text: errMsg });
    } finally {
      setIsLinkingTg(false);
    }
  };

  const isTg = isTelegramWebApp();
  const isLinked = Boolean(settingsData?.account_link);

  // If in Telegram and not linked to website, ensure security sub-tab cannot be active
  useEffect(() => {
    if (isTg && !isLinked && activeSubTab === 'security') {
      setActiveSubTab('telegram');
    }
  }, [isTg, isLinked, activeSubTab]);

  type SubTab = 'telegram' | 'developer' | 'security' | 'profile' | 'preferences';

  const navItems: { id: SubTab; label: string; icon: any; desc: string; badge?: string }[] = [
    {
      id: 'telegram',
      label: isTg ? 'Website Merge & Backup' : 'Telegram Account Sync',
      icon: isTg ? Globe : Smartphone,
      desc: isTg ? 'Merge and backup this account to website' : 'Merge bot & website balances',
    },
    {
      id: 'developer',
      label: 'Developer API',
      icon: Code,
      desc: 'REST API keys & automation webhooks',
      badge: 'Soon',
    },
    ...(!isTg || isLinked
      ? [
          {
            id: 'security' as SubTab,
            label: 'Password & Security',
            icon: Key,
            desc: 'Change password or set account key',
          },
        ]
      : []),
    {
      id: 'profile',
      label: 'Account Overview',
      icon: Shield,
      desc: 'Your ID, email & wallet credentials',
    },
    {
      id: 'preferences',
      label: 'Appearance & Currency',
      icon: Sliders,
      desc: 'Theme mode & currency formats',
    },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto py-4 px-2 sm:px-4">
      {/* Top Breadcrumb Navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setGlobalActiveTab(isTg ? 'profile' : 'store')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            isLight
              ? 'bg-white hover:bg-violet-50 text-[#514364] border border-[#E5DCF4] shadow-sm'
              : 'bg-[#181820] hover:bg-[#20202c] text-zinc-300 border border-[#262635]'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{isTg ? 'Back to Account' : 'Back to Storefront'}</span>
        </button>

        <div className="flex items-center gap-2">
          <span className={`text-xs ${isLight ? 'text-[#74638B]' : 'text-zinc-500'}`}>
            Account Status:
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Active &amp; Verified
          </span>
        </div>
      </div>

      {/* Main Settings Title */}
      <div className="mb-6">
        <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${isLight ? 'text-[#211536]' : 'text-white'}`}>
          Account Settings
        </h1>
        <p className={`text-xs sm:text-sm mt-1 ${isLight ? 'text-[#74638B]' : 'text-zinc-400'}`}>
          Manage your credentials, Telegram bot integration, security credentials, and platform preferences.
        </p>
      </div>

      {/* Desktop 2-Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left Navigation Sidebar (4 cols on md+) */}
        <div className="md:col-span-4 flex flex-col gap-2">
          <div
            className={`p-2 rounded-2xl border transition-all ${
              isLight
                ? 'bg-white border-[#E5DCF4] shadow-sm'
                : 'bg-[#14141b] border-[#262635]'
            }`}
          >
            <div className="flex md:flex-col gap-1 overflow-x-auto no-scrollbar py-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSubTab === item.id;
                const hasBadge = 'badge' in item && Boolean(item.badge);
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSubTab(item.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl text-left transition-all shrink-0 md:w-full ${
                      isActive
                        ? 'bg-[#7C3AED] text-white shadow-md shadow-[#7C3AED]/30 font-bold'
                        : isLight
                        ? 'text-[#514364] hover:bg-[#FAF8FF] hover:text-[#211536]'
                        : 'text-zinc-400 hover:text-white hover:bg-[#1a1a24]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <div className="min-w-0 hidden sm:block md:block flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold leading-tight truncate">{item.label}</span>
                        {hasBadge && (
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                              isActive
                                ? 'bg-amber-400 text-black font-extrabold shadow-sm'
                                : 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <div className={`text-[10px] leading-tight truncate mt-0.5 ${isActive ? 'text-white/80' : isLight ? 'text-[#74638B]' : 'text-zinc-500'}`}>
                        {item.desc}
                      </div>
                    </div>
                    <span className="sm:hidden text-xs font-semibold flex items-center gap-1.5">
                      <span>{item.label}</span>
                      {hasBadge && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                            isActive
                              ? 'bg-amber-400 text-black font-extrabold'
                              : 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Content Panel (8 cols on md+) */}
        <div className="md:col-span-8">
          <div
            className={`p-6 sm:p-8 rounded-3xl border transition-all ${
              isLight
                ? 'bg-white border-[#E5DCF4] shadow-md shadow-violet-500/5'
                : 'bg-[#14141b] border-[#262635]'
            }`}
          >
            {/* TAB 1: PROFILE DETAILS */}
            {activeSubTab === 'profile' && (
              isLoadingSettings ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-3">
                  <RefreshCw className="w-7 h-7 animate-spin text-[#7C3AED]" />
                  <span className={`text-xs ${isLight ? 'text-[#74638B]' : 'text-zinc-400'}`}>Loading profile settings...</span>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <h3 className={`text-base font-bold ${isLight ? 'text-[#211536]' : 'text-white'}`}>
                      Profile Overview
                    </h3>
                    <p className={`text-xs mt-0.5 ${isLight ? 'text-[#74638B]' : 'text-zinc-400'}`}>
                      Your official account identifier and connected contact channels.
                    </p>
                  </div>

                  {/* Account ID Banner */}
                  <div
                    className={`p-4 rounded-2xl border flex items-center justify-between ${
                      isLight ? 'bg-[#FAF8FF] border-[#E5DCF4]' : 'bg-[#1a1a24] border-[#2a2a38]'
                    }`}
                  >
                    <div>
                      <span className={`text-[11px] uppercase font-mono tracking-wider ${isLight ? 'text-[#74638B]' : 'text-zinc-400'}`}>
                        Platform Account ID
                      </span>
                      <div className={`text-base font-bold font-mono mt-0.5 ${isLight ? 'text-[#211536]' : 'text-white'}`}>
                        {user.telegramId || 'N/A'}
                      </div>
                    </div>
                    <button
                      onClick={() => handleCopy(user.telegramId)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                        isLight
                          ? 'bg-white hover:bg-violet-50 text-[#7C3AED] border border-[#E5DCF4] shadow-sm'
                          : 'bg-[#242432] hover:bg-[#2c2c3e] text-zinc-300'
                      }`}
                    >
                      {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedId ? 'Copied' : 'Copy ID'}</span>
                    </button>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className={`p-4 rounded-2xl border ${isLight ? 'bg-[#FAF8FF] border-[#E5DCF4]' : 'bg-[#1a1a24] border-[#2a2a38]'}`}>
                      <span className={`text-[11px] uppercase font-mono ${isLight ? 'text-[#74638B]' : 'text-zinc-400'}`}>
                        Email Address
                      </span>
                      <div className={`text-sm font-semibold mt-1 flex items-center gap-1.5 truncate ${isLight ? 'text-[#211536]' : 'text-white'}`}>
                        <span className="truncate">{settingsData?.email || user.email || 'None registered'}</span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      </div>
                    </div>

                    <div className={`p-4 rounded-2xl border ${isLight ? 'bg-[#FAF8FF] border-[#E5DCF4]' : 'bg-[#1a1a24] border-[#2a2a38]'}`}>
                      <span className={`text-[11px] uppercase font-mono ${isLight ? 'text-[#74638B]' : 'text-zinc-400'}`}>
                        WhatsApp Number
                      </span>
                      <div className={`text-sm font-semibold mt-1 ${isLight ? 'text-[#211536]' : 'text-white'}`}>
                        {settingsData?.whatsapp_number || 'Not provided'}
                      </div>
                    </div>
                  </div>

                  {/* Balance Summary Card */}
                  <div
                    className={`p-5 rounded-2xl border flex items-center justify-between ${
                      isLight ? 'bg-[#FAF8FF] border-[#E5DCF4]' : 'bg-[#1a1a24] border-[#2a2a38]'
                    }`}
                  >
                    <div>
                      <span className={`text-[11px] uppercase font-mono ${isLight ? 'text-[#74638B]' : 'text-zinc-400'}`}>
                        Available Wallet Balance
                      </span>
                      <div className="text-xl font-extrabold text-emerald-500 mt-0.5">
                        {formatPrice(user.balance)}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-[11px] uppercase font-mono ${isLight ? 'text-[#74638B]' : 'text-zinc-400'}`}>
                        Promo / Locked
                      </span>
                      <div className="text-base font-bold text-amber-500 mt-0.5">
                        {formatPrice(user.promoBalance)}
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}

            {/* TAB 2: CHANGE PASSWORD */}
            {activeSubTab === 'security' && (
              <form onSubmit={handleChangePassword} className="space-y-5">
                <div>
                  <h3 className={`text-base font-bold ${isLight ? 'text-[#211536]' : 'text-white'}`}>
                    Password &amp; Authentication
                  </h3>
                  <p className={`text-xs mt-0.5 ${isLight ? 'text-[#74638B]' : 'text-zinc-400'}`}>
                    {hasPassword
                      ? 'Update your account password. Choose a strong combination of at least 6 characters.'
                      : 'Create a password for your account so you can also log in directly using your email and password.'}
                  </p>
                </div>

                {passwordNotice && (
                  <div
                    className={`p-3.5 rounded-2xl text-xs font-semibold ${
                      passwordNotice.type === 'success'
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600'
                        : 'bg-rose-500/10 border border-rose-500/30 text-rose-600'
                    }`}
                  >
                    {passwordNotice.text}
                  </div>
                )}

                {hasPassword && (
                  <div>
                    <label className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-[#211536]' : 'text-zinc-300'}`}>
                      Current Password
                    </label>
                    <div className="relative">
                      <Lock className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${isLight ? 'text-[#74638B]' : 'text-zinc-500'}`} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className={`w-full pl-10 pr-10 py-3 rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-violet-500/30 ${
                          isLight
                            ? 'bg-[#FAF8FF] border border-[#E5DCF4] text-[#211536] placeholder-[#A494B8] focus:border-[#7C3AED]'
                            : 'bg-[#1a1a24] border border-[#2a2a38] text-white placeholder-zinc-500 focus:border-violet-500'
                        }`}
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className={`absolute right-3.5 top-1/2 -translate-y-1/2 ${isLight ? 'text-[#74638B] hover:text-[#211536]' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-[#211536]' : 'text-zinc-300'}`}>
                    {hasPassword ? 'New Password' : 'Create Password'}
                  </label>
                  <div className="relative">
                    <Lock className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${isLight ? 'text-[#74638B]' : 'text-zinc-500'}`} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={`w-full pl-10 pr-4 py-3 rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-violet-500/30 ${
                        isLight
                          ? 'bg-[#FAF8FF] border border-[#E5DCF4] text-[#211536] placeholder-[#A494B8] focus:border-[#7C3AED]'
                          : 'bg-[#1a1a24] border border-[#2a2a38] text-white placeholder-zinc-500 focus:border-violet-500'
                      }`}
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-[#211536]' : 'text-zinc-300'}`}>
                    {hasPassword ? 'Confirm New Password' : 'Confirm Password'}
                  </label>
                  <div className="relative">
                    <Lock className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${isLight ? 'text-[#74638B]' : 'text-zinc-500'}`} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full pl-10 pr-4 py-3 rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-violet-500/30 ${
                        isLight
                          ? 'bg-[#FAF8FF] border border-[#E5DCF4] text-[#211536] placeholder-[#A494B8] focus:border-[#7C3AED]'
                          : 'bg-[#1a1a24] border border-[#2a2a38] text-white placeholder-zinc-500 focus:border-violet-500'
                      }`}
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isChangingPassword || !newPassword || !confirmPassword || (hasPassword && !currentPassword)}
                  className="w-full py-3.5 px-4 rounded-xl font-bold text-xs text-white bg-[#7C3AED] hover:bg-[#6D28D9] active:scale-[0.99] transition-all shadow-md shadow-[#7C3AED]/30 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isChangingPassword ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>{hasPassword ? 'Update Password' : 'Set Account Password'}</span>
                  )}
                </button>
              </form>
            )}

            {/* TAB 3: TELEGRAM BOT LINKING OR WEB BACKUP */}
            {activeSubTab === 'telegram' && (
              isTg ? (
                <div className="space-y-6">
                  <div>
                    <h3 className={`text-base font-bold ${isLight ? 'text-[#211536]' : 'text-white'}`}>
                      Merge &amp; Backup Account to Website
                    </h3>
                    <p className={`text-xs mt-0.5 ${isLight ? 'text-[#74638B]' : 'text-zinc-400'}`}>
                      Merge and backup your Telegram account to our website platform to access your balance, active OTPs, and purchase history anywhere.
                    </p>
                  </div>

                  {settingsData?.account_link ? (
                    <div className={`p-6 rounded-3xl flex flex-col items-center text-center space-y-3 ${
                      isLight ? 'bg-emerald-50/70' : 'bg-emerald-500/[0.06]'
                    }`}>
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className={`text-base font-bold ${isLight ? 'text-[#211536]' : 'text-white'}`}>
                          Account Merged with Website
                        </h4>
                        <p className={`text-xs mt-1 ${isLight ? 'text-[#74638B]' : 'text-zinc-400'}`}>
                          Connected to Telegram User ID: <span className="font-mono text-emerald-600 font-bold">{settingsData.account_link.telegram_user_id}</span>
                        </p>
                      </div>
                      <div className={`p-4 rounded-2xl text-xs text-left w-full space-y-1.5 ${
                        isLight ? 'bg-white text-[#514364] shadow-sm' : 'bg-[#14141b] text-zinc-400'
                      }`}>
                        <p>&bull; Wallet balances are merged across both website and Telegram bot.</p>
                        <p>&bull; Order history and active OTP orders are visible across both platforms in real-time.</p>
                        <p>&bull; Connected since: <span className="font-mono font-semibold">{settingsData.account_link.created_at || 'Active'}</span></p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {backupNotice && (
                        <div
                          className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
                            backupNotice.type === 'success'
                              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600'
                              : 'bg-rose-500/10 border border-rose-500/30 text-rose-600'
                          }`}
                        >
                          {backupNotice.type === 'success' ? (
                            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                          ) : (
                            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                          )}
                          <span>{backupNotice.text}</span>
                        </div>
                      )}

                      {/* OPTION 1: 1-CLICK FAST CONNECT (RECOMMENDED) */}
                      <div
                        className={`p-5 rounded-3xl border transition-all space-y-3.5 ${
                          isLight
                            ? 'bg-[#FAF8FF] border-[#E5DCF4] shadow-sm'
                            : 'bg-[#181824] border-[#2e2e40] shadow-md shadow-violet-500/5'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-[#7C3AED]/15 text-[#7C3AED] flex items-center justify-center shrink-0">
                              <Zap className="w-5 h-5 fill-[#7C3AED]" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className={`text-sm font-bold ${isLight ? 'text-[#211536]' : 'text-white'}`}>
                                  1-Click Fast Connect
                                </h4>
                                <span className="text-[9px] uppercase font-mono font-black px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                                  Fastest
                                </span>
                              </div>
                              <p className={`text-[11px] mt-0.5 ${isLight ? 'text-[#74638B]' : 'text-zinc-400'}`}>
                                Recommended for instant zero-typing account merge.
                              </p>
                            </div>
                          </div>
                        </div>

                        <p className={`text-xs leading-relaxed ${isLight ? 'text-[#514364]' : 'text-zinc-300'}`}>
                          Instantly launch <span className="font-bold text-[#7C3AED]">daemonx.in</span> in your browser with a secure single-use verification link. When you sign in or create an account, your balance and order history merge automatically.
                        </p>

                        <button
                          onClick={handleGenerate1ClickLink}
                          disabled={isGeneratingMergeLink}
                          className="w-full py-3.5 px-4 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] hover:from-[#6D28D9] hover:to-[#5B21B6] active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-md shadow-[#7C3AED]/30 cursor-pointer disabled:opacity-50"
                        >
                          {isGeneratingMergeLink ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Generating Fast Connect Link...</span>
                            </>
                          ) : (
                            <>
                              <Zap className="w-4 h-4 fill-white" />
                              <span>Connect via 1-Click Fast Link</span>
                              <ExternalLink className="w-3.5 h-3.5 ml-1" />
                            </>
                          )}
                        </button>

                        {generatedMergeUrl && (
                          <div className={`p-3 rounded-2xl border text-xs flex items-center justify-between gap-2 ${
                            isLight ? 'bg-white border-[#E5DCF4]' : 'bg-[#121218] border-[#262635]'
                          }`}>
                            <span className={`text-[11px] truncate font-mono ${isLight ? 'text-[#74638B]' : 'text-zinc-400'}`}>
                              Link active (valid 15m)
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleCopyLink(generatedMergeUrl)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 ${
                                  isLight ? 'bg-violet-50 text-[#7C3AED]' : 'bg-[#222230] text-zinc-300'
                                }`}
                              >
                                {copiedLink ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                              </button>
                              <a
                                href={generatedMergeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => {
                                  if (window.Telegram?.WebApp?.openLink) {
                                    e.preventDefault();
                                    window.Telegram.WebApp.openLink(generatedMergeUrl);
                                  }
                                }}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#7C3AED] text-white flex items-center gap-1"
                              >
                                <span>Open</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* OPTION 2: BACKUP WITH EMAIL (ASYNC / FUTURE MERGE) */}
                      <div
                        className={`p-5 rounded-3xl border transition-all space-y-3.5 ${
                          isLight
                            ? 'bg-[#FAF8FF] border-[#E5DCF4] shadow-sm'
                            : 'bg-[#181824] border-[#2e2e40] shadow-md shadow-violet-500/5'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
                              <Mail className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className={`text-sm font-bold ${isLight ? 'text-[#211536]' : 'text-white'}`}>
                                  Backup with Email
                                </h4>
                                <span className="text-[9px] uppercase font-mono font-black px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
                                  Safe for Future
                                </span>
                              </div>
                              <p className={`text-[11px] mt-0.5 ${isLight ? 'text-[#74638B]' : 'text-zinc-400'}`}>
                                Save your email now. Merge automatically whenever you create a website account.
                              </p>
                            </div>
                          </div>
                        </div>

                        {pendingBackupEmail && !isEditingBackupEmail ? (
                          <div className={`p-4 rounded-2xl border space-y-2.5 ${
                            isLight ? 'bg-white border-emerald-500/30' : 'bg-[#121218] border-emerald-500/30'
                          }`}>
                            <div className="flex items-center justify-between">
                              <span className={`text-[11px] uppercase font-mono font-semibold ${isLight ? 'text-[#74638B]' : 'text-zinc-400'}`}>
                                Registered Backup Email
                              </span>
                              <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                Verified &amp; Protected
                              </span>
                            </div>
                            <div className={`text-sm font-bold font-mono ${isLight ? 'text-[#211536]' : 'text-white'}`}>
                              {pendingBackupEmail}
                            </div>
                            <p className={`text-[11px] leading-relaxed ${isLight ? 'text-[#74638B]' : 'text-zinc-400'}`}>
                              Your account is safe. Whenever you visit <span className="font-bold">daemonx.in</span> and log in or register with this email, your balances and orders will link automatically.
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setIsEditingBackupEmail(true);
                                setBackupEmailInput(pendingBackupEmail);
                                setBackupOtpSent(false);
                              }}
                              className={`text-xs font-semibold ${isLight ? 'text-[#7C3AED] hover:underline' : 'text-violet-400 hover:underline'}`}
                            >
                              Change Backup Email &rarr;
                            </button>
                          </div>
                        ) : !backupOtpSent ? (
                          <form onSubmit={handleRequestBackupOtp} className="space-y-3">
                            <div>
                              <label className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-[#211536]' : 'text-zinc-300'}`}>
                                Enter Your Email Address
                              </label>
                              <div className="relative">
                                <Mail className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${isLight ? 'text-[#74638B]' : 'text-zinc-500'}`} />
                                <input
                                  type="email"
                                  required
                                  value={backupEmailInput}
                                  onChange={(e) => setBackupEmailInput(e.target.value)}
                                  placeholder="name@gmail.com"
                                  className={`w-full pl-10 pr-4 py-3 rounded-xl text-xs transition-all focus:outline-none focus:ring-2 focus:ring-violet-500/30 ${
                                    isLight
                                      ? 'bg-white border border-[#E5DCF4] text-[#211536] placeholder-[#A494B8] focus:border-[#7C3AED]'
                                      : 'bg-[#121218] border border-[#2e2e40] text-white placeholder-zinc-500 focus:border-violet-500'
                                  }`}
                                />
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="submit"
                                disabled={isSendingBackupOtp || !backupEmailInput.trim()}
                                className="flex-1 py-3 px-4 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-600/30 cursor-pointer disabled:opacity-50"
                              >
                                {isSendingBackupOtp ? (
                                  <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    <span>Sending Code...</span>
                                  </>
                                ) : (
                                  <>
                                    <Send className="w-3.5 h-3.5" />
                                    <span>Send 6-Digit Verification Code</span>
                                  </>
                                )}
                              </button>
                              {pendingBackupEmail && (
                                <button
                                  type="button"
                                  onClick={() => setIsEditingBackupEmail(false)}
                                  className={`py-3 px-3 rounded-xl text-xs font-semibold ${
                                    isLight ? 'text-[#514364] bg-white border border-[#E5DCF4]' : 'text-zinc-400 bg-[#1f1f2b]'
                                  }`}
                                >
                                  Cancel
                                </button>
                              )}
                            </div>
                          </form>
                        ) : (
                          <form onSubmit={handleVerifyBackupOtp} className="space-y-3">
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <label className={`block text-xs font-semibold ${isLight ? 'text-[#211536]' : 'text-zinc-300'}`}>
                                  Enter 6-Digit Email Code
                                </label>
                                <span className={`text-[11px] font-mono ${isLight ? 'text-[#74638B]' : 'text-zinc-400'}`}>
                                  Sent to {backupEmailInput}
                                </span>
                              </div>
                              <input
                                type="text"
                                maxLength={6}
                                required
                                value={backupOtpInput}
                                onChange={(e) => setBackupOtpInput(e.target.value.replace(/\D/g, ''))}
                                placeholder="••••••"
                                className={`w-full px-4 py-3 rounded-xl text-center text-lg font-bold font-mono tracking-widest transition-all focus:outline-none focus:ring-2 focus:ring-violet-500/30 ${
                                  isLight
                                    ? 'bg-white border border-[#E5DCF4] text-[#211536] placeholder-[#A494B8] focus:border-[#7C3AED]'
                                    : 'bg-[#121218] border border-[#2e2e40] text-white placeholder-zinc-600 focus:border-violet-500'
                                }`}
                              />
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="submit"
                                disabled={isVerifyingBackupOtp || backupOtpInput.length !== 6}
                                className="flex-1 py-3 px-4 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-600/30 cursor-pointer disabled:opacity-50"
                              >
                                {isVerifyingBackupOtp ? (
                                  <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    <span>Verifying...</span>
                                  </>
                                ) : (
                                  <>
                                    <Check className="w-4 h-4" />
                                    <span>Verify &amp; Save Backup Email</span>
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setBackupOtpSent(false);
                                  setBackupOtpInput('');
                                }}
                                className={`py-3 px-3 rounded-xl text-xs font-semibold ${
                                  isLight ? 'text-[#514364] bg-white border border-[#E5DCF4]' : 'text-zinc-400 bg-[#1f1f2b]'
                                }`}
                              >
                                Change
                              </button>
                            </div>
                          </form>
                        )}
                      </div>

                      {/* OPTION 3: MANUAL TELEGRAM ID (ADVANCED FALLBACK) */}
                      <div
                        className={`p-5 rounded-3xl border transition-all space-y-3.5 ${
                          isLight
                            ? 'bg-[#FAF8FF] border-[#E5DCF4] shadow-sm'
                            : 'bg-[#181824] border-[#2e2e40] shadow-md shadow-violet-500/5'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
                              <Key className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className={`text-sm font-bold ${isLight ? 'text-[#211536]' : 'text-white'}`}>
                                  Manual Connect
                                </h4>
                                <span className="text-[9px] uppercase font-mono font-black px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30">
                                  Manual ID
                                </span>
                              </div>
                              <p className={`text-[11px] mt-0.5 ${isLight ? 'text-[#74638B]' : 'text-zinc-400'}`}>
                                Copy your numeric ID and enter it manually on the website.
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* ID Copy Card */}
                        <div
                          className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                            isLight ? 'bg-white border-[#E5DCF4]' : 'bg-[#121218] border-[#262635]'
                          }`}
                        >
                          <div>
                            <span className={`text-[10px] uppercase font-mono tracking-wider ${isLight ? 'text-[#74638B]' : 'text-zinc-500'}`}>
                              Your Telegram Numeric ID
                            </span>
                            <div className={`text-sm font-bold font-mono mt-0.5 ${isLight ? 'text-[#211536]' : 'text-white'}`}>
                              {user.telegramId || user.id}
                            </div>
                          </div>
                          <button
                            onClick={() => handleCopy(String(user.telegramId || user.id))}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                              isLight
                                ? 'bg-violet-50 hover:bg-violet-100 text-[#7C3AED] border border-[#E5DCF4]'
                                : 'bg-[#222230] hover:bg-[#2c2c3e] text-zinc-300'
                            }`}
                          >
                            {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedId ? 'Copied' : 'Copy ID'}</span>
                          </button>
                        </div>

                        <div className={`p-3.5 rounded-2xl border text-xs text-left w-full space-y-1.5 ${
                          isLight ? 'bg-white border-[#E5DCF4] text-[#514364]' : 'bg-[#121218] border-[#262635] text-zinc-400'
                        }`}>
                          <p className="font-semibold text-[11px] text-violet-400">Manual steps:</p>
                          <p>1. Open <span className="font-bold">daemonx.in</span> in any browser.</p>
                          <p>2. Log in or create a website account.</p>
                          <p>3. Go to <span className="font-bold">Settings &rarr; Telegram Account</span> and paste your ID (<span className="font-mono font-bold text-violet-400">{user.telegramId || user.id}</span>).</p>
                        </div>

                        <a
                          href="https://daemonx.in"
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            if (window.Telegram?.WebApp?.openLink) {
                              e.preventDefault();
                              window.Telegram.WebApp.openLink('https://daemonx.in');
                            }
                          }}
                          className={`w-full py-3 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                            isLight
                              ? 'bg-white hover:bg-violet-50 text-[#514364] border border-[#E5DCF4]'
                              : 'bg-[#20202c] hover:bg-[#282838] text-zinc-300 border border-[#2e2e40]'
                          }`}
                        >
                          <Globe className="w-4 h-4" />
                          <span>Open daemonx.in in Browser</span>
                          <ExternalLink className="w-3.5 h-3.5 ml-1" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <h3 className={`text-base font-bold ${isLight ? 'text-[#211536]' : 'text-white'}`}>
                      Telegram Bot Integration
                    </h3>
                    <p className={`text-xs mt-0.5 ${isLight ? 'text-[#74638B]' : 'text-zinc-400'}`}>
                      Link your Telegram Bot account with this website account to merge your wallet balance and order history.
                    </p>
                  </div>

                  {tgNotice && (
                    <div
                      className={`p-3.5 rounded-2xl text-xs font-semibold ${
                        tgNotice.type === 'success'
                          ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600'
                          : 'bg-rose-500/10 border border-rose-500/30 text-rose-600'
                      }`}
                    >
                      {tgNotice.text}
                    </div>
                  )}

                  {settingsData?.account_link ? (
                    <div className={`p-6 rounded-3xl border flex flex-col items-center text-center space-y-3 ${
                      isLight ? 'bg-[#FAF8FF] border-emerald-500/30' : 'bg-[#1a1a24] border-emerald-500/30'
                    }`}>
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className={`text-base font-bold ${isLight ? 'text-[#211536]' : 'text-white'}`}>
                          Accounts Linked &amp; Synchronized
                        </h4>
                        <p className={`text-xs mt-1 ${isLight ? 'text-[#74638B]' : 'text-zinc-400'}`}>
                          Connected to Telegram User ID: <span className="font-mono text-emerald-600 font-bold">{settingsData.account_link.telegram_user_id}</span>
                        </p>
                      </div>
                      <div className={`p-4 rounded-2xl border text-xs text-left w-full space-y-1.5 ${
                        isLight ? 'bg-white border-[#E5DCF4] text-[#514364]' : 'bg-[#14141b] border-[#2a2a38] text-zinc-400'
                      }`}>
                        <p>&bull; Wallet balances are merged across both website and Telegram bot.</p>
                        <p>&bull; Order history and active OTP orders are visible across both platforms in real-time.</p>
                        <p>&bull; Connected since: <span className="font-mono font-semibold">{settingsData.account_link.created_at || 'Active'}</span></p>
                      </div>
                    </div>
                  ) : !telegramOtpSent ? (
                    <form onSubmit={handleSendTelegramOtp} className="space-y-4">
                      <div>
                        <label className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-[#211536]' : 'text-zinc-300'}`}>
                          Your Telegram Numeric User ID
                        </label>
                        <input
                          type="text"
                          required
                          value={telegramIdInput}
                          onChange={(e) => setTelegramIdInput(e.target.value)}
                          placeholder="e.g. 7507183871"
                          className={`w-full px-4 py-3 rounded-xl text-sm font-mono transition-all focus:outline-none focus:ring-2 focus:ring-violet-500/30 ${
                            isLight
                              ? 'bg-[#FAF8FF] border border-[#E5DCF4] text-[#211536] placeholder-[#A494B8] focus:border-[#7C3AED]'
                              : 'bg-[#1a1a24] border border-[#2a2a38] text-white placeholder-zinc-500 focus:border-violet-500'
                          }`}
                        />
                        <p className={`text-[11px] mt-1.5 ${isLight ? 'text-[#74638B]' : 'text-zinc-500'}`}>
                          Our bot will send a private 6-digit confirmation code directly to your Telegram chat to verify account ownership.
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={isSendingTgOtp || !telegramIdInput.trim()}
                        className="w-full py-3.5 px-4 rounded-xl font-bold text-xs text-white bg-[#7C3AED] hover:bg-[#6D28D9] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-md shadow-[#7C3AED]/30"
                      >
                        {isSendingTgOtp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Send Telegram Verification Code</span>}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyTelegramLink} className="space-y-4">
                      <div>
                        <label className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-[#211536]' : 'text-zinc-300'}`}>
                          Enter 6-Digit Telegram Bot Code
                        </label>
                        <input
                          type="text"
                          maxLength={6}
                          required
                          value={telegramOtpInput}
                          onChange={(e) => setTelegramOtpInput(e.target.value.replace(/\D/g, ''))}
                          placeholder="••••••"
                          className={`w-full px-4 py-3 rounded-xl text-center text-xl font-bold font-mono tracking-widest transition-all focus:outline-none focus:ring-2 focus:ring-violet-500/30 ${
                            isLight
                              ? 'bg-[#FAF8FF] border border-[#E5DCF4] text-[#211536] placeholder-[#A494B8] focus:border-[#7C3AED]'
                              : 'bg-[#1a1a24] border border-[#2a2a38] text-white placeholder-zinc-600 focus:border-violet-500'
                          }`}
                        />
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="submit"
                          disabled={isLinkingTg || telegramOtpInput.length !== 6}
                          className="flex-1 py-3.5 px-4 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-md shadow-emerald-600/30"
                        >
                          {isLinkingTg ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Verify &amp; Link Accounts</span>}
                        </button>
                        <button
                          type="button"
                          onClick={() => setTelegramOtpSent(false)}
                          className={`py-3.5 px-4 rounded-xl font-semibold text-xs transition-colors ${
                            isLight
                              ? 'bg-white hover:bg-violet-50 text-[#514364] border border-[#E5DCF4]'
                              : 'bg-[#1f1f2b] hover:bg-[#262635] text-zinc-300 border border-[#2a2a38]'
                          }`}
                        >
                          Change ID
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )
            )}

            {/* TAB 4: PREFERENCES & APPEARANCE */}
            {activeSubTab === 'preferences' && (
              <div className="space-y-6">
                <div>
                  <h3 className={`text-base font-bold ${isLight ? 'text-[#211536]' : 'text-white'}`}>
                    Appearance &amp; Currency Preferences
                  </h3>
                  <p className={`text-xs mt-0.5 ${isLight ? 'text-[#74638B]' : 'text-zinc-400'}`}>
                    Customize your display theme and financial units.
                  </p>
                </div>

                {/* Theme Selector */}
                <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                  isLight ? 'bg-[#FAF8FF] border-[#E5DCF4]' : 'bg-[#1a1a24] border-[#2a2a38]'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                      {isLight ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-violet-400" />}
                    </div>
                    <div>
                      <div className={`text-sm font-bold ${isLight ? 'text-[#211536]' : 'text-white'}`}>
                        Color Theme
                      </div>
                      <div className={`text-xs ${isLight ? 'text-[#74638B]' : 'text-zinc-400'}`}>
                        Currently in {isLight ? 'Lavender Dream (Light Mode)' : 'Obsidian Zinc (Dark Mode)'}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={toggleTheme}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                      isLight
                        ? 'bg-white text-[#7C3AED] border border-[#E5DCF4] hover:bg-violet-50'
                        : 'bg-[#242432] text-white border border-[#2a2a38] hover:bg-[#2c2c3e]'
                    }`}
                  >
                    Switch to {isLight ? 'Dark Mode' : 'Light Mode'}
                  </button>
                </div>

                {/* Currency Selector */}
                <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                  isLight ? 'bg-[#FAF8FF] border-[#E5DCF4]' : 'bg-[#1a1a24] border-[#2a2a38]'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold text-base">
                      {currency === 'INR' ? '₹' : '$'}
                    </div>
                    <div>
                      <div className={`text-sm font-bold ${isLight ? 'text-[#211536]' : 'text-white'}`}>
                        Base Currency Preference
                      </div>
                      <div className={`text-xs ${isLight ? 'text-[#74638B]' : 'text-zinc-400'}`}>
                        Currently displaying all prices in {currency === 'INR' ? 'Indian Rupees (₹)' : 'USDT Dollars ($)'}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={toggleCurrency}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                      isLight
                        ? 'bg-white text-[#7C3AED] border border-[#E5DCF4] hover:bg-violet-50'
                        : 'bg-[#242432] text-white border border-[#2a2a38] hover:bg-[#2c2c3e]'
                    }`}
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    <span>Switch to {currency === 'INR' ? 'USDT ($)' : 'INR (₹)'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB: DEVELOPER API (COMING SOON) */}
            {activeSubTab === 'developer' && (
              <div className="space-y-6 text-center py-4 sm:py-6">
                {/* Glowing Badge & Icon */}
                <div className="relative inline-block mx-auto">
                  <div
                    className={`w-16 h-16 sm:w-20 sm:h-20 rounded-3xl flex items-center justify-center mx-auto transition-transform hover:scale-105 ${
                      isLight
                        ? 'bg-violet-50 text-[#7C3AED] border border-[#E5DCF4] shadow-md shadow-violet-500/10'
                        : 'bg-[#1a1a24] text-violet-400 border border-[#2a2a38] shadow-lg shadow-black/40'
                    }`}
                  >
                    <Code className="w-8 h-8 sm:w-10 sm:h-10" />
                  </div>
                  <div className="absolute -bottom-2 left-1/2 -translate-y-1/2 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-black shadow-md shrink-0 whitespace-nowrap">
                    Coming Soon
                  </div>
                </div>

                <div className="space-y-2 max-w-lg mx-auto pt-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#7C3AED]/10 text-[#7C3AED] border border-[#7C3AED]/20 uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5" />
                    Developer &amp; Reseller Portal
                  </div>
                  <h3 className={`text-xl sm:text-2xl font-black tracking-tight ${isLight ? 'text-[#211536]' : 'text-white'}`}>
                    REST API &amp; Webhook Access
                  </h3>
                  <p className={`text-xs sm:text-sm leading-relaxed ${isLight ? 'text-[#74638B]' : 'text-zinc-400'}`}>
                    We are building a robust, high-speed REST API and webhook pipeline for developers and volume resellers. Integrate automated OTP receiving directly into your backend services and bots.
                  </p>
                </div>

                {/* Features in Development Preview Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl mx-auto text-left pt-1">
                  <div className={`p-4 rounded-2xl border ${isLight ? 'bg-[#FAF8FF] border-[#E5DCF4]' : 'bg-[#1a1a24] border-[#2a2a38]'}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Terminal className="w-4 h-4 text-[#7C3AED]" />
                      <span className={`text-xs font-bold ${isLight ? 'text-[#211536]' : 'text-white'}`}>REST API v1</span>
                    </div>
                    <p className={`text-[11px] leading-relaxed ${isLight ? 'text-[#74638B]' : 'text-zinc-400'}`}>
                      Order virtual numbers, fetch OTP codes, and manage rentals via HTTPS requests.
                    </p>
                  </div>

                  <div className={`p-4 rounded-2xl border ${isLight ? 'bg-[#FAF8FF] border-[#E5DCF4]' : 'bg-[#1a1a24] border-[#2a2a38]'}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <span className={`text-xs font-bold ${isLight ? 'text-[#211536]' : 'text-white'}`}>Real-Time Webhooks</span>
                    </div>
                    <p className={`text-[11px] leading-relaxed ${isLight ? 'text-[#74638B]' : 'text-zinc-400'}`}>
                      Instant HTTP callbacks pushed to your server the moment an SMS code arrives.
                    </p>
                  </div>

                  <div className={`p-4 rounded-2xl border ${isLight ? 'bg-[#FAF8FF] border-[#E5DCF4]' : 'bg-[#1a1a24] border-[#2a2a38]'}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Key className="w-4 h-4 text-emerald-500" />
                      <span className={`text-xs font-bold ${isLight ? 'text-[#211536]' : 'text-white'}`}>Scoped API Keys</span>
                    </div>
                    <p className={`text-[11px] leading-relaxed ${isLight ? 'text-[#74638B]' : 'text-zinc-400'}`}>
                      Generate and rotate API keys with rate-limiting, IP allowlisting &amp; usage limits.
                    </p>
                  </div>
                </div>

                {/* Coming Soon Notice Card */}
                <div
                  className={`p-4 rounded-2xl border max-w-xl mx-auto flex items-center justify-between gap-3 text-left ${
                    isLight ? 'bg-[#FAF8FF] border-amber-500/30' : 'bg-[#1a1a24] border-amber-500/30'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className={`text-xs font-bold truncate ${isLight ? 'text-[#211536]' : 'text-white'}`}>
                        Under Active Development
                      </div>
                      <div className={`text-[11px] truncate ${isLight ? 'text-[#74638B]' : 'text-zinc-400'}`}>
                        Sandbox environment &amp; documentation will be announced here soon.
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase font-bold font-mono px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30 shrink-0">
                    Coming Soon
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
