import React, { useState, useEffect, useCallback } from 'react';
import {
  adminApi,
  AdminWebsiteBroadcastItem,
} from '../../../api/adminApi';
import { useApp } from '../../../context/AppContext';
import {
  BellRing,
  Send,
  Trash2,
  RefreshCw,
  Clock,
  Sparkles,
  Megaphone,
  AlertCircle,
  Globe,
  CheckCircle2,
  Eye,
  X,
  ShieldCheck,
} from 'lucide-react';

const RETENTION_PRESETS = [
  { label: '6h', hours: 6 },
  { label: '24h', hours: 24 },
  { label: '3 Days', hours: 72 },
  { label: '7 Days', hours: 168 },
  { label: '14 Days', hours: 336 },
  { label: '30 Days', hours: 720 },
];

function formatDurationHours(hours: number): string {
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = hours / 24;
  if (Number.isInteger(days)) return `${days} day${days === 1 ? '' : 's'}`;
  return `${hours}h`;
}

function formatExpiryCountdown(expiresIso?: string): string {
  if (!expiresIso) return '—';
  const ts = Date.parse(expiresIso);
  if (Number.isNaN(ts)) return expiresIso;
  const diffMs = ts - Date.now();
  if (diffMs <= 0) return 'Expired (purging)';
  const totalMins = Math.ceil(diffMs / 60000);
  if (totalMins < 60) return `Expires in ${totalMins}m`;
  const hrs = Math.floor(totalMins / 60);
  if (hrs < 24) return `Expires in ${hrs}h`;
  const days = Math.floor(hrs / 24);
  const remHrs = hrs % 24;
  return remHrs > 0 ? `Expires in ${days}d ${remHrs}h` : `Expires in ${days}d`;
}

