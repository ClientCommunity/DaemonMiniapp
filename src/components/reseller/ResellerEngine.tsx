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
  Sparkles,
  Layers,
  CheckSquare,
  Square,
  Server
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
  const { user, resellerConfig, updateResellerMargin, formatPrice, addToast } = useApp();

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
  const [selectedServerIds, setSelectedServerIds] = useState<number[]>(() => {
    if (resellerConfig.selectedServers && resellerConfig.selectedServers.length > 0) {
      return resellerConfig.selectedServers;
    }
    return [1, 2, 3, 4, 5];
  });
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedStandardRef, setCopiedStandardRef] = useState(false);

  // Toggle selection for individual server
  const toggleServer = (id: number) => {
    setSelectedServerIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) {
          addToast('At least 1 server must remain selected.', 'warning', 'Selection Required');
          return prev;
        }
        return prev.filter((s) => s !== id).sort((a, b) => a - b);
      } else {
        return [...prev, id].sort((a, b) => a - b);
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedServerIds.length === 5) {
      setSelectedServerIds([1]);
    } else {
      setSelectedServerIds([1, 2, 3, 4, 5]);
    }
  };

  // 1 URL for Multiple Servers
  const currentToken = resellerConfig.token || (user.telegramId ? `u${user.telegramId}` : 'resell');
  const baseToken = currentToken.startsWith('resell_') ? currentToken.replace('resell_', '') : currentToken;
  const serverSuffix = selectedServerIds.length < 5
    ? `_s${[...selectedServerIds].sort((a, b) => a - b).join('_s')}`
    : '';
  const calculatedResellerLink = `https://t.me/DeamonOTPbot?start=resell_${baseToken}${serverSuffix}`;
  const effectiveResellerLink = resellerConfig.resellerLink || calculatedResellerLink;

  const standardRefLink = user.telegramId
    ? `https://t.me/DeamonOTPbot?start=ref_${user.telegramId}`
    : `https://t.me/DeamonOTPbot?start=ref`;

  const handleCopyResellerLink = () => {
    navigator.clipboard?.writeText(effectiveResellerLink);
    setCopiedLink(true);
    addToast('Unique Multi-Server Reseller link copied to clipboard!', 'success', 'Copied');
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
    updateResellerMargin(marginInput, selectedServerIds);
  };

  const selectedProducts = serverProducts.filter((s) => selectedServerIds.includes(s.id));

  return (
    <div className="w-full flex flex-col pt-1 pb-4">
      {/* Reseller Banner */}
      <div className="p-4 mb-4 rounded-2xl bg-gradient-to-r from-[#181820] to-[#121217] border border-[#262630] relative overflow-hidden shadow-lg">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#7c3aed]/15 rounded-full filter blur-2xl pointer-events-none" />
        <span className="text-[10px] font-bold text-[#8b5cf6] uppercase tracking-wider block mb-1">
          Custom Margin Engine
        </span>
        <h2 className="text-base font-extrabold text-white tracking-tight flex items-center gap-1.5">
          <span>Reseller Bot Link Creator</span>
          <span className="text-[10px] font-mono font-bold text-[#8b5cf6] bg-[#7c3aed]/20 px-2 py-0.5 rounded-full border border-[#8b5cf6]/30">
            Multi-Server 1 URL
          </span>
        </h2>
        <p className="text-xs text-[#a1a1aa] mt-0.5">
          Select multiple servers, bundle them into 1 unique purchase link, and set your custom profit margin (₹5 - ₹100).
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

      {/* Reseller Link Bar with 1-Click Copy and Bundled Server Badges */}
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
            {effectiveResellerLink}
          </span>
          <button
            onClick={handleCopyResellerLink}
            className="shrink-0 flex items-center gap-1.5 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-violet-glow-sm active:scale-95 transition-all"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
          </button>
        </div>

        {/* Multiple Servers 1 URL indicator */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2 border-t border-[#262630]/60">
          <span className="text-[10px] text-[#a1a1aa] font-semibold flex items-center gap-1 mr-1">
            <Layers className="w-3 h-3 text-[#8b5cf6]" />
            <span>1 URL Bundled Servers ({selectedServerIds.length}/5):</span>
          </span>
          {serverProducts.map((s) => {
            const isIncluded = selectedServerIds.includes(s.id);
            if (!isIncluded) return null;
            return (
              <span
                key={s.id}
                className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-[#7c3aed]/15 text-[#a78bfa] border border-[#7c3aed]/30 flex items-center gap-1"
              >
                <PlatformIcon platform={s.platformIcon || 'tg'} className="w-2.5 h-2.5" />
                Server {s.id}
              </span>
            );
          })}
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

        {/* Multi-Server Selection (Select multiple servers, not just one) */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] text-[#a1a1aa] font-semibold flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-[#8b5cf6]" />
              <span>Select Servers for this Reseller URL</span>
            </label>
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-[10px] font-bold text-[#8b5cf6] hover:text-[#a78bfa] transition-colors underline"
            >
              {selectedServerIds.length === 5 ? 'Select Single' : 'Select All 5'}
            </button>
          </div>

          <p className="text-[10px] text-[#71717a] -mt-1">
            Tap servers to include or exclude them from your unique 1 URL link.
          </p>

          {/* Multi-Server Checkbox Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
            {serverProducts.map((s) => {
              const isSelected = selectedServerIds.includes(s.id);
              const retailPrice = s.basePriceInr + marginInput;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleServer(s.id)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all active:scale-[0.98] ${
                    isSelected
                      ? 'bg-[#7c3aed]/15 border-[#8b5cf6] text-white shadow-violet-glow-sm ring-1 ring-[#8b5cf6]/40'
                      : 'bg-[#0b0b0e] border-[#262630] text-[#71717a] hover:border-[#383848] opacity-70'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="shrink-0 text-[#8b5cf6]">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-[#8b5cf6]" />
                      ) : (
                        <Square className="w-4 h-4 text-[#52525b]" />
                      )}
                    </div>
                    <PlatformIcon platform={s.platformIcon || 'tg'} className="w-4 h-4 shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-[#a1a1aa]'}`}>
                        Server {s.id}: {s.badge}
                      </span>
                      <span className="text-[10px] text-[#71717a] truncate font-mono">
                        Base: {formatPrice(s.basePriceInr)}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-2">
                    <span className={`text-xs font-mono font-extrabold block ${isSelected ? 'text-[#22c55e]' : 'text-[#71717a]'}`}>
                      {formatPrice(retailPrice)}
                    </span>
                    <span className="text-[9px] text-[#71717a]">
                      +{formatPrice(marginInput)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Profit margin slider & numeric input */}
        <div className="flex flex-col gap-2 pt-1 border-t border-[#262630]/60">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-white">Your Custom Profit Margin (Applied across all selected servers)</span>
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

        {/* Real-Time Multi-Server Price Preview Table */}
        <div className="p-3.5 rounded-xl bg-[#0b0b0e] border border-[#262630] flex flex-col gap-2 font-mono text-xs">
          <div className="flex items-center justify-between pb-1.5 border-b border-[#262630] font-sans">
            <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#8b5cf6]" />
              <span>Live Price Simulation ({selectedProducts.length} Servers Bundled)</span>
            </span>
            <span className="text-[10px] text-[#8b5cf6] font-bold">
              1 Reseller URL
            </span>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            {selectedProducts.map((p) => {
              const sellPrice = p.basePriceInr + marginInput;
              const marginPct = Math.round((marginInput / p.basePriceInr) * 100);
              return (
                <div key={p.id} className="flex items-center justify-between py-1 border-b border-[#181820] last:border-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <PlatformIcon platform={p.platformIcon || 'tg'} className="w-3.5 h-3.5 shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-white font-bold font-sans text-xs truncate max-w-[170px]">
                        Server {p.id}: {p.badge}
                      </span>
                      <span className="text-[10px] text-[#71717a] font-mono">
                        Wholesale: {formatPrice(p.basePriceInr)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-right">
                    <div className="flex flex-col">
                      <span className="text-[#22c55e] font-mono font-bold text-xs">
                        +{formatPrice(marginInput)}
                      </span>
                      <span className="text-[9px] text-[#8b5cf6] font-sans">
                        +{marginPct}% ROI
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-white font-mono font-extrabold text-sm">
                        {formatPrice(sellPrice)}
                      </span>
                      <span className="text-[9px] text-[#71717a] font-sans">
                        Buyer Price
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="h-px bg-[#262630] my-0.5" />
          <div className="flex items-center justify-between text-[#a1a1aa] font-sans text-[11px]">
            <span>Reseller Profit per item sold:</span>
            <span className="text-[#22c55e] font-mono font-bold text-xs">
              +₹{marginInput} on any selected server
            </span>
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-2.5 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold text-xs shadow-violet-glow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Update & Save Reseller Margin ({selectedServerIds.length} Servers Bundled)</span>
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
