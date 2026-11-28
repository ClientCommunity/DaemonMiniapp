import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Server1Lzt } from './Server1Lzt';
import { Server2Sessions } from './Server2Sessions';
import { Server34Otp } from './Server34Otp';
import { Server5Smm } from './Server5Smm';
import { PinnedDealsSection } from '../dashboard/PinnedDealsSection';
import { hapticFeedback } from '../../utils/haptics';
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Users,
  Zap,
} from 'lucide-react';

const TelegramIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.52 2.77-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
  </svg>
);

const WhatsAppIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm5.79 14.15c-.24.68-1.39 1.3-1.94 1.38-.5.08-1.12.11-1.81-.11-.42-.14-.96-.32-1.65-.62-2.91-1.26-4.81-4.2-4.96-4.4-.14-.19-1.19-1.58-1.19-3.02 0-1.44.75-2.14 1.02-2.43.27-.29.58-.36.78-.36.19 0 .39 0 .56.01.18.01.42-.07.65.49.24.58.82 2 .89 2.15.07.15.12.33.02.53-.1.19-.15.31-.3.48-.15.17-.31.38-.45.51-.15.14-.3.3-.13.6.17.29.77 1.27 1.65 2.05 1.13 1 2.08 1.31 2.38 1.45.29.15.46.13.63-.07.17-.2.73-.85.93-1.14.19-.29.39-.24.66-.14.27.1 1.7.8 1.99.95.29.14.49.22.56.34.07.12.07.72-.17 1.4z" />
  </svg>
);

interface ServerMeta {
  id: 1 | 2 | 3 | 4 | 5;
  name: string;
  tagline: string;
  description: string;
  highlights: string[];
  badge: string;
  badgeColor: string;
  accentBar: string;
  accentBg: string;
  iconColor: string;
  dotColor?: string;
  icon: React.FC<{ className?: string }>;
}

const SERVERS: ServerMeta[] = [
  {
    id: 5,
    name: 'Server 5 · Social Media Service',
    tagline: 'SMM Hub · TG, IG, YouTube & More',
    description: 'Wholesale SMM growth packages — Telegram Members, Post Views, Reactions, Followers & Likes.',
    highlights: ['Platform Sub-Categories', 'Wholesale Per-1k Rates'],
    badge: 'SMM Hub',
    badgeColor: 'bg-[#7c3aed]/15 text-[#a78bfa]',
    accentBar: 'bg-[#7c3aed]',
    accentBg: 'bg-[#7c3aed]/15',
    iconColor: 'text-[#a78bfa]',
    icon: Users,
  },
  {
    id: 1,
    name: 'Server 1 · Cheap Quality',
    tagline: 'Instant TG Credentials + OTP',
    description: 'Cheapest ready-to-login Telegram accounts with live spam, geoblock, and 2FA filtering.',
    highlights: ['Live Spam/Geo Filters', 'Instant Login + OTP'],
    badge: 'Lowest Price',
    badgeColor: 'bg-amber-500/15 text-amber-500',
    accentBar: 'bg-[#229ED9]',
    accentBg: 'bg-[#229ED9]/15',
    iconColor: 'text-[#229ED9]',
    dotColor: 'bg-amber-400',
    icon: TelegramIcon,
  },
  {
    id: 2,
    name: 'Server 2 · Good Quality',
    tagline: '2021–2025 Aged & Bulk Sessions',
    description: 'Aged Telegram accounts & bulk .session ZIP packs with Good and Cheap quality tiers.',
    highlights: ['Account or .session ZIP', 'Bulk Quantity Support'],
    badge: 'High Trust',
    badgeColor: 'bg-emerald-500/15 text-[#22c55e]',
    accentBar: 'bg-emerald-500',
    accentBg: 'bg-[#229ED9]/15',
    iconColor: 'text-[#229ED9]',
    dotColor: 'bg-emerald-500',
    icon: TelegramIcon,
  },
  {
    id: 3,
    name: 'Server 3 · Instant Virtual OTP',
    tagline: 'All Apps · Ultra-Fast 1–3s SMS',
    description: 'High-speed virtual numbers for Telegram, WhatsApp, Google, OpenAI & 500+ apps.',
    highlights: ['1–3s Resolution', '10-Min Auto-Refund'],
    badge: 'Fastest',
    badgeColor: 'bg-amber-500/15 text-amber-500',
    accentBar: 'bg-[#eab308]',
    accentBg: 'bg-amber-500/15',
    iconColor: 'text-[#eab308]',
    icon: Zap,
  },
  {
    id: 4,
    name: 'Server 4 · Fresh Carrier Pool',
    tagline: 'All Apps · 21,000+ Private SIMs',
    description: 'Fresh private carrier pool across 180+ countries with high SMS completion rate.',
    highlights: ['Private Carrier SIMs', '10-Min Auto-Refund'],
    badge: 'Fresh Pool',
    badgeColor: 'bg-[#25D366]/15 text-[#25D366]',
    accentBar: 'bg-[#25D366]',
    accentBg: 'bg-[#25D366]/15',
    iconColor: 'text-[#25D366]',
    icon: WhatsAppIcon,
  },
];