export const WebsiteBroadcastsTab: React.FC = () => {
  const { addToast } = useApp();

  const [broadcasts, setBroadcasts] = useState<AdminWebsiteBroadcastItem[]>([]);
  const [pushSubscribers, setPushSubscribers] = useState<number>(0);
  const [pushReady, setPushReady] = useState<boolean>(false);
  const [defaultRetentionHours, setDefaultRetentionHours] = useState<number>(72);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Compose Form State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'normal' | 'important' | 'offer'>('normal');
  const [maxPopupViews, setMaxPopupViews] = useState<1 | 2>(1);
  const [retentionHours, setRetentionHours] = useState<string>('72');
  const [sendPush, setSendPush] = useState<boolean>(true);
  const [saveAsDefault, setSaveAsDefault] = useState<boolean>(false);

  // Confirmation & Action State
  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);
  const [publishing, setPublishing] = useState<boolean>(false);
  const [savingDefault, setSavingDefault] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadBroadcasts = useCallback(async (syncDefaultInput = false) => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await adminApi.getWebsiteBroadcasts();
      if (res?.success) {
        setBroadcasts(Array.isArray(res.broadcasts) ? res.broadcasts : []);
        setPushSubscribers(Number(res.push_subscriber_count || 0));
        const ready = Boolean(res.push_ready);
        setPushReady(ready);
        const defHrs = Number(res.default_retention_hours || 72);
        setDefaultRetentionHours(defHrs);
        if (syncDefaultInput) {
          setRetentionHours(String(defHrs));
          setSendPush(ready);
        }
      } else {
        setLoadError(res?.error || 'Could not load website broadcasts.');
      }
    } catch {
      setLoadError('Network error loading website broadcasts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBroadcasts(true);
  }, [loadBroadcasts]);

  // Close publish confirmation modal on Escape
  useEffect(() => {
    if (!confirmOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !publishing) setConfirmOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirmOpen, publishing]);

  const parsedHours = Math.floor(Number(retentionHours));
  const isRetentionValid = Number.isFinite(parsedHours) && parsedHours >= 1 && parsedHours <= 720;

  const handleRequestPublish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      addToast('Please enter a notification title.', 'error');
      return;
    }
    if (!message.trim()) {
      addToast('Please enter the notification message.', 'error');
      return;
    }
    if (!isRetentionValid) {
      addToast('Retention period must be between 1 and 720 hours (30 days).', 'error');
      return;
    }
    setConfirmOpen(true);
  };

  const handleSaveDefaultRetention = async () => {
    if (!isRetentionValid) {
      addToast('Retention period must be between 1 and 720 hours (30 days).', 'error');
      return;
    }
    setSavingDefault(true);
    try {
      const res = await adminApi.updateBroadcastSettings(parsedHours);
      if (res?.success) {
        const updated = Number(res.default_retention_hours || parsedHours);
        setDefaultRetentionHours(updated);
        setRetentionHours(String(updated));
        addToast(`Default auto-delete updated to ${formatDurationHours(updated)}`, 'success');
      } else {
        addToast(res?.error || 'Failed to update default retention', 'error');
      }
    } catch {
      addToast('Network error updating default retention', 'error');
    } finally {
      setSavingDefault(false);
    }
  };

  const handleConfirmPublish = async () => {
    if (!isRetentionValid) return;
    setPublishing(true);
    try {
      const res = await adminApi.publishWebsiteBroadcast({
        title: title.trim(),
        message: message.trim(),
        priority,
        max_popup_views: maxPopupViews,
        retention_hours: parsedHours,
        send_push: pushReady && sendPush,
        save_as_default_retention: saveAsDefault,
      });

      if (res?.success) {
        addToast(
          res.push_dispatched
            ? `Published website broadcast & dispatched browser push!`
            : `Published website broadcast (in-app popup + notification bell)!`,
          'success'
        );
        setTitle('');
        setMessage('');
        setPriority('normal');
        setMaxPopupViews(1);
        setSaveAsDefault(false);
        setConfirmOpen(false);
        loadBroadcasts(false);
      } else {
        addToast(res?.error || 'Failed to publish broadcast', 'error');
      }
    } catch {
      addToast('Network error publishing broadcast', 'error');
    } finally {
      setPublishing(false);
    }
  };

  const handleDelete = async (item: AdminWebsiteBroadcastItem) => {
    if (!window.confirm(`Delete broadcast "${item.title}"? It will be removed from all website users immediately.`)) {
      return;
    }
    setDeletingId(item.id);
    try {
      const res = await adminApi.deleteWebsiteBroadcast(item.id);
      if (res?.success) {
        addToast(`Deleted broadcast #${item.id}`, 'success');
        setBroadcasts((prev) => prev.filter((b) => b.id !== item.id));
      } else {
        addToast(res?.error || 'Failed to delete broadcast', 'error');
      }
    } catch {
      addToast('Error deleting broadcast', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300 pb-8">
      {/* === 1. OVERVIEW STATS STRIP === */}
      <div className="bg-[#181820] border border-[#262630] rounded-2xl p-4 sm:p-5 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <BellRing className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white leading-tight">
                Website Notification Broadcasts
              </h2>
              <p className="text-[11px] text-[#a1a1aa]">
                Deliver attention alerts to logged-in Website users via capped Auto-Popups, Account
                Notification Bell &amp; Browser Push
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadBroadcasts(false)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#121217] border border-[#262630] hover:border-[#7c3aed]/50 text-[11px] font-semibold text-[#a1a1aa] hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {loadError && (
          <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300 flex items-center justify-between gap-2">
            <span>{loadError}</span>
            <button
              type="button"
              onClick={() => loadBroadcasts(false)}
              className="font-bold underline hover:text-white"
            >
              Retry
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="bg-[#121217] border border-[#262630] rounded-xl p-3">
            <span className="text-[10px] font-semibold text-[#a1a1aa] block mb-1">
              Active Broadcasts
            </span>
            <span className="text-lg font-extrabold text-white font-mono">
              {broadcasts.length}
            </span>
            <span className="text-[10px] text-[#71717a] block">Auto-purged on expiry</span>
          </div>

          <div className="bg-[#121217] border border-cyan-500/25 rounded-xl p-3">
            <span className="text-[10px] font-semibold text-cyan-300 block mb-1">
              Push Subscribers
            </span>
            <span className="text-lg font-extrabold text-cyan-300 font-mono">
              {pushSubscribers.toLocaleString()}
            </span>
            <span className="text-[10px] text-[#71717a] block">Browsers opted into push</span>
          </div>

          <div className="bg-[#121217] border border-[#262630] rounded-xl p-3">
            <span className="text-[10px] font-semibold text-[#a1a1aa] block mb-1">
              Browser Push Engine
            </span>
            <span
              className={`text-xs font-extrabold inline-flex items-center gap-1 mt-1 ${
                pushReady ? 'text-emerald-400' : 'text-amber-300'
              }`}
            >
              {pushReady ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" /> VAPID Active
                </>
              ) : (
                <>
                  <Clock className="w-3.5 h-3.5" /> In-App Active
                </>
              )}
            </span>
            <span className="text-[10px] text-[#71717a] block mt-0.5">
              {pushReady ? 'OS push + in-app ready' : 'Install pywebpush for OS push'}
            </span>
          </div>

          <div className="bg-[#121217] border border-violet-500/25 rounded-xl p-3">
            <span className="text-[10px] font-semibold text-violet-300 block mb-1">
              Default Auto-Delete
            </span>
            <span className="text-lg font-extrabold text-violet-300 font-mono">
              {formatDurationHours(defaultRetentionHours)}
            </span>
            <span className="text-[10px] text-[#71717a] block">Configurable per broadcast</span>
          </div>
        </div>
      </div>

      {/* === 2. COMPOSE & PUBLISH NEW WEBSITE BROADCAST === */}
      <div className="bg-[#181820] border border-[#262630] rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-[#8b5cf6]" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Publish New Website Announcement
            </h3>
          </div>
          <span className="text-[10px] text-[#71717a] flex items-center gap-1">
            <Globe className="w-3 h-3 text-cyan-400" />
            Logged-in Website users only
          </span>
        </div>

        <form onSubmit={handleRequestPublish} className="space-y-4">
          {/* Title & Priority */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-[#a1a1aa]">
                  Notification Title
                </label>
                <span className="text-[10px] font-mono text-[#71717a]">{title.length}/120</span>
              </div>
              <input
                type="text"
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Server 1 India Restocked & Fast Delivery Active!"
                className="w-full bg-[#121217] border border-[#262630] focus:border-[#7c3aed] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#71717a] outline-none transition-colors"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[#a1a1aa] block mb-1">
                Badge Style
              </label>
              <div className="grid grid-cols-3 gap-1 bg-[#121217] p-1 rounded-xl border border-[#262630]">
                {(
                  [
                    { id: 'normal', label: 'Info' },
                    { id: 'important', label: 'Alert' },
                    { id: 'offer', label: 'Offer' },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPriority(p.id)}
                    className={`py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                      priority === p.id
                        ? p.id === 'important'
                          ? 'bg-rose-500 text-white shadow'
                          : p.id === 'offer'
                          ? 'bg-amber-500 text-black shadow'
                          : 'bg-[#7c3aed] text-white shadow'
                        : 'text-[#a1a1aa] hover:text-white'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Message Body */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-[#a1a1aa]">
                Message Body (Plain Text — Links Shown Cleanly as Text)
              </label>
              <span className="text-[10px] font-mono text-[#71717a]">{message.length}/2000</span>
            </div>
            <textarea
              rows={4}
              maxLength={2000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your announcement here... Any links (e.g. https://daemonx.in) will be shown cleanly as selectable plain text."
              className="w-full bg-[#121217] border border-[#262630] focus:border-[#7c3aed] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#71717a] outline-none transition-colors resize-y"
              required
            />
          </div>

          {/* Retention / Auto-Delete Period + Popup Limit */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            {/* Auto-Delete Retention */}
            <div className="bg-[#121217] border border-[#262630] rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-white flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-violet-400" />
                  <span>Auto-Delete After</span>
                </label>
                <span className="text-[10px] text-violet-300 font-mono">
                  {isRetentionValid ? formatDurationHours(parsedHours) : 'Invalid'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {RETENTION_PRESETS.map((preset) => (
                  <button
                    key={preset.hours}
                    type="button"
                    onClick={() => setRetentionHours(String(preset.hours))}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                      parsedHours === preset.hours
                        ? 'bg-[#7c3aed] text-white border-[#7c3aed]'
                        : 'bg-[#181820] text-[#a1a1aa] border-[#262630] hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[#a1a1aa]">Custom (hours):</span>
                  <input
                    type="number"
                    min={1}
                    max={720}
                    step={1}
                    value={retentionHours}
                    onChange={(e) => setRetentionHours(e.target.value)}
                    className="w-20 bg-[#181820] border border-[#262630] rounded-lg px-2 py-1 text-xs font-mono text-white outline-none"
                  />
                  <button
                    type="button"
                    disabled={savingDefault || !isRetentionValid || parsedHours === defaultRetentionHours}
                    onClick={handleSaveDefaultRetention}
                    className="px-2.5 py-1 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 text-[10px] font-bold text-violet-300 transition-colors disabled:opacity-40 cursor-pointer"
                    title="Save this duration as the new default without publishing"
                  >
                    {savingDefault ? 'Saving...' : 'Save Default'}
                  </button>
                </div>
                <label className="flex items-center gap-1.5 text-[10px] text-[#a1a1aa] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={saveAsDefault}
                    onChange={(e) => setSaveAsDefault(e.target.checked)}
                    className="accent-[#7c3aed]"
                  />
                  <span>Also save on publish</span>
                </label>
              </div>
            </div>

            {/* Auto-Popup Frequency Cap + Browser Push */}
            <div className="bg-[#121217] border border-[#262630] rounded-xl p-3.5 space-y-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-white flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                  <span>Auto-Popup Limit Per User</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMaxPopupViews(1)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      maxPopupViews === 1
                        ? 'bg-amber-500 text-black border-amber-500 shadow'
                        : 'bg-[#181820] text-[#a1a1aa] border-[#262630] hover:text-white'
                    }`}
                  >
                    Show Once (1×)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMaxPopupViews(2)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      maxPopupViews === 2
                        ? 'bg-amber-500 text-black border-amber-500 shadow'
                        : 'bg-[#181820] text-[#a1a1aa] border-[#262630] hover:text-white'
                    }`}
                  >
                    Show Twice (2×)
                  </button>
                </div>
                <p className="text-[10px] text-[#71717a]">
                  Once capped or marked read, it stays quietly in the Account notification bell
                  until auto-deleted.
                </p>
              </div>

              <div className="pt-2 border-t border-[#20202a] space-y-1">
                <label
                  className={`flex items-center justify-between gap-2 select-none ${
                    pushReady ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'
                  }`}
                >
                  <span className="text-[11px] text-zinc-200 font-semibold flex items-center gap-1.5 flex-wrap">
                    <span>Also send Browser Push ({pushSubscribers} subscribed)</span>
                    {!pushReady && (
                      <span className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        Standby
                      </span>
                    )}
                  </span>
                  <input
                    type="checkbox"
                    checked={pushReady && sendPush}
                    disabled={!pushReady}
                    onChange={(e) => setSendPush(e.target.checked)}
                    className="accent-[#7c3aed] w-4 h-4 disabled:opacity-50"
                  />
                </label>
                {!pushReady && (
                  <p className="text-[10px] text-amber-300/80">
                    In-app auto-popup &amp; notification bell are fully active. Install{' '}
                    <span className="font-mono">pywebpush</span> on the server to enable OS push.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Live Preview */}
          {(title.trim() || message.trim()) && (
            <div className="bg-[#121217] border border-violet-500/25 rounded-xl p-3.5 space-y-1.5">
              <span className="text-[10px] uppercase tracking-wider font-bold text-violet-300">
                Live Plain-Text Preview
              </span>
              <h4 className="text-xs font-extrabold text-white break-words">
                {title.trim() || '(Untitled)'}
              </h4>
              <p className="text-xs text-zinc-300 whitespace-pre-wrap break-words leading-relaxed">
                {message.trim() || '(Message preview)'}
              </p>
            </div>
          )}

          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={publishing}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6366f1] hover:from-[#6d28d9] hover:to-[#4f46e5] text-white text-xs font-extrabold shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Review &amp; Publish Broadcast</span>
            </button>
          </div>
        </form>
      </div>

      {/* === 3. ACTIVE BROADCASTS LIST === */}
      <div className="bg-[#181820] border border-[#262630] rounded-2xl p-4 sm:p-5 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Active Website Broadcasts ({broadcasts.length})
          </h3>
          <span className="text-[10px] text-[#71717a]">
            Expired items are deleted automatically
          </span>
        </div>

        {broadcasts.length === 0 ? (
          <div className="bg-[#121217] border border-[#262630] rounded-xl p-6 text-center text-xs text-[#71717a]">
            No active website broadcasts right now. Publish one above to notify logged-in website
            users.
          </div>
        ) : (
          <div className="space-y-2.5">
            {broadcasts.map((item) => {
              const Icon =
                item.priority === 'important'
                  ? AlertCircle
                  : item.priority === 'offer'
                  ? Sparkles
                  : Megaphone;
              const pillCls =
                item.priority === 'important'
                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                  : item.priority === 'offer'
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  : 'bg-violet-500/15 text-violet-300 border-violet-500/30';

              return (
                <div
                  key={item.id}
                  className="bg-[#121217] border border-[#262630] rounded-xl p-3.5 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${pillCls}`}
                      >
                        <Icon className="w-2.5 h-2.5" />
                        {item.priority === 'important'
                          ? 'Alert'
                          : item.priority === 'offer'
                          ? 'Offer'
                          : 'Info'}
                      </span>
                      <span className="text-xs font-bold text-white break-words">{item.title}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        Popup {item.max_popup_views}×
                      </span>
                    </div>

                    <p className="text-xs text-zinc-300 whitespace-pre-wrap break-words leading-relaxed">
                      {item.message}
                    </p>

                    <div className="flex items-center gap-x-3 gap-y-1 text-[10px] text-[#71717a] flex-wrap font-mono">
                      <span>#{item.id}</span>
                      <span className="text-violet-300">{formatExpiryCountdown(item.expires_at)}</span>
                      <span>• Retention: {formatDurationHours(item.retention_hours)}</span>
                      {item.send_push ? (
                        <span className="text-cyan-300">
                          • Push sent: {item.push_sent_count}
                          {item.push_failed_count > 0 ? ` (${item.push_failed_count} failed)` : ''}
                        </span>
                      ) : (
                        <span>• In-App only</span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={deletingId === item.id}
                    onClick={() => handleDelete(item)}
                    className="shrink-0 p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 transition-colors disabled:opacity-40 cursor-pointer"
                    title="Delete broadcast now"
                    aria-label="Delete broadcast"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* === 4. PUBLISH CONFIRMATION MODAL === */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => {
            if (!publishing) setConfirmOpen(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[#2e2e40] bg-[#16161f] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-[#262635] flex items-center justify-between bg-[#12121a]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Confirm Website Broadcast</h3>
                  <p className="text-[11px] text-[#a1a1aa]">
                    Review before sending to logged-in website users
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={publishing}
                onClick={() => setConfirmOpen(false)}
                className="text-[#a1a1aa] hover:text-white p-1.5 rounded-lg hover:bg-[#20202c]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="bg-[#121217] border border-[#262630] rounded-xl p-3.5 space-y-2">
                <div className="font-extrabold text-white text-sm break-words">{title.trim()}</div>
                <div className="text-zinc-300 whitespace-pre-wrap break-words leading-relaxed max-h-40 overflow-y-auto">
                  {message.trim()}
                </div>
              </div>

              <div className="bg-[#121217] border border-[#262630] rounded-xl p-3 space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[#a1a1aa]">Auto-Popup Cap</span>
                  <span className="font-bold text-amber-300">
                    {maxPopupViews === 1 ? 'Show Once (1×)' : 'Show Twice (2×)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#a1a1aa]">Auto-Delete After</span>
                  <span className="font-bold text-violet-300">
                    {formatDurationHours(parsedHours)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#a1a1aa]">Browser Web Push</span>
                  <span className="font-bold text-cyan-300">
                    {!pushReady
                      ? 'Standby (In-App delivery active)'
                      : sendPush
                      ? `Enabled (${pushSubscribers} subscribers)`
                      : 'Off (In-App only)'}
                  </span>
                </div>
              </div>
            </div>

            <div className="px-5 py-3.5 border-t border-[#262635] bg-[#12121a] flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={publishing}
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#a1a1aa] hover:text-white hover:bg-[#20202c]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={publishing}
                onClick={handleConfirmPublish}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6366f1] hover:from-[#6d28d9] hover:to-[#4f46e5] text-white text-xs font-extrabold shadow-md disabled:opacity-50 cursor-pointer"
              >
                {publishing ? 'Publishing...' : 'Publish Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
