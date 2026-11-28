import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Server1Lzt } from './Server1Lzt';
import { Server2Sessions } from './Server2Sessions';
import { Server34Otp } from './Server34Otp';
import { Server5Smm } from './Server5Smm';
import { PinnedDealsSection } from '../dashboard/PinnedDealsSection';
import { PlatformIcon } from '../common/PlatformIcon';
import { hapticFeedback } from '../../utils/haptics';
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface ServerMeta {
  id: 1 | 2 | 3 | 4 | 5;
  name: string;
  benefit: string;
  badge: string;
  badgeColor: string;
  accentBar: string;
  mainPlatform: string;
  showZapOverlay?: boolean;
  dotColor?: string;
  socialIcons?: string[];
  moreLabel?: string;
  tags?: string[];
  fallbackPrice: string;
  fallbackCount: string;
}

const SERVERS: ServerMeta[] = [
  {
    id: 5,
    name: 'Social Media Boost',
    benefit: 'Members, Post Views, Followers & Likes',
    badge: 'WHOLESALE',
    badgeColor: 'bg-[#7c3aed]/15 text-[#a78bfa]',
    accentBar: 'bg-[#7c3aed]',
    mainPlatform: 'ig',
    socialIcons: ['tg', 'ig', 'yt', 'tk', 'tw'],
    moreLabel: '+3',
    fallbackPrice: 'From ₹1 / 1k',
    fallbackCount: '9,000+ services',
  },
  {
    id: 1,
    name: 'TG Accounts · Economy',
    benefit: 'Ready-to-login accounts with instant OTP fetch',
    badge: 'LOWEST PRICE',
    badgeColor: 'bg-amber-500/15 text-amber-500',
    accentBar: 'bg-[#229ED9]',
    mainPlatform: 'tg',
    dotColor: 'bg-amber-400',
    tags: ['No-Spam Filter', 'Instant Login'],
    fallbackPrice: 'Check Stock',
    fallbackCount: 'Live stock',
  },
  {
    id: 2,
    name: 'TG Sessions · Aged (2021–25)',
    benefit: 'High-survival aged accounts & bulk .session ZIPs',
    badge: 'HIGH TRUST',
    badgeColor: 'bg-emerald-500/15 text-[#22c55e]',
    accentBar: 'bg-emerald-500',
    mainPlatform: 'tg',
    dotColor: 'bg-emerald-500',
    tags: ['OTP or .session ZIP', 'Bulk Ready'],
    fallbackPrice: 'Check Stock',
    fallbackCount: 'Aged stock',
  },
  {
    id: 3,
    name: 'Instant Virtual OTP',
    benefit: 'Fastest 1–3s SMS codes · 100% auto-refund',
    badge: '1–3s FASTEST',
    badgeColor: 'bg-amber-500/15 text-amber-500',
    accentBar: 'bg-[#eab308]',
    mainPlatform: 'tg',
    showZapOverlay: true,
    socialIcons: ['tg', 'wa', 'go', 'openai', 'ig'],
    moreLabel: '+500',
    fallbackPrice: 'From ₹10',
    fallbackCount: 'Fast OTP',
  },
  {
    id: 4,
    name: 'Fresh Carrier Numbers',
    benefit: 'Private carrier SIM pool · 100% auto-refund',
    badge: 'PRIVATE SIM',
    badgeColor: 'bg-[#25D366]/15 text-[#25D366]',
    accentBar: 'bg-[#25D366]',
    mainPlatform: 'wa',
    socialIcons: ['wa', 'tg', 'ig', 'fb', 'tk'],
    moreLabel: '+890',
    fallbackPrice: 'From ₹12',
    fallbackCount: 'Fresh SIMs',
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
  // VIEW A: COMPACT STORE HUB (5-Server Directory, Server 5 on Top)
  // ============================================================================
  if (viewMode === 'hub') {
    return (
      <div className="w-full flex flex-col pt-1.5 pb-10">
        {/* Thin Pinned Deals Hook */}
        <PinnedDealsSection title="Hot Pinned Deals" />

        {/* Store Hub Heading */}
        <div className="flex items-center justify-between mt-1.5 mb-2.5 px-0.5">
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
              Choose a Service
            </h2>
            <p className="text-[11px] text-[#a1a1aa]">
              Pick a server below to browse &amp; buy
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#22c55e] bg-[#22c55e]/15 px-2.5 py-1 rounded-full shrink-0">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Auto-Refund Guard</span>
          </span>
        </div>

        {/* Compact 2-Row Physical Server Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {SERVERS.map((srv) => {
            const stat = serverStats[srv.id];
            return (
              <div
                key={srv.id}
                onClick={() => handleOpenServer(srv.id)}
                className="store-server-card relative overflow-hidden rounded-2xl cursor-pointer flex flex-col justify-between group"
              >
                {/* Crisp 3px Top Accent Bar */}
                <div className={`h-[3px] w-full ${srv.accentBar}`} />

                <div className="p-3 flex flex-col gap-2.5">
                  {/* ROW 1: Real Brand Icon + Title/Benefit + Value Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`relative w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isLight ? 'bg-slate-100' : 'bg-white/[0.06]'
                      }`}>
                        <PlatformIcon platform={srv.mainPlatform} className="w-5 h-5" />
                        {srv.dotColor && (
                          <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${srv.dotColor} ring-2 ${isLight ? 'ring-white' : 'ring-[#181820]'}`} />
                        )}
                        {srv.showZapOverlay && (
                          <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center ring-2 ${isLight ? 'ring-white' : 'ring-[#181820]'}`}>
                            <Zap className="w-2.5 h-2.5 text-black fill-black" />
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#a1a1aa] leading-tight">
                          {srv.id === 5 ? 'SMM' : `Server ${srv.id}`}
                        </span>
                        <span className="text-xs sm:text-[13px] font-extrabold text-white truncate">
                          {srv.name}
                        </span>
                        <span className="text-[11px] text-[#a1a1aa] truncate">
                          {srv.benefit}
                        </span>
                      </div>
                    </div>

                    <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full shrink-0 ${srv.badgeColor}`}>
                      {srv.badge}
                    </span>
                  </div>

                  {/* ROW 2: Real Social Media Icons / Micro-Tags + Live Price + 2.5D Open Button */}
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <div className="flex items-center gap-2 min-w-0">
                      {srv.socialIcons ? (
                        <div className="flex items-center -space-x-1 shrink-0">
                          {srv.socialIcons.map((iconCode) => (
                            <div
                              key={iconCode}
                              className={`w-5 h-5 rounded-full flex items-center justify-center ring-1 ${
                                isLight ? 'bg-white ring-slate-200' : 'bg-[#121217] ring-[#262630]'
                              }`}
                            >
                              <PlatformIcon platform={iconCode} className="w-3.5 h-3.5" />
                            </div>
                          ))}
                          {srv.moreLabel && (
                            <span className={`ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                              isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/[0.06] text-[#a1a1aa]'
                            }`}>
                              {srv.moreLabel}
                            </span>
                          )}
                        </div>
                      ) : srv.tags ? (
                        <div className="flex items-center gap-1 shrink-0">
                          {srv.tags.map((t) => (
                            <span
                              key={t}
                              className={`text-[9.5px] font-semibold px-1.5 py-0.5 rounded-md ${
                                isLight ? 'bg-slate-100 text-slate-700' : 'bg-white/[0.06] text-[#d4d4d8]'
                              }`}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      <div className="flex flex-col leading-tight min-w-0">
                        <span className="text-[10px] text-[#71717a] truncate">
                          {stat.countLabel}
                        </span>
                        <span className="text-[11px] font-extrabold text-[#22c55e] font-mono tabular-nums truncate">
                          {stat.minPrice !== null ? `From ${formatPrice(stat.minPrice)}` : srv.fallbackPrice}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenServer(srv.id);
                      }}
                      className="btn-25d-primary inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-bold shrink-0 cursor-pointer"
                    >
                      <span>Open</span>
                      <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
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
  return (
    <div className="w-full flex flex-col pb-8 pt-1.5">
      {/* Compact Sticky Sub-Header: Back to All Servers + Quick Server Switcher on Desktop */}
      <div className="flex items-center justify-between gap-2 mb-2 px-0.5">
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
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 hidden sm:flex ${
              isLight ? 'bg-slate-100' : 'bg-white/[0.06]'
            }`}>
              <PlatformIcon platform={activeMeta.mainPlatform} className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs sm:text-sm font-extrabold text-white truncate">
                Server {activeMeta.id} · {activeMeta.name}
              </span>
              <span className="text-[10px] text-[#a1a1aa] truncate hidden sm:block">
                {activeMeta.benefit}
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
