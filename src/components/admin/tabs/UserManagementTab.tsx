import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  adminApi,
  AdminUserInfo,
  AdminUsersSummary,
  AdminUserOrderRecord,
  AdminUserDepositRecord,
} from '../../../api/adminApi';
import { useApp } from '../../../context/AppContext';
import {
  Search,
  Wallet,
  Copy,
  Ban,
  AlertTriangle,
  Users,
  Globe,
  Smartphone,
  Link2,
  RefreshCw,
  Mail,
  Phone,
  ShoppingBag,
  ArrowDownCircle,
  CheckCircle2,
  ShieldAlert,
  X,
  Calendar,
  TrendingUp,
} from 'lucide-react';

interface PendingBalanceAdjustment {
  amount: number;
  type: 'credit' | 'debit';
  isPromo: boolean;
  reason: string;
}

const DARK_SELECT_STYLE: React.CSSProperties = { colorScheme: 'dark' };
const DARK_OPTION_CLASS = 'bg-[#181820] text-white';

function formatShortDate(raw?: string): string {
  if (!raw) return '—';
  const cleaned = String(raw).trim();
  if (!cleaned || cleaned === 'None') return '—';
  return cleaned.length > 19 ? cleaned.slice(0, 19) : cleaned;
}

function getOrderStatusMeta(order: AdminUserOrderRecord): { label: string; cls: string } {
  if (order.refunded) {
    return {
      label: 'Refunded',
      cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    };
  }
  const otp = String(order.otp || '').toUpperCase();
  const reason = String(order.reason || '').toLowerCase();
  if (otp === 'CANCELLED' || reason === 'cancelled' || reason === 'canceled' || reason === 'failed') {
    return {
      label: 'Cancelled',
      cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    };
  }
  if (otp === 'WAITING' || reason === 'waiting' || reason === 'pending' || reason === 'in progress') {
    return {
      label: 'Active / Waiting',
      cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    };
  }
  return {
    label: 'Completed',
    cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  };
}

function getDepositStatusMeta(status?: string): { label: string; cls: string } {
  const s = String(status || '').toLowerCase().trim();
  if (s === 'approved' || s === 'completed' || s === 'success') {
    return {
      label: 'Approved',
      cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    };
  }
  if (s === 'pending' || s === 'waiting') {
    return {
      label: 'Pending',
      cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    };
  }
  if (s === 'rejected' || s === 'failed' || s === 'cancelled') {
    return {
      label: s.charAt(0).toUpperCase() + s.slice(1),
      cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    };
  }
  return {
    label: status || 'Logged',
    cls: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
  };
}

