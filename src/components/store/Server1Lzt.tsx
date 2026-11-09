import React, { useState, useEffect, useMemo } from 'react';
import { PriceSortFilter, PriceSortOrder } from '../common/PriceSortFilter';
import { useApp } from '../../context/AppContext';
import { downloadApi, authApi, storeApi, Server1Filters } from '../../api/endpoints';
import { Server1AccountItem } from '../../types';
import { hapticFeedback } from '../../utils/haptics';
import {
  Search,
  ShoppingBag,
  ShieldCheck,
  Key,
  Phone,
  Download,
  Check,
  Copy,
  Globe,
  Mail,
  RefreshCw,
  Clock,
  SlidersHorizontal,
  RotateCcw,
  Star,
  AlertTriangle,
  Archive,
  ChevronDown,
  X,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Server1SkeletonList } from '../common/GlassSkeleton';

export const Server1Lzt: React.FC = () => {
  const {
    user,
    setActiveTab,
    formatPrice,
    purchaseServer1Account,
    purchasedCredentialsModal,
    closeCredentialsModal,
    addToast,
    server1Items,
    isServerLoading,
    refreshStore,
    fetchOtpForNumber,
  } = useApp();

  const [search, setSearch] = useState<string>(() => {
    try {
      return localStorage.getItem('krish_s1_search') || '';
    } catch {
      return '';
    }
  });
  const [priceSort, setPriceSort] = useState<PriceSortOrder>(() => {
    try {
      return (localStorage.getItem('krish_s1_sort') as PriceSortOrder) || 'default';
    } catch {
      return 'default';
    }
  });
  const [selectedForPurchase, setSelectedForPurchase] = useState<Server1AccountItem | null>(() => {
    try {
      const saved = localStorage.getItem('krish_s1_modal_item');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const DEFAULT_FILTERS: Server1Filters = {
    spam: 'no',
    geoblock: 'no',
    login_mail: 'any',
    premium: 'any',
    offline: 'any',
    twofa: 'no',
    sort: 'az',
  };

  const [filters, setFilters] = useState<Server1Filters>(() => {
    try {
      const saved = localStorage.getItem('krish_s1_filters');
      return saved ? JSON.parse(saved) : DEFAULT_FILTERS;
    } catch {
      return DEFAULT_FILTERS;
    }
  });
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isVerifyingStock, setIsVerifyingStock] = useState(false);
  const [isRefreshingStock, setIsRefreshingStock] = useState(false);
  const [liveStockInfo, setLiveStockInfo] = useState<{
    stock: number;
    price: number;
    hasStock: boolean;
  } | null>(null);

  useEffect(() => {
    if (!selectedForPurchase) {
      setLiveStockInfo(null);
      setIsVerifyingStock(false);
      return;
    }
    let cancelled = false;
    setIsVerifyingStock(true);

    const checkPromise = storeApi.checkServer1Country(selectedForPurchase.country);
    const timeoutPromise = new Promise<{ success: false }>((resolve) =>
      setTimeout(() => resolve({ success: false }), 2500)
    );

    Promise.race([checkPromise, timeoutPromise])
      .then((res: any) => {
        if (!cancelled && res && res.success) {
          setLiveStockInfo({
            stock: res.stock,
            price: res.price,
            hasStock: res.has_stock,
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsVerifyingStock(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedForPurchase?.country]);

  const effectiveStock = liveStockInfo !== null ? liveStockInfo.stock : selectedForPurchase?.stockCount ?? 0;
  const effectivePrice = liveStockInfo !== null ? liveStockInfo.price : selectedForPurchase?.priceInr ?? 0;
  const isOutOfStock = liveStockInfo !== null ? !liveStockInfo.hasStock : effectiveStock <= 0;
  const [tempFilters, setTempFilters] = useState<Server1Filters>(filters);
  const [isSavingFilters, setIsSavingFilters] = useState(false);
  const [customOfflineDays, setCustomOfflineDays] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('krish_s1_filters');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.offline && !['any', '1', '7', '14', '30'].includes(parsed.offline)) {
          return String(parsed.offline);
        }
      }
    } catch {}
    return '';
  });

  const isCustomActive = useMemo(() => {
    return Boolean(
      tempFilters.offline &&
      !['any', '1', '7', '14', '30'].includes(tempFilters.offline)
    );
  }, [tempFilters.offline]);

  const openFilterModal = () => {
    setTempFilters(filters);
    if (filters.offline && !['any', '1', '7', '14', '30'].includes(filters.offline)) {
      setCustomOfflineDays(String(filters.offline));
    } else {
      setCustomOfflineDays('');
    }
    setIsFilterModalOpen(true);
  };

  // Sync filters from backend
  useEffect(() => {
    let active = true;
    authApi.getServer1Filters().then((res) => {
      if (active && res.success && res.filters) {
        setFilters(res.filters);
        try {
          localStorage.setItem('krish_s1_filters', JSON.stringify(res.filters));
        } catch {}
      }
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.spam !== 'no') count++;
    if (filters.geoblock !== 'no') count++;
    if (filters.login_mail !== 'any') count++;
    if (filters.premium !== 'any') count++;
    if (filters.offline !== 'any') count++;
    if (filters.twofa && filters.twofa !== 'no') count++;
    return count;
  }, [filters]);

  const handleApplyFilters = async () => {
    setIsSavingFilters(true);
    try {
      setFilters(tempFilters);
      localStorage.setItem('krish_s1_filters', JSON.stringify(tempFilters));
      await authApi.updateServer1Filters(tempFilters);
      addToast('Search filters updated successfully', 'success', 'Server 1 Filters');
      setIsFilterModalOpen(false);
      await refreshStore();
    } catch {
      addToast('Filters applied', 'info', 'Server 1 Filters');
      setIsFilterModalOpen(false);
    } finally {
      setIsSavingFilters(false);
    }
  };

  const handleResetFilters = () => {
    setTempFilters(DEFAULT_FILTERS);
    setCustomOfflineDays('');
  };

  useEffect(() => {
    try {
      localStorage.setItem('krish_s1_search', search);
      localStorage.setItem('krish_s1_sort', priceSort);
      if (selectedForPurchase) {
        localStorage.setItem('krish_s1_modal_item', JSON.stringify(selectedForPurchase));
      } else {
        localStorage.removeItem('krish_s1_modal_item');
      }
    } catch {}
  }, [search, priceSort, selectedForPurchase]);

  // Strict real data: display live stock from server1Items
  const filtered = useMemo(() => {
    return server1Items.filter((item) =>
      item.country.toLowerCase().includes(search.toLowerCase())
    );
  }, [server1Items, search]);

  const sorted = useMemo(() => {
    if (priceSort === 'asc') {
      return [...filtered].sort((a, b) => a.priceInr - b.priceInr);
    }
    if (priceSort === 'desc') {
      return [...filtered].sort((a, b) => b.priceInr - a.priceInr);
    }
    return filtered;
  }, [filtered, priceSort]);

  const [showArchived, setShowArchived] = useState(false);

  // Cleanly archive 0-stock items so users never browse among stock-0 listings
  const { inStockItems, archivedItems } = useMemo(() => {
    const inStock: Server1AccountItem[] = [];
    const archived: Server1AccountItem[] = [];
    for (const item of sorted) {
      if (item.stockCount > 0) {
        inStock.push(item);
      } else {
        archived.push(item);
      }
    }
    return { inStockItems: inStock, archivedItems: archived };
  }, [sorted]);

  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copied2Fa, setCopied2Fa] = useState(false);
  const [copiedOtp, setCopiedOtp] = useState(false);

  // Live Telegram Login Code (OTP) Retrieval State
  const [isFetchingOtp, setIsFetchingOtp] = useState(false);
  const [fetchedOtp, setFetchedOtp] = useState<string | null>(null);
  const [otpNotice, setOtpNotice] = useState<string | null>(null);

  useEffect(() => {
    if (purchasedCredentialsModal?.isOpen) {
      setFetchedOtp(purchasedCredentialsModal.otpCode || null);
      setOtpNotice(null);
      setCopiedOtp(false);
      setCopiedPhone(false);
      setCopied2Fa(false);
    }
  }, [purchasedCredentialsModal?.isOpen, purchasedCredentialsModal?.orderId, purchasedCredentialsModal?.otpCode]);

  const handleConfirmBuy = () => {
    if (!selectedForPurchase || isOutOfStock) return;
    const itemToBuy = {
      ...selectedForPurchase,
      priceInr: effectivePrice,
      stockCount: effectiveStock,
    };
    const success = purchaseServer1Account(itemToBuy);
    if (success) {
      setSelectedForPurchase(null);
    }
  };

  const handleFetchTelegramCode = async () => {
    if (!purchasedCredentialsModal) return;
    const phoneOrId =
      purchasedCredentialsModal.account?.credentialsSample?.phone ||
      purchasedCredentialsModal.orderId ||
      '';
    setIsFetchingOtp(true);
    setOtpNotice(null);

    try {
      const code = await fetchOtpForNumber(phoneOrId);
      if (code) {
        setFetchedOtp(code);
        setOtpNotice(null);
      } else {
        setOtpNotice('Code not received yet. Request the login code inside official Telegram for this number, then tap Get OTP again.');
      }
    } catch {
      setOtpNotice('Network error while checking for login code. Please tap Get OTP again.');
      addToast('Failed to check login code. Try again.', 'error');
    } finally {
      setIsFetchingOtp(false);
    }
  };

  const handleRefreshStock = async () => {
    if (isRefreshingStock || isServerLoading[1]) return;
    setIsRefreshingStock(true);
    hapticFeedback.light();
    try {
      await refreshStore();
      hapticFeedback.success();
      addToast('Server 1 stock updated', 'success', 'Server 1');
    } catch {
      hapticFeedback.error();
      addToast('Failed to refresh stock. Try again.', 'error', 'Server 1');
    } finally {
      setIsRefreshingStock(false);
    }
  };

  return (
    <div className="w-full flex flex-col pt-2">
      {/* Banner / Intro */}
      <div className="py-2 px-3 mb-2 rounded-xl bg-[#181820] border border-[#262630] flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-bold text-white truncate">Server 1: Global Accounts</span>
          <span className="text-[10px] text-[#71717a] hidden xs:inline">• Global Aged Stock</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleRefreshStock}
            disabled={isRefreshingStock || isServerLoading[1]}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#7c3aed]/15 hover:bg-[#7c3aed]/25 active:bg-[#7c3aed]/35 border border-[#7c3aed]/35 text-[#c084fc] hover:text-white text-[10px] font-bold transition-all active:scale-95 disabled:opacity-50"
            title="Refresh Server 1 stock"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshingStock || isServerLoading[1] ? 'animate-spin text-[#a78bfa]' : 'text-[#c084fc]'}`} />
            <span>{isRefreshingStock || isServerLoading[1] ? 'Refreshing...' : 'Refresh Stock'}</span>
          </button>
          <div className="px-1.5 py-0.5 rounded-md bg-[#22c55e]/10 border border-[#22c55e]/25 text-[#22c55e] text-[9px] font-bold uppercase tracking-wider shrink-0">
            High Trust
          </div>
        </div>
      </div>

      {/* Search Bar, Price Sort & Filters */}
      <div className="flex items-center gap-2 mb-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#a1a1aa] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search country (e.g. India, USA)..."
            className="w-full bg-[#181820] border border-[#262630] hover:border-[#38384a] focus:border-[#7c3aed] rounded-xl pl-10 pr-9 py-2.5 text-xs text-white placeholder-[#a1a1aa] focus:outline-none transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                try {
                  localStorage.removeItem('krish_s1_search');
                } catch {}
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#262632] hover:bg-[#323244] text-[#a1a1aa] hover:text-white flex items-center justify-center transition-colors active:scale-95"
              title="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <PriceSortFilter value={priceSort} onChange={setPriceSort} />
        <button
          type="button"
          onClick={openFilterModal}
          className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-semibold shrink-0 transition-all active:scale-95 ${
            activeFilterCount > 0
              ? 'bg-[#7c3aed]/25 border-[#8b5cf6] text-white shadow-violet-glow-sm'
              : 'bg-[#181820] border-[#262630] text-[#a1a1aa] hover:text-white hover:border-[#38384a]'
          }`}
          title="Configure Server 1 bot search filters"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-[#7c3aed] text-white text-[10px] font-extrabold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Active Filter Chips Banner */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 mb-2.5 text-[10px]">
        <button
          type="button"
          onClick={openFilterModal}
          className={`px-2 py-1 rounded-lg border font-medium shrink-0 flex items-center gap-1.5 transition-all ${
            filters.spam === 'no'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-[#22c55e]'
              : filters.spam === 'yes'
              ? 'bg-rose-500/10 border-rose-500/30 text-[#ef4444]'
              : 'bg-[#181820] border-[#262630] text-[#a1a1aa]'
          }`}
        >
          <span>Spam:</span>
          <span className="font-bold flex items-center gap-1">
            {filters.spam === 'no' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
            {filters.spam === 'yes' && <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />}
            {filters.spam === 'no' ? 'No Spam' : filters.spam === 'yes' ? 'Allow' : 'Any'}
          </span>
        </button>

        <button
          type="button"
          onClick={openFilterModal}
          className={`px-2 py-1 rounded-lg border font-medium shrink-0 flex items-center gap-1.5 transition-all ${
            filters.geoblock === 'no'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-[#22c55e]'
              : filters.geoblock === 'yes'
              ? 'bg-rose-500/10 border-rose-500/30 text-[#ef4444]'
              : 'bg-[#181820] border-[#262630] text-[#a1a1aa]'
          }`}
        >
          <span>Geo-block:</span>
          <span className="font-bold flex items-center gap-1">
            {filters.geoblock === 'no' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
            {filters.geoblock === 'yes' && <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />}
            {filters.geoblock === 'no' ? 'No Block' : filters.geoblock === 'yes' ? 'Blocked' : 'Any'}
          </span>
        </button>

        <button
          type="button"
          onClick={openFilterModal}
          className={`px-2 py-1 rounded-lg border font-medium shrink-0 flex items-center gap-1.5 transition-all ${
            filters.login_mail === 'yes'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-[#22c55e]'
              : filters.login_mail === 'no'
              ? 'bg-rose-500/10 border-rose-500/30 text-[#ef4444]'
              : 'bg-[#181820] border-[#262630] text-[#a1a1aa]'
          }`}
        >
          <span>Mail:</span>
          <span className="font-bold flex items-center gap-1">
            {filters.login_mail === 'yes' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
            {filters.login_mail === 'no' && <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />}
            {filters.login_mail === 'yes' ? 'Included' : filters.login_mail === 'no' ? 'None' : 'Any'}
          </span>
        </button>

        <button
          type="button"
          onClick={openFilterModal}
          className={`px-2 py-1 rounded-lg border font-medium shrink-0 flex items-center gap-1.5 transition-all ${
            filters.premium === 'yes'
              ? 'bg-amber-500/10 border-amber-500/30 text-[#f59e0b]'
              : filters.premium === 'no'
              ? 'bg-sky-500/10 border-sky-500/30 text-[#38bdf8]'
              : 'bg-[#181820] border-[#262630] text-[#a1a1aa]'
          }`}
        >
          <span>Prem:</span>
          <span className="font-bold flex items-center gap-1">
            {filters.premium === 'yes' && <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />}
            {filters.premium === 'yes' ? 'Only' : filters.premium === 'no' ? 'Non-Prem' : 'Any'}
          </span>
        </button>

        <button
          type="button"
          onClick={openFilterModal}
          className={`px-2 py-1 rounded-lg border font-medium shrink-0 flex items-center gap-1 transition-all ${
            filters.offline !== 'any'
              ? 'bg-[#7c3aed]/20 border-[#7c3aed]/40 text-[#c084fc]'
              : 'bg-[#181820] border-[#262630] text-[#a1a1aa]'
          }`}
        >
          <span>Offline:</span>
          <span className="font-bold">{filters.offline !== 'any' ? `≥${filters.offline}d` : 'Any'}</span>
        </button>

        <button
          type="button"
          onClick={openFilterModal}
          className={`px-2 py-1 rounded-lg border font-medium shrink-0 flex items-center gap-1.5 transition-all ${
            filters.twofa === 'yes'
              ? 'bg-amber-500/10 border-amber-500/30 text-[#f59e0b]'
              : filters.twofa === 'any'
              ? 'bg-sky-500/10 border-sky-500/30 text-[#38bdf8]'
              : 'bg-emerald-500/10 border-emerald-500/30 text-[#22c55e]'
          }`}
        >
          <span>2FA:</span>
          <span className="font-bold flex items-center gap-1">
            {(!filters.twofa || filters.twofa === 'no') && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
            {filters.twofa === 'yes' && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
            {filters.twofa === 'yes' ? 'With 2FA' : filters.twofa === 'any' ? 'Any' : 'Without 2FA'}
          </span>
        </button>
      </div>



      {/* Accounts Catalog Grid (Active in-stock listings only) */}
      <div className="grid grid-cols-1 gap-2.5">
        {inStockItems.map((item) => (
          <div
            key={item.id}
            onClick={() => setSelectedForPurchase(item)}
            className="flex items-center justify-between p-3.5 rounded-2xl bg-[#181820] border border-[#262630] hover:border-[#7c3aed]/50 transition-all cursor-pointer active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{item.icon}</span>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-white">{item.country}</span>
                  {activeFilterCount > 0 && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#7c3aed]/20 text-[#c084fc] border border-[#7c3aed]/30 font-semibold flex items-center gap-0.5">
                      <SlidersHorizontal className="w-2.5 h-2.5" />
                      <span>{activeFilterCount} Criteria</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-[#a1a1aa] mt-0.5">
                  <span>Stock: {item.stockCount} left</span>
                  <span>•</span>
                  <span className="text-[#22c55e] font-medium">Instant Delivery</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1.5">
              <span className="text-sm font-extrabold text-[#22c55e] font-mono">
                {formatPrice(item.priceInr)}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedForPurchase(item);
                }}
                className="flex items-center gap-1 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-semibold px-3 py-1.5 rounded-xl shadow-sm transition-all active:scale-95"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Buy</span>
              </button>
            </div>
          </div>
        ))}

        {isServerLoading[1] && server1Items.length === 0 ? (
          <Server1SkeletonList count={6} />
        ) : server1Items.length === 0 ? (
          <div className="p-8 text-center bg-[#181820] border border-[#262630] rounded-2xl flex flex-col items-center gap-2 text-[#a1a1aa]">
            <Globe className="w-8 h-8 text-[#8b5cf6]/50 mb-1" />
            <span className="text-sm font-bold text-white">No Server 1 stock available</span>
            <span className="text-xs">Market inventory is refreshing or currently out of stock.</span>
          </div>
        ) : inStockItems.length === 0 ? (
          <div className="p-7 text-center bg-[#181820] border border-[#262630] rounded-2xl flex flex-col items-center gap-2 text-[#a1a1aa]">
            <SlidersHorizontal className="w-7 h-7 text-[#8b5cf6]/60 mb-0.5" />
            <span className="text-sm font-bold text-white">No active stock matching your criteria</span>
            <span className="text-xs max-w-xs text-[#a1a1aa]">
              {search
                ? `No in-stock listings match "${search}" with current filters.`
                : 'All matching listings are currently out of stock. Adjust or relax your filters to see more results.'}
            </span>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={openFilterModal}
                className="mt-1 text-xs bg-[#7c3aed]/20 hover:bg-[#7c3aed]/30 border border-[#7c3aed]/40 text-[#c084fc] font-semibold px-3 py-1.5 rounded-xl transition-all"
              >
                Adjust Filters
              </button>
            )}
          </div>
        ) : null}
      </div>

      {/* Collapsed Archived / Out of Stock Drawer (Keeps 0-stock items out of the main shopping grid) */}
      {archivedItems.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[#262630]/60 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowArchived((prev) => !prev)}
            className="flex items-center justify-between p-3 rounded-xl bg-[#14141c] border border-[#262630] text-xs text-[#a1a1aa] hover:text-white transition-all active:scale-[0.99]"
          >
            <span className="flex items-center gap-2 font-semibold">
              <Archive className="w-3.5 h-3.5 text-[#8b5cf6]" />
              <span>Archived / Out of Stock ({archivedItems.length})</span>
            </span>
            <div className="flex items-center gap-1.5 text-[11px] text-[#71717a]">
              <span>{showArchived ? 'Hide' : 'Show'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showArchived ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {showArchived && (
            <div className="grid grid-cols-1 gap-2">
              {archivedItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedForPurchase(item)}
                  className="flex items-center justify-between p-3 rounded-2xl bg-[#121217] border border-[#22222b] hover:border-[#3f3f4e] transition-all cursor-pointer opacity-70 hover:opacity-100"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl grayscale">{item.icon}</span>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-white/80">{item.country}</span>
                      <span className="text-[11px] text-red-400/90 font-medium">Out of Stock for selected criteria</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#71717a] font-mono">{formatPrice(item.priceInr)}</span>
                    <span className="text-[10px] px-2 py-1 rounded-lg bg-[#22222b] text-[#a1a1aa] border border-[#2f2f3d]">Details</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirmation & Account Specifications Modal */}
      <Modal
        isOpen={!!selectedForPurchase}
        onClose={() => setSelectedForPurchase(null)}
        title="Account Details & Purchase"
        subtitle="Full specifications and delivery overview"
        footer={
          selectedForPurchase ? (
            <div className="grid grid-cols-2 gap-3 w-full">
              <button
                type="button"
                onClick={() => setSelectedForPurchase(null)}
                className="py-3 rounded-xl bg-[#1f1f2a] border border-[#262630] text-xs font-bold text-[#a1a1aa] hover:text-white active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBuy}
                disabled={isOutOfStock || user.balance < effectivePrice}
                className="py-3 rounded-xl bg-gradient-to-r from-[#22c55e] to-[#16a34a] hover:from-[#16a34a] hover:to-[#15803d] text-black font-extrabold text-xs shadow-green-glow active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:grayscale"
              >
                {isOutOfStock ? (
                  <span className="flex items-center gap-1.5 text-black">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Out of Stock for Selected Criteria</span>
                  </span>
                ) : (
                  <>
                    <Check className="w-4 h-4 text-black stroke-[3]" />
                    <span>Confirm & Pay ({formatPrice(effectivePrice)})</span>
                    {isVerifyingStock && (
                      <RefreshCw className="w-3 h-3 animate-spin text-black/60 ml-0.5" />
                    )}
                  </>
                )}
              </button>
            </div>
          ) : undefined
        }
      >
        {selectedForPurchase && (
          <div className="flex flex-col gap-3">
            {/* Service Title Card */}
            <div className="p-3 rounded-2xl bg-[#0b0b0e] border border-[#262630] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{selectedForPurchase.icon}</span>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white">
                    {selectedForPurchase.country} Telegram
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px] font-medium">
                    {isOutOfStock ? (
                      <span className="text-red-400 font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>0 in stock for your filters</span>
                      </span>
                    ) : (
                      <span className="text-[#22c55e] flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>Stock: {effectiveStock} available</span>
                        {isVerifyingStock && (
                          <RefreshCw className="w-2.5 h-2.5 animate-spin text-[#8b5cf6] ml-1" />
                        )}
                      </span>
                    )}
                    <span>•</span>
                    <span className="text-[#a1a1aa]">Instant Delivery</span>
                  </div>
                </div>
              </div>
              <div className="text-lg font-extrabold text-[#22c55e] font-mono">
                {formatPrice(effectivePrice)}
              </div>
            </div>

            {/* Out of Stock Alert Banner */}
            {isOutOfStock && !isVerifyingStock && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-xs text-red-200">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1 w-full">
                  <span className="font-bold text-white">No accounts match your active filters</span>
                  <span className="text-[11px] text-[#a1a1aa]">
                    There are currently 0 active listings in <b>{selectedForPurchase.country}</b> matching your criteria ({activeFilterCount} active filters).
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedForPurchase(null);
                      openFilterModal();
                    }}
                    className="mt-1 text-xs text-[#c084fc] font-bold hover:underline flex items-center gap-1 self-start"
                  >
                    <SlidersHorizontal className="w-3 h-3" />
                    <span>Adjust or Relax Filters</span>
                  </button>
                </div>
              </div>
            )}

            {/* Comprehensive Account Specifications & Details Sheet */}
            <div className="p-3 bg-[#181820] border border-[#262630] rounded-xl flex flex-col gap-2.5 text-xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-[#262630]">
                <span className="font-bold text-white text-[11px] flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#22c55e]" />
                  <span>Account Specifications & Features:</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedForPurchase(null);
                    openFilterModal();
                  }}
                  className="text-[10px] text-[#8b5cf6] hover:underline flex items-center gap-1"
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  <span>Configure</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded-lg bg-[#121217] border border-[#262630] flex flex-col gap-0.5">
                  <span className="text-[10px] text-[#a1a1aa] uppercase font-semibold">Account Type</span>
                  <span className="text-white font-bold">
                    {filters.twofa === 'yes' ? 'Aged Telegram 2FA' : filters.twofa === 'any' ? 'Aged Telegram' : 'Aged Telegram (Direct)'}
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-[#121217] border border-[#262630] flex flex-col gap-0.5">
                  <span className="text-[10px] text-[#a1a1aa] uppercase font-semibold">Premium Status</span>
                  <span className={`font-bold flex items-center gap-1 ${filters.premium === 'yes' ? 'text-amber-400' : filters.premium === 'no' ? 'text-sky-300' : 'text-white'}`}>
                    {filters.premium === 'yes' && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
                    {filters.premium === 'yes' ? 'Premium Only ⭐' : filters.premium === 'no' ? 'Standard (Non-Prem)' : 'Any (Standard / Prem)'}
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-[#121217] border border-[#262630] flex flex-col gap-0.5">
                  <span className="text-[10px] text-[#a1a1aa] uppercase font-semibold">Spam Status</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-400" />
                    {filters.spam === 'no' ? 'Clean (No SpamBlock)' : filters.spam === 'yes' ? 'Allow Spam' : 'Standard'}
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-[#121217] border border-[#262630] flex flex-col gap-0.5">
                  <span className="text-[10px] text-[#a1a1aa] uppercase font-semibold">2FA Security</span>
                  <span className={`font-bold flex items-center gap-1 ${
                    filters.twofa === 'yes'
                      ? 'text-amber-400'
                      : filters.twofa === 'any'
                      ? 'text-sky-300'
                      : 'text-emerald-400'
                  }`}>
                    <Key className="w-3 h-3" />
                    {filters.twofa === 'yes'
                      ? 'With 2FA Password'
                      : filters.twofa === 'any'
                      ? 'Any 2FA Status'
                      : 'Without 2FA (Clean)'}
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-[#121217] border border-[#262630] flex flex-col gap-0.5">
                  <span className="text-[10px] text-[#a1a1aa] uppercase font-semibold">Geo Access</span>
                  <span className="text-white font-bold flex items-center gap-1">
                    <Globe className="w-3 h-3 text-sky-400" />
                    {filters.geoblock === 'no' ? 'Worldwide (No Block)' : 'Universal Access'}
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-[#121217] border border-[#262630] flex flex-col gap-0.5">
                  <span className="text-[10px] text-[#a1a1aa] uppercase font-semibold">Inactivity / Age</span>
                  <span className="text-[#c084fc] font-bold flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#c084fc]" />
                    {filters.offline !== 'any' ? `≥${filters.offline}d Inactive` : 'Aged Global Stock'}
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-[#121217] border border-[#262630] flex flex-col gap-0.5">
                  <span className="text-[10px] text-[#a1a1aa] uppercase font-semibold">Delivery Format</span>
                  <span className="text-[#22c55e] font-bold flex items-center gap-1">
                    <Phone className="w-3 h-3 text-[#22c55e]" />
                    {filters.twofa === 'yes'
                      ? 'Phone + 2FA + OTP'
                      : filters.twofa === 'any'
                      ? 'Phone + Login Code'
                      : 'Phone + Direct OTP'}
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-[#121217] border border-[#262630] flex flex-col gap-0.5">
                  <span className="text-[10px] text-[#a1a1aa] uppercase font-semibold">Login / Mail</span>
                  <span className="text-white font-bold flex items-center gap-1">
                    <Mail className="w-3 h-3 text-emerald-400" />
                    {filters.login_mail === 'yes' ? 'Mail Bound' : filters.login_mail === 'no' ? 'Phone Only' : 'Standard'}
                  </span>
                </div>
              </div>
            </div>

            {/* Wallet Balance & Cost Breakdown */}
            <div className="p-2.5 bg-[#181820] border border-[#262630] rounded-xl flex flex-col gap-1.5 text-xs">
              <div className="flex items-center justify-between text-[#a1a1aa] text-[11px]">
                <span>Your Wallet Balance:</span>
                <span className="text-white font-mono font-bold">{formatPrice(user.balance)}</span>
              </div>
              <div className="flex items-center justify-between text-[#a1a1aa] text-[11px]">
                <span>Cost Deduction:</span>
                <span className="text-[#ef4444] font-mono font-bold">-{formatPrice(effectivePrice)}</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-[#262630] text-[#a1a1aa] text-[11px]">
                <span>Balance After Purchase:</span>
                <span className="text-[#22c55e] font-mono font-bold">
                  {formatPrice(Math.max(0, user.balance - effectivePrice))}
                </span>
              </div>
            </div>

            {user.balance < effectivePrice ? (
              <div className="p-3 bg-red-950/20 border border-red-500/40 rounded-xl text-xs text-[#ef4444] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#ef4444] shrink-0" />
                  <span>Insufficient balance for this account.</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedForPurchase(null);
                    setActiveTab('deposit');
                  }}
                  className="font-bold underline text-white ml-2 shrink-0"
                >
                  Deposit Now
                </button>
              </div>
            ) : (
              <div className="text-xs text-[#a1a1aa] bg-[#1f1f2a]/50 p-3 rounded-xl border border-[#262630] flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 text-white font-semibold">
                  <ShieldCheck className="w-4 h-4 text-[#22c55e]" />
                  <span>Instant Account Guarantee</span>
                </div>
                <p className="text-[11px]">
                  Credentials and 2FA password delivered immediately on next screen with live Telegram login OTP retrieval.
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Account Credential View Modal */}
      <Modal
        isOpen={!!purchasedCredentialsModal?.isOpen}
        onClose={closeCredentialsModal}
        title={purchasedCredentialsModal?.isLoading ? "Allocating Account..." : "Account Delivered!"}
        subtitle={
          purchasedCredentialsModal?.isLoading
            ? "Connecting to secure upstream provider..."
            : `Order ID: ${purchasedCredentialsModal?.orderId || 'S1_000000'}`
        }
        footer={
          <button
            onClick={closeCredentialsModal}
            disabled={purchasedCredentialsModal?.isLoading}
            className="w-full py-3 rounded-xl bg-[#1f1f2a] border border-[#262630] text-xs font-semibold text-white hover:bg-[#262630] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {purchasedCredentialsModal?.isLoading ? 'Allocating & Securing Credentials...' : 'Done / Close'}
          </button>
        }
      >
        {purchasedCredentialsModal?.isLoading ? (
          <div className="flex flex-col gap-4 py-3">
            {/* Pulsing Status Header */}
            <div className="p-4 bg-[#7c3aed]/10 border border-[#7c3aed]/30 rounded-2xl flex flex-col items-center justify-center text-center gap-2.5">
              <div className="relative">
                <RefreshCw className="w-8 h-8 text-[#8b5cf6] animate-spin" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-bold text-white">
                  Allocating and securing 2FA credentials
                </span>
                <span className="text-[11px] text-[#a1a1aa]">
                  Allocating {purchasedCredentialsModal.account?.country || 'Telegram'} Account · Securing session & authorizations
                </span>
              </div>
            </div>

            {/* Skeleton Loading Rows */}
            <div className="space-y-3">
              {/* Phone Skeleton */}
              <div className="p-3 bg-[#0b0b0e] border border-[#262630] rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-[#8b5cf6] animate-pulse" />
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-[#71717a] uppercase font-semibold">Phone Number</span>
                    <div className="h-4 w-36 bg-[#1f1f2a] rounded animate-pulse" />
                  </div>
                </div>
                <div className="h-7 w-7 bg-[#181820] rounded-lg animate-pulse" />
              </div>

              {/* 2FA Skeleton */}
              <div className="p-3 bg-[#0b0b0e] border border-[#262630] rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Key className="w-4 h-4 text-[#f59e0b] animate-pulse" />
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-[#71717a] uppercase font-semibold">2FA Password</span>
                    <div className="h-4 w-28 bg-[#1f1f2a] rounded animate-pulse" />
                  </div>
                </div>
                <div className="h-7 w-7 bg-[#181820] rounded-lg animate-pulse" />
              </div>

              {/* OTP section skeleton */}
              <div className="p-3 bg-[#121217] border border-[#262630] rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-[#71717a] animate-pulse" />
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-[#71717a] uppercase font-semibold">Telegram Login Code</span>
                    <div className="h-3.5 w-40 bg-[#1f1f2a] rounded animate-pulse" />
                  </div>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-center text-[#71717a] flex items-center justify-center gap-1.5">
              <Clock className="w-3.5 h-3.5 animate-spin" />
              <span>Please hold on, securing 2FA and resetting other sessions...</span>
            </div>
          </div>
        ) : purchasedCredentialsModal?.account && (
          <div className="flex flex-col gap-3.5">
            <div className="p-3 bg-[#22c55e]/10 border border-[#22c55e]/30 rounded-xl flex items-center gap-2 text-xs text-[#22c55e] font-semibold">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Ready for login. Save your credentials below!</span>
            </div>

            {/* Verified Account Quality Specifications */}
            {purchasedCredentialsModal.metadata && (
              <div className="p-3 bg-[#181820] border border-[#262630] rounded-xl flex flex-col gap-2 text-xs">
                <div className="flex items-center justify-between text-[#a1a1aa] pb-1 border-b border-[#262630]">
                  <span className="font-semibold text-white flex items-center gap-1.5 text-[11px]">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#22c55e]" />
                    <span>Verified Account Specifications:</span>
                  </span>
                  <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    Live Verified
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-0.5">
                  <div className="flex items-center justify-between p-1.5 rounded-lg bg-[#121217] border border-[#262630]">
                    <span className="text-[#a1a1aa]">SpamBlock:</span>
                    <span className={`font-bold ${purchasedCredentialsModal.metadata.has_spam ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {purchasedCredentialsModal.metadata.has_spam ? 'Flagged' : '✓ Clean (No Spam)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-1.5 rounded-lg bg-[#121217] border border-[#262630]">
                    <span className="text-[#a1a1aa]">Premium:</span>
                    <span className={`font-bold flex items-center gap-1 ${purchasedCredentialsModal.metadata.is_premium ? 'text-amber-400' : 'text-[#a1a1aa]'}`}>
                      {purchasedCredentialsModal.metadata.is_premium && <Star className="w-3 h-3 fill-amber-400" />}
                      {purchasedCredentialsModal.metadata.is_premium ? 'Active ⭐' : 'Standard'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-1.5 rounded-lg bg-[#121217] border border-[#262630]">
                    <span className="text-[#a1a1aa]">Inactivity:</span>
                    <span className="font-bold text-[#c084fc]">
                      {purchasedCredentialsModal.metadata.offline_days && purchasedCredentialsModal.metadata.offline_days > 0
                        ? `≥${purchasedCredentialsModal.metadata.offline_days}d offline`
                        : 'Recent'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-1.5 rounded-lg bg-[#121217] border border-[#262630]">
                    <span className="text-[#a1a1aa]">Geo-block:</span>
                    <span className={`font-bold ${purchasedCredentialsModal.metadata.has_geo_block ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {purchasedCredentialsModal.metadata.has_geo_block ? 'Restricted' : '✓ Clean'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Phone row */}
            <div className="p-3 bg-[#0b0b0e] border border-[#262630] rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#8b5cf6]" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-[#a1a1aa] uppercase font-semibold">Phone Number</span>
                  <span className="text-xs font-mono font-bold text-white">
                    {purchasedCredentialsModal.account.credentialsSample?.phone || 'Allocated (Pending Phone Delivery)'}
                  </span>
                </div>
              </div>
              {purchasedCredentialsModal.account?.credentialsSample?.phone && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      purchasedCredentialsModal.account?.credentialsSample?.phone || ''
                    );
                    setCopiedPhone(true);
                    setTimeout(() => setCopiedPhone(false), 2000);
                  }}
                  className="p-1.5 rounded-lg bg-[#181820] border border-[#262630] text-[#a1a1aa] hover:text-white"
                >
                  {copiedPhone ? <Check className="w-4 h-4 text-[#22c55e]" /> : <Copy className="w-4 h-4" />}
                </button>
              )}
            </div>

            {/* 2FA Password row */}
            <div className="p-3 bg-[#0b0b0e] border border-[#262630] rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-[#f59e0b]" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-[#a1a1aa] uppercase font-semibold">2FA Password</span>
                  <span className="text-xs font-mono font-bold text-white">
                    {purchasedCredentialsModal.account.credentialsSample?.twoFa || 'None (No 2FA Required)'}
                  </span>
                </div>
              </div>
              {purchasedCredentialsModal.account?.credentialsSample?.twoFa && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      purchasedCredentialsModal.account?.credentialsSample?.twoFa || ''
                    );
                    setCopied2Fa(true);
                    setTimeout(() => setCopied2Fa(false), 2000);
                  }}
                  className="p-1.5 rounded-lg bg-[#181820] border border-[#262630] text-[#a1a1aa] hover:text-white"
                >
                  {copied2Fa ? <Check className="w-4 h-4 text-[#22c55e]" /> : <Copy className="w-4 h-4" />}
                </button>
              )}
            </div>

            {/* Telegram Login Code (OTP) Retrieval Section */}
            <div className="p-3 bg-[#121217] border border-[#262630] rounded-xl flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-white uppercase tracking-wider">
                  Telegram Login Code (OTP)
                </span>
                {fetchedOtp && (
                  <button
                    onClick={handleFetchTelegramCode}
                    disabled={isFetchingOtp}
                    className="flex items-center gap-1 text-[10px] text-[#8b5cf6] hover:text-[#a78bfa]"
                  >
                    <RefreshCw className={`w-3 h-3 ${isFetchingOtp ? 'animate-spin' : ''}`} />
                    <span>Check Again</span>
                  </button>
                )}
              </div>

              {fetchedOtp ? (
                <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-[#22c55e] uppercase font-semibold">
                      Live Login Code
                    </span>
                    <span className="text-xl font-mono font-extrabold text-white tracking-widest mt-0.5">
                      {fetchedOtp}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(fetchedOtp);
                      setCopiedOtp(true);
                      setTimeout(() => setCopiedOtp(false), 2000);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold text-xs shadow-sm transition-all active:scale-95"
                  >
                    {copiedOtp ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedOtp ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleFetchTelegramCode}
                  disabled={isFetchingOtp}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold text-xs shadow-violet-glow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  {isFetchingOtp ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Contacting Telegram for Code...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      <span>Get OTP / Login Code</span>
                    </>
                  )}
                </button>
              )}

              {otpNotice && (
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] text-amber-300 flex items-start gap-2">
                  <Clock className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <span>{otpNotice}</span>
                </div>
              )}
            </div>

            {/* Login Guidance */}
            <div className="p-3 bg-[#181820] border border-[#262630] rounded-xl text-xs text-[#a1a1aa]">
              <span className="font-semibold text-white block mb-1">How to Login:</span>
              <ol className="list-decimal list-inside space-y-0.5 text-[11px]">
                <li>Enter the phone number into official Telegram app.</li>
                <li>Tap <strong className="text-white">Fetch Telegram Login Code</strong> above.</li>
                <li>Enter the 2FA Password if Telegram asks for cloud password.</li>
              </ol>
            </div>

            {/* Optional Session Download (only if provided by backend) */}
            {purchasedCredentialsModal.downloadUrl && (
              <button
                onClick={() => {
                  downloadApi.triggerDownload(
                    purchasedCredentialsModal.downloadUrl!,
                    `session_${purchasedCredentialsModal.orderId}.session`
                  );
                  addToast('Downloading session file...', 'info');
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#1f1f2a] border border-[#262630] text-xs font-semibold text-white hover:bg-[#262630]"
              >
                <Download className="w-4 h-4 text-[#22c55e]" />
                <span>Download .Session File</span>
              </button>
            )}
          </div>
        )}
      </Modal>

      {/* Server 1 Search Filter Configuration Modal */}
      <Modal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        title="Server 1 Filters"
        subtitle="Configure account quality and security filters matching the Telegram bot"
        footer={
          <div className="grid grid-cols-2 gap-3 w-full">
            <button
              type="button"
              onClick={handleResetFilters}
              className="py-3 rounded-xl bg-[#1f1f2a] border border-[#262630] text-xs font-bold text-[#a1a1aa] hover:text-white active:scale-95 transition-all flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Defaults</span>
            </button>
            <button
              type="button"
              onClick={handleApplyFilters}
              disabled={isSavingFilters}
              className="py-3 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] hover:from-[#6d28d9] hover:to-[#5b21b6] text-white font-extrabold text-xs shadow-violet-glow-sm active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{isSavingFilters ? 'Saving...' : 'Apply Filters'}</span>
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-4 pt-1 pb-1">
          {/* 1. Spam Filter */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">Spam Filter</span>
              <span className="text-[10px] text-[#a1a1aa]">SpamBlock status</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { val: 'no', label: 'No Spam', desc: 'Safe & Clean', dot: 'bg-emerald-400' },
                { val: 'yes', label: 'Allow Spam', desc: 'Any state', dot: 'bg-rose-400' },
                { val: 'any', label: 'Any', desc: 'No check' },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setTempFilters((prev) => ({ ...prev, spam: opt.val as 'no' | 'yes' | 'any' }))}
                  className={`py-2 px-1.5 rounded-xl border text-center flex flex-col items-center justify-center transition-all ${
                    tempFilters.spam === opt.val
                      ? 'bg-[#7c3aed]/25 border-[#8b5cf6] text-white shadow-violet-glow-sm ring-1 ring-[#8b5cf6]/50'
                      : 'bg-[#181820] border-[#262630] text-[#a1a1aa] hover:text-white'
                  }`}
                >
                  <span className="text-xs font-bold flex items-center gap-1">
                    {opt.dot && <span className={`w-1.5 h-1.5 rounded-full ${opt.dot}`} />}
                    {opt.label}
                  </span>
                  <span className="text-[9px] text-[#71717a]">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Geo-block Filter */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">Geo-block Filter</span>
              <span className="text-[10px] text-[#a1a1aa]">Regional IP restriction</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { val: 'no', label: 'No Block', desc: 'Unrestricted', dot: 'bg-emerald-400' },
                { val: 'yes', label: 'Blocked', desc: 'Geo-locked', dot: 'bg-rose-400' },
                { val: 'any', label: 'Any', desc: 'No check' },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setTempFilters((prev) => ({ ...prev, geoblock: opt.val as 'no' | 'yes' | 'any' }))}
                  className={`py-2 px-1.5 rounded-xl border text-center flex flex-col items-center justify-center transition-all ${
                    tempFilters.geoblock === opt.val
                      ? 'bg-[#7c3aed]/25 border-[#8b5cf6] text-white shadow-violet-glow-sm ring-1 ring-[#8b5cf6]/50'
                      : 'bg-[#181820] border-[#262630] text-[#a1a1aa] hover:text-white'
                  }`}
                >
                  <span className="text-xs font-bold flex items-center gap-1">
                    {opt.dot && <span className={`w-1.5 h-1.5 rounded-full ${opt.dot}`} />}
                    {opt.label}
                  </span>
                  <span className="text-[9px] text-[#71717a]">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Login Mail */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">Login Mail</span>
              <span className="text-[10px] text-[#a1a1aa]">Native email access</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { val: 'any', label: 'Any', desc: 'Default' },
                { val: 'yes', label: 'Included', desc: 'Webmail bound', dot: 'bg-emerald-400' },
                { val: 'no', label: 'No Mail', desc: 'Telegram only', dot: 'bg-rose-400' },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setTempFilters((prev) => ({ ...prev, login_mail: opt.val as 'yes' | 'no' | 'any' }))}
                  className={`py-2 px-1.5 rounded-xl border text-center flex flex-col items-center justify-center transition-all ${
                    tempFilters.login_mail === opt.val
                      ? 'bg-[#7c3aed]/25 border-[#8b5cf6] text-white shadow-violet-glow-sm ring-1 ring-[#8b5cf6]/50'
                      : 'bg-[#181820] border-[#262630] text-[#a1a1aa] hover:text-white'
                  }`}
                >
                  <span className="text-xs font-bold flex items-center gap-1">
                    {opt.dot && <span className={`w-1.5 h-1.5 rounded-full ${opt.dot}`} />}
                    {opt.label}
                  </span>
                  <span className="text-[9px] text-[#71717a]">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 4. Premium Filter */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">Telegram Premium</span>
              <span className="text-[10px] text-[#a1a1aa]">Premium badge status</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { val: 'any', label: 'Any', desc: 'Any account' },
                { val: 'yes', label: 'Premium Only', desc: 'Star badge', isStar: true },
                { val: 'no', label: 'Regular', desc: 'Non-premium' },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setTempFilters((prev) => ({ ...prev, premium: opt.val as 'yes' | 'no' | 'any' }))}
                  className={`py-2 px-1.5 rounded-xl border text-center flex flex-col items-center justify-center transition-all ${
                    tempFilters.premium === opt.val
                      ? 'bg-[#7c3aed]/25 border-[#8b5cf6] text-white shadow-violet-glow-sm ring-1 ring-[#8b5cf6]/50'
                      : 'bg-[#181820] border-[#262630] text-[#a1a1aa] hover:text-white'
                  }`}
                >
                  <span className="text-xs font-bold flex items-center gap-1">
                    {opt.isStar && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
                    {opt.label}
                  </span>
                  <span className="text-[9px] text-[#71717a]">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 5. 2FA (Two-Step Verification) Filter */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">2FA (Cloud Password)</span>
              <span className="text-[10px] text-[#a1a1aa]">Two-step verification status</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { val: 'no', label: 'Without 2fa', desc: 'No password', dot: 'bg-emerald-400' },
                { val: 'yes', label: 'With 2fa', desc: 'Password provided', dot: 'bg-amber-400' },
                { val: 'any', label: 'Any', desc: 'Any 2FA status' },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setTempFilters((prev) => ({ ...prev, twofa: opt.val as 'no' | 'yes' | 'any' }))}
                  className={`py-2 px-1.5 rounded-xl border text-center flex flex-col items-center justify-center transition-all ${
                    (tempFilters.twofa || 'no') === opt.val
                      ? 'bg-[#7c3aed]/25 border-[#8b5cf6] text-white shadow-violet-glow-sm ring-1 ring-[#8b5cf6]/50'
                      : 'bg-[#181820] border-[#262630] text-[#a1a1aa] hover:text-white'
                  }`}
                >
                  <span className="text-xs font-bold flex items-center gap-1">
                    {opt.dot && <span className={`w-1.5 h-1.5 rounded-full ${opt.dot}`} />}
                    {opt.label}
                  </span>
                  <span className="text-[9px] text-[#71717a]">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 5. Offline Filter */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">Offline Inactivity Duration</span>
              <span className="text-[10px] text-[#a1a1aa]">Last seen threshold</span>
            </div>
            {/* Quick Presets */}
            <div className="grid grid-cols-5 gap-1">
              {[
                { val: 'any', label: 'Any' },
                { val: '1', label: '≥1d' },
                { val: '7', label: '≥7d' },
                { val: '14', label: '≥14d' },
                { val: '30', label: '≥30d' },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => {
                    setTempFilters((prev) => ({ ...prev, offline: opt.val }));
                    setCustomOfflineDays('');
                  }}
                  className={`py-2 px-1 rounded-xl border text-center flex items-center justify-center transition-all ${
                    tempFilters.offline === opt.val && !isCustomActive
                      ? 'bg-[#7c3aed]/25 border-[#8b5cf6] text-white shadow-violet-glow-sm font-bold'
                      : 'bg-[#181820] border-[#262630] text-[#a1a1aa] hover:text-white text-xs'
                  }`}
                >
                  <span className="text-xs">{opt.label}</span>
                </button>
              ))}
            </div>

            {/* Custom Days Input */}
            <div className="flex items-center gap-2 pt-0.5">
              <div
                className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
                  isCustomActive
                    ? 'bg-[#7c3aed]/20 border-[#8b5cf6] ring-1 ring-[#8b5cf6]/50'
                    : 'bg-[#181820] border-[#262630] focus-within:border-[#8b5cf6]/60'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-[#8b5cf6] shrink-0" />
                <span className="text-xs text-[#a1a1aa] font-medium shrink-0">Custom Days:</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="e.g. 3, 5, 60, 90..."
                  value={customOfflineDays}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, '');
                    setCustomOfflineDays(raw);
                    if (raw && parseInt(raw, 10) > 0) {
                      setTempFilters((prev) => ({ ...prev, offline: raw }));
                    } else {
                      setTempFilters((prev) => ({ ...prev, offline: 'any' }));
                    }
                  }}
                  className="w-full bg-transparent text-xs text-white placeholder-[#52525b] outline-none font-bold"
                />
                {isCustomActive && (
                  <span className="text-[11px] font-bold text-[#c084fc] bg-[#7c3aed]/25 border border-[#7c3aed]/40 px-1.5 py-0.5 rounded-md shrink-0">
                    ≥{tempFilters.offline}d
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
