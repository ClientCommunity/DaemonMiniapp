import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { P2PTransferModal } from './P2PTransferModal';
import { ResellerEngine } from '../reseller/ResellerEngine';
import {
  BadgeCheck,
  Send,
  Lock,
  RotateCcw,
  Check,
  Copy,
  ArrowRight
} from 'lucide-react';

export const ProfileView: React.FC = () => {
  const { user, transferableBalance, formatPrice, resetDemoData, addToast, backendConnected } = useApp();

  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const handleCopyId = () => {
    navigator.clipboard?.writeText(user.telegramId);
    setCopiedId(true);
    addToast(`Telegram ID ${user.telegramId} copied!`, 'info', 'Copied');
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <div className="w-full flex flex-col pt-2 pb-12">
      {/* Profile Overview Card */}
      <div className="p-4 mb-4 rounded-2xl bg-gradient-to-b from-[#181820] to-[#121217] border border-[#262630] relative overflow-hidden shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="relative">
            <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#7c3aed] to-[#3b82f6] flex items-center justify-center font-bold text-lg text-white shadow-lg ring-2 ring-[#262630]">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.firstName} className="w-full h-full rounded-full object-cover" />
              ) : (
                user.firstName.substring(0, 2).toUpperCase()
              )}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-[#22c55e] rounded-full border-2 border-[#121217]" />
          </div>

          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base text-white truncate">
                {user.firstName}
              </span>
              <BadgeCheck className="w-4 h-4 text-[#22c55e] shrink-0" />
            </div>
            <span className="text-xs text-[#8b5cf6] font-mono">@{user.username}</span>
            <div className="flex items-center gap-2 text-[11px] text-[#a1a1aa] mt-1">
              <span>Member since {user.joinedDate}</span>
            </div>
          </div>

          {/* Copy ID button */}
          <button
            onClick={handleCopyId}
            className="p-2 rounded-xl bg-[#1f1f2a] border border-[#262630] text-[#a1a1aa] hover:text-white transition-colors"
            title="Copy Telegram ID"
          >
            {copiedId ? <Check className="w-4 h-4 text-[#22c55e]" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-[#262630]">
          <div className="flex flex-col items-center p-2 rounded-xl bg-[#0b0b0e]/70 border border-[#262630]">
            <span className="text-[10px] text-[#a1a1aa] uppercase font-semibold">Total Deposited</span>
            <span className="text-xs font-mono font-bold text-white mt-0.5">
              {formatPrice(user.totalDeposited)}
            </span>
          </div>
          <div className="flex flex-col items-center p-2 rounded-xl bg-[#0b0b0e]/70 border border-[#262630]">
            <span className="text-[10px] text-[#a1a1aa] uppercase font-semibold">Total Saved</span>
            <span className="text-xs font-mono font-bold text-[#22c55e] mt-0.5">
              {formatPrice(user.totalSaved)}
            </span>
          </div>
          <div className="flex flex-col items-center p-2 rounded-xl bg-[#0b0b0e]/70 border border-[#262630]">
            <span className="text-[10px] text-[#a1a1aa] uppercase font-semibold">Sales Profit</span>
            <span className="text-xs font-mono font-bold text-[#8b5cf6] mt-0.5">
              {formatPrice(user.salesBalance)}
            </span>
          </div>
        </div>
      </div>

      {/* P2P Balance Transfer Shortcut Card */}
      <div className="p-4 mb-4 rounded-2xl bg-[#181820] border border-[#262630]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
              <Send className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white">P2P Balance Transfer</h3>
              <p className="text-[10px] text-[#a1a1aa]">Send transferable funds to another user</p>
            </div>
          </div>

          <button
            onClick={() => setIsTransferModalOpen(true)}
            className="flex items-center gap-1 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-semibold px-3 py-1.5 rounded-xl shadow-sm transition-all active:scale-95"
          >
            <span>Transfer</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Transferable vs Promo breakdown mini bar */}
        <div className="p-2.5 rounded-xl bg-[#0b0b0e] border border-[#262630] flex items-center justify-between text-xs font-mono mt-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-[#a1a1aa]">Transferable:</span>
            <span className="font-bold text-[#22c55e]">{formatPrice(transferableBalance)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-[#f59e0b]" />
            <span className="text-[11px] text-[#f59e0b]">Locked: {formatPrice(user.promoBalance)}</span>
          </div>
        </div>
      </div>

      {/* Embedded Reseller Custom Margin Engine */}
      <ResellerEngine />

      {/* Dev Reset Utility or Production Server Status */}
      {!backendConnected ? (
        <div className="mt-2 p-4 rounded-2xl bg-[#181820]/60 border border-[#262630] flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-white">Demo Data Controls</span>
            <span className="text-[10px] text-[#a1a1aa]">Reset wallet balances and mock state</span>
          </div>
          <button
            onClick={resetDemoData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1f1f2a] hover:bg-[#262630] border border-[#262630] text-xs font-semibold text-[#a1a1aa] hover:text-white transition-all active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#8b5cf6]" />
            <span>Reset Demo</span>
          </button>
        </div>
      ) : (
        <div className="mt-2 p-3.5 rounded-2xl bg-[#181820]/60 border border-[#22c55e]/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#22c55e] animate-pulse" />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-white">Production Server Synchronized</span>
              <span className="text-[10px] text-[#a1a1aa]">Live backend connection active • Real-time telemetry</span>
            </div>
          </div>
          <span className="text-[10px] font-mono text-[#22c55e] bg-[#22c55e]/10 border border-[#22c55e]/20 px-2 py-0.5 rounded-lg">
            LIVE
          </span>
        </div>
      )}

      {/* Modal */}
      <P2PTransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
      />
    </div>
  );
};
