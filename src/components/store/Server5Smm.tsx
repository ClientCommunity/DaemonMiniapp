import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { server5Catalog } from '../../data/mockData';
import { SmmPlatform } from '../../types';
import { Rocket, Link as LinkIcon, ChevronDown, CheckCircle2 } from 'lucide-react';

export const Server5Smm: React.FC = () => {
  const { formatPrice, submitSmmOrder } = useApp();

  const [activePlatform, setActivePlatform] = useState<SmmPlatform>('telegram');
  const [selectedServiceId, setSelectedServiceId] = useState<string>(server5Catalog[0].id);
  const [targetLink, setTargetLink] = useState('');
  const [quantity, setQuantity] = useState(1000);

  const platforms: { id: SmmPlatform; label: string; icon: string }[] = [
    { id: 'telegram', label: 'Telegram', icon: '✈️' },
    { id: 'instagram', label: 'Instagram', icon: '📸' },
    { id: 'youtube', label: 'YouTube', icon: '▶️' },
    { id: 'tiktok', label: 'TikTok', icon: '🎵' },
    { id: 'twitter', label: 'Twitter (X)', icon: '🐦' },
  ];

  // Available services for the chosen platform
  const platformServices = server5Catalog.filter((s) => s.platform === activePlatform);
  const currentService = platformServices.find((s) => s.id === selectedServiceId) || platformServices[0];

  // Live price calculation: (ratePer1000 * quantity) / 1000
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

  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentService) return;
    const ok = submitSmmOrder(currentService, targetLink, quantity);
    if (ok) {
      setTargetLink('');
    }
  };

  const presetIncrements = [500, 1000, 2500, 5000];

  return (
    <div className="w-full flex flex-col pt-2">
      {/* Banner */}
      <div className="p-3 mb-3 rounded-2xl bg-[#181820] border border-[#262630] flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-white">Server 5: SMM Growth Hub</span>
          <span className="text-[11px] text-[#a1a1aa]">
            Automated organic followers, members, views & engagement
          </span>
        </div>
        <div className="px-2 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[10px] font-bold">
          High Retention
        </div>
      </div>

      {/* Platform Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 mb-3 -mx-4 px-4">
        {platforms.map((p) => {
          const isActive = activePlatform === p.id;
          return (
            <button
              key={p.id}
              onClick={() => handlePlatformChange(p.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 border transition-all ${
                isActive
                  ? 'bg-[#7c3aed] border-[#8b5cf6] text-white shadow-violet-glow-sm'
                  : 'bg-[#181820] border-[#262630] text-[#a1a1aa] hover:text-white'
              }`}
            >
              <span>{p.icon}</span>
              <span>{p.label}</span>
            </button>
          );
        })}
      </div>

      {/* SMM Order Form */}
      <form onSubmit={handleSubmitOrder} className="flex flex-col gap-3">
        {/* Service Dropdown */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-white flex items-center justify-between">
            <span>Select Service Package</span>
            {currentService?.refillDays > 0 && (
              <span className="text-[10px] font-normal text-[#22c55e]">
                🛡️ {currentService.refillDays}-Day Auto-Refill
              </span>
            )}
          </label>
          <div className="relative">
            <select
              value={currentService?.id || ''}
              onChange={(e) => setSelectedServiceId(e.target.value)}
              className="w-full appearance-none bg-[#181820] border border-[#262630] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#7c3aed] transition-colors pr-10"
            >
              {platformServices.map((service) => (
                <option key={service.id} value={service.id} className="bg-[#181820] text-white">
                  {service.name} — {formatPrice(service.ratePer1000)} / 1K
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-[#a1a1aa] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Target Link Input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-white">Target URL / Public Username</label>
          <div className="relative">
            <LinkIcon className="w-4 h-4 text-[#a1a1aa] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={targetLink}
              onChange={(e) => setTargetLink(e.target.value)}
              placeholder="e.g. https://t.me/yourchannel or @username"
              className="w-full bg-[#181820] border border-[#262630] rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-[#a1a1aa] focus:outline-none focus:border-[#7c3aed] transition-colors"
              required
            />
          </div>
          <span className="text-[10px] text-[#a1a1aa]">
            Make sure channel/account is public and not restricted.
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
          <div className="flex flex-col">
            <span className="text-[10px] text-[#a1a1aa] uppercase font-bold">Estimated Cost</span>
            <span className="text-[11px] text-[#8b5cf6]">
              Rate: {formatPrice(currentService?.ratePer1000 || 0)} per 1,000
            </span>
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
        <div className="mt-4 p-3 bg-[#181820]/60 border border-[#262630] rounded-xl flex flex-col gap-1.5 text-xs text-[#a1a1aa]">
          <div className="flex items-center gap-1.5 text-white font-semibold">
            <CheckCircle2 className="w-4 h-4 text-[#22c55e]" />
            <span>Delivery Guarantees</span>
          </div>
          <p>{currentService.description}</p>
          <span className="text-[10px] text-[#8b5cf6]">Speed: {currentService.avgSpeed}</span>
        </div>
      )}
    </div>
  );
};
