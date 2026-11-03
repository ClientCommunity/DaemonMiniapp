import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { OtpAppCode, VirtualOtpServiceItem } from '../../types';
import { PlatformIcon } from '../common/PlatformIcon';
import { PriceSortFilter, PriceSortOrder } from '../common/PriceSortFilter';
import { Search, Zap, ShoppingBag, ShieldCheck, Radio, X, Globe, Sparkles, Layers, Check } from 'lucide-react';
import { ActiveOtpCard } from '../dashboard/ActiveOtpCard';

interface Server34OtpProps {
  serverId: 3 | 4;
}

interface AppChipItem {
  code: OtpAppCode;
  label: string;
  count: number;
  badge?: string;
  order?: number;
}

/**
 * Matches a virtual OTP service item against an active category filter.
 * Handles canonical codes (wa, tg, ig, go, snap, fb, etc.), slug comparisons,
 * and exact service name matches.
 */
function matchesCategory(item: VirtualOtpServiceItem, cat: string): boolean {
  if (!cat || cat === 'all') return true;
  const c = cat.toLowerCase().trim();
  const itemCat = (item.category || '').toLowerCase().trim();
  if (itemCat === c) return true;

  const name = (item.serviceName || '').toLowerCase().trim();
  const raw = (item.rawName || '').toLowerCase().trim();
  const code = (item.serviceCode || '').toLowerCase().trim();

  // Known shorthand codes
  if (c === 'wa') return name.includes('whatsapp') || code === 'wa';
  if (c === 'tg') return name.includes('telegram') || code === 'tg';
  if (c === 'ig') return name.includes('instagram') || name.includes('insta') || code === 'ig';
  if (c === 'go') return name.includes('google') || name.includes('gmail') || code === 'go';
  if (c === 'snap') return name.includes('snapchat') || name.includes('snap') || code === 'snap' || code === 'fu';
  if (c === 'fb') return name.includes('facebook') || code === 'fb';
  if (c === 'tiktok' || c === 'tk') return name.includes('tiktok') || code === 'tk';
  if (c === 'twitter' || c === 'tw' || c === 'x') return name.includes('twitter') || name === 'x' || code === 'tw';
  if (c === 'discord' || c === 'dc') return name.includes('discord') || code === 'dc';
  if (c === 'openai') return name.includes('openai') || name.includes('chatgpt') || code === 'oa';
  if (c === 'steam') return name.includes('steam') || code === 'steam';

  // Slug comparison (e.g. "air_india" vs "airindia")
  const itemSlug = name.replace(/[^a-z0-9]/g, '');
  const targetSlug = c.replace(/[^a-z0-9]/g, '');
  if (itemSlug && targetSlug && itemSlug === targetSlug) return true;

  // Exact or word boundary matches
  if (name === c || name.startsWith(c + ' ') || name.endsWith(' ' + c) || raw.toLowerCase().startsWith(c)) return true;

  return false;
}

