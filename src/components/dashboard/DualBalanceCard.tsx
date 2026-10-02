import React from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle2, Lock, TrendingUp, PlusCircle, Send } from 'lucide-react';

interface DualBalanceCardProps {
  onOpenTransferModal: () => void;
}

export const DualBalanceCard: React.FC<DualBalanceCardProps> = ({ onOpenTransferModal }) => {
  const { user, transferableBalance, formatPrice, setActiveTab } = useApp();

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#181820] to-[#121217] border border-[#262630] p-4 shadow-xl">
      {/* Ambient Violet Flare */}
      <div className="absolute top-0 right-0 w-44 h-44 bg-[radial-gradient(ellipse_at_top_right,rgba(124,58,237,0.18),transparent_70%)] pointer-events-none" />

      {/* Main Total Balance */}
      <div className="flex flex-col mb-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider">
            Total Account Balance
          </span>
          <span className="text-[10px] font-semibold text-[#8b5cf6] bg-[#7c3aed]/15 px-2 py-0.5 rounded-full border border-[#7c3aed]/30">
            Active Wallet
          </span>
        </div>
        <div className="text-3xl font-extrabold text-[#22c55e] tracking-tight mt-1">
          {formatPrice(user.balance)}
        </div>
      </div>

      {/* Segmented Breakdown Cards (3-column Grid) */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {/* 1. Transferable Main Balance */}
        <div className="bg-[#0b0b0e]/70 border border-[#22c55e]/30 rounded-xl p-2.5 flex flex-col justify-between">
          <div className="flex items-center gap-1 text-[11px] text-[#a1a1aa] mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#22c55e] shrink-0" />
            <span className="truncate">Transferable</span>
          </div>
          <div className="text-sm font-bold text-white tracking-tight">
            {formatPrice(transferableBalance)}
          </div>
          <span className="text-[9px] text-[#22c55e] font-medium mt-1 truncate">
            P2P Eligible
          </span>
        </div>

        {/* 2. Locked Promo Balance */}
        <div className="bg-[#0b0b0e]/70 border border-[#f59e0b]/35 rounded-xl p-2.5 flex flex-col justify-between relative">
          <div className="flex items-center gap-1 text-[11px] text-[#f59e0b] mb-1">
            <Lock className="w-3.5 h-3.5 text-[#f59e0b] shrink-0" />
            <span className="truncate">Promo Fund</span>
          </div>
          <div className="text-sm font-bold text-[#f59e0b] tracking-tight">
            {formatPrice(user.promoBalance)}
          </div>
          <span className="text-[8px] bg-amber-500/15 text-amber-400 font-bold px-1 py-0.5 rounded border border-amber-500/30 mt-1 uppercase text-center truncate">
            Non-Transfer
          </span>
        </div>

        {/* 3. Sales / Reseller Profit */}
        <div className="bg-[#0b0b0e]/70 border border-[#8b5cf6]/30 rounded-xl p-2.5 flex flex-col justify-between">
          <div className="flex items-center gap-1 text-[11px] text-[#a1a1aa] mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-[#8b5cf6] shrink-0" />
            <span className="truncate">Sales Profit</span>
          </div>
          <div className="text-sm font-bold text-[#8b5cf6] tracking-tight">
            {formatPrice(user.salesBalance)}
          </div>
          <span className="text-[9px] text-[#a1a1aa] font-medium mt-1 truncate">
            Affiliate Share
          </span>
        </div>
      </div>

      {/* Hero Direct Action Buttons */}
      <div className="grid grid-cols-2 gap-2.5 pt-1">
        <button
          onClick={() => setActiveTab('deposit')}
          className="flex items-center justify-center gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold text-xs py-2.5 px-4 rounded-xl shadow-[0_0_15px_rgba(124,58,237,0.4)] transition-all active:scale-95"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Top-Up Deposit</span>
        </button>

        <button
          onClick={onOpenTransferModal}
          className="flex items-center justify-center gap-2 bg-[#1f1f2a] hover:bg-[#262630] border border-[#262630] text-white hover:text-[#8b5cf6] font-semibold text-xs py-2.5 px-4 rounded-xl transition-all active:scale-95"
        >
          <Send className="w-4 h-4 text-[#8b5cf6]" />
          <span>Transfer P2P</span>
        </button>
      </div>
    </div>
  );
};
