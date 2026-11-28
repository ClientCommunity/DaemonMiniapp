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
  FolderArchive,
  Radio,
  Rocket,
  ShieldCheck,
  UserCheck,
  Zap,
} from 'lucide-react';

interface ServerMeta {
  id: 1 | 2 | 3 | 4 | 5;
  name: string;
  tagline: string;
  description: string;
  highlights: string[];
  badge: string;
  badgeColor: string;
  accentBg: string;
  iconColor: string;
  icon: React.FC<{ className?: string }>;
}

const SERVERS: ServerMeta[] = [
  {
    id: 1,
    name: 'Server 1 · Budget Accounts',
    tagline: 'Instant TG Credentials + OTP',
    description: 'Cheapest ready-to-login Telegram accounts with live spam, geoblock, and 2FA filtering.',
    highlights: ['Live Spam/Geo Filters', 'Instant Login + OTP'],
    badge: 'Lowest Price',
    badgeColor: 'bg-amber-500/15 text-amber-400',
    accentBg: 'bg-amber-500/15',
    iconColor: 'text-amber-400',
    icon: UserCheck,
  },
  {
    id: 2,
    name: 'Server 2 · Aged & Bulk Sessions',
    tagline: '2021–2025 High-Trust Stock',
    description: 'Aged Telegram accounts & bulk .session ZIP packs with Good and Cheap quality tiers.',
    highlights: ['Account or .session ZIP', 'Bulk Quantity Support'],
    badge: 'High Trust',
    badgeColor: 'bg-emerald-500/15 text-[#22c55e]',
    accentBg: 'bg-emerald-500/15',
    iconColor: 'text-[#22c55e]',
    icon: FolderArchive,
  },
  {
    id: 3,
    name: 'Server 3 · Instant Virtual OTP',
    tagline: 'Ultra-Fast 1–3s SMS Delivery',
    description: 'High-speed virtual numbers for Telegram, WhatsApp, Google, OpenAI & 500+ apps.',
    highlights: ['1–3s Resolution', '10-Min Auto-Refund'],
    badge: 'Fastest',
    badgeColor: 'bg-[#7c3aed]/20 text-[#a78bfa]',
    accentBg: 'bg-[#7c3aed]/15',
    iconColor: 'text-[#a78bfa]',
    icon: Zap,
  },
  {
    id: 4,
    name: 'Server 4 · Fresh Carrier Pool',
    tagline: '21,000+ Private SIM Routes',
    description: 'Fresh private carrier pool across 180+ countries with high SMS completion rate.',
    highlights: ['Private Carrier SIMs', '10-Min Auto-Refund'],
    badge: 'Fresh Pool',
    badgeColor: 'bg-sky-500/15 text-sky-400',
    accentBg: 'bg-sky-500/15',
    iconColor: 'text-sky-400',
    icon: Radio,
  },
  {
    id: 5,
    name: 'Server 5 · Social Media Boost',
    tagline: 'TG, Instagram, YouTube & More',
    description: 'Wholesale SMM growth packages — Members, Post Views, Reactions, Followers & Likes.',
    highlights: ['Platform Sub-Categories', 'Wholesale Per-1k Rates'],
    badge: 'SMM Hub',
    badgeColor: 'bg-rose-500/15 text-rose-400',
    accentBg: 'bg-rose-500/15',
    iconColor: 'text-rose-400',
    icon: Rocket,
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
  } = useApp();

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
  // VIEW A: CLEAN STORE HUB (5-Server Directory)
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

        {/* Clean 5-Server Directory Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {SERVERS.map((srv) => {
            const Icon = srv.icon;
            const stat = serverStats[srv.id];
            return (
              <div
                key={srv.id}
                onClick={() => handleOpenServer(srv.id)}
                className="p-4 rounded-2xl bg-[#181820] hover:bg-[#1e1e29] shadow-sm transition-all duration-150 cursor-pointer flex flex-col justify-between gap-3 active:scale-[0.99] group"
              >
                <div>
                  {/* Top Row: Icon + Title + Status Badge */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-10 h-10 rounded-xl ${srv.accentBg} flex items-center justify-center shrink-0`}>
                        <Icon className={`w-5 h-5 ${srv.iconColor}`} />
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

                  {/* Feature Pills (No Borders) */}
                  <div className="flex flex-wrap gap-1.5">
                    {srv.highlights.map((hl) => (
                      <span
                        key={hl}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#121217] text-[#d4d4d8]"
                      >
                        {hl}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Bottom Row: Price/Stock + 2.5D Continue Button */}
                <div className="pt-2.5 flex items-center justify-between gap-2">
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
