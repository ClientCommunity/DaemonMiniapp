import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  ShoppingBag,
  ShoppingCart,
  CreditCard,
  Zap,
  Smartphone,
  Rocket,
  Wallet,
  Send,
  ChevronRight,
  ArrowDownLeft,
} from 'lucide-react';
import { HistoryItem } from '../../types';
import { PlatformIcon } from '../common/PlatformIcon';

export const RecentActivity: React.FC = () => {
  const { history, formatPrice, setActiveTab, openReceiptDrawer } = useApp();

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

  const recentItems = history.slice(0, 4);

  return (
    <div className="mt-2 mb-6">
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-sm font-bold text-white tracking-tight">Recent Activity</h3>
        <button
          onClick={() => setActiveTab('history')}
          className="flex items-center gap-1 text-xs font-semibold text-[#8b5cf6] hover:text-[#a78bfa] transition-colors"
        >
          <span>View All</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {recentItems.length === 0 ? (
          <div className="p-4 text-center rounded-xl bg-[#181820] border border-[#262630] text-xs text-[#a1a1aa]">
            No recent activity yet.
          </div>
        ) : (
          recentItems.map((item) => {
            const isDeposit = item.amountInr > 0;
            const isFailed = item.status === 'failed';
            const isSuccess = item.status === 'success';
            const isWaiting = item.status === 'waiting' || item.status === 'in_progress';
            const isRefunded = item.status === 'refunded' || item.status === 'cancelled';

            return (
              <div
                key={item.id}
                onClick={() => openReceiptDrawer(item)}
                className="flex items-center justify-between p-3 rounded-xl bg-[#181820] border border-[#262630] hover:border-[#383848] active:scale-[0.99] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[#121217] border border-[#262630] flex items-center justify-center shrink-0">
                    {getItemIcon(item)}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {getTitleIcon(item)}
                      <span className="text-xs font-semibold text-white truncate">
                        {getCleanTitle(item.title)}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#a1a1aa] truncate">
                      {item.subtitle}
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
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold mt-0.5 border ${
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
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
