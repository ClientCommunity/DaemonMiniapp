import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { server34Catalog } from '../../data/mockData';
import { OtpAppCode } from '../../types';
import { PlatformIcon } from '../common/PlatformIcon';
import { Search, Zap, ShoppingBag, ShieldCheck, Radio } from 'lucide-react';
import { ActiveOtpCard } from '../dashboard/ActiveOtpCard';

interface Server34OtpProps {
  serverId: 3 | 4;
}

export const Server34Otp: React.FC<Server34OtpProps> = ({ serverId }) => {
  const { formatPrice, requestVirtualOtp } = useApp();

  const [activeCategory, setActiveCategory] = useState<OtpAppCode>('all');
  const [search, setSearch] = useState('');

  const appChips: { code: OtpAppCode; label: string; badge?: string }[] = [
    { code: 'all', label: 'All Services' },
    { code: 'wa', label: 'WhatsApp', badge: 'Popular' },
    { code: 'tg', label: 'Telegram', badge: 'Hot' },
    { code: 'ig', label: 'Instagram' },
    { code: 'go', label: 'Google / Gmail' },
    { code: 'spam', label: 'SpamChat' },
  ];

  // Filter items by server, app category, and search query
  const filtered = server34Catalog.filter((item) => {
    if (item.server !== serverId) return false;
    if (activeCategory !== 'all' && item.category !== activeCategory) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchName = item.serviceName.toLowerCase().includes(q);
      const matchCountry = item.country.toLowerCase().includes(q);
      if (!matchName && !matchCountry) return false;
    }
    return true;
  });

  const isServer3 = serverId === 3;

  return (
    <div className="w-full flex flex-col pt-2">
      {/* Banner */}
      <div className="p-3 mb-3 rounded-2xl bg-[#181820] border border-[#262630] flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-white flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-[#8b5cf6]" />
            {isServer3 ? 'Server 3: Fast OTP (DGOTP)' : 'Server 4: Fresh Numbers (Tempora)'}
          </span>
          <span className="text-[11px] text-[#a1a1aa]">
            {isServer3
              ? 'Ultra-fast SMS resolution (1-3s) for major platforms'
              : 'Fresh carrier pool with 100% private virtual numbers'}
          </span>
        </div>
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#7c3aed]/20 border border-[#7c3aed]/40 text-[#8b5cf6] text-[10px] font-bold shrink-0">
          <Radio className="w-3 h-3 text-[#22c55e] animate-pulse" />
          <span>{isServer3 ? 'Fast Pool' : 'Fresh Pool'}</span>
        </div>
      </div>

      {/* Active OTP session widget if present */}
      <ActiveOtpCard />

      {/* Quick-Filter App Chips with SVG Icons */}
      <div className="mb-3">
        <div className="text-[11px] font-bold text-[#a1a1aa] mb-2 px-0.5 uppercase tracking-wider flex items-center justify-between">
          <span>Supported Platforms</span>
          <span className="text-[10px] text-[#8b5cf6] font-normal">
            {filtered.length} pools available
          </span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1.5 -mx-4 px-4">
          {appChips.map((chip) => {
            const isActive = activeCategory === chip.code;
            return (
              <button
                key={chip.code}
                type="button"
                onClick={() => setActiveCategory(chip.code)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold shrink-0 border transition-all duration-200 active:scale-95 ${
                  isActive
                    ? 'bg-[#7c3aed]/25 border-[#8b5cf6] text-white shadow-violet-glow-sm ring-1 ring-[#8b5cf6]/50'
                    : 'bg-[#181820] border-[#262630] text-[#a1a1aa] hover:text-white hover:border-[#383848]'
                }`}
              >
                <div className="w-4 h-4 flex items-center justify-center shrink-0">
                  <PlatformIcon platform={chip.code} className="w-4 h-4" />
                </div>
                <span>{chip.label}</span>
                {chip.badge && (
                  <span
                    className={`text-[9px] px-1 py-0.2 rounded font-extrabold uppercase ${
                      isActive
                        ? 'bg-[#7c3aed] text-white'
                        : 'bg-[#262630] text-[#a1a1aa]'
                    }`}
                  >
                    {chip.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search Input */}
      <div className="relative mb-3">
        <Search className="w-4 h-4 text-[#a1a1aa] absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by platform name or country (e.g. India, USA, WhatsApp)..."
          className="w-full bg-[#181820] border border-[#262630] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-[#71717a] focus:outline-none focus:border-[#7c3aed] transition-colors"
        />
      </div>

      {/* Virtual Numbers List */}
      <div className="grid grid-cols-1 gap-2.5">
        {filtered.map((service) => (
          <div
            key={service.id}
            className="flex items-center justify-between p-3.5 rounded-2xl bg-[#181820] border border-[#262630] hover:border-[#383848] transition-all"
          >
            <div className="flex items-center gap-3 min-w-0">
              {/* Authentic Platform SVG Badge */}
              <div className="w-10 h-10 rounded-xl bg-[#0b0b0e] border border-[#262630] flex items-center justify-center p-2 shrink-0 shadow-inner">
                <PlatformIcon platform={service.category || service.serviceCode} className="w-6 h-6" />
              </div>
              
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-white truncate">
                    {service.serviceName}
                  </span>
                  <span className="text-[10px] text-[#a1a1aa] px-1.5 py-0.5 rounded bg-[#0b0b0e] border border-[#262630]">
                    {service.country}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-[#a1a1aa] mt-1">
                  <span className="text-[#22c55e] font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                    {service.speed}
                  </span>
                  <span>•</span>
                  <span>{service.successRate}% Success</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1.5 shrink-0 pl-2">
              <span className="text-sm font-extrabold text-[#22c55e] font-mono">
                {formatPrice(service.priceInr)}
              </span>
              <button
                type="button"
                onClick={() => requestVirtualOtp(service)}
                className="flex items-center gap-1.5 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-semibold px-3 py-1.5 rounded-xl shadow-violet-glow-sm transition-all active:scale-95"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Get OTP</span>
              </button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="p-8 text-center bg-[#181820] border border-[#262630] rounded-2xl text-xs text-[#a1a1aa]">
            No virtual numbers available for this category right now.
          </div>
        )}
      </div>

      {/* Notice info */}
      <div className="mt-4 p-3 bg-[#181820]/60 border border-[#262630] rounded-xl flex items-center gap-2 text-xs text-[#a1a1aa]">
        <ShieldCheck className="w-4 h-4 text-[#22c55e] shrink-0" />
        <span>
          If no SMS arrives within 10 minutes, your balance is 100% automatically refunded.
        </span>
      </div>
    </div>
  );
};
