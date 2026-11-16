import React, { useState, useEffect } from 'react';
import {
  X,
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
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { webAuthApi, WebSettingsResponse } from '../../api/endpoints';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { user, addToast, formatPrice, refreshUser } = useApp();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'telegram' | 'developer'>('profile');

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

  // Telegram account connection state
  const [telegramIdInput, setTelegramIdInput] = useState('');
  const [telegramOtpInput, setTelegramOtpInput] = useState('');
  const [telegramOtpSent, setTelegramOtpSent] = useState(false);
  const [isSendingTgOtp, setIsSendingTgOtp] = useState(false);
  const [isLinkingTg, setIsLinkingTg] = useState(false);
  const [tgNotice, setTgNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsLoadingSettings(true);
      webAuthApi
        .getSettings()
        .then((res) => {
          if (res.success) setSettingsData(res);
        })
        .catch(() => {})
        .finally(() => setIsLoadingSettings(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

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
    } catch {
      setPasswordNotice({ type: 'error', text: 'Network error. Please try again.' });
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
    } catch {
      setTgNotice({ type: 'error', text: 'Network error. Please try again.' });
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
    } catch {
      setTgNotice({ type: 'error', text: 'Network error during linking verification.' });
    } finally {
      setIsLinkingTg(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-[#14141b] rounded-3xl border border-[#262635] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-white">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#262635] flex items-center justify-between bg-[#191924]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20 text-white">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Settings &amp; Security</h3>
              <p className="text-xs text-zinc-400">Manage account credentials, bot linking &amp; security</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-[#262635] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 px-6 pt-3 pb-2 border-b border-[#222230] overflow-x-auto bg-[#14141b]">
          {[
            { id: 'profile', label: 'Profile Details', icon: Shield },
            { id: 'security', label: 'Change Password', icon: Key },
            { id: 'telegram', label: 'Telegram Account', icon: Smartphone },
            { id: 'developer', label: 'Developer API', icon: Code },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1f1f2b]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* TAB 1: PROFILE DETAILS */}
          {activeTab === 'profile' && (
            isLoadingSettings ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-2 text-zinc-400">
                <RefreshCw className="w-6 h-6 animate-spin text-violet-500" />
                <span className="text-xs">Loading profile settings...</span>
              </div>
            ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#1a1a24] border border-[#2a2a38] flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-zinc-400 uppercase font-mono tracking-wider">Account ID</span>
                  <div className="text-sm font-bold text-white font-mono mt-0.5">{user.telegramId || 'N/A'}</div>
                </div>
                <button
                  onClick={() => handleCopy(user.telegramId)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#242432] hover:bg-[#2c2c3e] text-xs font-semibold text-zinc-300"
                >
                  {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
                  <span>{copiedId ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-[#1a1a24] border border-[#2a2a38]">
                  <span className="text-[11px] text-zinc-400 uppercase font-mono">Email Address</span>
                  <div className="text-sm font-semibold text-white mt-1 flex items-center gap-1.5 truncate">
                    <span className="truncate">{settingsData?.email || user.email || 'None registered'}</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#1a1a24] border border-[#2a2a38]">
                  <span className="text-[11px] text-zinc-400 uppercase font-mono">WhatsApp Number</span>
                  <div className="text-sm font-semibold text-white mt-1">
                    {settingsData?.whatsapp_number || 'Not provided'}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#1a1a24] border border-[#2a2a38] flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-zinc-400 uppercase font-mono">Wallet Balance</span>
                  <div className="text-lg font-bold text-emerald-400 mt-0.5">{formatPrice(user.balance)}</div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-zinc-400 uppercase font-mono">Promo Balance</span>
                  <div className="text-sm font-bold text-amber-400 mt-0.5">{formatPrice(user.promoBalance)}</div>
                </div>
              </div>
            </div>
            )
          )}

          {/* TAB 2: CHANGE PASSWORD */}
          {activeTab === 'security' && (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <p className="text-xs text-zinc-400">
                {hasPassword
                  ? 'To update your password, enter your current password and choose a new one with at least 6 characters.'
                  : 'Set a password for your account so you can also log in directly using your email and password.'}
              </p>

              {passwordNotice && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium ${
                    passwordNotice.type === 'success'
                      ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                  }`}
                >
                  {passwordNotice.text}
                </div>
              )}

              {hasPassword && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Current Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#1a1a24] border border-[#2a2a38] text-sm text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  {hasPassword ? 'New Password' : 'Create Password'}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#1a1a24] border border-[#2a2a38] text-sm text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  {hasPassword ? 'Confirm New Password' : 'Confirm Password'}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#1a1a24] border border-[#2a2a38] text-sm text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isChangingPassword || !newPassword || !confirmPassword || (hasPassword && !currentPassword)}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs text-white bg-violet-600 hover:bg-violet-700 active:scale-[0.99] transition-all shadow-md shadow-violet-600/30 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isChangingPassword ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <span>{hasPassword ? 'Update Password' : 'Set Account Password'}</span>
                )}
              </button>
            </form>
          )}

          {/* TAB 3: TELEGRAM BOT ACCOUNT LINKING */}
          {activeTab === 'telegram' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-900/20 to-indigo-900/20 border border-violet-500/30">
                <div className="flex items-center gap-2.5 mb-2">
                  <Smartphone className="w-5 h-5 text-violet-400" />
                  <h4 className="text-sm font-bold text-white">Combine Telegram Bot &amp; Website</h4>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Link your Telegram Bot account with this website account to combine your balances and view all order history in one unified view.
                </p>
              </div>

              {tgNotice && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium ${
                    tgNotice.type === 'success'
                      ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                  }`}
                >
                  {tgNotice.text}
                </div>
              )}

              {settingsData?.account_link ? (
                <div className="p-5 rounded-2xl bg-[#1a1a24] border border-emerald-500/30 flex flex-col items-center text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">Accounts Linked &amp; Synchronized</h4>
                    <p className="text-xs text-zinc-400 mt-1">
                      Connected to Telegram ID: <span className="font-mono text-emerald-400 font-semibold">{settingsData.account_link.telegram_user_id}</span>
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#14141b] border border-[#2a2a38] text-[11px] text-zinc-400 text-left w-full space-y-1">
                    <p>&bull; Wallet balances are merged across website and Telegram bot.</p>
                    <p>&bull; Order history and active OTP orders are visible across both platforms.</p>
                    <p>&bull; Linked on: <span className="text-zinc-300 font-mono">{settingsData.account_link.created_at || 'Active'}</span></p>
                  </div>
                </div>
              ) : !telegramOtpSent ? (
                <form onSubmit={handleSendTelegramOtp} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Your Telegram Numeric User ID
                    </label>
                    <input
                      type="text"
                      required
                      value={telegramIdInput}
                      onChange={(e) => setTelegramIdInput(e.target.value)}
                      placeholder="e.g. 7507183871"
                      className="w-full px-4 py-2.5 rounded-xl bg-[#1a1a24] border border-[#2a2a38] text-sm text-white placeholder-zinc-500 font-mono focus:border-violet-500 focus:outline-none"
                    />
                    <p className="text-[11px] text-zinc-500 mt-1">
                      Our bot will send a private 6-digit confirmation code directly to your Telegram chat to verify ownership.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={isSendingTgOtp || !telegramIdInput.trim()}
                    className="w-full py-3 px-4 rounded-xl font-bold text-xs text-white bg-violet-600 hover:bg-violet-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {isSendingTgOtp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Send Telegram Verification Code</span>}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyTelegramLink} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Enter 6-Digit Telegram Bot Code
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      value={telegramOtpInput}
                      onChange={(e) => setTelegramOtpInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••••"
                      className="w-full px-4 py-2.5 rounded-xl bg-[#1a1a24] border border-[#2a2a38] text-center text-lg font-bold font-mono text-white placeholder-zinc-600 focus:border-violet-500 focus:outline-none tracking-widest"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={isLinkingTg || telegramOtpInput.length !== 6}
                      className="flex-1 py-3 px-4 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {isLinkingTg ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Verify &amp; Link Accounts</span>}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTelegramOtpSent(false)}
                      className="py-3 px-4 rounded-xl font-semibold text-xs text-zinc-400 hover:text-white bg-[#1f1f2b] border border-[#2a2a38]"
                    >
                      Change ID
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 4: DEVELOPER & API */}
          {activeTab === 'developer' && (
            <div className="space-y-4 text-center py-6">
              <div className="w-14 h-14 rounded-2xl bg-[#1f1f2b] border border-[#2a2a38] flex items-center justify-center mx-auto text-violet-400">
                <Code className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <div className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/20 text-violet-400 border border-violet-500/30 uppercase tracking-wider">
                  Upcoming Capability
                </div>
                <h4 className="text-base font-bold text-white">Developer API &amp; Webhooks</h4>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                  Programmatic number ordering, incoming OTP webhooks, and automated balance top-up API keys will be accessible here in our next scheduled platform update.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
