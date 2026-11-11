import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { OrderCategory, HistoryItem } from '../../types';
import {
  Search,
  ShoppingBag,
  ShoppingCart,
  CreditCard,
  Zap,
  Smartphone,
  Rocket,
  Wallet,
  Send,
  ChevronRight,
  Radio,
  Clock,
  ArrowDownLeft,
} from 'lucide-react';
import { PlatformIcon } from '../common/PlatformIcon';
import { ReceiptDrawer } from './ReceiptDrawer';
import { ActiveNumbersSection } from '../common/ActiveNumbersSection';
import { hapticFeedback } from '../../utils/haptics';

export const HistoryView: React.FC = () => {
  const { history, activeNumbers, formatPrice, openReceiptDrawer } = useApp();

  const [historySection, setHistorySection] = useState<'active' | 'past'>(() =>
    activeNumbers.length > 0 ? 'active' : 'past'
  );
  const [activeCategory, setActiveCategory] = useState<OrderCategory | 'all'>('all');
  const [search, setSearch] = useState('');

  const filterTabs: { id: OrderCategory | 'all'; label: string }[] = [
    { id: 'all', label: 'All Orders' },
    { id: 'otp_activation', label: 'Virtual OTP' },
    { id: 'account_purchase', label: 'Accounts' },
    { id: 'smm_order', label: 'SMM Boost' },
    { id: 'deposit', label: 'Deposits' },
  ];

  const getCleanTitle = (title: string): string => {
    return title
      .replace(/^[\s\uFE0F]*[\u{1F300}-\u{1FAD6}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{FE00}-\u{FE0F}]+\s*/u, '')
      .trim();
  };

  const getTitleIcon = (item: HistoryItem) => {
    const raw = item.title;
    if (raw.includes('💳') || item.category === 'deposit') {
      return <CreditCard className="w-3.5 h-3.5 text-[#22c55e] shrink-0" />;
    }
    if (raw.includes('📤') || (item.category === 'transfer' && item.amountInr < 0)) {
      return <Send className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
    }
    if (raw.includes('📥') || (item.category === 'transfer' && item.amountInr > 0)) {
      return <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    }
    if (raw.includes('🚀') || item.category === 'smm_order') {
      return <Rocket className="w-3.5 h-3.5 text-[#f59e0b] shrink-0" />;
    }
    if (item.category === 'otp_activation' || raw.includes('Server 3') || raw.includes('Server 4')) {
      return <Zap className="w-3.5 h-3.5 text-[#8b5cf6] shrink-0" />;
    }
    return <ShoppingCart className="w-3.5 h-3.5 text-[#a78bfa] shrink-0" />;
  };

  const filteredHistory = history.filter((item) => {
    if (activeCategory !== 'all' && item.category !== activeCategory) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchId = item.id.toLowerCase().includes(q);
      if (!matchTitle && !matchId) return false;
    }
    return true;
  });

  const getItemIcon = (item: HistoryItem) => {
    const t = (item.title + ' ' + (item.subtitle || '')).toLowerCase();
    if (
      t.includes('telegram') ||
      t.includes('teleg') ||
      t.includes('tg') ||
      t.includes('server 1') ||
      t.includes('server 2')
    ) {
      return <PlatformIcon platform="tg" className="w-5 h-5" />;
    }
    if (t.includes('whatsapp') || t.includes('wa')) return <PlatformIcon platform="wa" className="w-5 h-5" />;
    if (t.includes('instagram') || t.includes('instag') || t.includes('ig')) return <PlatformIcon platform="ig" className="w-5 h-5" />;
    if (t.includes('youtube') || t.includes('yt')) return <PlatformIcon platform="yt" className="w-5 h-5" />;
    if (t.includes('tiktok') || t.includes('tk')) return <PlatformIcon platform="tk" className="w-5 h-5" />;
    if (t.includes('twitter') || t.includes(' x ')) return <PlatformIcon platform="tw" className="w-5 h-5" />;
    if (t.includes('google') || t.includes('gmail')) return <PlatformIcon platform="go" className="w-5 h-5" />;

    switch (item.category) {
      case 'otp_activation':
        return <Smartphone className="w-4 h-4 text-[#8b5cf6]" />;
      case 'account_purchase':
        return <ShoppingBag className="w-4 h-4 text-blue-400" />;
      case 'smm_order':
        return <Rocket className="w-4 h-4 text-[#f59e0b]" />;
      case 'deposit':
        return <Wallet className="w-4 h-4 text-[#22c55e]" />;
      case 'transfer':
        return <Send className="w-4 h-4 text-purple-400" />;
    }
  };

  return (
    <div className="w-full flex flex-col pt-2 pb-10">
      {/* Header */}
      <div className="p-3 mb-3 rounded-2xl bg-[#181820] border border-[#262630] flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-white">Order & Ledger History</span>
          <span className="text-[11px] text-[#a1a1aa]">
            All virtual numbers, account credentials, and top-ups
          </span>
        </div>
        <span className="text-xs font-mono font-bold text-[#8b5cf6] bg-[#7c3aed]/15 px-2.5 py-1 rounded-full border border-[#7c3aed]/30">
          {history.length} Records
        </span>
      </div>

      {/* Dedicated Section Switcher: Active Numbers vs Past Orders */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-[#121217] border border-[#262630] rounded-2xl mb-3">
        <button
          onClick={() => {
            hapticFeedback.selection();
            setHistorySection('active');
          }}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            historySection === 'active'
              ? 'bg-[#7c3aed] text-white shadow-violet-glow-sm'
              : 'text-[#a1a1aa] hover:text-white'
          }`}
        >
          <Radio className={`w-3.5 h-3.5 ${activeNumbers.length > 0 ? 'text-[#22c55e] animate-pulse' : ''}`} />
          <span>Active Numbers</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
              historySection === 'active'
                ? 'bg-white/20 text-white'
                : activeNumbers.length > 0
                ? 'bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/30'
                : 'bg-[#1f1f2a] text-[#71717a]'
            }`}
          >
            {activeNumbers.length}
          </span>
        </button>

        <button
          onClick={() => {
            hapticFeedback.selection();
            setHistorySection('past');
          }}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            historySection === 'past'
              ? 'bg-[#7c3aed] text-white shadow-violet-glow-sm'
              : 'text-[#a1a1aa] hover:text-white'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Past Orders</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
              historySection === 'past' ? 'bg-white/20 text-white' : 'bg-[#1f1f2a] text-[#71717a]'
            }`}
          >
            {history.length}
          </span>
        </button>
      </div>

      {/* SECTION 1: Dedicated Active Numbers Section */}
      {historySection === 'active' && (
        <div className="w-full">
          <ActiveNumbersSection expandAll={true} showEmptyState={true} />
        </div>
      )}

      {/* SECTION 2: Past Orders Section */}
      {historySection === 'past' && (
        <>
          {/* Active numbers notification banner if any pending */}
          {activeNumbers.length > 0 && (
            <div
              onClick={() => {
                hapticFeedback.selection();
                setHistorySection('active');
              }}
              className="p-3 mb-3 rounded-2xl bg-gradient-to-r from-[#7c3aed]/15 to-[#22c55e]/15 border border-[#7c3aed]/30 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-all"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse shrink-0" />
                <span className="text-xs font-bold text-white">
                  {activeNumbers.length} Active Number{activeNumbers.length > 1 ? 's' : ''} Awaiting OTP
                </span>
              </div>
              <span className="text-[11px] font-bold text-[#8b5cf6] flex items-center gap-1">
                View Active <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          )}

          {/* Filterable Segmented Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2 mb-3 -mx-4 px-4">
            {filterTabs.map((tab) => {
              const isActive = activeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveCategory(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 border transition-all ${
                    isActive
                      ? 'bg-[#7c3aed] border-[#8b5cf6] text-white shadow-violet-glow-sm'
                      : 'bg-[#181820] border-[#262630] text-[#a1a1aa] hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Search Bar */}
          <div className="relative mb-3">
            <Search className="w-4 h-4 text-[#a1a1aa] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by order ID or product..."
              className="w-full bg-[#181820] border border-[#262630] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-[#a1a1aa] focus:outline-none focus:border-[#7c3aed] transition-colors"
            />
          </div>

          {/* History Items List */}
          <div className="flex flex-col gap-2">
            {history.length === 0 ? (
              <div className="p-10 text-center bg-[#181820] border border-[#262630] rounded-2xl flex flex-col items-center justify-center gap-3">
                <ShoppingBag className="w-8 h-8 text-[#71717a]" />
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-white">No Orders Placed Yet</span>
                  <span className="text-xs text-[#a1a1aa]">
                    Your transactions, accounts, and virtual OTP orders will appear here once placed.
                  </span>
                </div>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="p-8 text-center bg-[#181820] border border-[#262630] rounded-2xl text-xs text-[#a1a1aa]">
                No transactions found for the selected filter.
              </div>
            ) : (
              filteredHistory.map((item) => {
                const isDeposit = item.amountInr > 0;
                const isFailed = item.status === 'failed';
                const isSuccess = item.status === 'success';
                const isWaiting = item.status === 'waiting' || item.status === 'in_progress';
                const isRefunded = item.status === 'refunded' || item.status === 'cancelled';

                return (
                  <div
                    key={item.id}
                    onClick={() => openReceiptDrawer(item)}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-[#181820] border border-[#262630] hover:border-[#383848] active:scale-[0.99] transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[#121217] border border-[#262630] flex items-center justify-center shrink-0">
                        {getItemIcon(item)}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {getTitleIcon(item)}
                          <span className="text-xs font-bold text-white truncate">
                            {getCleanTitle(item.title)}
                          </span>
                        </div>
                        <span className="text-[10px] text-[#a1a1aa] truncate mt-0.5">
                          {item.subtitle} • {item.date}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end shrink-0 ml-3">
                      <span
                        className={`text-xs font-bold font-mono ${
                          isDeposit ? 'text-[#22c55e]' : isFailed ? 'text-[#a1a1aa]' : 'text-white'
                        }`}
                      >
                        {isDeposit ? `+${formatPrice(item.amountInr)}` : formatPrice(item.amountInr)}
                      </span>
                      <div className="flex items-center gap-1 mt-1">
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase border ${
                            isFailed
                              ? 'bg-red-500/15 text-red-400 border-red-500/30'
                              : isSuccess
                              ? 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30'
                              : isWaiting
                              ? 'bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/30 animate-pulse'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          {isFailed ? 'Failed' : isRefunded ? 'Refunded' : isWaiting ? 'Active' : isDeposit ? 'Credited' : 'Delivered'}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-[#a1a1aa]" />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Slide-over Receipt Drawer Modal */}
      <ReceiptDrawer />
    </div>
  );
};
