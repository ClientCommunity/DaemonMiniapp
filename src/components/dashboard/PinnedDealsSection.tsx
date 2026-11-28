import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { storeApi, PinnedServiceItem } from '../../api/endpoints';
import { ArrowRight, Flame, Zap } from 'lucide-react';

interface PinnedDealsSectionProps {
  serverFilter?: 1 | 2 | 3 | 4 | 5;
  title?: string;
}

export const PinnedDealsSection: React.FC<PinnedDealsSectionProps> = ({
  serverFilter,
  title,
}) => {
  const { setActiveTab, setSelectedServer } = useApp();
  const [pinnedItems, setPinnedItems] = useState<PinnedServiceItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    storeApi
      .getPinned(serverFilter)
      .then((res) => {
        if (isMounted && res?.success && Array.isArray(res.pinned)) {
          setPinnedItems(res.pinned);
        }
      })
      .catch(() => {
        // Silently fail if none
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [serverFilter]);

  if (loading || pinnedItems.length === 0) {
    return null;
  }

  const handleSelectDeal = (item: PinnedServiceItem) => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
    const query = item.country_name || item.service_name || item.service_id;
    try {
      if (item.server_no === 1) {
        localStorage.setItem('krish_s1_search', query);
      } else if (item.server_no === 2) {
        localStorage.setItem('krish_s2_search', query);
      } else if (item.server_no === 3 || item.server_no === 4) {
        localStorage.setItem(`krish_otp_search_s${item.server_no}`, query);
      } else if (item.server_no === 5) {
        localStorage.setItem('krish_smm_search', query);
      }
    } catch {}

    setSelectedServer(item.server_no);
    setActiveTab('store');
    try {
      window.dispatchEvent(new CustomEvent('krish_pinned_selected', { detail: item }));
    } catch {}
  };

  return (
    <div className="w-full mt-2.5 mb-1.5 animate-in fade-in duration-200">
      {/* Ultra-slim section label */}
      <div className="flex items-center justify-between mb-1.5 px-0.5">
        <div className="flex items-center gap-1.5">
          <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-[11px] font-bold text-white tracking-wide uppercase">
            {title ? title.replace(/^[^\w\s]+/, '').trim() : 'Hot Pinned Deals'}
          </span>
          <span className="text-[10px] font-mono font-bold text-amber-400">
            ({pinnedItems.length})
          </span>
        </div>
        <span className="text-[10px] text-[#71717a] hidden sm:inline">
          Tap any deal to jump right in
        </span>
      </div>

      {/* Thin, high-hook horizontal strip (single-row compact pills) */}
      <div className="flex gap-2 overflow-x-auto pb-1.5 no-scrollbar snap-x snap-mandatory">
        {pinnedItems.map((item) => {
          const badgeText = item.badge
            ? item.badge.replace(/[^\w\s%+-]/g, '').trim() || 'HOT'
            : 'HOT';
          const subText = item.category_name || item.country_name || item.subtitle;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectDeal(item)}
              className="flex-shrink-0 snap-start bg-[#16161f] hover:bg-[#1d1d29] border border-amber-500/35 hover:border-amber-400/70 rounded-xl px-2.5 py-2 flex items-center gap-2.5 transition-all duration-150 active:scale-[0.98] cursor-pointer group text-left max-w-[300px]"
            >
              {/* Left Hot Tag */}
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 text-[9px] font-extrabold uppercase tracking-wider shrink-0">
                <Zap className="w-2.5 h-2.5 text-amber-400" />
                S{item.server_no}
              </span>

              {/* Middle: Single-line Service + Subtle Tag */}
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors truncate max-w-[130px]">
                    {item.service_name}
                  </span>
                  <span className="text-[9px] font-bold text-amber-400/90 uppercase shrink-0">
                    • {badgeText}
                  </span>
                </div>
                {subText && (
                  <span className="text-[10px] text-[#71717a] truncate max-w-[170px] leading-tight">
                    {subText}
                  </span>
                )}
              </div>

              {/* Right: Price + 2.5D Hook Pill */}
              <div className="flex items-center gap-2 pl-1 shrink-0">
                <span className="text-xs font-extrabold text-[#22c55e] font-mono tabular-nums">
                  {item.price ? `₹${item.price}` : 'View'}
                </span>
                <span className="btn-25d-amber inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-extrabold">
                  <span>Get</span>
                  <ArrowRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
