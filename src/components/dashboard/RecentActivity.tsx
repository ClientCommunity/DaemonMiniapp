import React from 'react';
import { useApp } from '../../context/AppContext';
import { ShoppingBag, Smartphone, Rocket, Wallet, Send, ChevronRight } from 'lucide-react';
import { HistoryItem } from '../../types';

export const RecentActivity: React.FC = () => {
  const { history, formatPrice, setActiveTab, openReceiptDrawer } = useApp();

  const getCategoryIcon = (category: HistoryItem['category']) => {
    switch (category) {
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
                    {getCategoryIcon(item.category)}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-white truncate">
                      {item.title}
                    </span>
                    <span className="text-[10px] text-[#a1a1aa] truncate">
                      {item.subtitle}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end shrink-0 ml-3">
                  <span
                    className={`text-xs font-bold font-mono ${
                      isDeposit ? 'text-[#22c55e]' : 'text-white'
                    }`}
                  >
                    {isDeposit ? `+${formatPrice(item.amountInr)}` : formatPrice(item.amountInr)}
                  </span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold mt-0.5 border ${
                      isSuccess
                        ? 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30'
                        : isWaiting
                        ? 'bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/30 animate-pulse'
                        : 'bg-[#262630] text-[#a1a1aa] border-zinc-700'
                    }`}
                  >
                    {isRefunded ? 'Refunded' : isWaiting ? 'Active' : 'Delivered'}
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