export const UserManagementTab: React.FC = () => {
  const { addToast } = useApp();

  // Default Users-tab Population Overview (Read-Only Summary)
  const [summary, setSummary] = useState<AdminUsersSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Race-safety counter for lookup / clear
  const lookupSeqRef = useRef(0);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<AdminUserInfo | null>(null);
  const [orders, setOrders] = useState<AdminUserOrderRecord[]>([]);
  const [deposits, setDeposits] = useState<AdminUserDepositRecord[]>([]);
  const [searched, setSearched] = useState(false);
  const [historyTab, setHistoryTab] = useState<'orders' | 'deposits'>('orders');

  // Balance Adjustment Form & Mandatory Confirmation Modal State
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustType, setAdjustType] = useState<'credit' | 'debit'>('credit');
  const [adjustIsPromo, setAdjustIsPromo] = useState(false);
  const [adjustReason, setAdjustReason] = useState('Admin manual adjustment');
  const [pendingAdjustment, setPendingAdjustment] = useState<PendingBalanceAdjustment | null>(null);
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  // Ban State
  const [banSubmitting, setBanSubmitting] = useState(false);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const res = await adminApi.getUsersSummary();
      if (res?.success && res.summary) {
        setSummary(res.summary);
      } else {
        setSummaryError(res?.error || 'Could not load user counts.');
      }
    } catch {
      setSummaryError('Network error loading user counts.');
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // Close confirmation modal on Escape when not actively submitting
  useEffect(() => {
    if (!pendingAdjustment) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !adjustSubmitting) {
        setPendingAdjustment(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pendingAdjustment, adjustSubmitting]);

  const executeLookup = useCallback(
    async (queryToRun: string, silent = false) => {
      const trimmed = queryToRun.trim();
      if (!trimmed) {
        if (!silent) {
          addToast('Enter a 14-digit Website ID, Telegram ID, Email, or @username', 'error');
        }
        return;
      }

      const reqSeq = ++lookupSeqRef.current;
      if (!silent) {
        setLoading(true);
        setSearched(true);
      }
      try {
        const res = await adminApi.searchUser(trimmed);
        if (reqSeq !== lookupSeqRef.current) return;
        if (res?.success && res.user) {
          setUser(res.user);
          setOrders(Array.isArray(res.orders) ? res.orders : []);
          setDeposits(Array.isArray(res.deposits) ? res.deposits : []);
        } else if (!silent) {
          setUser(null);
          setOrders([]);
          setDeposits([]);
          addToast(res?.error || 'User not found in database', 'error');
        }
      } catch {
        if (reqSeq !== lookupSeqRef.current) return;
        if (!silent) {
          setUser(null);
          setOrders([]);
          setDeposits([]);
          addToast('Failed to lookup user', 'error');
        }
      } finally {
        if (!silent && reqSeq === lookupSeqRef.current) setLoading(false);
      }
    },
    [addToast]
  );

  const handleSearchUser = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPendingAdjustment(null);
    await executeLookup(searchQuery, false);
  };

  const handleClearSearch = () => {
    lookupSeqRef.current += 1;
    setLoading(false);
    setSearchQuery('');
    setUser(null);
    setOrders([]);
    setDeposits([]);
    setSearched(false);
    setPendingAdjustment(null);
    setHistoryTab('orders');
  };

  // Step 1 of Balance Adjustment: Validate and open Confirmation Modal (never mutates directly)
  const handleRequestBalanceAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = Math.floor(Number(adjustAmount));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      addToast('Please enter a valid positive whole INR amount', 'error');
      return;
    }

    setPendingAdjustment({
      amount: parsed,
      type: adjustType,
      isPromo: adjustIsPromo,
      reason: adjustReason.trim() || 'Admin manual balance adjustment',
    });
  };

  // Step 2 of Balance Adjustment: Execute ONLY after explicit Admin Confirmation
  const handleConfirmBalanceAdjustment = async () => {
    if (!user || !pendingAdjustment) return;

    setAdjustSubmitting(true);
    try {
      const res = await adminApi.adjustUserBalance({
        user_id: user.user_id,
        amount: pendingAdjustment.amount,
        type: pendingAdjustment.type,
        is_promo: pendingAdjustment.isPromo,
        reason: pendingAdjustment.reason,
      });

      if (res?.success) {
        const nextTotal =
          res.balance !== undefined
            ? res.balance
            : res.new_balance !== undefined
            ? res.new_balance
            : user.balance;
        const nextPromo =
          res.promo_balance !== undefined
            ? res.promo_balance
            : res.new_promo_balance !== undefined
            ? res.new_promo_balance
            : user.promo_balance;
        const nextTrans =
          res.transferable_balance !== undefined
            ? res.transferable_balance
            : Math.max(0, nextTotal - nextPromo);
        const nextSales =
          res.sales_balance !== undefined ? res.sales_balance : user.sales_balance;

        setUser((prev) =>
          prev
            ? {
                ...prev,
                balance: nextTotal,
                promo_balance: nextPromo,
                transferable_balance: nextTrans,
                sales_balance: nextSales,
              }
            : null
        );

        const actionWord = pendingAdjustment.type === 'credit' ? 'Credited' : 'Debited';
        const walletWord = pendingAdjustment.isPromo ? 'Promo' : 'Main';
        const notifyNote =
          res.notified_channel === 'telegram'
            ? ' • Instant Telegram alert sent'
            : ' • Updated in Web wallet ledger';

        addToast(
          `${actionWord} ₹${pendingAdjustment.amount} (${walletWord})${notifyNote}`,
          'success'
        );

        setAdjustAmount('');
        setPendingAdjustment(null);

        // Silently refresh user record so the new deposit audit row & totals reflect immediately
        executeLookup(String(user.user_id), true);
      } else {
        addToast(res?.error || 'Failed to adjust balance', 'error');
      }
    } catch {
      addToast('Error executing balance adjustment', 'error');
    } finally {
      setAdjustSubmitting(false);
    }
  };

  const handleToggleBan = async () => {
    if (!user) return;
    const isCurrentlyBanned = Boolean(user.banned);
    const willBan = !isCurrentlyBanned;
    const targetLabel =
      user.email || (user.username ? `@${user.username}` : `User #${user.user_id}`);
    const confirmMessage = willBan
      ? `Are you sure you want to BAN ${targetLabel} (ID: ${user.user_id})? This will block their store and bot access.`
      : `UNBAN ${targetLabel} (ID: ${user.user_id})? This will restore normal account access.`;

    if (!window.confirm(confirmMessage)) return;

    setBanSubmitting(true);
    try {
      const res = await adminApi.banUser(user.user_id, willBan);
      if (res?.success) {
        addToast(
          willBan ? `User #${user.user_id} has been BANNED.` : `User #${user.user_id} UNBANNED.`,
          willBan ? 'warning' : 'success'
        );
        setUser((prev) => (prev ? { ...prev, banned: willBan } : null));
        loadSummary();
      } else {
        addToast('Failed to update ban status', 'error');
      }
    } catch {
      addToast('Error toggling ban status', 'error');
    } finally {
      setBanSubmitting(false);
    }
  };

  const handleCopyText = (val: string | number, label: string) => {
    navigator.clipboard?.writeText(String(val));
    addToast(`${label} copied`, 'info');
  };

  // Compute live Before -> After preview mirroring backend adjust_user_balance_debit_db / credit_user_balance
  const previewBalances = (() => {
    if (!user || !pendingAdjustment) return null;
    const curTotal = Number(user.balance || 0);
    const curPromo = Number(user.promo_balance || 0);
    const curTrans = Number(
      user.transferable_balance !== undefined
        ? user.transferable_balance
        : Math.max(0, curTotal - curPromo)
    );
    const amt = pendingAdjustment.amount;

    if (pendingAdjustment.type === 'credit') {
      const nextTotal = curTotal + amt;
      const nextPromo = pendingAdjustment.isPromo ? curPromo + amt : curPromo;
      const nextTrans = pendingAdjustment.isPromo ? curTrans : curTrans + amt;
      return {
        curTarget: pendingAdjustment.isPromo ? curPromo : curTrans,
        nextTarget: pendingAdjustment.isPromo ? nextPromo : nextTrans,
        curPromo,
        nextPromo,
        curTotal,
        nextTotal,
        promoSpill: 0,
      };
    }

    // Debit (floored at 0) — exact mirror of admin_repo.adjust_user_balance_debit_db
    if (pendingAdjustment.isPromo) {
      const deducted = Math.min(curPromo, amt);
      const nextPromo = curPromo - deducted;
      const nextTotal = Math.max(0, curTotal - deducted);
      return {
        curTarget: curPromo,
        nextTarget: nextPromo,
        curPromo,
        nextPromo,
        curTotal,
        nextTotal,
        promoSpill: 0,
      };
    }

    // Main Debit deducts from total balance and clamps promo_balance = min(curPromo, nextTotal)
    const deducted = Math.min(curTotal, amt);
    const nextTotal = curTotal - deducted;
    const nextPromo = Math.min(curPromo, nextTotal);
    const nextTrans = Math.max(0, nextTotal - nextPromo);
    const promoSpill = Math.max(0, curPromo - nextPromo);
    return {
      curTarget: curTrans,
      nextTarget: nextTrans,
      curPromo,
      nextPromo,
      curTotal,
      nextTotal,
      promoSpill,
    };
  })();

  const accountType =
    user?.account_type ||
    (user && (user.linked_telegram_id || user.linked_web_id)
      ? 'linked'
      : user && user.user_id >= 90000000000000
      ? 'website'
      : user?.email
      ? 'linked'
      : 'telegram');

  const displayName =
    user?.name ||
    user?.first_name ||
    (accountType === 'website' ? 'Website User' : 'Telegram User');

  const avatarInitials = (
    user?.name ||
    user?.first_name ||
    user?.email ||
    (accountType === 'website' ? 'WB' : 'TG')
  )
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* === 1. USER POPULATION SUMMARY OVERVIEW (Default View Inside Users Tab) === */}
      <div className="bg-[#181820] border border-[#262630] rounded-2xl p-4 sm:p-5 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#8b5cf6]" />
            <div>
              <h2 className="text-sm font-bold text-white leading-tight">
                User Population Overview
              </h2>
              <p className="text-[11px] text-[#a1a1aa]">
                Live breakdown across Bot / Mini App and Website accounts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {summary && summary.banned_users > 0 && (
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
                {summary.banned_users.toLocaleString()} Banned
              </span>
            )}
            <button
              type="button"
              onClick={loadSummary}
              disabled={summaryLoading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#121217] border border-[#262630] hover:border-[#7c3aed]/50 text-[11px] font-semibold text-[#a1a1aa] hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${summaryLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {summaryError && !summary && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/25 text-[11px] text-rose-300">
            <span>{summaryError}</span>
            <button
              type="button"
              onClick={loadSummary}
              className="font-bold underline hover:text-white shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Total Users */}
          <div className="bg-[#121217] border border-[#262630] rounded-xl p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold text-[#a1a1aa]">Total Users</span>
              <Users className="w-3.5 h-3.5 text-[#8b5cf6]" />
            </div>
            <div className="text-lg font-extrabold text-white font-mono">
              {summary ? summary.total_users.toLocaleString() : '—'}
            </div>
            <span className="text-[10px] text-[#71717a]">Unique accounts</span>
          </div>

          {/* Bot / Mini App Users */}
          <div className="bg-[#121217] border border-indigo-500/25 rounded-xl p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold text-indigo-300">Bot / Mini App</span>
              <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="text-lg font-extrabold text-white font-mono">
              {summary ? summary.telegram_users.toLocaleString() : '—'}
            </div>
            <span className="text-[10px] text-[#71717a]">Telegram user IDs</span>
          </div>

          {/* Website Users (14-digit unlinked) */}
          <div className="bg-[#121217] border border-cyan-500/25 rounded-xl p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold text-cyan-300">Website Only</span>
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-lg font-extrabold text-cyan-300 font-mono">
              {summary ? summary.website_users.toLocaleString() : '—'}
            </div>
            <span className="text-[10px] text-[#71717a]">14-digit Web accounts</span>
          </div>

          {/* Linked / Merged Accounts */}
          <div className="bg-[#121217] border border-emerald-500/25 rounded-xl p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold text-emerald-300">Linked (Both)</span>
              <Link2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-lg font-extrabold text-emerald-300 font-mono">
              {summary ? summary.linked_users.toLocaleString() : '—'}
            </div>
            <span className="text-[10px] text-[#71717a]">
              {summary
                ? `${summary.total_web_accessible.toLocaleString()} total web logins`
                : 'Bot + Website merged'}
            </span>
          </div>
        </div>
      </div>

      {/* === 2. UNIFIED USER SEARCH BAR === */}
      <div className="bg-[#181820] border border-[#262630] rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-sm font-bold text-white">Lookup Customer Account</h3>
            <p className="text-[11px] text-[#a1a1aa]">
              Search by 14-digit Website ID, Telegram ID, Email address, or @username. Individual
              user details appear only after searching.
            </p>
          </div>
          {(user || searched) && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#121217] border border-[#262630] hover:border-rose-500/40 text-[11px] font-semibold text-[#a1a1aa] hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>

        <form onSubmit={handleSearchUser} className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#71717a] absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="e.g. 90000000000001, 123456789, user@gmail.com, or @username"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#121217] border border-[#262630] focus:border-[#7c3aed] rounded-xl pl-10 pr-9 py-2.5 text-xs text-white placeholder-[#71717a] outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-[#71717a] hover:text-white"
                aria-label="Clear search query"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold px-5 py-2.5 rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Search className="w-3.5 h-3.5" />
            <span>{loading ? 'Searching...' : 'Lookup User'}</span>
          </button>
        </form>
      </div>

      {/* === 3. SEARCH RESULT STATE (Rendered ONLY After Searching) === */}
      {user && (
        <div className="space-y-5 animate-in zoom-in-95 duration-200">
          {/* 3A. Identity & Platform Profile Card */}
          <div className="bg-[#181820] border border-[#262630] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              {/* Avatar & Identity Info */}
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`w-12 h-12 rounded-2xl shrink-0 flex items-center justify-center text-white font-bold text-base shadow-md ${
                    accountType === 'website'
                      ? 'bg-gradient-to-tr from-cyan-600 to-blue-600'
                      : accountType === 'linked'
                      ? 'bg-gradient-to-tr from-violet-600 to-emerald-500'
                      : 'bg-gradient-to-tr from-[#7c3aed] to-[#3b82f6]'
                  }`}
                >
                  {avatarInitials}
                </div>

                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-white tracking-tight truncate">
                      {displayName}
                    </h3>

                    {/* Account Type Badge */}
                    {accountType === 'website' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                        <Globe className="w-2.5 h-2.5" />
                        Website Only
                      </span>
                    ) : accountType === 'linked' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        <Link2 className="w-2.5 h-2.5" />
                        Linked (Bot + Web)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                        <Smartphone className="w-2.5 h-2.5" />
                        Bot / Mini App
                      </span>
                    )}

                    {/* Active / Banned Status */}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        user.banned
                          ? 'bg-[#ef4444]/15 text-[#ef4444] border-[#ef4444]/30'
                          : 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30'
                      }`}
                    >
                      {user.banned ? 'BANNED' : 'ACTIVE'}
                    </span>
                  </div>

                  {/* Metadata Badges Row */}
                  <div className="flex items-center gap-x-3 gap-y-1 text-xs text-[#a1a1aa] flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleCopyText(user.user_id, 'User ID')}
                      className="font-mono hover:text-white flex items-center gap-1 cursor-pointer text-[#c4b5fd]"
                      title="Click to copy ID"
                    >
                      <span>ID: {user.user_id}</span>
                      <Copy className="w-3 h-3 text-[#71717a]" />
                    </button>

                    {user.linked_telegram_id && user.linked_telegram_id !== user.user_id && (
                      <button
                        type="button"
                        onClick={() => handleCopyText(user.linked_telegram_id!, 'Linked Telegram ID')}
                        className="font-mono hover:text-white flex items-center gap-1 cursor-pointer text-emerald-300 text-[11px]"
                        title="Click to copy Linked Telegram ID"
                      >
                        <Link2 className="w-3 h-3 shrink-0" />
                        <span>TG: {user.linked_telegram_id}</span>
                        <Copy className="w-2.5 h-2.5 text-[#71717a]" />
                      </button>
                    )}

                    {user.linked_web_id && user.linked_web_id !== user.user_id && (
                      <button
                        type="button"
                        onClick={() => handleCopyText(user.linked_web_id!, 'Linked Website ID')}
                        className="font-mono hover:text-white flex items-center gap-1 cursor-pointer text-cyan-300 text-[11px]"
                        title="Click to copy Linked Website ID"
                      >
                        <Globe className="w-3 h-3 shrink-0" />
                        <span>Web: {user.linked_web_id}</span>
                        <Copy className="w-2.5 h-2.5 text-[#71717a]" />
                      </button>
                    )}

                    {user.email && (
                      <button
                        type="button"
                        onClick={() => handleCopyText(user.email!, 'Email')}
                        className="flex items-center gap-1 hover:text-white cursor-pointer"
                        title="Click to copy Email"
                      >
                        <Mail className="w-3 h-3 text-cyan-400 shrink-0" />
                        <span className="truncate max-w-[220px]">{user.email}</span>
                        {user.is_verified && (
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                        )}
                      </button>
                    )}

                    {user.username && (
                      <span className="font-mono text-[#8b5cf6]">@{user.username}</span>
                    )}

                    {user.whatsapp_number && (
                      <span className="flex items-center gap-1 text-emerald-300/90 font-mono text-[11px]">
                        <Phone className="w-3 h-3" />
                        {user.whatsapp_number}
                      </span>
                    )}

                    {user.joined_date && user.joined_date !== 'None' && (
                      <span className="flex items-center gap-1 text-[11px] text-[#71717a]">
                        <Calendar className="w-3 h-3" />
                        Joined: {formatShortDate(user.joined_date)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Ban / Unban Button */}
              <button
                type="button"
                onClick={handleToggleBan}
                disabled={banSubmitting}
                className={`shrink-0 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-md cursor-pointer disabled:opacity-50 ${
                  user.banned
                    ? 'bg-[#22c55e]/20 hover:bg-[#22c55e]/30 text-[#22c55e] border border-[#22c55e]/40'
                    : 'bg-[#ef4444]/20 hover:bg-[#ef4444]/30 text-[#ef4444] border border-[#ef4444]/40'
                }`}
              >
                <Ban className="w-4 h-4" />
                <span>{user.banned ? 'Unban User' : 'Ban User'}</span>
              </button>
            </div>

            {/* 3B. Complete 6-Card Financial & Activity Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
              <div className="bg-[#121217] border border-[#262630] rounded-xl p-3">
                <span className="text-[10px] font-semibold text-[#a1a1aa] block mb-1">
                  Transferable Balance
                </span>
                <span className="text-lg font-bold text-white font-mono block">
                  ₹{(user.transferable_balance ?? user.balance).toLocaleString()}
                </span>
                <span className="text-[10px] text-[#71717a]">Spendable &amp; P2P ready</span>
              </div>

              <div className="bg-[#121217] border border-[#ec4899]/30 rounded-xl p-3">
                <span className="text-[10px] font-semibold text-[#ec4899] block mb-1">
                  Promo Balance
                </span>
                <span className="text-lg font-bold text-[#ec4899] font-mono block">
                  ₹{(user.promo_balance ?? 0).toLocaleString()}
                </span>
                <span className="text-[10px] text-[#71717a]">Locked for store purchases</span>
              </div>

              <div className="bg-[#121217] border border-[#262630] rounded-xl p-3">
                <span className="text-[10px] font-semibold text-[#a1a1aa] block mb-1">
                  Sales / Reseller
                </span>
                <span className="text-lg font-bold text-[#8b5cf6] font-mono block">
                  ₹{(user.sales_balance ?? 0).toLocaleString()}
                </span>
                <span className="text-[10px] text-[#71717a]">Affiliate commissions</span>
              </div>

              <div className="bg-[#121217] border border-[#22c55e]/30 rounded-xl p-3">
                <span className="text-[10px] font-semibold text-[#22c55e] block mb-1">
                  Total Deposited
                </span>
                <span className="text-lg font-bold text-[#22c55e] font-mono block">
                  ₹{(user.total_deposited ?? 0).toLocaleString()}
                </span>
                <span className="text-[10px] text-[#71717a]">Lifetime top-ups</span>
              </div>

              <div className="bg-[#121217] border border-sky-500/30 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-semibold text-sky-300">Total Purchases</span>
                  <ShoppingBag className="w-3 h-3 text-sky-400" />
                </div>
                <span className="text-lg font-bold text-sky-300 font-mono block">
                  {(user.total_orders ?? orders.length).toLocaleString()}
                </span>
                {user.server_breakdown ? (
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5 text-[9px] text-[#71717a] font-mono">
                    <span>S1/2: {user.server_breakdown.server1_2?.orders ?? 0}</span>
                    <span>• S3: {user.server_breakdown.server3?.orders ?? 0}</span>
                    <span>• S4: {user.server_breakdown.server4?.orders ?? 0}</span>
                    <span>• S5: {user.server_breakdown.server5?.orders ?? 0}</span>
                  </div>
                ) : (
                  <span className="text-[10px] text-[#71717a]">Completed orders</span>
                )}
              </div>

              <div className="bg-[#121217] border border-amber-500/30 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-semibold text-amber-300">Total Spent</span>
                  <TrendingUp className="w-3 h-3 text-amber-400" />
                </div>
                <span className="text-lg font-bold text-amber-300 font-mono block">
                  ₹{(user.total_spent ?? 0).toLocaleString()}
                </span>
                <span className="text-[10px] text-[#71717a]">Across all 5 servers</span>
              </div>
            </div>
          </div>

          {/* 3C. Direct Balance Adjustment Form (Triggers Mandatory Confirmation Modal) */}
          <div className="bg-[#181820] border border-[#262630] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-[#8b5cf6]" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Direct Balance Adjustment (Credit / Debit)
                </h4>
              </div>
              <span className="text-[10px] text-[#a1a1aa]">
                Requires confirmation •{' '}
                {accountType === 'website'
                  ? 'Updates web wallet ledger immediately'
                  : 'Notifies user instantly on Telegram'}
              </span>
            </div>

            <form onSubmit={handleRequestBalanceAdjustment} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {/* Credit vs Debit */}
                <div>
                  <label className="text-[11px] font-semibold text-[#a1a1aa] block mb-1">
                    Action Type
                  </label>
                  <div className="flex items-center gap-1 bg-[#121217] p-1 rounded-xl border border-[#262630]">
                    <button
                      type="button"
                      onClick={() => setAdjustType('credit')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        adjustType === 'credit'
                          ? 'bg-[#22c55e] text-black shadow'
                          : 'text-[#a1a1aa]'
                      }`}
                    >
                      + Credit
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustType('debit')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        adjustType === 'debit'
                          ? 'bg-[#ef4444] text-white shadow'
                          : 'text-[#a1a1aa]'
                      }`}
                    >
                      - Debit
                    </button>
                  </div>
                </div>

                {/* Target Balance: Main vs Promo */}
                <div>
                  <label className="text-[11px] font-semibold text-[#a1a1aa] block mb-1">
                    Wallet Target
                  </label>
                  <select
                    value={adjustIsPromo ? 'promo' : 'main'}
                    onChange={(e) => setAdjustIsPromo(e.target.value === 'promo')}
                    style={DARK_SELECT_STYLE}
                    className="w-full bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs text-white outline-none"
                  >
                    <option value="main" className={DARK_OPTION_CLASS}>
                      Main Transferable Balance
                    </option>
                    <option value="promo" className={DARK_OPTION_CLASS}>
                      Promo Balance (Locked)
                    </option>
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <label className="text-[11px] font-semibold text-[#a1a1aa] block mb-1">
                    Amount (INR ₹)
                  </label>
                  <input
                    type="number"
                    placeholder="100"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    required
                    min={1}
                    step={1}
                    className="w-full bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>

                {/* Audit Reason */}
                <div>
                  <label className="text-[11px] font-semibold text-[#a1a1aa] block mb-1">
                    Audit Log Reason
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Compensation / Refund"
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    className="w-full bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={adjustSubmitting}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50 ${
                  adjustType === 'credit'
                    ? 'bg-[#22c55e] hover:bg-[#16a34a] text-black'
                    : 'bg-[#ef4444] hover:bg-[#dc2626] text-white'
                }`}
              >
                {adjustType === 'credit' ? 'Review & Credit Balance' : 'Review & Debit Balance'}
              </button>
            </form>
          </div>

          {/* 3D. Tabbed History Inspector (Purchases & Deposits) */}
          <div className="bg-[#181820] border border-[#262630] rounded-2xl p-4 sm:p-5 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-[#121217] p-1 rounded-xl border border-[#262630]">
                <button
                  type="button"
                  onClick={() => setHistoryTab('orders')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    historyTab === 'orders'
                      ? 'bg-[#7c3aed] text-white shadow'
                      : 'text-[#a1a1aa] hover:text-white'
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Recent Purchases ({orders.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryTab('deposits')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    historyTab === 'deposits'
                      ? 'bg-[#7c3aed] text-white shadow'
                      : 'text-[#a1a1aa] hover:text-white'
                  }`}
                >
                  <ArrowDownCircle className="w-3.5 h-3.5" />
                  <span>Recent Deposits ({deposits.length})</span>
                </button>
              </div>
              <span className="text-[10px] text-[#71717a]">Showing latest 20 records</span>
            </div>

            {historyTab === 'orders' ? (
              orders.length === 0 ? (
                <div className="bg-[#121217] border border-[#262630] rounded-xl p-6 text-center text-xs text-[#71717a]">
                  No purchases found for this account yet.
                </div>
              ) : (
                <div className="rounded-xl border border-[#262630] bg-[#121217] divide-y divide-[#20202a] max-h-80 overflow-y-auto">
                  {orders.map((ord, idx) => {
                    const statusMeta = getOrderStatusMeta(ord);
                    return (
                      <div
                        key={`ord_${ord.server || 'srv'}_${ord.id}_${idx}`}
                        className="p-3 flex items-center justify-between gap-3 hover:bg-[#1a1a24] transition-colors"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-500/15 text-violet-300 border border-violet-500/30">
                              {ord.server || 'Server 1'}
                            </span>
                            <span className="text-xs font-bold text-white truncate max-w-[240px]">
                              {ord.country || 'Service Order'}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${statusMeta.cls}`}
                            >
                              {statusMeta.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-[#a1a1aa] flex-wrap font-mono">
                            <span>#{ord.id}</span>
                            {ord.phone && (
                              <span
                                className="truncate max-w-[180px] sm:max-w-[260px]"
                                title={String(ord.phone)}
                              >
                                • {ord.phone}
                              </span>
                            )}
                            {ord.otp &&
                              ord.otp !== 'WAITING' &&
                              ord.otp !== 'CANCELLED' && (
                                <span className="text-emerald-400">• OTP: {ord.otp}</span>
                              )}
                            <span className="text-[#71717a]">• {formatShortDate(ord.date)}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-extrabold font-mono text-white">
                            ₹{Number(ord.price || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : deposits.length === 0 ? (
              <div className="bg-[#121217] border border-[#262630] rounded-xl p-6 text-center text-xs text-[#71717a]">
                No deposit or balance adjustment records found for this account yet.
              </div>
            ) : (
              <div className="rounded-xl border border-[#262630] bg-[#121217] divide-y divide-[#20202a] max-h-80 overflow-y-auto">
                {deposits.map((dep, idx) => {
                  const statusMeta = getDepositStatusMeta(dep.status);
                  const isNegative = Number(dep.amount || 0) < 0;
                  return (
                    <div
                      key={`dep_${dep.id}_${idx}`}
                      className="p-3 flex items-center justify-between gap-3 hover:bg-[#1a1a24] transition-colors"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-white truncate max-w-[260px]">
                            {dep.method_name || 'Deposit'}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${statusMeta.cls}`}
                          >
                            {statusMeta.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-[#71717a] font-mono">
                          <span>#{dep.id}</span>
                          <span>• {formatShortDate(dep.date)}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`text-xs font-extrabold font-mono ${
                            isNegative ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          {isNegative
                            ? `-₹${Math.abs(Number(dep.amount || 0)).toLocaleString()}`
                            : `+₹${Number(dep.amount || 0).toLocaleString()}`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Not Found State */}
      {!user && searched && !loading && (
        <div className="bg-[#181820] border border-[#262630] rounded-2xl p-8 text-center space-y-2">
          <AlertTriangle className="w-8 h-8 text-[#f59e0b] mx-auto opacity-75" />
          <h4 className="text-sm font-bold text-white">No User Record Found</h4>
          <p className="text-xs text-[#71717a]">
            No account matched "{searchQuery}". Check the 14-digit Website ID, Telegram ID, Email,
            or @username and try again.
          </p>
        </div>
      )}

      {/* === 4. MANDATORY BALANCE ADJUSTMENT CONFIRMATION MODAL === */}
      {user && pendingAdjustment && previewBalances && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => {
            if (!adjustSubmitting) setPendingAdjustment(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[#2e2e40] bg-[#16161f] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-[#262635] flex items-center justify-between bg-[#12121a]">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                    pendingAdjustment.type === 'credit'
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                      : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                  }`}
                >
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Confirm Balance {pendingAdjustment.type === 'credit' ? 'Credit' : 'Debit'}
                  </h3>
                  <p className="text-[11px] text-[#a1a1aa]">
                    Please verify details before applying this change
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={adjustSubmitting}
                onClick={() => setPendingAdjustment(null)}
                className="text-[#a1a1aa] hover:text-white p-1.5 rounded-lg hover:bg-[#20202c] disabled:opacity-40"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-3.5 text-xs">
              <div className="bg-[#121217] border border-[#262630] rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#a1a1aa]">Target User</span>
                  <span className="font-bold text-white text-right truncate max-w-[220px]">
                    {displayName}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#a1a1aa]">Account ID</span>
                  <span className="font-mono text-[#c4b5fd]">{user.user_id}</span>
                </div>
                {user.email && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#a1a1aa]">Email</span>
                    <span className="text-cyan-300 truncate max-w-[220px]">{user.email}</span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#20202a]">
                  <span className="text-[#a1a1aa]">Operation</span>
                  <span
                    className={`font-extrabold font-mono ${
                      pendingAdjustment.type === 'credit' ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {pendingAdjustment.type === 'credit' ? '+' : '-'}₹
                    {pendingAdjustment.amount.toLocaleString()} (
                    {pendingAdjustment.isPromo ? 'Promo' : 'Main'})
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#a1a1aa]">
                    {pendingAdjustment.isPromo ? 'Promo Balance' : 'Transferable Balance'}
                  </span>
                  <span className="font-mono text-white font-bold">
                    ₹{previewBalances.curTarget.toLocaleString()} →{' '}
                    <span
                      className={
                        pendingAdjustment.type === 'credit' ? 'text-emerald-400' : 'text-rose-400'
                      }
                    >
                      ₹{previewBalances.nextTarget.toLocaleString()}
                    </span>
                  </span>
                </div>
                {previewBalances.promoSpill > 0 && (
                  <div className="flex items-center justify-between gap-2 text-amber-300">
                    <span>Promo Balance (Spillover)</span>
                    <span className="font-mono font-bold">
                      ₹{previewBalances.curPromo.toLocaleString()} → ₹
                      {previewBalances.nextPromo.toLocaleString()} (-₹
                      {previewBalances.promoSpill.toLocaleString()})
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#a1a1aa]">Total Balance</span>
                  <span className="font-mono text-white font-bold">
                    ₹{previewBalances.curTotal.toLocaleString()} → ₹
                    {previewBalances.nextTotal.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3 pt-1 border-t border-[#20202a]">
                  <span className="text-[#a1a1aa] shrink-0">Audit Note</span>
                  <span className="text-right text-zinc-200 break-words">
                    {pendingAdjustment.reason}
                  </span>
                </div>
              </div>

              <div className="rounded-xl px-3 py-2.5 bg-violet-500/10 border border-violet-500/25 text-[11px] text-violet-200">
                {accountType === 'website'
                  ? 'This Website-only user has no Telegram chat ID — the updated balance and audit entry will reflect immediately on their website wallet.'
                  : 'An instant Telegram Bot message will be sent to this user immediately after confirming.'}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 border-t border-[#262635] bg-[#12121a] flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={adjustSubmitting}
                onClick={() => setPendingAdjustment(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#a1a1aa] hover:text-white hover:bg-[#20202c] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={adjustSubmitting}
                onClick={handleConfirmBalanceAdjustment}
                className={`px-5 py-2 rounded-xl text-xs font-extrabold transition-all shadow-md cursor-pointer disabled:opacity-50 ${
                  pendingAdjustment.type === 'credit'
                    ? 'bg-[#22c55e] hover:bg-[#16a34a] text-black'
                    : 'bg-[#ef4444] hover:bg-[#dc2626] text-white'
                }`}
              >
                {adjustSubmitting
                  ? 'Applying...'
                  : pendingAdjustment.type === 'credit'
                  ? `Confirm +₹${pendingAdjustment.amount.toLocaleString()} Credit`
                  : `Confirm -₹${pendingAdjustment.amount.toLocaleString()} Debit`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
