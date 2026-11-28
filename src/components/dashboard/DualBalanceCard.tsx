import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  CheckCircle2,
  Lock,
  TrendingUp,
  PlusCircle,
  Send,
  Eye,
  EyeOff,
  Info,
  X,
  Wifi,
} from 'lucide-react';
import { hapticFeedback } from '../../utils/haptics';

interface DualBalanceCardProps {
  onOpenTransferModal: () => void;
}

export const DualBalanceCard: React.FC<DualBalanceCardProps> = ({ onOpenTransferModal }) => {
  const { user, transferableBalance, formatPrice, setActiveTab } = useApp();

  const [isPrivate, setIsPrivate] = useState<boolean>(() => {
    try {
      return localStorage.getItem('krish_balance_privacy') === 'true';
    } catch {
      return false;
    }
  });

  const [showPromoInfo, setShowPromoInfo] = useState<boolean>(false);

  const togglePrivacy = () => {
    hapticFeedback.light();
    setIsPrivate((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('krish_balance_privacy', String(next));
      } catch {}
      return next;
    });
  };

  const togglePromoInfo = () => {
    hapticFeedback.light();
    setShowPromoInfo((prev) => !prev);
  };

  const cardTail = (user.telegramId || '0000').toString().slice(-4).padStart(4, '0');

  return (
    <div className="atm-wallet-card relative overflow-hidden rounded-2xl p-4 sm:p-5 select-none">
      {/* Subtle diagonal sheen */}
      <div className="absolute -top-24 -right-24 w-56 h-56 rounded-full bg-white/[0.03] pointer-events-none" />

      {/* ATM Card Top Bar: EMV Chip + Contactless + Brand & Active Status */}
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2.5">
          {/* Metallic EMV Chip */}
          <div className="w-9 h-6 rounded-md bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 p-[1px] shadow-sm shrink-0">
            <div className="w-full h-full rounded-[5px] bg-gradient-to-br from-amber-300/90 via-yellow-500/80 to-amber-700/90 relative overflow-hidden flex items-center justify-center">
              <div className="w-full h-[1px] bg-amber-950/35" />
              <div className="absolute inset-y-0 left-1/3 w-[1px] bg-amber-950/35" />
              <div className="absolute inset-y-0 right-1/3 w-[1px] bg-amber-950/35" />
            </div>
          </div>
          <Wifi className="w-4 h-4 text-[#a1a1aa] rotate-90 opacity-75" />
          <div className="flex flex-col leading-none">
            <span className="text-[10px] font-extrabold tracking-[0.16em] text-[#a1a1aa] uppercase">
              Deamon Pay
            </span>
            <span className="text-[9px] font-mono text-[#71717a] mt-0.5">
              •••• {cardTail}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={togglePrivacy}
            className="p-1.5 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-white/10 active:scale-90 transition-all flex items-center justify-center cursor-pointer"
            title={isPrivate ? 'Show balance' : 'Hide balance for privacy / screenshots'}
            aria-label={isPrivate ? 'Show balance' : 'Hide balance'}
          >
            {isPrivate ? (
              <EyeOff className="w-3.5 h-3.5 text-[#8b5cf6]" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
          </button>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#22c55e] bg-[#22c55e]/15 px-2.5 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
            ACTIVE
          </span>
        </div>
      </div>

      {/* Hero Balance Display */}
      <div className="mb-4">
        <span className="text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-[0.14em] block">
          Available Balance
        </span>
        <div className="flex items-baseline justify-between gap-2 mt-0.5">
          <div className="text-3xl sm:text-[34px] font-black text-white tracking-tight tabular-nums leading-none">
            {isPrivate ? (
              <span className="font-mono text-2xl tracking-[0.25em] text-[#22c55e]/90">
                ••••••
              </span>
            ) : (
              formatPrice(user.balance)
            )}
          </div>
          <span className="text-[10px] font-mono text-[#71717a] uppercase tracking-wider truncate max-w-[120px]">
            {user.firstName}
          </span>
        </div>
      </div>

      {/* Promo Balance Education Alert (Toggleable via info icon) */}
      {showPromoInfo && (
        <div className="relative mb-3 p-2.5 rounded-xl bg-[#1e1b2e] border border-[#f59e0b]/40 animate-in fade-in duration-200">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-[#f59e0b] shrink-0 mt-0.5" />
              <p className="text-[11px] text-zinc-300 leading-relaxed">
                <span className="font-bold text-amber-300">Promo Fund:</span> Automatically discounts up to 50% on orders and cannot be transferred via P2P.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                hapticFeedback.light();
                setShowPromoInfo(false);
              }}
              className="text-zinc-400 hover:text-white p-0.5 rounded-lg cursor-pointer"
              aria-label="Close promo info"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Segmented Card Strip (Clean Matte Cells — No Competing Borders + Glows) */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {/* 1. Transferable Main Balance */}
        <div className="bg-black/30 rounded-xl p-2.5 flex flex-col justify-between">
          <div className="flex items-center gap-1 text-[10px] text-[#a1a1aa] mb-1">
            <CheckCircle2 className="w-3 h-3 text-[#22c55e] shrink-0" />
            <span className="truncate">Transferable</span>
          </div>
          <div className="text-xs sm:text-sm font-bold text-white tracking-tight tabular-nums">
            {isPrivate ? (
              <span className="font-mono text-xs tracking-wider text-[#a1a1aa]">••••</span>
            ) : (
              formatPrice(transferableBalance)
            )}
          </div>
          <span className="text-[9px] text-[#22c55e] font-medium mt-0.5 truncate">
            P2P Ready
          </span>
        </div>

        {/* 2. Locked Promo Balance */}
        <div className="bg-black/30 rounded-xl p-2.5 flex flex-col justify-between relative">
          <div className="flex items-center justify-between text-[10px] text-[#f59e0b] mb-1">
            <div className="flex items-center gap-1 min-w-0">
              <Lock className="w-3 h-3 text-[#f59e0b] shrink-0" />
              <span className="truncate">Promo</span>
            </div>
            <button
              type="button"
              onClick={togglePromoInfo}
              className="p-0.5 -mr-0.5 rounded text-amber-400/80 hover:text-amber-300 cursor-pointer"
              title="Promo balance policy"
              aria-label="Promo balance info"
            >
              <Info className="w-3 h-3" />
            </button>
          </div>
          <div className="text-xs sm:text-sm font-bold text-[#f59e0b] tracking-tight tabular-nums">
            {isPrivate ? (
              <span className="font-mono text-xs tracking-wider text-amber-500/70">••••</span>
            ) : (
              formatPrice(user.promoBalance)
            )}
          </div>
          <span className="text-[9px] text-amber-400/80 font-medium mt-0.5 truncate">
            Order Bonus
          </span>
        </div>

        {/* 3. Sales / Reseller Profit */}
        <div className="bg-black/30 rounded-xl p-2.5 flex flex-col justify-between">
          <div className="flex items-center gap-1 text-[10px] text-[#a1a1aa] mb-1">
            <TrendingUp className="w-3 h-3 text-[#a78bfa] shrink-0" />
            <span className="truncate">Profit</span>
          </div>
          <div className="text-xs sm:text-sm font-bold text-[#a78bfa] tracking-tight tabular-nums">
            {isPrivate ? (
              <span className="font-mono text-xs tracking-wider text-purple-400/70">••••</span>
            ) : (
              formatPrice(user.salesBalance)
            )}
          </div>
          <span className="text-[9px] text-[#a1a1aa] font-medium mt-0.5 truncate">
            Affiliate
          </span>
        </div>
      </div>

      {/* 2.5D Tactile Card Action Buttons */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => {
            hapticFeedback.light();
            setActiveTab('deposit');
          }}
          className="btn-25d-primary flex items-center justify-center gap-2 font-bold text-xs py-2.5 px-4 rounded-xl cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Top-Up Deposit</span>
        </button>

        <button
          type="button"
          onClick={() => {
            hapticFeedback.light();
            onOpenTransferModal();
          }}
          className="btn-25d-secondary flex items-center justify-center gap-2 font-bold text-xs py-2.5 px-4 rounded-xl cursor-pointer"
        >
          <Send className="w-4 h-4 text-[#a78bfa]" />
          <span>Transfer P2P</span>
        </button>
      </div>
    </div>
  );
};
