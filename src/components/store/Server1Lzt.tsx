import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { otpApi, downloadApi } from '../../api/endpoints';
import { Server1AccountItem } from '../../types';
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
  Clock
} from 'lucide-react';
import { Modal } from '../common/Modal';

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
  } = useApp();

  const [search, setSearch] = useState('');
  const [selectedForPurchase, setSelectedForPurchase] = useState<Server1AccountItem | null>(null);

  // Strict real data: display live stock from server1Items
  const items = server1Items;
  const filtered = items.filter((item) =>
    item.country.toLowerCase().includes(search.toLowerCase())
  );

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
    if (!selectedForPurchase) return;
    const success = purchaseServer1Account(selectedForPurchase);
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
      const res = await otpApi.getStatus(phoneOrId);
      if (res && (res.status === 'completed' || res.status === 'delivered') && res.otp) {
        setFetchedOtp(res.otp);
        setOtpNotice(null);
        try {
          if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
          }
        } catch {}
        addToast(`Telegram Login Code received: ${res.otp}`, 'success', 'Code Received!');
      } else {
        setOtpNotice('⏳ Code not received yet. Request the login code inside official Telegram for this number, then tap Fetch again.');
        addToast('No new login code detected yet. Request code in Telegram app first.', 'info');
      }
    } catch {
      setOtpNotice('Network error while checking for login code. Please tap Fetch again.');
      addToast('Failed to check login code. Try again.', 'error');
    } finally {
      setIsFetchingOtp(false);
    }
  };

  return (
    <div className="w-full flex flex-col pt-2">
      {/* Banner / Intro */}
      <div className="p-3 mb-3 rounded-2xl bg-[#181820] border border-[#262630] flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-white">Server 1: Global 2FA Accounts</span>
          <span className="text-[11px] text-[#a1a1aa]">
            Global aged Telegram accounts with instant 2FA credentials
          </span>
        </div>
        <div className="px-2 py-1 rounded-lg bg-[#22c55e]/15 border border-[#22c55e]/30 text-[#22c55e] text-[10px] font-bold">
          High Trust
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-3">
        <Search className="w-4 h-4 text-[#a1a1aa] absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search country (e.g. India, USA)..."
          className="w-full bg-[#181820] border border-[#262630] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-[#a1a1aa] focus:outline-none focus:border-[#7c3aed] transition-colors"
        />
      </div>

      {/* Accounts Catalog Grid */}
      <div className="grid grid-cols-1 gap-2.5">
        {filtered.map((item) => (
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
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#7c3aed]/20 text-[#8b5cf6] font-semibold border border-[#7c3aed]/30">
                    {item.format}
                  </span>
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

        {items.length === 0 ? (
          <div className="p-8 text-center bg-[#181820] border border-[#262630] rounded-2xl flex flex-col items-center gap-2 text-[#a1a1aa]">
            <Globe className="w-8 h-8 text-[#8b5cf6]/50 mb-1" />
            <span className="text-sm font-bold text-white">No Server 1 stock available</span>
            <span className="text-xs">Market inventory is refreshing or currently out of stock.</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center bg-[#181820] border border-[#262630] rounded-2xl text-xs text-[#a1a1aa]">
            No accounts match your search query.
          </div>
        ) : null}
      </div>

      {/* Confirmation Purchase Modal */}
      <Modal
        isOpen={!!selectedForPurchase}
        onClose={() => setSelectedForPurchase(null)}
        title="Confirm Account Purchase"
        subtitle="Review account details before balance deduction"
        footer={
          selectedForPurchase ? (
            <div className="grid grid-cols-2 gap-3 w-full">
              <button
                type="button"
                onClick={() => setSelectedForPurchase(null)}
                className="py-3.5 rounded-xl bg-[#1f1f2a] border border-[#262630] text-xs font-bold text-[#a1a1aa] hover:text-white active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBuy}
                disabled={user.balance < selectedForPurchase.priceInr}
                className="py-3.5 rounded-xl bg-gradient-to-r from-[#22c55e] to-[#16a34a] hover:from-[#16a34a] hover:to-[#15803d] text-black font-extrabold text-xs shadow-green-glow active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:grayscale"
              >
                <Check className="w-4 h-4 text-black stroke-[3]" />
                <span>Confirm & Pay ({formatPrice(selectedForPurchase.priceInr)})</span>
              </button>
            </div>
          ) : undefined
        }
      >
        {selectedForPurchase && (
          <div className="flex flex-col gap-3.5">
            <div className="p-3.5 rounded-2xl bg-[#0b0b0e] border border-[#262630] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{selectedForPurchase.icon}</span>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white">
                    {selectedForPurchase.country} Telegram
                  </span>
                  <span className="text-[11px] text-[#a1a1aa]">
                    Format: {selectedForPurchase.format}
                  </span>
                </div>
              </div>
              <div className="text-lg font-extrabold text-[#22c55e] font-mono">
                {formatPrice(selectedForPurchase.priceInr)}
              </div>
            </div>

            {/* Wallet Balance & Deduction Breakdown */}
            <div className="p-3 bg-[#181820] border border-[#262630] rounded-xl flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between text-[#a1a1aa]">
                <span>Your Wallet Balance:</span>
                <span className="text-white font-mono font-bold">{formatPrice(user.balance)}</span>
              </div>
              <div className="flex items-center justify-between text-[#a1a1aa]">
                <span>Cost Deduction:</span>
                <span className="text-[#ef4444] font-mono font-bold">-{formatPrice(selectedForPurchase.priceInr)}</span>
              </div>
              <div className="flex items-center justify-between pt-1.5 border-t border-[#262630] text-[#a1a1aa]">
                <span>Balance After Purchase:</span>
                <span className="text-[#22c55e] font-mono font-bold">
                  {formatPrice(Math.max(0, user.balance - selectedForPurchase.priceInr))}
                </span>
              </div>
            </div>

            {user.balance < selectedForPurchase.priceInr ? (
              <div className="p-3 bg-red-950/20 border border-red-500/40 rounded-xl text-xs text-[#ef4444] flex items-center justify-between">
                <span>⚠️ Insufficient balance for this account.</span>
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
        title="🎉 Account Delivered!"
        subtitle={`Order ID: ${purchasedCredentialsModal?.orderId || 'S1_000000'}`}
        footer={
          <button
            onClick={closeCredentialsModal}
            className="w-full py-3 rounded-xl bg-[#1f1f2a] border border-[#262630] text-xs font-semibold text-white hover:bg-[#262630] active:scale-95 transition-all"
          >
            Done / Close
          </button>
        }
      >
        {purchasedCredentialsModal?.account && (
          <div className="flex flex-col gap-3.5">
            <div className="p-3 bg-[#22c55e]/10 border border-[#22c55e]/30 rounded-xl flex items-center gap-2 text-xs text-[#22c55e] font-semibold">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Ready for login. Save your credentials below!</span>
            </div>

            {/* Phone row */}
            <div className="p-3 bg-[#0b0b0e] border border-[#262630] rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#8b5cf6]" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-[#a1a1aa] uppercase font-semibold">Phone Number</span>
                  <span className="text-xs font-mono font-bold text-white">
                    {purchasedCredentialsModal.account.credentialsSample?.phone || '+91 98234 19283'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    purchasedCredentialsModal.account?.credentialsSample?.phone || '+91 98234 19283'
                  );
                  setCopiedPhone(true);
                  setTimeout(() => setCopiedPhone(false), 2000);
                }}
                className="p-1.5 rounded-lg bg-[#181820] border border-[#262630] text-[#a1a1aa] hover:text-white"
              >
                {copiedPhone ? <Check className="w-4 h-4 text-[#22c55e]" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            {/* 2FA Password row */}
            <div className="p-3 bg-[#0b0b0e] border border-[#262630] rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-[#f59e0b]" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-[#a1a1aa] uppercase font-semibold">2FA Password</span>
                  <span className="text-xs font-mono font-bold text-white">
                    {purchasedCredentialsModal.account.credentialsSample?.twoFa || 'krish@2024TG'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    purchasedCredentialsModal.account?.credentialsSample?.twoFa || 'krish@2024TG'
                  );
                  setCopied2Fa(true);
                  setTimeout(() => setCopied2Fa(false), 2000);
                }}
                className="p-1.5 rounded-lg bg-[#181820] border border-[#262630] text-[#a1a1aa] hover:text-white"
              >
                {copied2Fa ? <Check className="w-4 h-4 text-[#22c55e]" /> : <Copy className="w-4 h-4" />}
              </button>
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
                      <span>📩 Fetch Telegram Login Code</span>
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
    </div>
  );
};
