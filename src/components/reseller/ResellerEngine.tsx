import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Share2,
  Copy,
  Check,
  TrendingUp,
  Users,
  ShoppingBag,
  Sliders,
  Sparkles
} from 'lucide-react';
import { PlatformIcon } from '../common/PlatformIcon';

interface ServerProductOption {
  id: number;
  serverName: string;
  badge: string;
  category: string;
  basePriceInr: number;
  platformIcon?: string;
}

export const ResellerEngine: React.FC = () => {
  const { resellerConfig, updateResellerMargin, formatPrice, addToast } = useApp();

  const serverProducts: ServerProductOption[] = [
    {
      id: 1,
      serverName: 'Server 1: Global 2FA Accounts',
      badge: 'Global 2FA',
      category: 'Telegram Accounts with instant 2FA credentials',
      basePriceInr: 85,
      platformIcon: 'tg'
    },
    {
      id: 2,
      serverName: 'Server 2: Aged Session Vault',
      badge: 'Aged Sessions',
      category: 'Multi-year Telegram sessions (Good / Cheap)',
      basePriceInr: 60,
      platformIcon: 'tg'
    },
    {
      id: 3,
      serverName: 'Server 3: Instant Virtual OTP',
      badge: 'Fast OTP',
      category: 'Instant 1-3s SMS activation pool',
      basePriceInr: 45,
      platformIcon: 'wa'
    },
    {
      id: 4,
      serverName: 'Server 4: Fresh Carrier Numbers',
      badge: 'Fresh Numbers',
      category: 'Private non-recycled carrier numbers pool',
      basePriceInr: 55,
      platformIcon: 'tg'
    },
    {
      id: 5,
      serverName: 'Server 5: SMM Services Hub',
      badge: 'SMM Boost',
      category: 'Organic members, followers & views (per 1K)',
      basePriceInr: 95,
      platformIcon: 'instagram'
    }
  ];

  const [marginInput, setMarginInput] = useState<number>(resellerConfig.marginInr);
  const [selectedServerId, setSelectedServerId] = useState<number>(1);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedStandardRef, setCopiedStandardRef] = useState(false);

  const selectedServer = serverProducts.find((s) => s.id === selectedServerId) || serverProducts[0];
  const finalPriceInr = selectedServer.basePriceInr + marginInput;

  const standardRefLink = `https://t.me/DeamonOTPbot?start=ref_7507183871`;

  const handleCopyResellerLink = () => {
    navigator.clipboard?.writeText(resellerConfig.resellerLink);
    setCopiedLink(true);
    addToast('Unique Reseller link copied to clipboard!', 'success', 'Copied');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyStandardRef = () => {
    navigator.clipboard?.writeText(standardRefLink);
    setCopiedStandardRef(true);
    addToast('Standard referral link copied!', 'info', 'Copied');
    setTimeout(() => setCopiedStandardRef(false), 2000);
  };

  const handleSaveMargin = (e: React.FormEvent) => {
    e.preventDefault();
    updateResellerMargin(marginInput);
  };

  return (
    <div className="w-full flex flex-col pt-1 pb-4">
      {/* Reseller Banner */}
      <div className="p-4 mb-4 rounded-2xl bg-gradient-to-r from-[#181820] to-[#121217] border border-[#262630] relative overflow-hidden shadow-lg">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#7c3aed]/15 rounded-full filter blur-2xl pointer-events-none" />
        <span className="text-[10px] font-bold text-[#8b5cf6] uppercase tracking-wider block mb-1">
          Custom Margin Engine
        </span>
        <h2 className="text-base font-extrabold text-white tracking-tight">
          Reseller Bot Link Creator
        </h2>
        <p className="text-xs text-[#a1a1aa] mt-0.5">
          Set your own profit margin (₹5 - ₹100) and share customized purchase links.
        </p>
      </div>

      {/* 3-Metric Performance Grid */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {/* Metric 1 */}
        <div className="p-3 rounded-2xl bg-[#181820] border border-[#262630] flex flex-col">
          <div className="flex items-center gap-1.5 text-[#a1a1aa] text-[10px] font-semibold mb-1">
            <Users className="w-3.5 h-3.5 text-blue-400" />
            <span>Customers</span>
          </div>
          <span className="text-base font-extrabold text-white font-mono">
            {resellerConfig.customersCount}
          </span>
          <span className="text-[9px] text-[#22c55e] font-medium mt-0.5">+3 this week</span>
        </div>

        {/* Metric 2 */}
        <div className="p-3 rounded-2xl bg-[#181820] border border-[#262630] flex flex-col">
          <div className="flex items-center gap-1.5 text-[#a1a1aa] text-[10px] font-semibold mb-1">
            <ShoppingBag className="w-3.5 h-3.5 text-[#f59e0b]" />
            <span>Orders</span>
          </div>
          <span className="text-base font-extrabold text-white font-mono">
            {resellerConfig.ordersCount}
          </span>
          <span className="text-[9px] text-[#a1a1aa] font-medium mt-0.5">Dispatched</span>
        </div>

        {/* Metric 3 */}
        <div className="p-3 rounded-2xl bg-[#181820] border border-[#262630] flex flex-col">
          <div className="flex items-center gap-1.5 text-[#a1a1aa] text-[10px] font-semibold mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-[#22c55e]" />
            <span>Profit</span>
          </div>
          <span className="text-base font-extrabold text-[#22c55e] font-mono">
            {formatPrice(resellerConfig.totalProfitInr)}
          </span>
          <span className="text-[9px] text-[#8b5cf6] font-medium mt-0.5">Credited</span>
        </div>
      </div>

      {/* Reseller Link Bar with 1-Click Copy */}
      <div className="p-4 rounded-2xl bg-[#181820] border border-[#262630] mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-white flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-[#8b5cf6]" />
            <span>Active Reseller Bot Link</span>
          </span>
          <span className="text-[10px] font-mono font-bold text-[#22c55e] bg-[#22c55e]/15 px-2 py-0.5 rounded-full border border-[#22c55e]/30">
            +{formatPrice(resellerConfig.marginInr)} Margin
          </span>
        </div>

        <div className="flex items-center justify-between bg-[#0b0b0e] border border-[#262630] rounded-xl px-3 py-2">
          <span className="text-xs font-mono text-[#8b5cf6] truncate mr-2">
            {resellerConfig.resellerLink}
          </span>
          <button
            onClick={handleCopyResellerLink}
            className="shrink-0 flex items-center gap-1.5 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-violet-glow-sm active:scale-95 transition-all"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
          </button>
        </div>
      </div>

      {/* Custom Margin Creator & Price Simulator */}
      <form onSubmit={handleSaveMargin} className="p-4 rounded-2xl bg-[#181820] border border-[#262630] mb-4 flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-[#7c3aed]" />
            <span>Live Price Simulator & Margin Config</span>
          </h3>
          <span className="text-[10px] text-[#a1a1aa]">Allowed: ₹5 – ₹100</span>
        </div>

        {/* Server Selection (Strictly 5 Servers) */}
        <div className="flex flex-col gap-2">
          <label className="text-[11px] text-[#a1a1aa] font-semibold flex items-center justify-between">
            <span>Select Server Product</span>
            <span className="text-[10px] text-[#8b5cf6] font-bold">
              Server {selectedServer.id} Selected
            </span>
          </label>

          {/* Quick Server Tabs Selector */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
            {serverProducts.map((s) => {
              const isActive = selectedServerId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedServerId(s.id)}
                  className={`flex flex-col items-center justify-center px-3 py-2 rounded-xl border text-xs shrink-0 transition-all active:scale-95 ${
                    isActive
                      ? 'bg-[#7c3aed] border-[#8b5cf6] text-white shadow-violet-glow-sm font-bold ring-1 ring-[#8b5cf6]/50'
                      : 'bg-[#0b0b0e] border-[#262630] text-[#a1a1aa] hover:text-white hover:border-[#383848]'
                  }`}
                >
                  <PlatformIcon platform={s.platformIcon || 'tg'} className="w-3.5 h-3.5 mb-1" />
                  <span className="text-[11px] font-bold leading-tight">Server {s.id}</span>
                  <span className={`text-[9px] mt-0.5 leading-none ${isActive ? 'text-white/90' : 'text-[#71717a]'}`}>
                    {s.badge}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Detailed Server Dropdown */}
          <div className="relative mt-1">
            <select
              value={selectedServerId}
              onChange={(e) => setSelectedServerId(Number(e.target.value))}
              className="w-full bg-[#0b0b0e] border border-[#262630] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#7c3aed] transition-colors appearance-none pr-8 font-medium"
            >
              {serverProducts.map((s) => (
                <option key={s.id} value={s.id} className="bg-[#181820] text-white">
                  {s.serverName} — Wholesale {formatPrice(s.basePriceInr)}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#a1a1aa] text-[10px]">
              ▼
            </div>
          </div>
        </div>

        {/* Profit margin slider & numeric input */}
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-white">Your Custom Profit Margin</span>
            <span className="text-[#22c55e] font-mono text-sm">+₹{marginInput}</span>
          </div>

          <input
            type="range"
            min={resellerConfig.minMargin}
            max={resellerConfig.maxMargin}
            step={1}
            value={marginInput}
            onChange={(e) => setMarginInput(Number(e.target.value))}
            className="w-full accent-[#7c3aed] cursor-pointer"
          />

          <div className="flex items-center justify-between text-[10px] text-[#a1a1aa] font-mono">
            <span>Min: ₹{resellerConfig.minMargin}</span>
            <span>Max: ₹{resellerConfig.maxMargin}</span>
          </div>
        </div>

        {/* Real-Time Price Preview Comparison */}
        <div className="p-3.5 rounded-xl bg-[#0b0b0e] border border-[#262630] flex flex-col gap-2 font-mono text-xs">
          <div className="flex items-center justify-between text-[#a1a1aa]">
            <span className="font-sans">Selected Server:</span>
            <div className="flex items-center gap-1.5 justify-end">
              <PlatformIcon platform={selectedServer.platformIcon || 'tg'} className="w-4 h-4 shrink-0" />
              <span className="text-white font-bold font-sans text-right max-w-[200px] truncate">
                {selectedServer.serverName}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between text-[#a1a1aa]">
            <span className="font-sans">Wholesale Base Cost:</span>
            <span>{formatPrice(selectedServer.basePriceInr)}</span>
          </div>
          <div className="flex items-center justify-between text-[#22c55e] font-bold">
            <span className="font-sans">Your Added Margin:</span>
            <span>+{formatPrice(marginInput)}</span>
          </div>
          <div className="h-px bg-[#262630] my-0.5" />
          <div className="flex items-center justify-between text-white font-extrabold text-sm">
            <span className="font-sans">Customer Store Price:</span>
            <span className="text-[#22c55e] font-mono text-base">{formatPrice(finalPriceInr)}</span>
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-2.5 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold text-xs shadow-violet-glow-sm transition-all active:scale-95"
        >
          Update & Save Reseller Margin
        </button>
      </form>

      {/* Standard Referral Program */}
      <div className="p-4 rounded-2xl bg-[#181820] border border-[#262630]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-white flex items-center gap-1.5">
            <Share2 className="w-4 h-4 text-blue-400" />
            <span>Standard Referral Link</span>
          </span>
          <span className="text-[10px] text-[#22c55e] font-semibold">10% Lifetime</span>
        </div>
        <div className="flex items-center justify-between bg-[#0b0b0e] border border-[#262630] rounded-xl px-3 py-2">
          <span className="text-xs font-mono text-[#a1a1aa] truncate mr-2">
            {standardRefLink}
          </span>
          <button
            onClick={handleCopyStandardRef}
            className="shrink-0 flex items-center gap-1 bg-[#1f1f2a] hover:bg-[#262630] text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[#262630] text-white transition-colors"
          >
            {copiedStandardRef ? <Check className="w-3.5 h-3.5 text-[#22c55e]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedStandardRef ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
