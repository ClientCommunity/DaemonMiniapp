import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { storeApi, PinnedServiceItem } from '../../api/endpoints';
import { ArrowRight, Flame, Sparkles } from 'lucide-react';

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
  };

  return (
    <div className="w-full mt-4 mb-2 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-2.5 px-0.5">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
              {title || '🔥 Featured & Pinned Deals'}
              <span className="text-[10px] font-mono text-amber-400 font-semibold px-1.5 py-0.2 rounded-full bg-amber-500/10 border border-amber-500/20">
                {pinnedItems.length}
              </span>
            </h3>
          </div>
        </div>
      </div>

      {/* Horizontal Scrollable Carousel on mobile / Flex Grid on wider screens */}
      <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
        {pinnedItems.map((item) => (
          <div
            key={item.id}
            onClick={() => handleSelectDeal(item)}
            className="flex-shrink-0 w-[240px] bg-gradient-to-b from-[#181822] to-[#121218] hover:from-[#1d1d2b] hover:to-[#161620] border border-[#262638] hover:border-amber-500/40 rounded-2xl p-3.5 flex flex-col justify-between transition-all duration-200 cursor-pointer snap-start shadow-lg shadow-black/20 group relative overflow-hidden active:scale-[0.98]"
          >
            {/* Top ambient glow */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/10 transition-colors" />

            <div>
              {/* Header: Server Pill + Custom Badge */}
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#20202e] border border-[#2c2c3e] text-[10px] font-medium text-[#a1a1aa]">
                  <span>{item.server_icon || '⚡'}</span>
                  <span>Server {item.server_no}</span>
                </span>

                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[10px] font-bold text-amber-300">
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>{item.badge || '🔥 Hot'}</span>
                </span>
              </div>

              {/* Title & Category */}
              <h4 className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors line-clamp-1 mb-0.5">
                {item.service_name}
              </h4>
              <p className="text-[10px] text-[#71717a] line-clamp-1">
                {item.category_name || item.country_name || item.subtitle || 'Instant Delivery'}
              </p>
            </div>

            {/* Bottom: Price + Buy Action */}
            <div className="mt-3 pt-2.5 border-t border-[#262638] flex items-center justify-between">
              <div>
                <span className="text-[9px] text-[#71717a] block leading-none mb-0.5">
                  {item.server_no === 5 ? 'Per 1k' : 'Price'}
                </span>
                <span className="text-xs font-extrabold text-[#22c55e] font-mono">
                  {item.price ? `₹${item.price}` : 'Check Price'}
                </span>
              </div>

              <button
                type="button"
                className="flex items-center gap-1 bg-amber-500/15 group-hover:bg-amber-500 text-amber-300 group-hover:text-black border border-amber-500/30 group-hover:border-amber-400 font-bold px-2.5 py-1.5 rounded-xl text-[10px] transition-all duration-200"
              >
                <span>Buy</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
