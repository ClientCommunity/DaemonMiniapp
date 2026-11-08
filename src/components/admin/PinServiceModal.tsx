import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { adminApi } from '../../api/adminApi';
import { PinnedServiceItem, storeApi } from '../../api/endpoints';
import {
  Pin,
  X,
  Search,
  Sparkles,
  Check,
  Flame,
  Zap,
  Trash2,
  Tag,
  Layers,
  Globe,
  Radio,
  Share2,
} from 'lucide-react';

export interface PreselectedServiceInfo {
  server_no: number;
  service_id: string;
  service_name: string;
  category_name?: string;
  country_code?: string;
  country_name?: string;
  price?: number;
  badge?: string;
}

interface PinServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPinnedSuccessfully: () => void;
  initialService?: PreselectedServiceInfo | null;
  pinnedList?: PinnedServiceItem[];
}

const BADGE_PRESETS = [
  { label: 'Hot', icon: Flame, color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  { label: 'Instant', icon: Zap, color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  { label: 'Best Seller', icon: Sparkles, color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  { label: 'VIP', icon: Tag, color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' },
  { label: 'Sale', icon: Tag, color: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
  { label: 'Popular', icon: Sparkles, color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
];

export const PinServiceModal: React.FC<PinServiceModalProps> = ({
  isOpen,
  onClose,
  onPinnedSuccessfully,
  initialService = null,
  pinnedList = [],
}) => {
  const { server1Items, server2Items, server34Items, addToast } = useApp();

  const [activeServer, setActiveServer] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedService, setSelectedService] = useState<PreselectedServiceInfo | null>(null);
  const [badge, setBadge] = useState('Hot');
  const [displayOrder, setDisplayOrder] = useState('0');
  const [isManualMode, setIsManualMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Server 5 On-Demand Server-Side Search (Eliminates mobile memory crashes)
  const [s5Results, setS5Results] = useState<Array<{
    server_no: number;
    service_id: string;
    service_name: string;
    category_name?: string;
    country_name?: string;
    country_code?: string;
    price?: number;
    stock?: number;
  }>>([]);
  const [isSearchingS5, setIsSearchingS5] = useState(false);

  useEffect(() => {
    if (!isOpen || activeServer !== 5) return;
    let cancelled = false;
    setIsSearchingS5(true);
    const t = setTimeout(async () => {
      try {
        const res = await storeApi.getServer5({
          page: 1,
          limit: 30,
          search: searchQuery.trim() || undefined,
        });
        if (!cancelled && res?.success && Array.isArray(res.items)) {
          setS5Results(
            res.items.map((item) => ({
              server_no: 5,
              service_id: String(item.id),
              service_name: item.name || 'SMM Service',
              category_name: item.category || 'SMM',
              country_name: '',
              country_code: '',
              price: Number(item.price || 0),
              stock: undefined,
            }))
          );
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setIsSearchingS5(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [isOpen, activeServer, searchQuery]);

  // Sync initial service when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialService) {
        setActiveServer(initialService.server_no);
        setSelectedService(initialService);
        if (initialService.badge) setBadge(initialService.badge);
      } else {
        setSelectedService(null);
        setSearchQuery('');
        setBadge('Hot');
        setDisplayOrder('0');
        setIsManualMode(false);
      }
    }
  }, [isOpen, initialService]);

  // Check if current selected service is already pinned
  const existingPin = useMemo(() => {
    if (!selectedService) return null;
    return (
      pinnedList.find(
        (p) =>
          p.server_no === selectedService.server_no &&
          String(p.service_id).trim().toLowerCase() ===
            String(selectedService.service_id).trim().toLowerCase()
      ) || null
    );
  }, [selectedService, pinnedList]);

  // Catalog items for the selected server
  const filteredCatalog = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    if (activeServer === 1) {
      return (server1Items || [])
        .filter((item) => !q || item.country.toLowerCase().includes(q) || item.countryCode.toLowerCase().includes(q))
        .map((item) => ({
          server_no: 1,
          service_id: item.countryCode || item.country,
          service_name: `${item.country} 2FA Account`,
          category_name: 'Telegram 2FA',
          country_name: item.country,
          country_code: item.countryCode,
          price: item.priceInr,
          stock: item.stockCount,
        }));
    }

    if (activeServer === 2) {
      return (server2Items || [])
        .filter(
          (item) =>
            !q ||
            item.country.toLowerCase().includes(q) ||
            item.qualityTier.toLowerCase().includes(q) ||
            String(item.accountYear).includes(q)
        )
        .map((item) => ({
          server_no: 2,
          service_id: `${item.countryCode || item.country}_${item.qualityTier}_${item.accountYear}`,
          service_name: `${item.country} ${item.accountYear} (${item.qualityTier === 'good' ? 'Good' : 'Cheap'})`,
          category_name: `Telegram ${item.qualityTier.toUpperCase()} Session`,
          country_name: item.country,
          country_code: item.countryCode,
          price: item.priceInr,
          stock: item.stockCount,
        }));
    }

    if (activeServer === 3 || activeServer === 4) {
      return (server34Items || [])
        .filter((item) => item.server === activeServer)
        .filter(
          (item) =>
            !q ||
            item.serviceName.toLowerCase().includes(q) ||
            item.country.toLowerCase().includes(q) ||
            item.serviceCode.toLowerCase().includes(q)
        )
        .map((item) => ({
          server_no: activeServer,
          service_id: item.serviceCode,
          service_name: `${item.serviceName} (${item.country})`,
          category_name: item.serviceName,
          country_name: item.country,
          country_code: item.countryCode,
          price: item.priceInr,
          stock: item.availableCount,
        }));
    }

    if (activeServer === 5) {
      return s5Results;
    }

    return [];
  }, [activeServer, searchQuery, server1Items, server2Items, server34Items, s5Results]);

  const handleSelectFromList = (item: {
    server_no: number;
    service_id: string;
    service_name: string;
    category_name?: string;
    country_name?: string;
    country_code?: string;
    price?: number;
  }) => {
    setSelectedService({
      server_no: item.server_no,
      service_id: item.service_id,
      service_name: item.service_name,
      category_name: item.category_name,
      country_name: item.country_name,
      country_code: item.country_code,
      price: item.price,
    });
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService || !selectedService.service_id || !selectedService.service_name) {
      addToast('Please select or specify a valid service', 'error');
      return;
    }

    setSubmitting(true);
    try {
      if (existingPin) {
        // Update existing pin badge/order
        await adminApi.updatePinnedService(existingPin.id, {
          badge: badge.trim() || 'Hot',
          display_order: parseInt(displayOrder, 10) || 0,
          is_active: 1,
        });
        addToast(`Updated pin for "${selectedService.service_name}"`, 'success');
      } else {
        // Create new pin
        await adminApi.addPinnedService({
          server_no: selectedService.server_no,
          service_id: selectedService.service_id,
          service_name: selectedService.service_name,
          category_name: selectedService.category_name || '',
          country_name: selectedService.country_name || '',
          country_code: selectedService.country_code || '',
          badge: badge.trim() || 'Hot',
          display_order: parseInt(displayOrder, 10) || 0,
        });
        addToast(`Successfully pinned "${selectedService.service_name}"!`, 'success');
      }

      onPinnedSuccessfully();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to pin service';
      addToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnpin = async () => {
    if (!existingPin) return;
    if (!window.confirm(`Unpin "${existingPin.service_name}" from the store?`)) return;

    setSubmitting(true);
    try {
      await adminApi.deletePinnedService(existingPin.id);
      addToast(`Unpinned "${existingPin.service_name}"`, 'success');
      onPinnedSuccessfully();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to unpin service';
      addToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#181820] border border-[#262635] w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#262630] flex items-center justify-between bg-[#14141a]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Pin className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>{existingPin ? 'Manage Pinned Service' : 'Pin Service to Storefront'}</span>
                {existingPin && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-semibold">
                    Currently Pinned
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-[#a1a1aa]">
                Featured at the top of the Home Dashboard & Store tab for all users.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#a1a1aa] hover:text-white p-1.5 rounded-lg hover:bg-[#20202a] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 no-scrollbar">
          {/* Server Selector Tabs (Only active if not in pre-selected mode or Krish wants to switch) */}
          <div>
            <label className="text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wider block mb-1.5">
              Select Target Server:
            </label>
            <div className="grid grid-cols-5 gap-1.5 bg-[#121217] p-1 rounded-xl border border-[#262630]">
              {[
                { no: 1, label: 'S1: 2FA', icon: Globe },
                { no: 2, label: 'S2: Stock', icon: Layers },
                { no: 3, label: 'S3: Virtual', icon: Zap },
                { no: 4, label: 'S4: Carrier', icon: Radio },
                { no: 5, label: 'S5: SMM', icon: Share2 },
              ].map((s) => {
                const Icon = s.icon;
                const isCurrent = activeServer === s.no;
                return (
                  <button
                    key={s.no}
                    type="button"
                    onClick={() => {
                      setActiveServer(s.no);
                      setSelectedService(null);
                      setSearchQuery('');
                    }}
                    className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-[10px] font-bold transition-all ${
                      isCurrent
                        ? 'bg-amber-500 text-black shadow-sm font-extrabold'
                        : 'text-[#a1a1aa] hover:text-white hover:bg-[#1a1a24]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 mb-1 shrink-0" />
                    <span className="truncate w-full text-center">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Service Search Bar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wider">
                Select Service from Server {activeServer}:
              </label>
              <button
                type="button"
                onClick={() => setIsManualMode(!isManualMode)}
                className="text-[11px] text-amber-400 hover:text-amber-300 font-medium underline"
              >
                {isManualMode ? 'Back to Catalog Picker' : 'Enter Manually'}
              </button>
            </div>

            {!isManualMode ? (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-[#71717a] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder={`Search Server ${activeServer} catalog (e.g. ${
                      activeServer === 5
                        ? 'Instagram, Telegram, YouTube...'
                        : activeServer === 2
                        ? 'Bangladesh, 2025, Good...'
                        : activeServer === 1
                        ? 'USA, Russia, Algeria...'
                        : 'WhatsApp, Telegram, India...'
                    })`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#121217] border border-[#262630] focus:border-amber-500/60 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-[#71717a] outline-none transition-colors"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2.5 text-xs text-[#71717a] hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Catalog List */}
                <div className="max-h-48 overflow-y-auto rounded-xl border border-[#262630] bg-[#121217] divide-y divide-[#20202a]">
                  {activeServer === 5 && isSearchingS5 ? (
                    <div className="p-4 text-center text-xs text-[#a1a1aa] animate-pulse">
                      Searching Server 5 catalog...
                    </div>
                  ) : filteredCatalog.length === 0 ? (
                    <div className="p-4 text-center text-xs text-[#71717a]">
                      No services found for "{searchQuery}". Try another keyword or switch server.
                    </div>
                  ) : (
                    filteredCatalog.map((item) => {
                      const isSelected =
                        selectedService?.server_no === item.server_no &&
                        String(selectedService?.service_id) === String(item.service_id);
                      const isItemPinned = pinnedList.some(
                        (p) =>
                          p.server_no === item.server_no &&
                          String(p.service_id) === String(item.service_id)
                      );

                      return (
                        <div
                          key={`${item.server_no}_${item.service_id}`}
                          onClick={() => handleSelectFromList(item)}
                          className={`p-2.5 flex items-center justify-between gap-2.5 cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-amber-500/15 border-l-2 border-amber-500'
                              : 'hover:bg-[#1a1a24]'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-white truncate max-w-[280px]">
                                {item.service_name}
                              </span>
                              {isItemPinned && (
                                <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded font-semibold flex items-center gap-0.5">
                                  <Pin className="w-2.5 h-2.5" /> Pinned
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-[#a1a1aa] mt-0.5">
                              <span className="font-mono text-[#38bdf8]">ID: {item.service_id}</span>
                              {item.category_name && <span>• {item.category_name}</span>}
                              {item.country_name && <span>• {item.country_name}</span>}
                              {item.stock !== undefined && (
                                <span className="text-emerald-400">• Stock: {item.stock}</span>
                              )}
                            </div>
                          </div>

                          <div className="text-right shrink-0 flex items-center gap-2">
                            {item.price !== undefined && (
                              <span className="text-xs font-extrabold text-[#22c55e] font-mono">
                                ₹{item.price}
                              </span>
                            )}
                            <div
                              className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                                isSelected
                                  ? 'bg-amber-500 border-amber-500 text-black'
                                  : 'border-[#383848] text-transparent'
                              }`}
                            >
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              /* Manual Input Mode */
              <div className="space-y-3 bg-[#121217] p-3.5 rounded-xl border border-[#262630]">
                <div>
                  <label className="text-[10px] text-[#a1a1aa] block mb-1">Service ID / Code</label>
                  <input
                    type="text"
                    value={selectedService?.service_id || ''}
                    onChange={(e) =>
                      setSelectedService((prev) => ({
                        server_no: activeServer,
                        service_id: e.target.value,
                        service_name: prev?.service_name || '',
                        category_name: prev?.category_name,
                        country_name: prev?.country_name,
                      }))
                    }
                    placeholder="e.g. 101, tg, wa, US"
                    className="w-full bg-[#181820] border border-[#262630] rounded-lg px-3 py-1.5 text-xs text-white font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#a1a1aa] block mb-1">Display Title</label>
                  <input
                    type="text"
                    value={selectedService?.service_name || ''}
                    onChange={(e) =>
                      setSelectedService((prev) => ({
                        server_no: activeServer,
                        service_id: prev?.service_id || '',
                        service_name: e.target.value,
                        category_name: prev?.category_name,
                        country_name: prev?.country_name,
                      }))
                    }
                    placeholder="e.g. Instagram Followers Instant"
                    className="w-full bg-[#181820] border border-[#262630] rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-[#a1a1aa] block mb-1">Category (optional)</label>
                    <input
                      type="text"
                      value={selectedService?.category_name || ''}
                      onChange={(e) =>
                        setSelectedService((prev) => ({
                          ...(prev || { server_no: activeServer, service_id: '', service_name: '' }),
                          category_name: e.target.value,
                        }))
                      }
                      placeholder="e.g. Instagram"
                      className="w-full bg-[#181820] border border-[#262630] rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#a1a1aa] block mb-1">Country (optional)</label>
                    <input
                      type="text"
                      value={selectedService?.country_name || ''}
                      onChange={(e) =>
                        setSelectedService((prev) => ({
                          ...(prev || { server_no: activeServer, service_id: '', service_name: '' }),
                          country_name: e.target.value,
                        }))
                      }
                      placeholder="e.g. India"
                      className="w-full bg-[#181820] border border-[#262630] rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Selected Service Card Preview */}
          {selectedService && (
            <div className="bg-[#121217] border border-amber-500/30 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                  Selected Target Service
                </span>
                <span className="text-xs font-mono font-bold text-[#22c55e]">
                  {selectedService.price !== undefined ? `₹${selectedService.price}` : ''}
                </span>
              </div>
              <h4 className="text-xs font-bold text-white">{selectedService.service_name}</h4>
              <p className="text-[10px] text-[#a1a1aa] flex items-center gap-2">
                <span>Server {selectedService.server_no}</span>
                <span>• ID: <code className="text-[#38bdf8]">{selectedService.service_id}</code></span>
                {selectedService.category_name && <span>• {selectedService.category_name}</span>}
                {selectedService.country_name && <span>• {selectedService.country_name}</span>}
              </p>
            </div>
          )}

          {/* Badge & Order Customization */}
          <div className="space-y-3 pt-2 border-t border-[#262630]">
            <div>
              <label className="text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wider block mb-1.5">
                Feature Badge Tag:
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {BADGE_PRESETS.map((p) => {
                  const Icon = p.icon;
                  const isSelected = badge.toLowerCase() === p.label.toLowerCase();
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setBadge(p.label)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                        isSelected
                          ? `${p.color} ring-1 ring-amber-400 shadow-sm`
                          : 'bg-[#121217] text-[#a1a1aa] border-[#262630] hover:text-white'
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      <span>{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-[#a1a1aa] block mb-1">
                  Custom Badge Text:
                </label>
                <input
                  type="text"
                  value={badge}
                  onChange={(e) => setBadge(e.target.value)}
                  placeholder="e.g. 50% Off, Fast, VIP"
                  className="w-full bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs text-white outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#a1a1aa] block mb-1">
                  Priority Sort Order #:
                </label>
                <input
                  type="number"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(e.target.value)}
                  placeholder="0"
                  className="w-full bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs text-white outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-[#262630] flex items-center justify-between bg-[#14141a]">
          <div>
            {existingPin ? (
              <button
                type="button"
                onClick={handleUnpin}
                disabled={submitting}
                className="flex items-center gap-1.5 text-xs font-bold text-red-400 hover:text-red-300 px-3 py-2 rounded-xl hover:bg-red-500/10 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Unpin from Store</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-semibold text-[#a1a1aa] hover:text-white px-3 py-2"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSavePin}
              disabled={submitting || !selectedService}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-extrabold px-5 py-2.5 rounded-xl text-xs transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Pin className="w-4 h-4" />
              <span>
                {submitting
                  ? 'Saving...'
                  : existingPin
                  ? 'Update Pinned Service'
                  : 'Pin to Storefront'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
