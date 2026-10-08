import React, { useState } from 'react';
import {
  adminApi,
  AdminUserInfo,
} from '../../../api/adminApi';
import { useApp } from '../../../context/AppContext';
import {
  Search,
  Wallet,
  Copy,
  Ban,
  AlertTriangle,
} from 'lucide-react';

export const UserManagementTab: React.FC = () => {
  const { addToast } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<AdminUserInfo | null>(null);
  const [searched, setSearched] = useState(false);

  // Balance Adjustment Form State
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustType, setAdjustType] = useState<'credit' | 'debit'>('credit');
  const [adjustIsPromo, setAdjustIsPromo] = useState(false);
  const [adjustReason, setAdjustReason] = useState('Admin manual adjustment');
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  // Ban Confirmation State
  const [banSubmitting, setBanSubmitting] = useState(false);

  const handleSearchUser = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) {
      addToast('Please enter a Telegram User ID or username', 'error');
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const res = await adminApi.searchUser(searchQuery.trim());
      if (res?.success && res.user) {
        setUser(res.user);
      } else {
        setUser(null);
        addToast(res?.error || 'User not found in database', 'error');
      }
    } catch {
      setUser(null);
      addToast('Failed to lookup user', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const amount = parseFloat(adjustAmount);
    if (isNaN(amount) || amount <= 0) {
      addToast('Please enter a valid positive amount', 'error');
      return;
    }

    setAdjustSubmitting(true);
    try {
      const res = await adminApi.adjustUserBalance({
        user_id: user.user_id,
        amount,
        type: adjustType,
        is_promo: adjustIsPromo,
        reason: adjustReason.trim() || 'Admin manual balance adjustment',
      });

      if (res?.success) {
        addToast(
          `Successfully ${adjustType === 'credit' ? 'credited' : 'debited'} ₹${amount} (${
            adjustIsPromo ? 'Promo' : 'Main'
          })`,
          'success'
        );
        // Update local user state immediately
        setUser((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            balance: res.new_balance !== undefined ? res.new_balance : prev.balance,
            promo_balance:
              res.new_promo_balance !== undefined ? res.new_promo_balance : prev.promo_balance,
            transferable_balance:
              res.new_balance !== undefined && res.new_promo_balance !== undefined
                ? Math.max(0, res.new_balance - res.new_promo_balance)
                : prev.transferable_balance,
          };
        });
        setAdjustAmount('');
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
    const willBan = !user.banned;
    const confirmMessage = willBan
      ? `Are you sure you want to BAN User #${user.user_id} (@${user.username || 'unknown'})? This will block their bot and store access.`
      : `UNBAN User #${user.user_id}? This will restore normal account access.`;

    if (!window.confirm(confirmMessage)) return;

    setBanSubmitting(true);
    try {
      const res = await adminApi.banUser(user.user_id, willBan);
      if (res?.success) {
        setUser((prev) => (prev ? { ...prev, banned: res.banned ? 1 : 0 } : null));
        addToast(
          res.banned ? `User #${user.user_id} has been BANNED` : `User #${user.user_id} has been UNBANNED`,
          res.banned ? 'error' : 'success'
        );
      } else {
        addToast('Failed to update ban status', 'error');
      }
    } catch {
      addToast('Error toggling ban state', 'error');
    } finally {
      setBanSubmitting(false);
    }
  };

  const handleCopyId = (id: number) => {
    navigator.clipboard?.writeText(String(id));
    addToast(`Telegram ID ${id} copied!`, 'info', 'Copied');
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Search Header Banner */}
      <div className="bg-[#181820] border border-[#262630] rounded-2xl p-5 shadow-sm space-y-3">
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight">
            User Lookup & Wallet Administration
          </h3>
          <p className="text-xs text-[#a1a1aa]">
            Search by Telegram User ID or username to inspect wallets, adjust balances, and manage account ban status.
          </p>
        </div>

        <form onSubmit={handleSearchUser} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#71717a]" />
            <input
              type="text"
              placeholder="Enter Telegram ID (e.g. 7507183871) or @username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#121217] border border-[#262630] focus:border-[#7c3aed] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-[#71717a] outline-none transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold px-5 py-2.5 rounded-xl text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Lookup User'}
          </button>
        </form>
      </div>

      {/* User Found Profile Details */}
      {user && (
        <div className="space-y-5 animate-in zoom-in-95 duration-200">
          {/* Main User Profile Card */}
          <div className="bg-[#181820] border border-[#262630] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Avatar & User Details */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#7c3aed] to-[#3b82f6] flex items-center justify-center text-white font-bold text-base shadow-md">
                  {user.first_name ? user.first_name.substring(0, 2).toUpperCase() : 'TG'}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white tracking-tight">
                      {user.first_name || 'Telegram User'}
                    </h3>
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

                  <div className="flex items-center gap-2 text-xs text-[#a1a1aa] mt-0.5">
                    <span className="font-mono text-[#8b5cf6]">
                      {user.username ? `@${user.username}` : 'No username'}
                    </span>
                    <span>•</span>
                    <button
                      onClick={() => handleCopyId(user.user_id)}
                      className="font-mono hover:text-white flex items-center gap-1 cursor-pointer"
                      title="Click to copy ID"
                    >
                      <span>ID: {user.user_id}</span>
                      <Copy className="w-3 h-3 text-[#71717a]" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Ban / Unban Button */}
              <button
                onClick={handleToggleBan}
                disabled={banSubmitting}
                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-md cursor-pointer ${
                  user.banned
                    ? 'bg-[#22c55e]/20 hover:bg-[#22c55e]/30 text-[#22c55e] border border-[#22c55e]/40'
                    : 'bg-[#ef4444]/20 hover:bg-[#ef4444]/30 text-[#ef4444] border border-[#ef4444]/40'
                }`}
              >
                <Ban className="w-4 h-4" />
                <span>{user.banned ? 'Unban User' : 'Ban User'}</span>
              </button>
            </div>

            {/* Wallet Balances 4-Card Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
              <div className="bg-[#121217] border border-[#262630] rounded-xl p-3">
                <span className="text-[10px] font-semibold text-[#a1a1aa] block mb-1">
                  Transferable Balance
                </span>
                <span className="text-lg font-bold text-white block">
                  ₹{user.transferable_balance ?? user.balance}
                </span>
                <span className="text-[10px] text-[#71717a]">Can be spent or sent P2P</span>
              </div>

              <div className="bg-[#121217] border border-[#ec4899]/30 rounded-xl p-3">
                <span className="text-[10px] font-semibold text-[#ec4899] block mb-1">
                  Promo Balance
                </span>
                <span className="text-lg font-bold text-[#ec4899] block">
                  ₹{user.promo_balance}
                </span>
                <span className="text-[10px] text-[#71717a]">Locked for store purchases</span>
              </div>

              <div className="bg-[#121217] border border-[#262630] rounded-xl p-3">
                <span className="text-[10px] font-semibold text-[#a1a1aa] block mb-1">
                  Sales / Reseller
                </span>
                <span className="text-lg font-bold text-[#8b5cf6] block">
                  ₹{user.sales_balance ?? 0}
                </span>
                <span className="text-[10px] text-[#71717a]">Affiliate commissions</span>
              </div>

              <div className="bg-[#121217] border border-[#22c55e]/30 rounded-xl p-3">
                <span className="text-[10px] font-semibold text-[#22c55e] block mb-1">
                  Total Deposited
                </span>
                <span className="text-lg font-bold text-[#22c55e] block">
                  ₹{user.total_deposited}
                </span>
                <span className="text-[10px] text-[#71717a]">Lifetime total topups</span>
              </div>
            </div>
          </div>

          {/* Balance Adjustment Section */}
          <div className="bg-[#181820] border border-[#262630] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-[#8b5cf6]" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Direct Balance Adjustment (Credit / Debit)
              </h4>
            </div>

            <form onSubmit={handleAdjustBalance} className="space-y-4">
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
                    className="w-full bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs text-white outline-none"
                  >
                    <option value="main">Main Transferable Balance</option>
                    <option value="promo">Promo Balance (Locked)</option>
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
                {adjustSubmitting
                  ? 'Processing...'
                  : `${adjustType === 'credit' ? 'Credit' : 'Debit'} User Balance`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* No user searched yet or empty state */}
      {!user && searched && !loading && (
        <div className="bg-[#181820] border border-[#262630] rounded-2xl p-8 text-center space-y-2">
          <AlertTriangle className="w-8 h-8 text-[#f59e0b] mx-auto opacity-75" />
          <h4 className="text-sm font-bold text-white">No User Record Found</h4>
          <p className="text-xs text-[#71717a]">
            No account matched query "{searchQuery}". Check the Telegram ID or username and try again.
          </p>
        </div>
      )}
    </div>
  );
};
