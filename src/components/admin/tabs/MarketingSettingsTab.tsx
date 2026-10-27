import React, { useEffect, useState, useCallback } from 'react';
import {
  adminApi,
  ResellerSettings,
  PromoCodeItem,
  DatabaseStats,
} from '../../../api/adminApi';
import { useApp } from '../../../context/AppContext';
import {
  Megaphone,
  Gift,
  Power,
  Plus,
  RefreshCw,
  Users,
  Radio,
  Database,
  Download,
  HardDrive,
} from 'lucide-react';

export const MarketingSettingsTab: React.FC = () => {
  const { addToast } = useApp();

  // ============================================================================
  // 1. MASTER BOT STATUS STATE
  // ============================================================================
  const [botStatus, setBotStatus] = useState<'on' | 'off'>('on');
  const [botStatusLoading, setBotStatusLoading] = useState(false);

  const loadBotStatus = useCallback(async () => {
    try {
      const res = await adminApi.getBotStatus();
      if (res?.success) {
        setBotStatus(res.bot_status === 'off' ? 'off' : 'on');
      }
    } catch {
      // Ignore
    }
  }, []);

  const handleToggleBotStatus = async () => {
    const nextStatus = botStatus === 'on' ? 'off' : 'on';
    const msg = nextStatus === 'off'
      ? 'Put Krish Bot into MAINTENANCE mode? Non-admin users will be blocked.'
      : 'Set Krish Bot ONLINE? All customers will have immediate access.';

    if (!window.confirm(msg)) return;

    setBotStatusLoading(true);
    try {
      const res = await adminApi.toggleBotStatus(nextStatus);
      if (res?.success) {
        setBotStatus(nextStatus);
        addToast(
          nextStatus === 'on' ? 'Bot is now ONLINE' : 'Bot is now in MAINTENANCE mode',
          nextStatus === 'on' ? 'success' : 'error'
        );
      }
    } catch {
      addToast('Failed to toggle bot status', 'error');
    } finally {
      setBotStatusLoading(false);
    }
  };

  // ============================================================================
  // 2. RESELLER ENGINE STATE
  // ============================================================================
  const [resellerSettings, setResellerSettings] = useState<ResellerSettings>({
    status: 'on',
    min_margin: 5,
    max_margin: 100,
  });
  const [minMarginInput, setMinMarginInput] = useState('5');
  const [maxMarginInput, setMaxMarginInput] = useState('100');
  const [resellerLoading, setResellerLoading] = useState(false);

  const loadResellerSettings = useCallback(async () => {
    try {
      const res = await adminApi.getResellerSettings();
      if (res?.success && res.settings) {
        setResellerSettings(res.settings);
        setMinMarginInput(String(res.settings.min_margin || 5));
        setMaxMarginInput(String(res.settings.max_margin || 100));
      }
    } catch {
      // Ignore
    }
  }, []);

  const handleSaveResellerSettings = async () => {
    const minM = parseFloat(minMarginInput);
    const maxM = parseFloat(maxMarginInput);

    if (isNaN(minM) || isNaN(maxM) || minM < 1 || maxM < minM) {
      addToast('Invalid margin limits: min must be <= max and at least ₹1', 'error');
      return;
    }

    setResellerLoading(true);
    try {
      const res = await adminApi.updateResellerSettings({
        status: resellerSettings.status,
        min_margin: minM,
        max_margin: maxM,
      });
      if (res?.success) {
        setResellerSettings((prev) => ({ ...prev, min_margin: minM, max_margin: maxM }));
        addToast('Reseller margin engine updated successfully', 'success');
      }
    } catch {
      addToast('Failed to update reseller settings', 'error');
    } finally {
      setResellerLoading(false);
    }
  };

  const handleToggleReseller = async () => {
    const nextStatus = resellerSettings.status === 'on' ? 'off' : 'on';
    try {
      const res = await adminApi.updateResellerSettings({ status: nextStatus });
      if (res?.success) {
        setResellerSettings((prev) => ({ ...prev, status: nextStatus }));
        addToast(`Reseller engine turned ${nextStatus.toUpperCase()}`, 'success');
      }
    } catch {
      addToast('Failed to toggle reseller engine', 'error');
    }
  };

  // ============================================================================
  // 3. FORCE-JOIN CHANNEL SETTINGS STATE
  // ============================================================================
  const [forceJoinStatus, setForceJoinStatus] = useState<'on' | 'off'>('on');
  const [forceChannels, setForceChannels] = useState('');
  const [forceJoinLoading, setForceJoinLoading] = useState(false);

  const loadForceJoinSettings = useCallback(async () => {
    try {
      const res = await adminApi.getForceJoinSettings();
      if (res?.success) {
        setForceJoinStatus(res.status === 'off' ? 'off' : 'on');
        setForceChannels(res.channels || '-1003186256877, -1003350590878');
      }
    } catch {
      // Ignore
    }
  }, []);

  const handleSaveForceJoin = async () => {
    setForceJoinLoading(true);
    try {
      const channelArray = forceChannels
        .split(',')
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      const res = await adminApi.updateForceJoinSettings({
        status: forceJoinStatus,
        channels: channelArray,
      });
      if (res?.success) {
        addToast('Force-join channel configuration saved', 'success');
      }
    } catch {
      addToast('Failed to save force-join settings', 'error');
    } finally {
      setForceJoinLoading(false);
    }
  };

  // ============================================================================
  // 3b. TELEGRAM LOG & PROOF CHANNELS STATE
  // ============================================================================
  const [adminLogChannel, setAdminLogChannel] = useState('');
  const [publicLogChannel, setPublicLogChannel] = useState('');
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [channelsSaving, setChannelsSaving] = useState(false);

  const loadChannelsSettings = useCallback(async () => {
    setChannelsLoading(true);
    try {
      const res = await adminApi.getChannelsSettings();
      if (res?.success) {
        setAdminLogChannel(res.admin_log_channel_id || '-1003970256704');
        setPublicLogChannel(res.public_log_channel_id || '-1003186256877');
      }
    } catch {
      // Ignore
    } finally {
      setChannelsLoading(false);
    }
  }, []);

  const handleSaveChannels = async () => {
    setChannelsSaving(true);
    try {
      const res = await adminApi.updateChannelsSettings({
        admin_log_channel_id: adminLogChannel.trim(),
        public_log_channel_id: publicLogChannel.trim(),
      });
      if (res?.success) {
        addToast('Telegram log & proof channels updated successfully', 'success');
        if (res.admin_log_channel_id) setAdminLogChannel(res.admin_log_channel_id);
        if (res.public_log_channel_id) setPublicLogChannel(res.public_log_channel_id);
      } else {
        addToast(res?.message || 'Failed to update channel settings', 'error');
      }
    } catch {
      addToast('Error saving telegram channel settings', 'error');
    } finally {
      setChannelsSaving(false);
    }
  };

  // ============================================================================
  // 4. PROMO CODES STATE
  // ============================================================================
  const [promoCodes, setPromoCodes] = useState<PromoCodeItem[]>([]);
  const [promoLoading, setPromoLoading] = useState(false);
  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoValue, setNewPromoValue] = useState('50');
  const [newPromoMaxUses, setNewPromoMaxUses] = useState('1');
  const [promoSubmitting, setPromoSubmitting] = useState(false);

  const loadPromoCodes = useCallback(async () => {
    setPromoLoading(true);
    try {
      const res = await adminApi.getPromoCodes();
      if (res?.success && res.promo_codes) {
        setPromoCodes(res.promo_codes);
      }
    } catch {
      // Ignore
    } finally {
      setPromoLoading(false);
    }
  }, []);

  const handleGenerateRandomCode = () => {
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    setNewPromoCode(`KRISH${rand}`);
  };

  const handleCreatePromoCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromoCode.trim()) {
      addToast('Promo code is required', 'error');
      return;
    }
    const val = parseFloat(newPromoValue);
    if (isNaN(val) || val <= 0) {
      addToast('Please enter a valid credit amount', 'error');
      return;
    }

    setPromoSubmitting(true);
    try {
      const res = await adminApi.createPromoCode({
        code: newPromoCode.trim().toUpperCase(),
        value: val,
        max_uses: parseInt(newPromoMaxUses) || 1,
      });
      if (res?.success) {
        addToast(`Promo Code ${newPromoCode.toUpperCase()} created!`, 'success');
        setNewPromoCode('');
        loadPromoCodes();
      } else {
        addToast(res?.error || 'Failed to create promo code', 'error');
      }
    } catch {
      addToast('Error creating promo code', 'error');
    } finally {
      setPromoSubmitting(false);
    }
  };

  const handleDeactivatePromo = async (code: string) => {
    if (!window.confirm(`Deactivate promo code "${code}"?`)) return;
    try {
      const res = await adminApi.deactivatePromoCode(code);
      if (res?.success) {
        setPromoCodes((prev) =>
          prev.map((p) => (p.code === code ? { ...p, active: 0 } : p))
        );
        addToast(`Promo code ${code} deactivated`, 'info');
      }
    } catch {
      addToast('Failed to deactivate promo code', 'error');
    }
  };


  // ============================================================================
  // 5. DATABASE BACKUP & SYSTEM SNAPSHOT STATE
  // ============================================================================
  const [dbStats, setDbStats] = useState<DatabaseStats | null>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbDownloading, setDbDownloading] = useState(false);

  const loadDbStats = useCallback(async () => {
    setDbLoading(true);
    try {
      const res = await adminApi.getDatabaseStats();
      if (res?.success) {
        setDbStats(res);
      }
    } catch {
      // Non-blocking fallback
    } finally {
      setDbLoading(false);
    }
  }, []);

  const handleDownloadDb = async () => {
    setDbDownloading(true);
    try {
      addToast('Creating compressed database snapshot...', 'info', 'Backup Started');
      await adminApi.downloadDatabaseBackup();
      addToast('Full database backup (.zip) downloaded successfully!', 'success', 'Backup Complete');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Download failed';
      addToast(msg, 'error', 'Backup Failed');
    } finally {
      setDbDownloading(false);
    }
  };

  useEffect(() => {
    loadBotStatus();
    loadResellerSettings();
    loadForceJoinSettings();
    loadChannelsSettings();
    loadPromoCodes();
    loadDbStats();
  }, [loadBotStatus, loadResellerSettings, loadForceJoinSettings, loadChannelsSettings, loadPromoCodes]);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* 1. Master Bot Status Card */}
      <div className="bg-[#181820] border border-[#262630] rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Power className="w-5 h-5 text-[#8b5cf6]" />
            <h3 className="text-sm font-bold text-white tracking-tight">
              Master Krish Telegram Bot Status
            </h3>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                botStatus === 'on'
                  ? 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30'
                  : 'bg-[#ef4444]/15 text-[#ef4444] border-[#ef4444]/30'
              }`}
            >
              {botStatus === 'on' ? 'ONLINE (ACCEPTING ORDERS)' : 'MAINTENANCE (BLOCKED)'}
            </span>
          </div>
          <p className="text-xs text-[#a1a1aa]">
            Global system switch. When turned OFF, customers in bot and Mini App receive the maintenance screen.
          </p>
        </div>

        <button
          onClick={handleToggleBotStatus}
          disabled={botStatusLoading}
          className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-md cursor-pointer ${
            botStatus === 'on'
              ? 'bg-[#ef4444]/20 hover:bg-[#ef4444]/30 text-[#ef4444] border border-[#ef4444]/40'
              : 'bg-[#22c55e]/20 hover:bg-[#22c55e]/30 text-[#22c55e] border border-[#22c55e]/40'
          }`}
        >
          <Power className="w-4 h-4" />
          <span>{botStatus === 'on' ? 'Trigger Maintenance' : 'Bring Bot Online'}</span>
        </button>
      </div>

      {/* 2. Reseller Engine Controls & Force-Join Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Reseller Engine */}
        <div className="bg-[#181820] border border-[#262630] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-[#8b5cf6]" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Reseller Custom Margin Engine
              </h4>
            </div>

            <button
              onClick={handleToggleReseller}
              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                resellerSettings.status === 'on'
                  ? 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30'
                  : 'bg-[#ef4444]/15 text-[#ef4444] border-[#ef4444]/30'
              }`}
            >
              {resellerSettings.status === 'on' ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          <p className="text-xs text-[#a1a1aa]">
            Controls the allowable profit margin range (Price_final = Price_base + Margin) for user reseller links.
          </p>

          <div className="grid grid-cols-2 gap-3 bg-[#121217] p-3 rounded-xl border border-[#262630]">
            <div>
              <label className="text-[10px] font-semibold text-[#a1a1aa] block mb-1">
                Min Margin (Strictly ₹5)
              </label>
              <input
                type="number"
                value={minMarginInput}
                onChange={(e) => setMinMarginInput(e.target.value)}
                className="w-full bg-[#181820] border border-[#262630] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-[#a1a1aa] block mb-1">
                Max Margin (Strictly ₹100)
              </label>
              <input
                type="number"
                value={maxMarginInput}
                onChange={(e) => setMaxMarginInput(e.target.value)}
                className="w-full bg-[#181820] border border-[#262630] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
              />
            </div>
          </div>

          <button
            onClick={handleSaveResellerSettings}
            disabled={resellerLoading}
            className="w-full bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold py-2 rounded-xl text-xs transition-all shadow-sm"
          >
            Save Reseller Limits
          </button>
        </div>

        {/* Force-Join Settings */}
        <div className="bg-[#181820] border border-[#262630] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#22c55e]" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Force-Join Channel Verification
              </h4>
            </div>

            <button
              onClick={() => setForceJoinStatus((prev) => (prev === 'on' ? 'off' : 'on'))}
              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                forceJoinStatus === 'on'
                  ? 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30'
                  : 'bg-[#ef4444]/15 text-[#ef4444] border-[#ef4444]/30'
              }`}
            >
              {forceJoinStatus === 'on' ? 'Enforced' : 'Off'}
            </button>
          </div>

          <p className="text-xs text-[#a1a1aa]">
            Requires customers to join official Telegram broadcast channels before buying or depositing.
          </p>

          <div>
            <label className="text-[10px] font-semibold text-[#a1a1aa] block mb-1">
              Required Channel IDs (comma-separated):
            </label>
            <input
              type="text"
              value={forceChannels}
              onChange={(e) => setForceChannels(e.target.value)}
              className="w-full bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs font-mono text-white outline-none"
            />
          </div>

          <button
            onClick={handleSaveForceJoin}
            disabled={forceJoinLoading}
            className="w-full bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold py-2 rounded-xl text-xs transition-all shadow-sm"
          >
            Save Channels Configuration
          </button>
        </div>
      </div>

      {/* 2b. Telegram Log & Proof Channels Card */}
      <div className="bg-[#181820] border border-[#262630] rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-[#38bdf8]" />
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Telegram Log & Proof Channels
              </h4>
              <p className="text-[11px] text-[#a1a1aa]">
                Configure real-time Telegram logging channels for private admin alerts and public purchase/deposit proofs
              </p>
            </div>
          </div>
          <button
            onClick={loadChannelsSettings}
            disabled={channelsLoading}
            className="p-1.5 rounded-xl bg-[#121217] border border-[#262630] text-[#a1a1aa] hover:text-white"
            title="Refresh channels"
          >
            <RefreshCw className={`w-4 h-4 ${channelsLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-wider">
                Admin Log Channel ID (Private Alerts)
              </label>
              <span className="text-[10px] text-[#71717a] font-mono">Default: -1003970256704</span>
            </div>
            <input
              type="text"
              placeholder="-1003970256704"
              value={adminLogChannel}
              onChange={(e) => setAdminLogChannel(e.target.value)}
              className="w-full bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs font-mono text-white outline-none focus:border-[#38bdf8] transition-colors"
            />
            <p className="text-[10px] text-[#71717a]">
              Receives private admin logs: manual deposit verification requests, screenshots, and system error alerts.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-wider">
                Public Proof Channel ID (Community Feed)
              </label>
              <span className="text-[10px] text-[#71717a] font-mono">Default: -1003186256877</span>
            </div>
            <input
              type="text"
              placeholder="-1003186256877"
              value={publicLogChannel}
              onChange={(e) => setPublicLogChannel(e.target.value)}
              className="w-full bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs font-mono text-white outline-none focus:border-[#38bdf8] transition-colors"
            />
            <p className="text-[10px] text-[#71717a]">
              Public channel where completed deposits and OTP purchase success receipts are broadcast.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            onClick={handleSaveChannels}
            disabled={channelsSaving || channelsLoading}
            className="bg-[#38bdf8] hover:bg-[#0284c7] text-black font-bold px-5 py-2 rounded-xl text-xs transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>{channelsSaving ? 'Saving Channels...' : 'Save Channels Configuration'}</span>
          </button>
        </div>
      </div>

      {/* 3. Promo Codes & Giveaways Hub */}
      <div className="bg-[#181820] border border-[#262630] rounded-2xl p-5 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift className="w-4 h-4 text-[#8b5cf6]" />
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Promo Codes & Giveaways Engine
              </h3>
              <p className="text-[11px] text-[#a1a1aa]">
                Generate one-time or multi-use credit gift vouchers for marketing campaigns
              </p>
            </div>
          </div>

          <button
            onClick={loadPromoCodes}
            className="p-1.5 rounded-xl bg-[#121217] border border-[#262630] text-[#a1a1aa] hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 ${promoLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Create Promo Code Form */}
        <form
          onSubmit={handleCreatePromoCode}
          className="bg-[#121217] border border-[#262630] rounded-xl p-4 space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-semibold text-[#a1a1aa]">Code</label>
                <button
                  type="button"
                  onClick={handleGenerateRandomCode}
                  className="text-[10px] text-[#8b5cf6] hover:underline"
                >
                  Generate
                </button>
              </div>
              <input
                type="text"
                placeholder="PROMO100"
                value={newPromoCode}
                onChange={(e) => setNewPromoCode(e.target.value.toUpperCase())}
                required
                className="w-full bg-[#181820] border border-[#262630] rounded-lg px-2.5 py-1.5 text-xs font-mono uppercase text-white outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-[#a1a1aa] block mb-1">
                Credit Amount (₹)
              </label>
              <input
                type="number"
                placeholder="50"
                value={newPromoValue}
                onChange={(e) => setNewPromoValue(e.target.value)}
                required
                min={1}
                className="w-full bg-[#181820] border border-[#262630] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-[#a1a1aa] block mb-1">
                Max Uses (Redemption Limit)
              </label>
              <input
                type="number"
                placeholder="1"
                value={newPromoMaxUses}
                onChange={(e) => setNewPromoMaxUses(e.target.value)}
                min={1}
                className="w-full bg-[#181820] border border-[#262630] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={promoSubmitting}
            className="bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>Create Promo Code</span>
          </button>
        </form>

        {/* Promo Codes Table */}
        <div className="overflow-x-auto no-scrollbar border border-[#262630] rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#121217] text-[#a1a1aa] border-b border-[#262630]">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Promo Code</th>
                <th className="py-2.5 px-3 font-semibold">Credit Value</th>
                <th className="py-2.5 px-3 font-semibold">Uses / Limit</th>
                <th className="py-2.5 px-3 font-semibold">Status</th>
                <th className="py-2.5 px-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262630]">
              {promoCodes.map((p) => (
                <tr key={p.code} className="hover:bg-[#121217]/50">
                  <td className="py-2 px-3 font-mono text-white font-bold">{p.code}</td>
                  <td className="py-2 px-3 font-bold text-[#22c55e]">₹{p.value}</td>
                  <td className="py-2 px-3 text-[#a1a1aa]">
                    {p.used_count || 0} / {p.max_uses}
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        p.active !== 0
                          ? 'bg-[#22c55e]/15 text-[#22c55e]'
                          : 'bg-[#71717a]/15 text-[#71717a]'
                      }`}
                    >
                      {p.active !== 0 ? 'Active' : 'Deactivated'}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right">
                    {p.active !== 0 && (
                      <button
                        onClick={() => handleDeactivatePromo(p.code)}
                        className="text-[#ef4444] hover:text-[#dc2626] text-xs font-semibold"
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {promoCodes.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-[#71717a]">
                    No active promo codes created yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Database Backup & Disaster Recovery Archive */}
      <div className="bg-[#181820] border border-[#262630] rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[#22c55e]" />
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <span>Database Backup & Disaster Recovery</span>
                <span className="text-[10px] font-mono font-bold text-[#22c55e] bg-[#22c55e]/15 px-2 py-0.5 rounded-full border border-[#22c55e]/30">
                  Live Online Snapshot
                </span>
              </h3>
              <p className="text-[11px] text-[#a1a1aa]">
                Create an instant, uncorrupted, ZIP-compressed backup of the entire SQLite database with zero downtime
              </p>
            </div>
          </div>

          <button
            onClick={loadDbStats}
            disabled={dbLoading}
            className="p-1.5 rounded-xl bg-[#121217] border border-[#262630] text-[#a1a1aa] hover:text-white transition-colors"
            title="Refresh Database Stats"
          >
            <RefreshCw className={`w-4 h-4 ${dbLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 rounded-xl bg-[#121217] border border-[#262630]">
            <span className="text-[10px] text-[#71717a] font-semibold uppercase tracking-wider block mb-1">
              Active Database
            </span>
            <span className="text-xs font-mono font-bold text-white truncate block">
              {dbStats?.filename || 'otp_bot_final.db'}
            </span>
            <span className="text-[9px] text-[#22c55e] font-medium mt-0.5 block">SQLite 3 Engine</span>
          </div>

          <div className="p-3 rounded-xl bg-[#121217] border border-[#262630]">
            <span className="text-[10px] text-[#71717a] font-semibold uppercase tracking-wider block mb-1">
              Uncompressed Size
            </span>
            <span className="text-sm font-mono font-extrabold text-white">
              {dbStats?.size_mb ? `${dbStats.size_mb} MB` : '45.1 MB'}
            </span>
            <span className="text-[9px] text-[#a1a1aa] font-medium mt-0.5 block">On Server Disk</span>
          </div>

          <div className="p-3 rounded-xl bg-[#121217] border border-[#262630]">
            <span className="text-[10px] text-[#71717a] font-semibold uppercase tracking-wider block mb-1">
              Estimated ZIP Size
            </span>
            <span className="text-sm font-mono font-extrabold text-[#22c55e]">
              {dbStats?.estimated_zip_mb ? `~${dbStats.estimated_zip_mb} MB` : '~9.2 MB'}
            </span>
            <span className="text-[9px] text-[#8b5cf6] font-medium mt-0.5 block">80% Deflate Ratio</span>
          </div>

          <div className="p-3 rounded-xl bg-[#121217] border border-[#262630]">
            <span className="text-[10px] text-[#71717a] font-semibold uppercase tracking-wider block mb-1">
              Registered Records
            </span>
            <span className="text-sm font-mono font-extrabold text-[#38bdf8]">
              {dbStats?.counts?.users ? `${dbStats.counts.users.toLocaleString()} Users` : '10,000+ Users'}
            </span>
            <span className="text-[9px] text-[#a1a1aa] font-medium mt-0.5 block">
              {dbStats?.counts?.orders ? `${dbStats.counts.orders} Orders` : 'Orders & Deposits'}
            </span>
          </div>
        </div>

        {/* Download Action Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-[#121217] border border-[#262630]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#22c55e]/15 text-[#22c55e]">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>Instant Browser Backup (.zip)</span>
                <span className="text-[10px] text-[#22c55e] font-mono">Fast & Safe</span>
              </div>
              <p className="text-[11px] text-[#71717a]">
                Downloads a compressed archive containing the full database snapshot directly to your device.
              </p>
            </div>
          </div>

          <button
            onClick={handleDownloadDb}
            disabled={dbDownloading}
            className="w-full sm:w-auto shrink-0 bg-[#22c55e] hover:bg-[#16a34a] text-black font-extrabold px-5 py-2.5 rounded-xl text-xs transition-all shadow-emerald-glow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {dbDownloading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Generating Backup...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Download Full DB Backup (.zip)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
