import React, { useEffect, useState } from 'react';
import {
  Bell,
  BellOff,
  BellRing,
  X,
  CheckCheck,
  RefreshCw,
  Copy,
  Check,
  Megaphone,
  AlertCircle,
  Sparkles,
  Clock,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useWebsiteNotifications } from '../../context/WebsiteNotificationsContext';
import { WebsiteBroadcastRecord } from '../../api/endpoints';

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

function formatTimeLeft(expiresIso?: string): string {
  if (!expiresIso) return '';
  const ts = Date.parse(expiresIso);
  if (Number.isNaN(ts)) return '';
  const diffMs = ts - Date.now();
  if (diffMs <= 0) return 'Expiring soon';
  const hrs = Math.ceil(diffMs / 3600000);
  if (hrs < 24) return `${hrs}h left`;
  const days = Math.ceil(hrs / 24);
  return `${days}d left`;
}

export const NotificationInboxModal: React.FC = () => {
  const { theme, addToast } = useApp();
  const {
    isInboxOpen,
    closeInbox,
    broadcasts,
    loading,
    unreadCount,
    isOpened,
    markOpened,
    markAllOpened,
    refreshBroadcasts,
    pushSupported,
    pushServerReady,
    pushPermission,
    isPushSubscribed,
    pushBusy,
    enablePush,
    disablePush,
  } = useWebsiteNotifications();

  const [copiedId, setCopiedId] = useState<number | null>(null);
  const isLight = theme === 'light';

  useEffect(() => {
    if (!isInboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeInbox();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isInboxOpen, closeInbox]);

  if (!isInboxOpen) return null;

  const handleCopyItem = (e: React.MouseEvent, item: WebsiteBroadcastRecord) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(`${item.title}\n\n${item.message}`);
    setCopiedId(item.id);
    addToast('Message copied', 'info');
    setTimeout(() => setCopiedId((curr) => (curr === item.id ? null : curr)), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={closeInbox}
    >
      <div
        style={{ backgroundColor: isLight ? '#ffffff' : '#14141c', opacity: 1 }}
        className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-150 ${
          isLight
            ? 'bg-white border-[#E5DCF4] text-[#211536] shadow-purple-950/20'
            : 'bg-[#14141c] border-[#29293a] text-white shadow-black/90'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`px-5 py-4 border-b flex items-center justify-between gap-2 ${
            isLight ? 'border-[#EFE9FA] bg-[#FAF8FF]' : 'border-[#232332] bg-[#181823]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="relative w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span
                  className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ${
                    isLight ? 'ring-[#FAF8FF]' : 'ring-[#181823]'
                  }`}
                />
              )}
            </div>
            <div>
              <h3
                className={`text-sm font-extrabold flex items-center gap-2 ${
                  isLight ? 'text-[#211536]' : 'text-white'
                }`}
              >
                <span>Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
                    {unreadCount} unread
                  </span>
                )}
              </h3>
              <p className={`text-[11px] ${isLight ? 'text-[#74638B]' : 'text-zinc-400'}`}>
                Latest announcements &amp; platform updates
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllOpened}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                  isLight
                    ? 'text-[#7c3aed] hover:bg-purple-100/70'
                    : 'text-violet-300 hover:bg-violet-500/15'
                }`}
                title="Mark all as opened"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Mark all read</span>
              </button>
            )}
            <button
              type="button"
              onClick={refreshBroadcasts}
              disabled={loading}
              className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${
                isLight
                  ? 'text-[#74638B] hover:text-[#211536] hover:bg-purple-100/60'
                  : 'text-zinc-400 hover:text-white hover:bg-[#232332]'
              }`}
              title="Refresh notifications"
              aria-label="Refresh notifications"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={closeInbox}
              className={`p-1.5 rounded-lg transition-colors ${
                isLight
                  ? 'text-[#74638B] hover:text-[#211536] hover:bg-purple-100/60'
                  : 'text-zinc-400 hover:text-white hover:bg-[#232332]'
              }`}
              aria-label="Close notifications"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Browser Push Status Bar */}
        {pushSupported && (
          <div
            className={`px-5 py-3 border-b flex items-center justify-between gap-3 ${
              isLight ? 'border-[#EFE9FA] bg-white' : 'border-[#232332] bg-[#14141c]'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {isPushSubscribed ? (
                <BellRing className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <BellOff className="w-4 h-4 text-zinc-400 shrink-0" />
              )}
              <div className="min-w-0">
                <div
                  className={`text-xs font-bold leading-tight ${
                    isLight ? 'text-[#211536]' : 'text-white'
                  }`}
                >
                  Browser Push Alerts
                </div>
                <p
                  className={`text-[10px] leading-snug truncate ${
                    isLight ? 'text-[#74638B]' : 'text-zinc-400'
                  }`}
                >
                  {isPushSubscribed
                    ? 'Active — alerts delivered even when tab is closed'
                    : pushPermission === 'denied'
                    ? 'Blocked in browser settings (in-app alerts still work)'
                    : !pushServerReady
                    ? 'In-app alerts active (server push standby)'
                    : 'Enable to receive instant OS notifications'}
                </p>
              </div>
            </div>

            {pushServerReady && pushPermission !== 'denied' && (
              <button
                type="button"
                disabled={pushBusy}
                onClick={isPushSubscribed ? disablePush : enablePush}
                className={`shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all disabled:opacity-50 cursor-pointer ${
                  isPushSubscribed
                    ? isLight
                      ? 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100'
                      : 'bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25'
                    : 'bg-[#7c3aed] hover:bg-[#6d28d9] text-white shadow-sm'
                }`}
              >
                {pushBusy ? '...' : isPushSubscribed ? 'Turn Off' : 'Enable'}
              </button>
            )}
          </div>
        )}

        {/* Notification List */}
        <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
          {broadcasts.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div
                className={`w-12 h-12 rounded-2xl mx-auto flex items-center justify-center border ${
                  isLight
                    ? 'bg-[#FAF8FF] border-[#E5DCF4] text-[#8B7AA8]'
                    : 'bg-[#181823] border-[#262635] text-zinc-500'
                }`}
              >
                <Bell className="w-5 h-5" />
              </div>
              <h4
                className={`text-sm font-bold ${isLight ? 'text-[#211536]' : 'text-white'}`}
              >
                No Active Notifications
              </h4>
              <p className={`text-xs max-w-xs mx-auto ${isLight ? 'text-[#74638B]' : 'text-zinc-500'}`}>
                You're all caught up! New announcements from the team will appear right here.
              </p>
            </div>
          ) : (
            broadcasts.map((item) => {
              const opened = isOpened(item.id);
              const priority = String(item.priority || 'normal').toLowerCase();
              const Icon =
                priority === 'important'
                  ? AlertCircle
                  : priority === 'offer'
                  ? Sparkles
                  : Megaphone;
              const iconColor =
                priority === 'important'
                  ? 'text-rose-400 bg-rose-500/15 border-rose-500/30'
                  : priority === 'offer'
                  ? 'text-amber-400 bg-amber-500/15 border-amber-500/30'
                  : 'text-violet-400 bg-violet-500/15 border-violet-500/30';

              return (
                <div
                  key={item.id}
                  onClick={() => markOpened(item.id)}
                  className={`rounded-xl p-3.5 border transition-all cursor-pointer ${
                    !opened
                      ? isLight
                        ? 'bg-violet-50/70 border-violet-300 shadow-sm'
                        : 'bg-[#1a1829] border-violet-500/40 shadow-sm'
                      : isLight
                      ? 'bg-[#FAF8FF] border-[#E5DCF4] opacity-85 hover:opacity-100'
                      : 'bg-[#111118] border-[#232332] opacity-85 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`relative w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${iconColor}`}
                    >
                      <Icon className="w-4 h-4" />
                      {!opened && (
                        <span
                          className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ${
                            isLight ? 'ring-violet-50' : 'ring-[#1a1829]'
                          }`}
                        />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          <h4
                            className={`text-xs sm:text-sm font-bold leading-snug break-words ${
                              isLight ? 'text-[#211536]' : 'text-white'
                            }`}
                          >
                            {item.title}
                          </h4>
                          {!opened && (
                            <span className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500 text-white">
                              New
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={(e) => handleCopyItem(e, item)}
                          className={`p-1 rounded-md shrink-0 transition-colors ${
                            isLight
                              ? 'text-[#74638B] hover:text-[#211536] hover:bg-purple-100'
                              : 'text-zinc-500 hover:text-white hover:bg-[#252536]'
                          }`}
                          title="Copy message"
                        >
                          {copiedId === item.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      {/* Message rendered strictly as plain text (links shown cleanly as text) */}
                      <p
                        className={`text-xs leading-relaxed whitespace-pre-wrap break-words select-text ${
                          isLight ? 'text-[#43335E]' : 'text-zinc-300'
                        }`}
                      >
                        {item.message}
                      </p>

                      <div
                        className={`flex items-center gap-2 text-[10px] pt-0.5 ${
                          isLight ? 'text-[#74638B]' : 'text-zinc-500'
                        }`}
                      >
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {formatRelativeTime(item.created_at)}
                        </span>
                        {item.expires_at && (
                          <>
                            <span>•</span>
                            <span>{formatTimeLeft(item.expires_at)}</span>
                          </>
                        )}
                        {!opened && (
                          <>
                            <span>•</span>
                            <span className="text-violet-400 font-semibold">Tap to mark read</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