export const Server34Otp: React.FC<Server34OtpProps> = ({ serverId }) => {
  const { formatPrice, requestVirtualOtp, server34Items } = useApp();

  const [activeCategory, setActiveCategory] = useState<OtpAppCode>(() => {
    try {
      const saved = localStorage.getItem(`krish_otp_cat_s${serverId}`);
      if (saved === 'spam') return 'snap';
      return (saved as OtpAppCode) || 'all';
    } catch {
      return 'all';
    }
  });
  const [search, setSearch] = useState<string>(() => {
    try {
      return localStorage.getItem(`krish_otp_search_s${serverId}`) || '';
    } catch {
      return '';
    }
  });
  const [priceSort, setPriceSort] = useState<PriceSortOrder>(() => {
    try {
      const saved = localStorage.getItem(`krish_otp_sort_s${serverId}`);
      return (saved as PriceSortOrder) || 'default';
    } catch {
      return 'default';
    }
  });
  const [displayCount, setDisplayCount] = useState(50);
  const [isAppPickerOpen, setIsAppPickerOpen] = useState(false);
  const [appPickerSearch, setAppPickerSearch] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(`krish_otp_cat_s${serverId}`, activeCategory);
      localStorage.setItem(`krish_otp_search_s${serverId}`, search);
      localStorage.setItem(`krish_otp_sort_s${serverId}`, priceSort);
    } catch {}
  }, [activeCategory, search, priceSort, serverId]);

  const isServer3 = serverId === 3;

  // Live stock loaded from backend /api/store/servers for this server
  const serverItems = useMemo(
    () => server34Items.filter((item) => item.server === serverId),
    [server34Items, serverId]
  );

  // Dynamically extract all available apps, their route counts, and popular chips
  const { appChips, allUniqueApps, activeAppLabel } = useMemo(() => {
    const popularDefs: Record<string, { label: string; badge?: string; order: number }> = {
      wa: { label: 'WhatsApp', badge: 'Popular', order: 1 },
      tg: { label: 'Telegram', badge: 'Hot', order: 2 },
      ig: { label: 'Instagram', order: 3 },
      go: { label: 'Google / Gmail', order: 4 },
      snap: { label: 'Snapchat', order: 5 },
      fb: { label: 'Facebook', order: 6 },
      tiktok: { label: 'TikTok', order: 7 },
      twitter: { label: 'Twitter / X', order: 8 },
      discord: { label: 'Discord', order: 9 },
      openai: { label: 'OpenAI / ChatGPT', order: 10 },
      steam: { label: 'Steam', order: 11 },
    };

    const map = new Map<string, AppChipItem>();

    serverItems.forEach((item) => {
      let matchedCode = '';
      let matchedLabel = '';
      let matchedBadge: string | undefined = undefined;
      let order = 999;

      for (const [pCode, pDef] of Object.entries(popularDefs)) {
        if (matchesCategory(item, pCode)) {
          matchedCode = pCode;
          matchedLabel = pDef.label;
          matchedBadge = pDef.badge;
          order = pDef.order;
          break;
        }
      }

      if (!matchedCode) {
        const cleanName = item.serviceName.trim() || 'Other Service';
        matchedCode = cleanName;
        matchedLabel = cleanName;
        order = 1000;
      }

      const existing = map.get(matchedCode);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(matchedCode, {
          code: matchedCode as OtpAppCode,
          label: matchedLabel || 'Service',
          count: 1,
          badge: matchedBadge,
          order,
        });
      }
    });

    // All unique apps sorted alphabetically (for full list search/picker)
    const allUnique = Array.from(map.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );

    // Dynamic horizontal chips: "All Services" first, then popular apps in stock, then remaining by count
    const chips: AppChipItem[] = [
      {
        code: 'all',
        label: 'All Services',
        count: serverItems.length,
      },
    ];

    const popularInStock = Array.from(map.values())
      .filter((e) => (e.order || 0) < 999 && e.count > 0)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    chips.push(...popularInStock);

    const othersInStock = Array.from(map.values())
      .filter((e) => (e.order || 0) >= 999 && e.count > 0)
      .sort((a, b) => b.count - a.count);

    chips.push(...othersInStock);

    // If activeCategory is set to an app far down the list, pin it right after "All Services"
    if (activeCategory !== 'all') {
      const activeIdx = chips.findIndex((c) => c.code === activeCategory);
      if (activeIdx > 6) {
        const [activeChip] = chips.splice(activeIdx, 1);
        chips.splice(1, 0, activeChip);
      } else if (activeIdx === -1) {
        chips.splice(1, 0, {
          code: activeCategory,
          label: activeCategory,
          count: 0,
        });
      }
    }

    let label = 'All Services';
    if (activeCategory !== 'all') {
      const found = map.get(activeCategory) || allUnique.find((x) => x.code === activeCategory || x.label.toLowerCase() === activeCategory.toLowerCase());
      label = found ? found.label : activeCategory;
    }

    return {
      appChips: chips,
      allUniqueApps: allUnique,
      activeAppLabel: label,
    };
  }, [serverItems, activeCategory]);

  // Modal filtered apps based on search query
  const modalFilteredApps = useMemo(() => {
    const q = appPickerSearch.trim().toLowerCase();
    if (!q) return allUniqueApps;
    return allUniqueApps.filter(
      (app) => app.label.toLowerCase().includes(q) || app.code.toLowerCase().includes(q)
    );
  }, [allUniqueApps, appPickerSearch]);

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

  // Multi-attribute search matching: region, country, dial code, number, operator, service name
  const filtered = useMemo(() => {
    const trimmed = search.trim().toLowerCase();
    const searchTokens = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];

    return serverItems.filter((item: VirtualOtpServiceItem) => {
      // 1. Strict Category Chip enforcement:
      // If a specific category chip is selected (e.g. WhatsApp, Discord), ONLY services matching that category are shown.
      if (activeCategory !== 'all' && !matchesCategory(item, activeCategory)) {
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

  // Reset pagination window when search query, category, sort, or active server changes
  useEffect(() => {
    setDisplayCount(50);
  }, [search, activeCategory, priceSort, serverId]);

  const sorted = useMemo(() => {
    if (priceSort === 'asc') {
      return [...filtered].sort((a, b) => a.priceInr - b.priceInr);
    }
    if (priceSort === 'desc') {
      return [...filtered].sort((a, b) => b.priceInr - a.priceInr);
    }
    return filtered;
  }, [filtered, priceSort]);

  // Virtual slice: Render only top items to maintain 60fps and avoid DOM overload
  const visibleItems = useMemo(() => {
    return sorted.slice(0, displayCount);
  }, [sorted, displayCount]);

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

      {/* Multi-Attribute Search Bar & Price Sort Filter */}
      <div className="flex items-center gap-2 mb-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#a1a1aa] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              activeCategory !== 'all'
                ? `Search ${activeAppLabel} numbers by country (+91, USA, UK)...`
                : isServer3
                ? 'Search by country, dial code (+91, +1, +44), or app (WhatsApp, Telegram)...'
                : 'Search 21,000+ carrier services (WhatsApp, Telegram, Steam, Netflix)...'
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
        <PriceSortFilter value={priceSort} onChange={setPriceSort} />
      </div>

      {/* Quick Country Shortcut Navigation Pills */}
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

      {/* Quick-Filter App Chips with SVG Icons and Full App Selector */}
      <div className="mb-3">
        <div className="text-[11px] font-bold text-[#a1a1aa] mb-2 px-0.5 uppercase tracking-wider flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span>Supported Platforms</span>
            <span className="text-[10px] text-[#71717a] font-normal">
              ({allUniqueApps.length} apps)
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsAppPickerOpen(true)}
            className="flex items-center gap-1 text-[11px] font-semibold text-[#8b5cf6] hover:text-[#a78bfa] transition-colors py-0.5 px-2 rounded-lg bg-[#7c3aed]/10 border border-[#7c3aed]/30"
          >
            <Layers className="w-3 h-3" />
            <span>All Apps ({allUniqueApps.length}) ▾</span>
          </button>
        </div>

        {/* Horizontal Chips Bar */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1.5 -mx-4 px-4">
          {/* Quick Select App Pill */}
          <button
            type="button"
            onClick={() => setIsAppPickerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold shrink-0 border bg-[#1c1b29] hover:bg-[#252338] border-[#7c3aed]/40 text-[#c4b5fd] transition-all duration-200 active:scale-95 shadow-sm"
          >
            <Layers className="w-3.5 h-3.5 text-[#8b5cf6]" />
            <span>Select App ▾</span>
          </button>

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
                {chip.count !== undefined && chip.code !== 'all' && (
                  <span className="text-[10px] font-mono text-[#71717a] font-normal">
                    {chip.count}
                  </span>
                )}
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
                {isActive && chip.code !== 'all' && (
                  <X className="w-3 h-3 text-[#c4b5fd] ml-0.5 hover:text-white" />
                )}
              </button>
            );
          })}
        </div>

        {/* Active Category Filter Status Indicator */}
        {activeCategory !== 'all' && (
          <div className="flex items-center justify-between mt-2 px-2.5 py-1.5 rounded-xl bg-[#7c3aed]/15 border border-[#7c3aed]/30 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <PlatformIcon platform={activeCategory} className="w-4 h-4 shrink-0" />
              <span className="text-white font-semibold truncate">
                Filtered to: <span className="text-[#c4b5fd]">{activeAppLabel}</span>
              </span>
              <span className="text-[10px] text-[#a1a1aa] shrink-0 font-mono">
                ({filtered.length} {filtered.length === 1 ? 'number' : 'numbers'})
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className="flex items-center gap-1 text-[11px] text-[#c4b5fd] hover:text-white font-bold ml-2 shrink-0 px-2 py-0.5 rounded-lg bg-[#7c3aed]/20 hover:bg-[#7c3aed]/40 transition-colors"
            >
              <X className="w-3 h-3" />
              <span>Clear Filter</span>
            </button>
          </div>
        )}
      </div>

      {/* Virtual Services List */}
      <div className="grid grid-cols-1 gap-2.5">
        {serverItems.length === 0 ? (
          <div className="p-10 text-center bg-[#181820] border border-[#262630] rounded-2xl flex flex-col items-center justify-center gap-3">
            <Radio className="w-8 h-8 text-[#71717a]" />
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-white">No OTP Services in Stock</span>
              <span className="text-xs text-[#a1a1aa]">
                Live pool is currently empty for Server {serverId}. Check back shortly.
              </span>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center bg-[#181820] border border-[#262630] rounded-2xl flex flex-col items-center justify-center gap-3">
            <Globe className="w-8 h-8 text-[#71717a]" />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-white">No virtual services found</span>
              <span className="text-[11px] text-[#a1a1aa]">
                No services matching &quot;{search}&quot;
                {activeCategory !== 'all' ? ` in ${activeAppLabel}` : ''}.
              </span>
            </div>
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
                    <span className="font-mono text-[#a1a1aa]">{isServer3 || !service.availableCount || service.availableCount >= 999 ? "Available" : `${service.availableCount} stock`}</span>
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
            Showing {displayCount} of {filtered.length.toLocaleString()} available services
          </span>
          <button
            type="button"
            onClick={() => setDisplayCount((prev) => prev + 50)}
            className="px-5 py-2.5 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-bold shadow-violet-glow-sm transition-all active:scale-95 flex items-center gap-1.5"
          >
            <span>Load More Services</span>
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

      {/* All Apps Search & Selection Bottom-Sheet Modal */}
      {isAppPickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
          onClick={() => {
            setIsAppPickerOpen(false);
            setAppPickerSearch('');
          }}
        >
          <div
            className="w-full sm:max-w-lg bg-[#14141b] border border-[#272736] rounded-t-3xl sm:rounded-2xl flex flex-col max-h-[85vh] sm:max-h-[80vh] shadow-2xl overflow-hidden animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-[#232330] flex items-center justify-between bg-[#181822]">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#8b5cf6]" />
                  <span>All Supported Platforms</span>
                </span>
                <span className="text-[11px] text-[#a1a1aa]">
                  Choose from {allUniqueApps.length} services available on Server {serverId}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAppPickerOpen(false);
                  setAppPickerSearch('');
                }}
                className="w-8 h-8 rounded-full bg-[#232332] hover:bg-[#303044] text-[#a1a1aa] hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Search Bar */}
            <div className="p-3 border-b border-[#232330] bg-[#14141b]">
              <div className="relative">
                <Search className="w-4 h-4 text-[#71717a] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={appPickerSearch}
                  onChange={(e) => setAppPickerSearch(e.target.value)}
                  placeholder={`Search ${allUniqueApps.length} platforms (e.g. Netflix, Steam, Tinder)...`}
                  className="w-full bg-[#1b1b26] border border-[#2e2e40] focus:border-[#7c3aed] rounded-xl pl-9 pr-9 py-2 text-xs text-white placeholder-[#71717a] focus:outline-none"
                  autoFocus
                />
                {appPickerSearch && (
                  <button
                    type="button"
                    onClick={() => setAppPickerSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#2a2a3c] text-[#a1a1aa] hover:text-white flex items-center justify-center"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Modal Apps List */}
            <div className="p-3 overflow-y-auto max-h-[60vh] space-y-1.5 no-scrollbar">
              {/* Option to select "All Services" */}
              <button
                type="button"
                onClick={() => {
                  setActiveCategory('all');
                  setIsAppPickerOpen(false);
                  setAppPickerSearch('');
                }}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all ${
                  activeCategory === 'all'
                    ? 'bg-[#7c3aed]/25 border-[#8b5cf6] text-white font-bold'
                    : 'bg-[#181822] hover:bg-[#20202e] border-[#262634] text-[#d4d4d8]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 flex items-center justify-center">
                    <PlatformIcon platform="all" className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="font-bold text-white">All Services</span>
                    <span className="text-[10px] text-[#a1a1aa]">View everything across all countries</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-[#a1a1aa]">
                    {serverItems.length.toLocaleString()} routes
                  </span>
                  {activeCategory === 'all' && <Check className="w-4 h-4 text-[#8b5cf6]" />}
                </div>
              </button>

              {/* Filtered App List */}
              {modalFilteredApps.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#71717a]">
                  No platforms matching &quot;{appPickerSearch}&quot; found
                </div>
              ) : (
                modalFilteredApps.map((app) => {
                  const isSelected = activeCategory === app.code;
                  return (
                    <button
                      key={app.code}
                      type="button"
                      onClick={() => {
                        setActiveCategory(app.code);
                        setIsAppPickerOpen(false);
                        setAppPickerSearch('');
                      }}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all active:scale-[0.99] ${
                        isSelected
                          ? 'bg-[#7c3aed]/25 border-[#8b5cf6] text-white font-bold shadow-violet-glow-sm'
                          : 'bg-[#181822] hover:bg-[#20202e] border-[#262634] text-[#d4d4d8]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-6 h-6 flex items-center justify-center shrink-0">
                          <PlatformIcon platform={app.code} className="w-5 h-5" />
                        </div>
                        <span className="font-semibold text-white truncate text-left">
                          {app.label}
                        </span>
                        {app.badge && (
                          <span className="text-[8px] px-1 py-0.2 rounded font-extrabold uppercase bg-[#7c3aed]/30 text-[#c4b5fd] border border-[#7c3aed]/40 shrink-0">
                            {app.badge}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono text-[#a1a1aa]">
                          {app.count} {app.count === 1 ? 'route' : 'routes'}
                        </span>
                        {isSelected && <Check className="w-4 h-4 text-[#8b5cf6]" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
