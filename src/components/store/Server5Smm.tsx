import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { SmmPlatform, SmmServiceItem } from '../../types';
import { PlatformIcon } from '../common/PlatformIcon';
import { Modal } from '../common/Modal';
import {
  Rocket,
  Search,
  X,
  Link as LinkIcon,
  ShieldCheck,
  Zap,
  Clock,
  ShoppingBag,
  Plus,
  Minus,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';

export const Server5Smm: React.FC = () => {
  const { formatPrice, submitSmmOrder, server5Items, user, setActiveTab } = useApp();

  const [activePlatform, setActivePlatform] = useState<SmmPlatform | 'all'>(() => {
    try {
      return (localStorage.getItem('krish_smm_platform') as SmmPlatform | 'all') || 'all';
    } catch {
      return 'all';
    }
  });
  const [search, setSearch] = useState<string>(() => {
    try {
      return localStorage.getItem('krish_smm_search') || '';
    } catch {
      return '';
    }
  });
  const [modalService, setModalService] = useState<SmmServiceItem | null>(() => {
    try {
      const saved = localStorage.getItem('krish_smm_modal_service');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [modalTargetLink, setModalTargetLink] = useState<string>(() => {
    try {
      return localStorage.getItem('krish_smm_modal_link') || '';
    } catch {
      return '';
    }
  });
  const [modalQuantity, setModalQuantity] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('krish_smm_modal_qty');
      return saved && Number(saved) > 0 ? Number(saved) : 1000;
    } catch {
      return 1000;
    }
  });

  // Persist filter and modal inputs across app reloads / tab switches
  useEffect(() => {
    try {
      localStorage.setItem('krish_smm_platform', activePlatform);
      localStorage.setItem('krish_smm_search', search);
      if (modalService) {
        localStorage.setItem('krish_smm_modal_service', JSON.stringify(modalService));
        localStorage.setItem('krish_smm_modal_link', modalTargetLink);
        localStorage.setItem('krish_smm_modal_qty', String(modalQuantity));
      } else {
        localStorage.removeItem('krish_smm_modal_service');
        localStorage.removeItem('krish_smm_modal_link');
        localStorage.removeItem('krish_smm_modal_qty');
      }
    } catch {}
  }, [activePlatform, search, modalService, modalTargetLink, modalQuantity]);

  // Post-purchase confirmation modal state
  const [placedOrder, setPlacedOrder] = useState<{
    orderId: string;
    serviceName: string;
    platform: SmmPlatform;
    link: string;
    quantity: number;
    cost: number;
  } | null>(null);

  const platforms: {
    id: SmmPlatform | 'all';
    label: string;
    badge?: string;
  }[] = [
    { id: 'all', label: 'All Services', badge: 'All' },
    { id: 'telegram', label: 'Telegram', badge: 'Hot' },
    { id: 'instagram', label: 'Instagram', badge: 'Popular' },
    { id: 'youtube', label: 'YouTube' },
    { id: 'tiktok', label: 'TikTok' },
    { id: 'twitter', label: 'Twitter (X)' },
    { id: 'facebook', label: 'Facebook' },
    { id: 'whatsapp', label: 'WhatsApp' },
  ];

  // Available services for chosen platform (consuming live inventory from AppContext)
  const allServices = server5Items;
  const platformServices = useMemo(() => {
    let list = activePlatform === 'all'
      ? allServices
      : allServices.filter((s) => s.platform === activePlatform);

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        s.categoryName.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.platform.toLowerCase().includes(q)
      );
    }
    return list;
  }, [allServices, activePlatform, search]);

  const presetIncrements = [500, 1000, 2500, 5000];

  const handleOpenBuyModal = (service: SmmServiceItem) => {
    setModalService(service);
    setModalTargetLink('');
    setModalQuantity(service.minQuantity || 1000);
  };

  const handleModalQuantityChange = (val: number) => {
    if (!modalService) return;
    const min = modalService.minQuantity || 100;
    const max = modalService.maxQuantity || 50000;
    setModalQuantity(Math.min(max, Math.max(min, val)));
  };

  const handleModalIncrement = (inc: number) => {
    if (!modalService) return;
    handleModalQuantityChange(modalQuantity + inc);
  };

  const handleModalDecrement = (dec: number) => {
    if (!modalService) return;
    handleModalQuantityChange(modalQuantity - dec);
  };

  const modalTotalCost = modalService
    ? Math.round((modalService.ratePer1000 * modalQuantity) / 1000)
    : 0;

  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalService) return;

    const ok = submitSmmOrder(modalService, modalTargetLink, modalQuantity);
    if (ok) {
      const captured = {
        orderId: `SMM_${Date.now().toString().slice(-6)}`,
        serviceName: modalService.name,
        platform: modalService.platform,
        link: modalTargetLink,
        quantity: modalQuantity,
        cost: modalTotalCost,
      };
      setModalService(null);
      setPlacedOrder(captured);
    }
  };

  const getUrlPlaceholder = (platform: SmmPlatform | 'all') => {
    switch (platform) {
      case 'facebook':
        return 'https://facebook.com/...';
      case 'whatsapp':
        return 'https://chat.whatsapp.com/... or channel link';
      case 'telegram':
        return 'https://t.me/channel_name or @username';
      case 'instagram':
        return 'https://instagram.com/username or @username';
      case 'youtube':
        return 'https://youtube.com/watch?v=... or channel URL';
      case 'tiktok':
        return 'https://tiktok.com/@username';
      case 'twitter':
        return 'https://x.com/username or post URL';
      default:
        return 'https://...';
    }
  };

  return (
    <div className="w-full flex flex-col pt-2">
      {/* Banner */}
      <div className="p-3 mb-3 rounded-2xl bg-[#181820] border border-[#262630] flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-white flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-[#8b5cf6]" />
            Server 5: SMM Growth Hub
          </span>
          <span className="text-[11px] text-[#a1a1aa]">
            Automated organic followers, members, views & engagement
          </span>
        </div>
        <div className="px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-[#22c55e] text-[10px] font-bold">
          High Retention
        </div>
      </div>

      {allServices.length === 0 ? (
        <div className="p-10 text-center bg-[#181820] border border-[#262630] rounded-2xl flex flex-col items-center justify-center gap-3">
          <Rocket className="w-8 h-8 text-[#71717a]" />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-white">No SMM Services Configured</span>
            <span className="text-xs text-[#a1a1aa]">
              The backend currently has no active SMM provider packages loaded. Check back soon.
            </span>
          </div>
        </div>
      ) : (
        <>
          {/* Search Bar */}
          <div className="relative mb-3">
            <Search className="w-4 h-4 text-[#a1a1aa] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search all SMM services (Followers, Likes, Views, Members, Subscribers...)"
              className="w-full bg-[#181820] border border-[#262630] hover:border-[#38384a] focus:border-[#7c3aed] rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-[#71717a] focus:outline-none transition-all shadow-inner"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#262632] hover:bg-[#323244] text-[#a1a1aa] hover:text-white flex items-center justify-center transition-colors"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Social Media Platform Selector Tabs */}
          <div className="mb-3.5">
            <div className="text-[11px] font-bold text-[#a1a1aa] mb-2 px-0.5 uppercase tracking-wider">
              Select Platform
            </div>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4">
              {platforms.map((p) => {
                const isActive = activePlatform === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setActivePlatform(p.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold shrink-0 border transition-all duration-200 active:scale-95 ${
                      isActive
                        ? 'bg-[#7c3aed]/25 border-[#8b5cf6] text-white shadow-violet-glow-sm ring-1 ring-[#8b5cf6]/50'
                        : 'bg-[#181820] border-[#262630] text-[#a1a1aa] hover:text-white hover:border-[#383848]'
                    }`}
                  >
                    <div className="w-5 h-5 flex items-center justify-center shrink-0">
                      <PlatformIcon platform={p.id} className="w-5 h-5" />
                    </div>
                    <span>{p.label}</span>
                    {p.badge && (
                      <span
                        className={`text-[9px] px-1 py-0.2 rounded font-extrabold uppercase ${
                          isActive
                            ? 'bg-[#7c3aed] text-white'
                            : 'bg-[#262630] text-[#a1a1aa]'
                        }`}
                      >
                        {p.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Service Packages List */}
          <div className="mb-3">
            <div className="text-[11px] font-bold text-[#a1a1aa] mb-2 px-0.5 uppercase tracking-wider flex items-center justify-between">
              <span>Choose Package</span>
              <span className="text-[10px] text-[#8b5cf6] font-normal">
                {platformServices.length} options available
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {platformServices.length === 0 ? (
                <div className="p-8 text-center bg-[#181820] border border-[#262630] rounded-2xl flex flex-col items-center justify-center gap-2">
                  <Rocket className="w-6 h-6 text-[#71717a]" />
                  <span className="text-xs font-semibold text-white">No services found</span>
                  <span className="text-[11px] text-[#a1a1aa]">
                    No packages matching &quot;{search}&quot;
                    {activePlatform !== 'all' ? ` in ${activePlatform.toUpperCase()}` : ''}.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setActivePlatform('all');
                    }}
                    className="mt-2 px-3 py-1.5 rounded-lg bg-[#262632] hover:bg-[#323244] text-xs font-medium text-white transition-colors"
                  >
                    Reset Filters &amp; View All
                  </button>
                </div>
              ) : (
                platformServices.map((service) => (
                <div
                  key={service.id}
                  onClick={() => handleOpenBuyModal(service)}
                  className="p-3.5 rounded-2xl bg-[#181820] border border-[#262630] hover:border-[#8b5cf6]/60 cursor-pointer transition-all active:scale-[0.99] shadow-sm hover:shadow-violet-glow-sm/20 flex flex-col gap-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="mt-0.5 p-1.5 rounded-xl bg-[#0b0b0e] border border-[#262630] shrink-0">
                        <PlatformIcon platform={service.platform} className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-white leading-tight">
                            {service.name}
                          </span>
                          {service.refillDays > 0 && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-[#22c55e] border border-emerald-500/30 flex items-center gap-1">
                              <ShieldCheck className="w-2.5 h-2.5" />
                              {service.refillDays}d Auto-Refill
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-[#a1a1aa] mt-0.5 line-clamp-1">
                          {service.description}
                        </span>
                      </div>
                    </div>

                    {/* Rate & Buy Button */}
                    <div className="flex flex-col items-end shrink-0 pl-1 gap-1">
                      <span className="text-sm font-extrabold text-[#22c55e] font-mono">
                        {formatPrice(service.ratePer1000)}
                      </span>
                      <span className="text-[9px] text-[#a1a1aa]">per 1,000</span>
                    </div>
                  </div>

                  {/* Sub-info bar + Direct Action Button */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#262630]/60 text-[10px] text-[#a1a1aa]">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#8b5cf6]" />
                        {service.avgSpeed}
                      </span>
                      <span>•</span>
                      <span>Min: {service.minQuantity.toLocaleString()}</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenBuyModal(service);
                      }}
                      className="flex items-center gap-1 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-semibold px-3 py-1 rounded-xl shadow-violet-glow-sm transition-all active:scale-95"
                    >
                      <ShoppingBag className="w-3 h-3" />
                      <span>Buy / Configure</span>
                    </button>
                  </div>
                </div>
              ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Configure & Buy SMM Modal */}
      <Modal
        isOpen={!!modalService}
        onClose={() => setModalService(null)}
        title="Configure SMM Order"
        subtitle={modalService?.name}
      >
        {modalService && (
          <form onSubmit={handleModalSubmit} className="flex flex-col gap-3.5 pt-1">
            {/* Service Summary Header Card */}
            <div className="p-3 rounded-xl bg-[#0b0b0e] border border-[#262630] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#181820] border border-[#262630]">
                  <PlatformIcon platform={modalService.platform} className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white">{modalService.name}</span>
                  <div className="flex items-center gap-2 text-[10px] text-[#a1a1aa] mt-0.5">
                    <span className="text-[#8b5cf6] font-medium">{modalService.avgSpeed}</span>
                    {modalService.refillDays > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-[#22c55e]">{modalService.refillDays}d Warranty</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs font-extrabold text-[#22c55e] font-mono">
                  {formatPrice(modalService.ratePer1000)}
                </span>
                <span className="text-[9px] text-[#a1a1aa]">per 1,000</span>
              </div>
            </div>

            {/* Target Link Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-white flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <LinkIcon className="w-3.5 h-3.5 text-[#8b5cf6]" />
                  Target URL or Public Username
                </span>
                <span className="text-[10px] font-normal text-[#a1a1aa]">Must be public</span>
              </label>
              <input
                type="text"
                value={modalTargetLink}
                onChange={(e) => setModalTargetLink(e.target.value)}
                placeholder={getUrlPlaceholder(modalService.platform)}
                className="w-full bg-[#0b0b0e] border border-[#262630] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#71717a] focus:outline-none focus:border-[#7c3aed] transition-colors"
                required
              />
              <span className="text-[10px] text-[#a1a1aa]">
                Ensure your channel, page, or account is public with zero privacy restrictions.
              </span>
            </div>

            {/* Quantity Stepper & Chips */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">Order Quantity</span>
                <span className="text-[#a1a1aa] text-[10px]">
                  Min: {modalService.minQuantity.toLocaleString()} | Max: {modalService.maxQuantity.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleModalDecrement(500)}
                  className="p-2.5 rounded-xl bg-[#181820] border border-[#262630] text-[#a1a1aa] hover:text-white active:scale-95 transition-all"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="number"
                  value={modalQuantity}
                  onChange={(e) => handleModalQuantityChange(Number(e.target.value))}
                  min={modalService.minQuantity}
                  max={modalService.maxQuantity}
                  step={100}
                  className="flex-1 bg-[#0b0b0e] border border-[#262630] rounded-xl px-3 py-2 text-xs text-center font-mono font-bold text-white focus:outline-none focus:border-[#7c3aed]"
                />
                <button
                  type="button"
                  onClick={() => handleModalIncrement(500)}
                  className="p-2.5 rounded-xl bg-[#181820] border border-[#262630] text-[#a1a1aa] hover:text-white active:scale-95 transition-all"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Quick preset chips */}
              <div className="grid grid-cols-4 gap-1.5 mt-1">
                {presetIncrements.map((inc) => (
                  <button
                    type="button"
                    key={inc}
                    onClick={() => handleModalQuantityChange(inc)}
                    className={`py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                      modalQuantity === inc
                        ? 'bg-[#7c3aed]/30 border-[#7c3aed] text-white'
                        : 'bg-[#0b0b0e] border-[#262630] text-[#a1a1aa] hover:text-white'
                    }`}
                  >
                    +{inc.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Total Cost & Wallet Verification Card */}
            <div className="p-3 rounded-xl bg-[#0b0b0e] border border-[#262630] flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] text-[#a1a1aa] uppercase font-bold tracking-wider">
                  Total Order Amount
                </span>
                <span className="text-[11px] text-[#a1a1aa] mt-0.5">
                  Wallet Balance: <span className="text-white font-mono">{formatPrice(user.balance)}</span>
                </span>
              </div>
              <div className="text-xl font-extrabold text-[#22c55e] font-mono">
                {formatPrice(modalTotalCost)}
              </div>
            </div>

            {user.balance < modalTotalCost && (
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] text-amber-400 flex items-center justify-between">
                <span>Insufficient balance for this order.</span>
                <button
                  type="button"
                  onClick={() => {
                    setModalService(null);
                    setActiveTab('deposit');
                  }}
                  className="font-bold underline text-white"
                >
                  Top Up
                </button>
              </div>
            )}

            {/* Submit & Cancel Buttons */}
            <div className="sticky bottom-0 bg-[#15151c] pt-3 pb-1 border-t border-[#262630]/80 -mx-4 px-4 mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setModalService(null)}
                className="py-3 rounded-xl bg-[#1f1f2a] border border-[#262630] text-xs font-semibold text-[#a1a1aa] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={user.balance < modalTotalCost}
                className="py-3 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-xs font-bold text-white shadow-violet-glow-sm active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Rocket className="w-3.5 h-3.5" />
                <span>Confirm & Pay</span>
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Post-Purchase SMM Confirmation Modal */}
      <Modal
        isOpen={!!placedOrder}
        onClose={() => setPlacedOrder(null)}
        title="🎉 SMM Order Dispatched!"
        subtitle={placedOrder?.orderId}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPlacedOrder(null)}
              className="py-3 rounded-xl bg-[#1f1f2a] border border-[#262630] text-xs font-semibold text-[#a1a1aa] hover:text-white"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={() => {
                setPlacedOrder(null);
                setActiveTab('history');
              }}
              className="py-3 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-xs font-bold text-white shadow-violet-glow-sm active:scale-95 transition-all flex items-center justify-center gap-1.5"
            >
              <span>View History</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        }
      >
        {placedOrder && (
          <div className="flex flex-col gap-3.5 pt-1">
            <div className="p-3 bg-[#22c55e]/10 border border-[#22c55e]/30 rounded-xl flex items-center gap-2.5 text-xs text-[#22c55e] font-semibold">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>Order has been queued and sent to high-speed delivery node!</span>
            </div>

            <div className="p-3 bg-[#0b0b0e] border border-[#262630] rounded-xl flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-[#262630]">
                <span className="text-[#a1a1aa]">Package</span>
                <span className="font-bold text-white">{placedOrder.serviceName}</span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-[#262630]">
                <span className="text-[#a1a1aa]">Target Destination</span>
                <span className="font-mono text-white truncate max-w-[180px]">{placedOrder.link}</span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-[#262630]">
                <span className="text-[#a1a1aa]">Quantity</span>
                <span className="font-mono font-bold text-white">{placedOrder.quantity.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#a1a1aa]">Amount Deducted</span>
                <span className="font-mono font-bold text-[#22c55e]">{formatPrice(placedOrder.cost)}</span>
              </div>
            </div>

            <div className="p-3 bg-[#181820] border border-[#262630] rounded-xl text-[11px] text-[#a1a1aa] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#8b5cf6] shrink-0" />
              <span>Status: <strong className="text-white">In Progress</strong> · Live tracking available in Order History.</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
