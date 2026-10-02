import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { server5Catalog } from '../../data/mockData';
import { SmmPlatform } from '../../types';
import { PlatformIcon } from '../common/PlatformIcon';
import { Rocket, Link as LinkIcon, ShieldCheck, Zap, Info, Check, Clock } from 'lucide-react';

export const Server5Smm: React.FC = () => {
  const { formatPrice, submitSmmOrder } = useApp();

  const [activePlatform, setActivePlatform] = useState<SmmPlatform>('telegram');
  const [selectedServiceId, setSelectedServiceId] = useState<string>(server5Catalog[0].id);
  const [targetLink, setTargetLink] = useState('');
  const [quantity, setQuantity] = useState(1000);

  const platforms: {
    id: SmmPlatform;
    label: string;
    badge?: string;
  }[] = [
    { id: 'telegram', label: 'Telegram', badge: 'Hot' },
    { id: 'instagram', label: 'Instagram', badge: 'Popular' },
    { id: 'youtube', label: 'YouTube' },
    { id: 'tiktok', label: 'TikTok' },
    { id: 'twitter', label: 'Twitter (X)' },
  ];

  // Available services for chosen platform
  const platformServices = server5Catalog.filter((s) => s.platform === activePlatform);
  const currentService = platformServices.find((s) => s.id === selectedServiceId) || platformServices[0];

  // Total Price: (ratePer1000 * quantity) / 1000
  const totalPriceInr = currentService
    ? Math.round((currentService.ratePer1000 * quantity) / 1000)
    : 0;

  const handlePlatformChange = (p: SmmPlatform) => {
    setActivePlatform(p);
    const firstService = server5Catalog.find((s) => s.platform === p);
    if (firstService) {
      setSelectedServiceId(firstService.id);
      setQuantity(firstService.minQuantity);
    }
  };

  const handleSelectService = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    const svc = platformServices.find((s) => s.id === serviceId);
    if (svc && (quantity < svc.minQuantity || quantity > svc.maxQuantity)) {
      setQuantity(svc.minQuantity);
    }
  };

  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentService) return;
    const ok = submitSmmOrder(currentService, targetLink, quantity);
    if (ok) {
      setTargetLink('');
    }
  };

  const presetIncrements = [500, 1000, 2500, 5000];

  const getUrlPlaceholder = () => {
    switch (activePlatform) {
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

      {/* Social Media Platform SVG Selector Tabs */}
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
                onClick={() => handlePlatformChange(p.id)}
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

      {/* Service Packages (Visual Cards Selection) */}
      <div className="mb-3">
        <div className="text-[11px] font-bold text-[#a1a1aa] mb-2 px-0.5 uppercase tracking-wider flex items-center justify-between">
          <span>Choose Package</span>
          <span className="text-[10px] text-[#8b5cf6] font-normal">
            {platformServices.length} options available
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {platformServices.map((service) => {
            const isSelected = selectedServiceId === service.id;
            return (
              <div
                key={service.id}
                onClick={() => handleSelectService(service.id)}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-[#7c3aed]/15 border-[#8b5cf6] shadow-violet-glow-sm'
                    : 'bg-[#181820] border-[#262630] hover:border-[#383848]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="mt-0.5 p-1 rounded-lg bg-[#0b0b0e] border border-[#262630] shrink-0">
                      <PlatformIcon platform={service.platform} className="w-4 h-4" />
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

                  {/* Rate Badge */}
                  <div className="flex flex-col items-end shrink-0 pl-1">
                    <span className="text-xs font-extrabold text-[#22c55e] font-mono">
                      {formatPrice(service.ratePer1000)}
                    </span>
                    <span className="text-[9px] text-[#a1a1aa]">per 1,000</span>
                  </div>
                </div>

                {/* Sub-info bar */}
                <div className="flex items-center gap-3 mt-2 pt-2 border-t border-[#262630]/60 text-[10px] text-[#a1a1aa]">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#8b5cf6]" />
                    Speed: {service.avgSpeed}
                  </span>
                  <span>•</span>
                  <span>Min: {service.minQuantity.toLocaleString()}</span>
                  <span>•</span>
                  <span>Max: {service.maxQuantity.toLocaleString()}</span>
                  {isSelected && (
                    <span className="ml-auto text-[10px] text-[#8b5cf6] font-bold flex items-center gap-1">
                      <Check className="w-3 h-3" /> Selected
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SMM Order Form */}
      <form onSubmit={handleSubmitOrder} className="flex flex-col gap-3">
        {/* Target Link Input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-white flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <PlatformIcon platform={activePlatform} className="w-3.5 h-3.5" />
              Target URL or Public Username
            </span>
            <span className="text-[10px] font-normal text-[#a1a1aa]">Must be public</span>
          </label>
          <div className="relative">
            <LinkIcon className="w-4 h-4 text-[#a1a1aa] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={targetLink}
              onChange={(e) => setTargetLink(e.target.value)}
              placeholder={getUrlPlaceholder()}
              className="w-full bg-[#181820] border border-[#262630] rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-[#71717a] focus:outline-none focus:border-[#7c3aed] transition-colors"
              required
            />
          </div>
          <span className="text-[10px] text-[#a1a1aa]">
            Ensure the channel, page, or account has no geographic restrictions and is fully public.
          </span>
        </div>

        {/* Quantity Stepper & Chips */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-white">Quantity</span>
            <span className="text-[#a1a1aa] text-[10px]">
              Min: {currentService?.minQuantity.toLocaleString()} | Max: {currentService?.maxQuantity.toLocaleString()}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              min={currentService?.minQuantity || 100}
              max={currentService?.maxQuantity || 50000}
              step={100}
              className="w-full bg-[#181820] border border-[#262630] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#7c3aed] transition-colors"
            />
          </div>

          {/* Quick preset increments */}
          <div className="grid grid-cols-4 gap-1.5 mt-1">
            {presetIncrements.map((inc) => (
              <button
                type="button"
                key={inc}
                onClick={() => setQuantity(inc)}
                className={`py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                  quantity === inc
                    ? 'bg-[#7c3aed]/30 border-[#7c3aed] text-white'
                    : 'bg-[#181820] border-[#262630] text-[#a1a1aa] hover:text-white'
                }`}
              >
                +{inc.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        {/* Live Price Estimation Box */}
        <div className="p-3.5 rounded-2xl bg-[#0b0b0e] border border-[#262630] flex items-center justify-between mt-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#181820] border border-[#262630]">
              <PlatformIcon platform={activePlatform} className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-[#a1a1aa] uppercase font-bold tracking-wider">
                Estimated Cost
              </span>
              <span className="text-[11px] text-[#8b5cf6]">
                Rate: {formatPrice(currentService?.ratePer1000 || 0)} per 1,000
              </span>
            </div>
          </div>
          <div className="text-xl font-extrabold text-[#22c55e] font-mono">
            {formatPrice(totalPriceInr)}
          </div>
        </div>

        {/* Order Submit Button */}
        <button
          type="submit"
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold text-xs shadow-violet-glow transition-all active:scale-95 mt-2"
        >
          <Rocket className="w-4 h-4" />
          <span>Place SMM Order ({formatPrice(totalPriceInr)})</span>
        </button>
      </form>

      {/* Service description card */}
      {currentService && (
        <div className="mt-4 p-3 bg-[#181820]/60 border border-[#262630] rounded-xl flex flex-col gap-2 text-xs text-[#a1a1aa]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-white font-semibold">
              <PlatformIcon platform={currentService.platform} className="w-4 h-4" />
              <span>Delivery & Quality Guarantees</span>
            </div>
            {currentService.refillDays > 0 ? (
              <span className="text-[10px] font-bold text-[#22c55e] flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> {currentService.refillDays} Days Warranty
              </span>
            ) : (
              <span className="text-[10px] text-[#a1a1aa] flex items-center gap-1">
                <Info className="w-3 h-3" /> Standard Delivery
              </span>
            )}
          </div>
          <p className="text-[11px] leading-relaxed">{currentService.description}</p>
          <div className="flex items-center gap-2 text-[10px] text-[#8b5cf6] font-medium pt-1 border-t border-[#262630]/60">
            <Clock className="w-3 h-3" />
            <span>Average Dispatch Speed: {currentService.avgSpeed}</span>
          </div>
        </div>
      )}
    </div>
  );
};
