import React, { useEffect, useState, useCallback } from 'react';
import {
  adminApi,
  AdminOverviewStats,
  ProviderBalances,
} from '../../../api/adminApi';
import { useAdmin } from '../../../context/AdminContext';
import {
  Users,
  Wallet,
  ShoppingBag,
  Clock,
  RefreshCw,
  Server,
  Layers,
  ArrowUpRight,
  Coins,
  AlertTriangle,
} from 'lucide-react';

export const OverviewTab: React.FC = () => {
  const { setActiveAdminTab } = useAdmin();
  const [stats, setStats] = useState<AdminOverviewStats | null>(null);
  const [providerBalances, setProviderBalances] = useState<ProviderBalances | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchOverviewData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [overviewRes, providersRes] = await Promise.allSettled([
        adminApi.getOverview(),
        adminApi.getProviderBalances(),
      ]);

      if (overviewRes.status === 'fulfilled' && overviewRes.value?.stats) {
        setStats(overviewRes.value.stats);
      } else if (overviewRes.status === 'rejected') {
        throw new Error('Failed to fetch system overview statistics.');
      }

      if (providersRes.status === 'fulfilled' && providersRes.value?.provider_balances) {
        setProviderBalances(providersRes.value.provider_balances);
      }

      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load system metrics';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOverviewData();
  }, [fetchOverviewData]);

  const formatCurrency = (val?: number | string | null): string => {
    if (val === undefined || val === null || val === '') return '₹0.00';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return String(val);
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Banner: Title & Refresh Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#181820] border border-[#262630] rounded-2xl p-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-base font-bold text-white tracking-tight">
              Live System Analytics & KPIs
            </h2>
            <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
          </div>
          <p className="text-xs text-[#a1a1aa]">
            Real-time database metrics, user wallet liabilities, and upstream provider balances.
            {lastUpdated && <span className="ml-2 text-[#71717a]">Updated {lastUpdated}</span>}
          </p>
        </div>

        <button
          onClick={() => fetchOverviewData(true)}
          disabled={refreshing || loading}
          className="flex items-center justify-center gap-2 bg-[#7c3aed]/20 hover:bg-[#7c3aed]/30 active:scale-95 text-[#a78bfa] hover:text-white border border-[#7c3aed]/40 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh KPIs'}</span>
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#ef4444] rounded-xl p-3.5 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <div className="flex-1 min-w-0 font-medium">{error}</div>
          <button
            onClick={() => fetchOverviewData(true)}
            className="text-[11px] underline font-semibold hover:text-white"
          >
            Retry
          </button>
        </div>
      )}

      {/* Primary KPI Grid (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Total Users */}
        <div className="bg-[#181820] border border-[#262630] rounded-2xl p-4 shadow-sm hover:border-[#3b3b4a] transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[#a1a1aa]">Total Registered Users</span>
            <div className="w-8 h-8 rounded-xl bg-[#3b82f6]/10 border border-[#3b82f6]/20 flex items-center justify-center text-[#3b82f6]">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {loading ? '...' : (stats?.users_count ?? 0).toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-[#71717a] mt-1">Verified Telegram accounts</p>
        </div>

        {/* Card 2: Total Deposits */}
        <div className="bg-[#181820] border border-[#262630] rounded-2xl p-4 shadow-sm hover:border-[#3b3b4a] transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[#a1a1aa]">Total Deposits Volume</span>
            <div className="w-8 h-8 rounded-xl bg-[#22c55e]/10 border border-[#22c55e]/20 flex items-center justify-center text-[#22c55e]">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#22c55e] tracking-tight">
            {loading ? '...' : formatCurrency(stats?.total_deposited_inr)}
          </div>
          <p className="text-[11px] text-[#71717a] mt-1">
            {stats?.successful_deposits_count ?? 0} successful deposits
          </p>
        </div>

        {/* Card 3: Store Sales */}
        <div className="bg-[#181820] border border-[#262630] rounded-2xl p-4 shadow-sm hover:border-[#3b3b4a] transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[#a1a1aa]">Store Sales Revenue</span>
            <div className="w-8 h-8 rounded-xl bg-[#8b5cf6]/10 border border-[#8b5cf6]/20 flex items-center justify-center text-[#8b5cf6]">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {loading ? '...' : formatCurrency(stats?.total_orders_revenue_inr)}
          </div>
          <p className="text-[11px] text-[#71717a] mt-1">
            {stats?.total_orders_count ?? 0} fulfilled orders
          </p>
        </div>

        {/* Card 4: Pending Deposits Review */}
        <div
          onClick={() => setActiveAdminTab('payments')}
          className="bg-[#181820] border border-[#262630] rounded-2xl p-4 shadow-sm hover:border-[#f59e0b]/50 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[#a1a1aa]">Pending UTR Reviews</span>
            <div className="w-8 h-8 rounded-xl bg-[#f59e0b]/10 border border-[#f59e0b]/20 flex items-center justify-center text-[#f59e0b] group-hover:scale-105 transition-transform">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-[#f59e0b] tracking-tight">
              {loading ? '...' : stats?.pending_deposits ?? 0}
            </span>
            {(stats?.pending_deposits ?? 0) > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f59e0b]/20 text-[#f59e0b] font-semibold animate-pulse">
                Action Required
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#71717a] mt-1 flex items-center justify-between">
            <span>Manual deposit review queue</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-[#71717a] group-hover:text-white" />
          </p>
        </div>
      </div>

      {/* Secondary Row: Wallet Liabilities & Stock Inventory */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Wallet Liabilities Card */}
        <div className="bg-[#181820] border border-[#262630] rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#ec4899]/10 border border-[#ec4899]/20 flex items-center justify-center text-[#ec4899]">
                  <Coins className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Total Wallet Liabilities
                </h3>
              </div>
              <span className="text-[11px] text-[#71717a]">All active users</span>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="bg-[#121217] border border-[#262630] rounded-xl p-3">
                <span className="text-[11px] text-[#a1a1aa] block mb-1">Transferable Balance</span>
                <span className="text-base font-bold text-white">
                  {loading ? '...' : formatCurrency(stats?.total_balance)}
                </span>
              </div>
              <div className="bg-[#121217] border border-[#262630] rounded-xl p-3">
                <span className="text-[11px] text-[#a1a1aa] block mb-1">Promo Balance (Locked)</span>
                <span className="text-base font-bold text-[#ec4899]">
                  {loading ? '...' : formatCurrency(stats?.total_promo_balance)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Server 2 Stock Breakdown Card */}
        <div className="bg-[#181820] border border-[#262630] rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#22c55e]/10 border border-[#22c55e]/20 flex items-center justify-center text-[#22c55e]">
                  <Layers className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Server 2 Session Stock
                </h3>
              </div>
              <button
                onClick={() => setActiveAdminTab('servers')}
                className="text-[11px] text-[#8b5cf6] hover:underline flex items-center gap-1"
              >
                Manage Stock <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="bg-[#121217] border border-[#262630] rounded-xl p-3 text-center">
                <span className="text-[10px] text-[#a1a1aa] block mb-0.5">Total Available</span>
                <span className="text-sm font-bold text-white">
                  {loading ? '...' : stats?.stock_total_count ?? 0}
                </span>
              </div>
              <div className="bg-[#121217] border border-[#22c55e]/30 rounded-xl p-3 text-center">
                <span className="text-[10px] text-[#22c55e] block mb-0.5">🟢 Good Quality</span>
                <span className="text-sm font-bold text-white">
                  {loading ? '...' : stats?.stock_good_count ?? 0}
                </span>
              </div>
              <div className="bg-[#121217] border border-[#eab308]/30 rounded-xl p-3 text-center">
                <span className="text-[10px] text-[#eab308] block mb-0.5">🟡 Cheap Quality</span>
                <span className="text-sm font-bold text-white">
                  {loading ? '...' : stats?.stock_cheap_count ?? 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section: Provider Balances Hub */}
      <div className="bg-[#181820] border border-[#262630] rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#7c3aed]/15 border border-[#7c3aed]/30 flex items-center justify-center text-[#8b5cf6]">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Upstream Provider API Balances
              </h3>
              <p className="text-[11px] text-[#a1a1aa]">
                Live balance enquiries from external OTP, market & SMM panels
              </p>
            </div>
          </div>

          <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#121217] border border-[#262630] text-[#a1a1aa] font-medium">
            4 Providers Active
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Provider 1: LZT Market */}
          <div className="bg-[#121217] border border-[#262630] rounded-xl p-3.5 flex flex-col justify-between hover:border-[#3b3b4a] transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-white">Server 1 (LZT)</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 font-medium">
                Active
              </span>
            </div>
            <div className="text-lg font-bold text-white tracking-tight">
              {loading
                ? '...'
                : providerBalances?.lzt_balance !== undefined
                ? String(providerBalances.lzt_balance)
                : 'Configured'}
            </div>
            <span className="text-[10px] text-[#71717a] mt-1">LZT Market 2FA Accounts</span>
          </div>

          {/* Provider 2: DGOTP */}
          <div className="bg-[#121217] border border-[#262630] rounded-xl p-3.5 flex flex-col justify-between hover:border-[#3b3b4a] transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-white">Server 3 (DGOTP)</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 font-medium">
                API Ready
              </span>
            </div>
            <div className="text-lg font-bold text-[#22c55e] tracking-tight">
              {loading
                ? '...'
                : providerBalances?.dgotp_balance !== undefined
                ? formatCurrency(providerBalances.dgotp_balance)
                : '₹0.00'}
            </div>
            <span className="text-[10px] text-[#71717a] mt-1">Virtual Numbers Provider</span>
          </div>

          {/* Provider 3: TemporaSMS */}
          <div className="bg-[#121217] border border-[#262630] rounded-xl p-3.5 flex flex-col justify-between hover:border-[#3b3b4a] transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-white">Server 4 (Tempora)</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 font-medium">
                API Ready
              </span>
            </div>
            <div className="text-lg font-bold text-[#22c55e] tracking-tight">
              {loading
                ? '...'
                : providerBalances?.temporasms_balance !== undefined
                ? formatCurrency(providerBalances.temporasms_balance)
                : '₹0.00'}
            </div>
            <span className="text-[10px] text-[#71717a] mt-1">Temporary OTP Carrier</span>
          </div>

          {/* Provider 4: SMM Panels */}
          <div className="bg-[#121217] border border-[#262630] rounded-xl p-3.5 flex flex-col justify-between hover:border-[#3b3b4a] transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-white">Server 5 (SMM Hub)</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#8b5cf6]/10 text-[#8b5cf6] border border-[#8b5cf6]/20 font-medium">
                Multi-Panel
              </span>
            </div>
            <div className="text-lg font-bold text-white tracking-tight">
              {loading
                ? '...'
                : providerBalances?.smm_balance !== undefined
                ? String(providerBalances.smm_balance)
                : 'Ready'}
            </div>
            <span className="text-[10px] text-[#71717a] mt-1">Social Boost Panels</span>
          </div>
        </div>
      </div>
    </div>
  );
};