export const StorefrontView: React.FC = () => {
  const {
    selectedServer,
    setSelectedServer,
    server1Items,
    server2Items,
    server34Items,
    formatPrice,
    theme,
  } = useApp();
  const isLight = theme === 'light';

  const [viewMode, setViewMode] = useState<'hub' | 'server'>(() => {
    try {
      if (sessionStorage.getItem('krish_store_open_server') === '1') {
        sessionStorage.removeItem('krish_store_open_server');
        return 'server';
      }
    } catch {}
    return 'hub';
  });

  // Open dedicated server view automatically if user clicks a Pinned Deal or external shortcut
  useEffect(() => {
    const onPinned = () => {
      try {
        sessionStorage.removeItem('krish_store_open_server');
      } catch {}
      setViewMode('server');
    };
    window.addEventListener('krish_pinned_selected', onPinned);
    return () => window.removeEventListener('krish_pinned_selected', onPinned);
  }, []);

  const serverStats = useMemo(() => {
    const s1Prices = server1Items.filter((i) => i.stockCount > 0).map((i) => i.priceInr);
    const s2Prices = server2Items.filter((i) => i.stockCount > 0).map((i) => i.priceInr);
    const s3Items = server34Items.filter((i) => i.server === 3);
    const s4Items = server34Items.filter((i) => i.server === 4);
    const s3Prices = s3Items.map((i) => i.priceInr);
    const s4Prices = s4Items.map((i) => i.priceInr);

    return {
      1: {
        minPrice: s1Prices.length ? Math.min(...s1Prices) : null,
        countLabel: server1Items.length ? `${server1Items.length} countries` : 'Live stock',
      },
      2: {
        minPrice: s2Prices.length ? Math.min(...s2Prices) : null,
        countLabel: server2Items.length ? `${server2Items.length} packages` : 'Aged stock',
      },
      3: {
        minPrice: s3Prices.length ? Math.min(...s3Prices) : null,
        countLabel: s3Items.length ? `${s3Items.length.toLocaleString()} routes` : 'Fast OTP',
      },
      4: {
        minPrice: s4Prices.length ? Math.min(...s4Prices) : null,
        countLabel: s4Items.length ? `${s4Items.length.toLocaleString()} routes` : 'Fresh SIMs',
      },
      5: {
        minPrice: null,
        countLabel: '9,000+ services',
      },
    } as Record<number, { minPrice: number | null; countLabel: string }>;
  }, [server1Items, server2Items, server34Items]);

  const handleOpenServer = (serverId: 1 | 2 | 3 | 4 | 5) => {
    hapticFeedback.light();
    setSelectedServer(serverId);
    setViewMode('server');
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {}
  };

  const handleBackToHub = () => {
    hapticFeedback.light();
    setViewMode('hub');
  };

  const activeMeta = SERVERS.find((s) => s.id === selectedServer) || SERVERS[0];

  // ============================================================================
  // VIEW A: CLEAN STORE HUB (5-Server Directory, Server 5 on Top)
  // ============================================================================
  if (viewMode === 'hub') {
    return (
      <div className="w-full flex flex-col pt-2 pb-10">
        {/* Thin Pinned Deals Hook */}
        <PinnedDealsSection title="Hot Pinned Deals" />

        {/* Store Hub Heading */}
        <div className="flex items-center justify-between mt-2 mb-3 px-0.5">
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
              Choose a Service Server
            </h2>
            <p className="text-[11px] text-[#a1a1aa]">
              Select the server that fits what you want to buy
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#22c55e] bg-[#22c55e]/15 px-2.5 py-1 rounded-full shrink-0">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Auto-Refund Guard</span>
          </span>
        </div>

        {/* Clean 5-Server Physical Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {SERVERS.map((srv) => {
            const Icon = srv.icon;
            const stat = serverStats[srv.id];
            return (
              <div
                key={srv.id}
                onClick={() => handleOpenServer(srv.id)}
                className="store-server-card relative overflow-hidden rounded-2xl cursor-pointer flex flex-col justify-between active:scale-[0.99] group"
              >
                {/* Crisp Top Accent Bar (Zero Neon Glow) */}
                <div className={`h-1 w-full ${srv.accentBar}`} />

                <div className="p-4 flex flex-col justify-between flex-1 gap-3">
                  <div>
                    {/* Top Row: Original Icon + Title + Status Badge */}
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`relative w-10 h-10 rounded-xl ${srv.accentBg} flex items-center justify-center shrink-0`}>
                          <Icon className={`w-5 h-5 ${srv.iconColor}`} />
                          {srv.dotColor && (
                            <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${srv.dotColor} ring-2 ${isLight ? 'ring-white' : 'ring-[#181820]'}`} />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs sm:text-sm font-extrabold text-white truncate">
                            {srv.name}
                          </span>
                          <span className="text-[10px] font-medium text-[#a1a1aa] truncate">
                            {srv.tagline}
                          </span>
                        </div>
                      </div>
                      <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full shrink-0 ${srv.badgeColor}`}>
                        {srv.badge}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-[11px] text-[#a1a1aa] leading-relaxed mb-2.5">
                      {srv.description}
                    </p>

                    {/* Feature Chips */}
                    <div className="flex flex-wrap gap-1.5">
                      {srv.highlights.map((hl) => (
                        <span
                          key={hl}
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                            isLight ? 'bg-slate-100 text-slate-700' : 'bg-white/[0.05] text-[#d4d4d8]'
                          }`}
                        >
                          {hl}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Card Footer Strip: Price/Stock + 2.5D Continue Button */}
                  <div className={`pt-2.5 mt-1 border-t flex items-center justify-between gap-2 ${
                    isLight ? 'border-slate-100' : 'border-white/[0.06]'
                  }`}>
                    <div className="flex flex-col leading-tight">
                      <span className="text-[10px] text-[#71717a]">
                        {stat.countLabel}
                      </span>
                      <span className="text-xs font-extrabold text-[#22c55e] font-mono tabular-nums">
                        {stat.minPrice !== null ? `From ${formatPrice(stat.minPrice)}` : 'Wholesale Rates'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenServer(srv.id);
                      }}
                      className="btn-25d-primary inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      <span>Continue</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ============================================================================
  // VIEW B: DEDICATED SERVER WORKSPACE
  // ============================================================================
  const ActiveIcon = activeMeta.icon;

  return (
    <div className="w-full flex flex-col pb-8 pt-1.5">
      {/* Compact Sticky Sub-Header: Back to All Servers + Quick Server Switcher on Desktop */}
      <div className="flex items-center justify-between gap-2 mb-2.5 px-0.5">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={handleBackToHub}
            className="btn-25d-secondary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Servers</span>
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-7 h-7 rounded-lg ${activeMeta.accentBg} flex items-center justify-center shrink-0 hidden sm:flex`}>
              <ActiveIcon className={`w-4 h-4 ${activeMeta.iconColor}`} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs sm:text-sm font-extrabold text-white truncate">
                {activeMeta.name}
              </span>
              <span className="text-[10px] text-[#a1a1aa] truncate hidden sm:block">
                {activeMeta.tagline}
              </span>
            </div>
          </div>
        </div>

        {/* Desktop Quick Server Switcher Pills */}
        <div className="hidden lg:flex items-center gap-1.5 shrink-0">
          {SERVERS.map((srv) => {
            const isActive = srv.id === selectedServer;
            return (
              <button
                key={srv.id}
                type="button"
                onClick={() => handleOpenServer(srv.id)}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'btn-25d-primary'
                    : 'btn-25d-secondary text-[#a1a1aa] hover:text-white'
                }`}
              >
                S{srv.id}
              </button>
            );
          })}
        </div>
      </div>

      {/* Render Active Server Component */}
      {selectedServer === 1 && <Server1Lzt />}
      {selectedServer === 2 && <Server2Sessions />}
      {selectedServer === 3 && <Server34Otp serverId={3} />}
      {selectedServer === 4 && <Server34Otp serverId={4} />}
      {selectedServer === 5 && <Server5Smm />}
    </div>
  );
};
