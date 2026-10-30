import React, { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../../api/adminApi';
import { PinnedServiceItem } from '../../../api/endpoints';
import { useApp } from '../../../context/AppContext';
import {
  Pin,
  Plus,
  Trash2,
  RefreshCw,
  Send,
  Megaphone,
} from 'lucide-react';

export const PinnedServicesTab: React.FC = () => {
  const { addToast } = useApp();
  const [pinnedItems, setPinnedItems] = useState<PinnedServiceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [serverFilter, setServerFilter] = useState<number | null>(null);

  // Add Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formServerNo, setFormServerNo] = useState<number>(5);
  const [formServiceId, setFormServiceId] = useState('');
  const [formServiceName, setFormServiceName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formCountry, setFormCountry] = useState('');
  const [formBadge, setFormBadge] = useState('🔥 Hot');
  const [formOrder, setFormOrder] = useState('0');
  const [submitting, setSubmitting] = useState(false);

  // Broadcast Modal State
  const [broadcastTarget, setBroadcastTarget] = useState<PinnedServiceItem | null>(null);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastButtonLabel, setBroadcastButtonLabel] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);

  const loadPinned = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getPinnedServices(serverFilter || undefined);
      if (res?.success && Array.isArray(res.pinned)) {
        setPinnedItems(res.pinned);
      }
    } catch {
      addToast('Failed to load pinned services', 'error');
    } finally {
      setLoading(false);
    }
  }, [serverFilter, addToast]);

  useEffect(() => {
    loadPinned();
  }, [loadPinned]);

  const handleToggleActive = async (item: PinnedServiceItem) => {
    const nextStatus = item.is_active ? 0 : 1;
    try {
      const res = await adminApi.updatePinnedService(item.id, { is_active: nextStatus });
      if (res?.success) {
        setPinnedItems((prev) =>
          prev.map((p) => (p.id === item.id ? { ...p, is_active: nextStatus } : p))
        );
        addToast(
          `Service is now ${nextStatus ? 'ACTIVE (visible to users)' : 'HIDDEN'}`,
          'success'
        );
      }
    } catch {
      addToast('Failed to update status', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Remove this service from the pinned list?')) return;
    try {
      const res = await adminApi.deletePinnedService(id);
      if (res?.success) {
        setPinnedItems((prev) => prev.filter((p) => p.id !== id));
        addToast('Service unpinned successfully', 'success');
      }
    } catch {
      addToast('Failed to delete pinned service', 'error');
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formServiceId.trim() || !formServiceName.trim()) {
      addToast('Service ID and Name are required', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await adminApi.addPinnedService({
        server_no: formServerNo,
        service_id: formServiceId.trim(),
        service_name: formServiceName.trim(),
        category_name: formCategory.trim(),
        country_name: formCountry.trim(),
        badge: formBadge.trim() || '🔥 Hot',
        display_order: parseInt(formOrder, 10) || 0,
      });

      if (res?.success && res.item) {
        addToast('Service successfully pinned!', 'success');
        setIsAddModalOpen(false);
        setFormServiceId('');
        setFormServiceName('');
        setFormCategory('');
        setFormCountry('');
        setFormOrder('0');
        loadPinned();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to pin service';
      addToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenBroadcast = (item: PinnedServiceItem) => {
    setBroadcastTarget(item);
    setBroadcastMessage(
      `<b>${item.badge || '🔥 Hot'} Featured Service Alert!</b>\n\n` +
      `<b>${item.service_name}</b> (Server ${item.server_no}) is now available with high speed and instant fulfillment.\n` +
      `Tap the button below to buy immediately!`
    );
    setBroadcastButtonLabel(`⚡ Buy ${item.service_name}`);
  };

  const handleSendBroadcast = async () => {
    if (!broadcastTarget) return;
    setBroadcasting(true);
    try {
      const res = await adminApi.broadcastPinnedService(
        broadcastTarget.id,
        broadcastMessage.trim(),
        broadcastButtonLabel.trim()
      );
      if (res?.success) {
        addToast(
          `Broadcast completed: Sent to ${res.sent} users (${res.failed} unreachable)`,
          'success'
        );
        setBroadcastTarget(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Broadcast failed';
      addToast(msg, 'error');
    } finally {
      setBroadcasting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="bg-[#181820] border border-[#262630] rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <Pin className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>Pinned & Featured Services</span>
                <span className="text-[10px] font-mono text-amber-400 font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                  {pinnedItems.length} items
                </span>
              </h3>
              <p className="text-xs text-[#a1a1aa] mt-0.5">
                Pin any service from Servers 1–5 to show at the top of the Home Dashboard & each Server tab.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => loadPinned()}
              disabled={loading}
              className="p-2 rounded-xl bg-[#121217] border border-[#262630] text-[#a1a1aa] hover:text-white transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-md active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Pin New Service</span>
            </button>
          </div>
        </div>

        {/* Server filter pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-4 mt-4 border-t border-[#262630] scrollbar-none">
          <button
            onClick={() => setServerFilter(null)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              serverFilter === null
                ? 'bg-amber-500 text-black shadow-sm'
                : 'bg-[#121217] text-[#a1a1aa] hover:text-white border border-[#262630]'
            }`}
          >
            All Servers
          </button>
          {[1, 2, 3, 4, 5].map((sNo) => (
            <button
              key={sNo}
              onClick={() => setServerFilter(sNo)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                serverFilter === sNo
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'bg-[#121217] text-[#a1a1aa] hover:text-white border border-[#262630]'
              }`}
            >
              Server {sNo}
            </button>
          ))}
        </div>
      </div>

      {/* Pinned Services List */}
      {pinnedItems.length === 0 ? (
        <div className="bg-[#181820] border border-[#262630] rounded-2xl p-10 text-center">
          <Pin className="w-8 h-8 text-[#71717a] mx-auto mb-2 opacity-50" />
          <h4 className="text-sm font-bold text-white mb-1">No Pinned Services</h4>
          <p className="text-xs text-[#a1a1aa] max-w-sm mx-auto mb-4">
            You haven't pinned any services yet. Click the button below to feature services from any server.
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 bg-amber-500 text-black font-bold px-4 py-2 rounded-xl text-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Pin First Service</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {pinnedItems.map((item) => (
            <div
              key={item.id}
              className={`bg-[#181820] border rounded-2xl p-4 transition-all duration-200 flex flex-col justify-between ${
                item.is_active
                  ? 'border-[#262630] hover:border-amber-500/40 shadow-sm'
                  : 'border-red-500/20 opacity-60 bg-[#14141a]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-[#121217] border border-[#262630] text-[10px] font-bold text-amber-400">
                      Server {item.server_no}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[10px] font-bold text-amber-300">
                      {item.badge}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleToggleActive(item)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${
                        item.is_active
                          ? 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30'
                          : 'bg-[#ef4444]/15 text-[#ef4444] border-[#ef4444]/30'
                      }`}
                    >
                      {item.is_active ? 'Active' : 'Disabled'}
                    </button>
                  </div>
                </div>

                <h4 className="text-sm font-bold text-white mb-0.5">{item.service_name}</h4>
                <div className="flex items-center gap-2 text-xs text-[#a1a1aa] mb-3">
                  <span>ID: <code className="text-[#38bdf8]">{item.service_id}</code></span>
                  {item.category_name && <span>• {item.category_name}</span>}
                  {item.country_name && <span>• {item.country_name}</span>}
                  <span>• Order #{item.display_order}</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-3 border-t border-[#262630] flex items-center justify-between gap-2">
                <button
                  onClick={() => handleOpenBroadcast(item)}
                  className="flex items-center gap-1.5 bg-[#38bdf8]/10 hover:bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/30 font-bold px-3 py-1.5 rounded-xl text-xs transition-all"
                  title="Broadcast this service with 1-click button to all Telegram users"
                >
                  <Megaphone className="w-3.5 h-3.5" />
                  <span>Broadcast</span>
                </button>

                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-1.5 text-[#71717a] hover:text-[#ef4444] rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#181820] border border-[#262630] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#262630]">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Pin className="w-4 h-4 text-amber-400" />
                <span>Pin a Service</span>
              </h4>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-[#a1a1aa] hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-[#a1a1aa] block mb-1">
                  Target Server:
                </label>
                <select
                  value={formServerNo}
                  onChange={(e) => setFormServerNo(Number(e.target.value))}
                  className="w-full bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs text-white outline-none"
                >
                  <option value={1}>Server 1 (Global 2FA Accounts / LZT)</option>
                  <option value={2}>Server 2 (Sessions & Combo Stock)</option>
                  <option value={3}>Server 3 (Instant Virtual OTP)</option>
                  <option value={4}>Server 4 (Fresh Carrier OTP)</option>
                  <option value={5}>Server 5 (SMM Hub Services)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#a1a1aa] block mb-1">
                  Service ID / Code:
                </label>
                <input
                  type="text"
                  placeholder="e.g. 101, tg, wa, US"
                  value={formServiceId}
                  onChange={(e) => setFormServiceId(e.target.value)}
                  className="w-full bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#a1a1aa] block mb-1">
                  Display Name:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Telegram India OTP, Instagram Followers"
                  value={formServiceName}
                  onChange={(e) => setFormServiceName(e.target.value)}
                  className="w-full bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs text-white outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#a1a1aa] block mb-1">
                    Category (optional):
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Instagram"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#a1a1aa] block mb-1">
                    Country (optional):
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. India"
                    value={formCountry}
                    onChange={(e) => setFormCountry(e.target.value)}
                    className="w-full bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#a1a1aa] block mb-1">
                    Badge Text:
                  </label>
                  <input
                    type="text"
                    placeholder="🔥 Hot"
                    value={formBadge}
                    onChange={(e) => setFormBadge(e.target.value)}
                    className="w-full bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#a1a1aa] block mb-1">
                    Sort Order #:
                  </label>
                  <input
                    type="number"
                    value={formOrder}
                    onChange={(e) => setFormOrder(e.target.value)}
                    className="w-full bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-[#a1a1aa] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-5 py-2 rounded-xl text-xs transition-all shadow-md"
                >
                  {submitting ? 'Pinning...' : 'Save & Pin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Broadcast Modal */}
      {broadcastTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#181820] border border-[#262630] rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#262630]">
              <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-[#38bdf8]" />
                <h4 className="text-sm font-bold text-white">Broadcast Pinned Service</h4>
              </div>
              <button
                onClick={() => setBroadcastTarget(null)}
                className="text-[#a1a1aa] hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#a1a1aa]">
              This sends a Telegram announcement to all registered bot users with an instant 1-click button opening this service.
            </p>

            <div>
              <label className="text-xs font-semibold text-[#a1a1aa] block mb-1">
                Announcement Message (HTML):
              </label>
              <textarea
                rows={4}
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                className="w-full bg-[#121217] border border-[#262630] rounded-xl p-3 text-xs text-white outline-none font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[#a1a1aa] block mb-1">
                Action Button Text:
              </label>
              <input
                type="text"
                value={broadcastButtonLabel}
                onChange={(e) => setBroadcastButtonLabel(e.target.value)}
                className="w-full bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs text-white outline-none"
              />
            </div>

            <div className="p-3 bg-[#121217] border border-[#262630] rounded-xl text-[11px] text-[#71717a] space-y-1">
              <div>🔗 <b>Direct Deep Links included:</b></div>
              <div>• Telegram Bot: <code>t.me/bot?start=pin_{broadcastTarget.id}</code></div>
              <div>• Mini App: <code>t.me/bot/app?startapp=pin_{broadcastTarget.id}</code></div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setBroadcastTarget(null)}
                className="px-4 py-2 rounded-xl text-xs text-[#a1a1aa] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendBroadcast}
                disabled={broadcasting}
                className="bg-[#38bdf8] hover:bg-[#0284c7] text-black font-bold px-5 py-2 rounded-xl text-xs flex items-center gap-2 shadow-md transition-all disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{broadcasting ? 'Broadcasting...' : 'Send Broadcast Now'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
