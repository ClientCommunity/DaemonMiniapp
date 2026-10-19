import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { OtpAppCode, VirtualOtpServiceItem } from '../../types';
import { PlatformIcon } from '../common/PlatformIcon';
import { Search, Zap, ShoppingBag, ShieldCheck, Radio, X, Globe, Sparkles } from 'lucide-react';
import { ActiveOtpCard } from '../dashboard/ActiveOtpCard';

interface Server34OtpProps {
  serverId: 3 | 4;
}

export const Server34Otp: React.FC<Server34OtpProps> = ({ serverId }) => {
  const { formatPrice, requestVirtualOtp, server34Items, setSelectedServer } = useApp();

  const [activeCategory, setActiveCategory] = useState<OtpAppCode>('all');
  const [search, setSearch] = useState('');
  const [displayCount, setDisplayCount] = useState(50);

  const isServer3 = serverId === 3;

  const appChips: { code: OtpAppCode; label: string; badge?: string }[] = [
    { code: 'all', label: 'All Services' },
    { code: 'wa', label: 'WhatsApp', badge: 'Popular' },
    { code: 'tg', label: 'Telegram', badge: 'Hot' },
    { code: 'ig', label: 'Instagram' },
    { code: 'go', label: 'Google / Gmail' },
    { code: 'spam', label: 'SpamChat' },
  ];

  // Quick country shortcuts for Server 3 (where country routes exist)
  const countrySearches = [
    { label: '🇮🇳 India (+91)', query: 'India' },
    { label: '🇺🇸 USA (+1)', query: 'USA' },
    { label: '🇬🇧 UK (+44)', query: 'UK' },
    { label: '🇳🇬 Nigeria (+234)', query: 'Nigeria' },
    { label: '🇮🇩 Indonesia (+62)', query: 'Indonesia' },
    { label: '🇧🇷 Brazil (+55)', query: 'Brazil' },
    { label: '🇨🇴 Colombia (+57)', query: 'Colombia' },
    { label: '🇳🇱 Netherlands (+31)', query: 'Netherlands' },
    { label: '🖥️ Server 105', query: '105' },
  ];

  // Live stock loaded from backend /api/store/servers for this server
  const serverItems = useMemo(
    () => server34Items.filter((item) => item.server === serverId),
    [server34Items, serverId]
  );

  // Multi-attribute search matching: region, country, dial code, number, operator, service name
  const filtered = useMemo(() => {
    const trimmed = search.trim().toLowerCase();
    const searchTokens = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];

    return serverItems.filter((item: VirtualOtpServiceItem) => {
      // 1. Strict Category Chip enforcement:
      // If a specific category chip is selected (e.g. WhatsApp), ONLY services matching that category can EVER be shown.
      // This strictly prevents "Air India" or other unrelated services from leaking in.
      if (activeCategory !== 'all' && item.category !== activeCategory) {
        return false;
      }

      // 2. Multi-word search token matching (e.g. "India WhatsApp", "WhatsApp +91", "TG India")
      if (searchTokens.length > 0) {
        const allTokensMatch = searchTokens.every((token) => {
          const cleanNumber = token.replace(/^\+/, ''); // "+91" -> "91"
          const isExplicitPlus = token.startsWith('+');

          const matchName = item.serviceName.toLowerCase().includes(token);
          const matchRawName = item.rawName ? item.rawName.toLowerCase().includes(token) : false;
          const matchCountry = item.country.toLowerCase().includes(token);
          const matchCountryCode = item.countryCode ? item.countryCode.toLowerCase() === token : false;
          const matchServiceCode = item.serviceCode.toLowerCase().includes(token);

          // Match calling codes (e.g. "+91" or "91")
          const itemDial = (item.callingCode || '').replace(/^\+/, '').toLowerCase();
          let matchCallingCode = false;
          if (isExplicitPlus) {
            matchCallingCode = Boolean(item.callingCode && item.callingCode.toLowerCase().startsWith(token));
          } else if (cleanNumber.length > 0) {
            matchCallingCode = itemDial === cleanNumber || (cleanNumber.length >= 2 && itemDial.startsWith(cleanNumber));
          }

          // Match server / operator numbers (e.g. "105" in "Server 105", or "server 105")
          const matchOperatorNumber =
            (cleanNumber.length >= 2 && item.country.toLowerCase().includes(cleanNumber)) ||
            item.country.toLowerCase().includes('server ' + cleanNumber);

          return (
            matchName ||
            matchRawName ||
            matchCountry ||
            matchCountryCode ||
            matchServiceCode ||
            matchCallingCode ||
            matchOperatorNumber
          );
        });

        if (!allTokensMatch) return false;
      }

      return true;
    });
  }, [serverItems, search, activeCategory]);

  // Reset pagination window when search query, category, or active server changes
  useEffect(() => {
    setDisplayCount(50);
  }, [search, activeCategory, serverId]);

  // Virtual slice: Render only top items to maintain 60fps and avoid DOM overload
  const visibleItems = useMemo(() => {
    return filtered.slice(0, displayCount);
  }, [filtered, displayCount]);

  return (
    <div className="w-full flex flex-col pt-2">
      {/* Banner */}
      <div className="p-3 mb-3 rounded-2xl bg-[#181820] border border-[#262630] flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-white flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-[#8b5cf6]" />
            {isServer3 ? 'Server 3: Instant Virtual OTP' : 'Server 4: Fresh Carrier Numbers'}
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

      {/* Multi-Attribute Search Bar */}
      <div className="relative mb-2.5">
        <Search className="w-4 h-4 text-[#a1a1aa] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            isServer3
              ? 'Search by country, dial code (+91, +1, +44), or app (WhatsApp, Telegram)...'
              : 'Search 21,000+ carrier services (WhatsApp, Telegram, Steam, Tinder, Netflix)...'
          }
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

      {/* Quick Country Shortcut Pills (Displayed exclusively in Server 3 for country-dedicated routes) */}
      {isServer3 && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2 mb-2 text-[11px]">
          <span className="text-[#71717a] font-medium shrink-0 flex items-center gap-1 pl-0.5">
            <Sparkles className="w-3 h-3 text-[#f59e0b]" />
            <span>Country:</span>
          </span>
          {countrySearches.map((qs) => {
            const isSelected = search.toLowerCase() === qs.query.toLowerCase();
            return (
              <button
                key={qs.query}
                type="button"
                onClick={() => {
                  if (isSelected) {
                    setSearch('');
                  } else {
                    setSearch(qs.query);
                  }
                }}
                className={`px-2.5 py-1 rounded-lg shrink-0 border transition-all duration-150 active:scale-95 ${
                  isSelected
                    ? 'bg-[#7c3aed] border-[#8b5cf6] text-white font-bold shadow-sm'
                    : 'bg-[#15151c] hover:bg-[#1e1e28] border-[#262630] text-[#a1a1aa] hover:text-white'
                }`}
              >
                {qs.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Quick-Filter App Chips with SVG Icons */}
      <div className="mb-3">
        <div className="text-[11px] font-bold text-[#a1a1aa] mb-2 px-0.5 uppercase tracking-wider flex items-center justify-between">
          <span>Supported Platforms</span>
          <span className="text-[10px] text-[#8b5cf6] font-normal">
            {filtered.length} {filtered.length === 1 ? 'number' : 'numbers'} available
          </span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1.5 -mx-4 px-4">
          {appChips.map((chip) => {
            const isActive = activeCategory === chip.code;
            return (
              <button
                key={chip.code}
                type="button"
                onClick={() => {
                  setActiveCategory(isActive ? 'all' : chip.code);
                }}
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

      {/* Virtual Numbers List */}
      <div className="grid grid-cols-1 gap-2.5">
        {serverItems.length === 0 ? (
          <div className="p-10 text-center bg-[#181820] border border-[#262630] rounded-2xl flex flex-col items-center justify-center gap-3">
            <Radio className="w-8 h-8 text-[#71717a]" />
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-white">No OTP Numbers in Stock</span>
              <span className="text-xs text-[#a1a1aa]">
                Live pool is currently empty for Server {serverId}. Check back shortly.
              </span>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center bg-[#181820] border border-[#262630] rounded-2xl flex flex-col items-center justify-center gap-3">
            <Globe className="w-8 h-8 text-[#71717a]" />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-white">No virtual numbers found</span>
              <span className="text-[11px] text-[#a1a1aa]">
                No numbers matching &quot;{search}&quot;
                {activeCategory !== 'all' ? ` in ${activeCategory.toUpperCase()}` : ''}.
              </span>
            </div>
            {serverId === 4 && (
              <button
                type="button"
                onClick={() => setSelectedServer(3)}
                className="mt-1 px-3.5 py-2 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-xs font-bold text-white transition-all shadow-violet-glow-sm flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>Looking for Country Numbers? Switch to Server 3 (India, USA...)</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setActiveCategory('all');
              }}
              className="mt-1 px-3 py-1.5 rounded-lg bg-[#262632] hover:bg-[#323244] text-xs font-medium text-white transition-colors"
            >
              Reset Filters &amp; View All
            </button>
          </div>
        ) : (
          visibleItems.map((service) => (
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
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#d4d4d8] px-2 py-0.5 rounded-md bg-[#0b0b0e] border border-[#2a2a38]">
                      {service.flag && <span className="text-xs leading-none">{service.flag}</span>}
                      <span>{service.country}</span>
                      {service.callingCode && (
                        <span className="text-[#38bdf8] font-mono font-bold ml-0.5">
                          {service.callingCode}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-[#a1a1aa] mt-1">
                    <span className="text-[#22c55e] font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                      {service.speed}
                    </span>
                    <span>•</span>
                    <span>{service.successRate}% Success</span>
                    <span>•</span>
                    <span className="font-mono text-[#a1a1aa]">{service.availableCount} stock</span>
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
          ))
        )}
      </div>

      {/* Pagination Load More Control */}
      {filtered.length > displayCount && (
        <div className="flex flex-col items-center justify-center py-4 px-2 gap-2">
          <span className="text-[11px] text-[#a1a1aa]">
            Showing {displayCount} of {filtered.length.toLocaleString()} available numbers
          </span>
          <button
            type="button"
            onClick={() => setDisplayCount((prev) => prev + 50)}
            className="px-5 py-2.5 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-bold shadow-violet-glow-sm transition-all active:scale-95 flex items-center gap-1.5"
          >
            <span>Load More Numbers</span>
            <span className="text-[10px] opacity-80">(+{Math.min(50, filtered.length - displayCount)})</span>
          </button>
        </div>
      )}

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
