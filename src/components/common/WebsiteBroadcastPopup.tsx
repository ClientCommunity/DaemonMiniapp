import React, { useEffect, useState } from 'react';
import {
  BellRing,
  Sparkles,
  Megaphone,
  AlertCircle,
  X,
  Copy,
  Check,
  Clock,
  Bell,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useWebsiteNotifications } from '../../context/WebsiteNotificationsContext';

function formatRelativeTime(iso?: string): string {
  if (!iso) return '';
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '';
  const diffMin = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export const WebsiteBroadcastPopup: React.FC = () => {
  const { theme, addToast } = useApp();
  const {
    activePopup,
    dismissPopup,
    pushSupported,
    pushServerReady,
    pushPermission,
    isPushSubscribed,
    pushBusy,
    enablePush,
  } = useWebsiteNotifications();

  const [copied, setCopied] = useState(false);
  const isLight = theme === 'light';

  useEffect(() => {
    if (!activePopup) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dismissPopup(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [activePopup, dismissPopup]);

  if (!activePopup) return null;

  const priority = String(activePopup.priority || 'normal').toLowerCase();
  const accent =
    priority === 'important'
      ? {
          badge: 'Important',
          icon: AlertCircle,
          iconBg: 'bg-rose-500/15 border-rose-500/35 text-rose-400',
          pill: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
          bar: 'from-rose-500 via-orange-500 to-amber-500',
        }
      : priority === 'offer'
      ? {
          badge: 'Special Offer',
          icon: Sparkles,
          iconBg: 'bg-amber-500/15 border-amber-500/35 text-amber-400',
          pill: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
          bar: 'from-amber-400 via-orange-500 to-violet-500',
        }
      : {
          badge: 'Announcement',
          icon: Megaphone,
          iconBg: 'bg-violet-500/15 border-violet-500/35 text-violet-400',
          pill: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
          bar: 'from-[#7c3aed] via-[#6366f1] to-[#3b82f6]',
        };

  const PriorityIcon = accent.icon;

  const handleCopy = () => {
    const fullText = `${activePopup.title}\n\n${activePopup.message}`;
    navigator.clipboard?.writeText(fullText);
    setCopied(true);
    addToast('Notification text copied', 'info');
    setTimeout(() => setCopied(false), 2000);
  };

  const canPromptPush =
    pushSupported && pushServerReady && !isPushSubscribed && pushPermission === 'default';

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={() => dismissPopup(false)}
    >
      <div
        style={{ backgroundColor: isLight ? '#ffffff' : '#14141c', opacity: 1 }}
        className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ${
          isLight
            ? 'bg-white border-[#E5DCF4] text-[#211536] shadow-purple-950/20'
            : 'bg-[#14141c] border-[#2b2b3d] text-white shadow-black/90'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Strip */}
        <div className={`h-1 w-full bg-gradient-to-r ${accent.bar}`} />

        {/* Header */}
        <div
          className={`px-5 py-4 border-b flex items-start justify-between gap-3 ${
            isLight ? 'border-[#EFE9FA] bg-[#FAF8FF]' : 'border-[#232332] bg-[#181823]'
          }`}
        >
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${accent.iconBg}`}
            >
              <PriorityIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${accent.pill}`}
                >
                  {accent.badge}
                </span>
                {activePopup.created_at && (
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] ${
                      isLight ? 'text-[#74638B]' : 'text-zinc-400'
                    }`}
                  >
                    <Clock className="w-2.5 h-2.5" />
                    {formatRelativeTime(activePopup.created_at)}
                  </span>
                )}
              </div>
              <h3
                className={`text-sm sm:text-base font-extrabold leading-snug break-words ${
                  isLight ? 'text-[#211536]' : 'text-white'
                }`}
              >
                {activePopup.title}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={() => dismissPopup(false)}
            className={`p-1.5 rounded-lg transition-colors shrink-0 ${
              isLight
                ? 'text-[#74638B] hover:text-[#211536] hover:bg-purple-100/60'
                : 'text-zinc-400 hover:text-white hover:bg-[#232332]'
            }`}
            aria-label="Close announcement"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body (Links rendered strictly as clean, selectable plain text) */}
        <div className="px-5 py-4 space-y-3.5 max-h-[55vh] overflow-y-auto">
          <div
            className={`rounded-xl p-3.5 border text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words select-text ${
              isLight
                ? 'bg-[#FAF8FF] border-[#E5DCF4] text-[#35264E]'
                : 'bg-[#101017] border-[#242434] text-zinc-200'
            }`}
          >
            {activePopup.message}
          </div>

          {/* Optional non-intrusive Browser Push Opt-In Strip */}
          {canPromptPush && (
            <div
              className={`rounded-xl px-3.5 py-2.5 border flex items-center justify-between gap-2.5 ${
                isLight
                  ? 'bg-violet-50 border-violet-200 text-[#3B2660]'
                  : 'bg-violet-500/10 border-violet-500/25 text-violet-200'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <BellRing className="w-4 h-4 text-violet-400 shrink-0" />
                <span className="text-[11px] leading-snug">
                  Get instant alerts even when this tab is closed?
                </span>
              </div>
              <button
                type="button"
                disabled={pushBusy}
                onClick={enablePush}
                className="shrink-0 px-2.5 py-1 rounded-lg bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-[10px] font-bold transition-colors disabled:opacity-50"
              >
                {pushBusy ? 'Enabling...' : 'Enable'}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={`px-5 py-3.5 border-t flex items-center justify-between gap-2 ${
            isLight ? 'border-[#EFE9FA] bg-[#FAF8FF]' : 'border-[#232332] bg-[#181823]'
          }`}
        >
          <button
            type="button"
            onClick={handleCopy}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
              isLight
                ? 'bg-white border-[#E5DCF4] text-[#514364] hover:text-[#211536]'
                : 'bg-[#12121a] border-[#2a2a3c] text-zinc-300 hover:text-white'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => dismissPopup(true)}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6366f1] hover:from-[#6d28d9] hover:to-[#4f46e5] text-white text-xs font-extrabold shadow-md active:scale-95 transition-all cursor-pointer"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Got it</span>
          </button>
        </div>
      </div>
    </div>
  );
};
