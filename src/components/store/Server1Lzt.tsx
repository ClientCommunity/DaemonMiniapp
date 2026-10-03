import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { server1Catalog } from '../../data/mockData';
import { Server1AccountItem } from '../../types';
import { Search, ShoppingBag, ShieldCheck, Key, Phone, Download, Check, Copy } from 'lucide-react';
import { Modal } from '../common/Modal';

export const Server1Lzt: React.FC = () => {
  const {
    formatPrice,
    purchaseServer1Account,
    purchasedCredentialsModal,
    closeCredentialsModal,
    addToast
  } = useApp();

  const [search, setSearch] = useState('');
  const [selectedForPurchase, setSelectedForPurchase] = useState<Server1AccountItem | null>(null);

  // Filter accounts
  const filtered = server1Catalog.filter((item) =>
    item.country.toLowerCase().includes(search.toLowerCase())
  );

  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copied2Fa, setCopied2Fa] = useState(false);

  const handleConfirmBuy = () => {
    if (!selectedForPurchase) return;
    const success = purchaseServer1Account(selectedForPurchase);
    if (success) {
      setSelectedForPurchase(null);
    }
  };

  const handleDownloadSession = (country: string) => {
    const fakeContent = `TELETHON_SESSION_DATA_FOR_${country.toUpperCase()}_ACCOUNT_STRING_PREVIEW_XYZ123`;
    const blob = new Blob([fakeContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `session_${country.toLowerCase()}_2fa.session`;
    link.click();
    URL.revokeObjectURL(url);
    addToast('Downloaded session file successfully!', 'success', 'Saved');
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
            className="flex items-center justify-between p-3.5 rounded-2xl bg-[#181820] border border-[#262630] hover:border-[#383848] transition-all"
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
                onClick={() => setSelectedForPurchase(item)}
                className="flex items-center gap-1 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-semibold px-3 py-1.5 rounded-xl shadow-sm transition-all active:scale-95"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Buy</span>
              </button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="p-8 text-center bg-[#181820] border border-[#262630] rounded-2xl text-xs text-[#a1a1aa]">
            No accounts match your search query.
          </div>
        )}
      </div>

      {/* Confirmation Purchase Modal */}
      <Modal
        isOpen={!!selectedForPurchase}
        onClose={() => setSelectedForPurchase(null)}
        title="Confirm Account Purchase"
        subtitle="Review account details before balance deduction"
      >
        {selectedForPurchase && (
          <div className="flex flex-col gap-4">
            <div className="p-3 rounded-xl bg-[#0b0b0e] border border-[#262630] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{selectedForPurchase.icon}</span>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white">
                    {selectedForPurchase.country} Telegram
                  </span>
                  <span className="text-[11px] text-[#a1a1aa]">
                    Format: {selectedForPurchase.format}
                  </span>
                </div>
              </div>
              <div className="text-base font-extrabold text-[#22c55e] font-mono">
                {formatPrice(selectedForPurchase.priceInr)}
              </div>
            </div>

            <div className="text-xs text-[#a1a1aa] bg-[#1f1f2a]/50 p-3 rounded-xl border border-[#262630] flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-white font-semibold">
                <ShieldCheck className="w-4 h-4 text-[#22c55e]" />
                <span>Instant Account Guarantee</span>
              </div>
              <p>
                Credentials and session files will be delivered immediately on screen and saved in your Order History.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                onClick={() => setSelectedForPurchase(null)}
                className="py-2.5 rounded-xl bg-[#1f1f2a] border border-[#262630] text-xs font-semibold text-[#a1a1aa] hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBuy}
                className="py-2.5 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-xs font-bold text-white shadow-violet-glow-sm active:scale-95 transition-all"
              >
                Confirm & Pay
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Account Credential View Modal */}
      <Modal
        isOpen={!!purchasedCredentialsModal?.isOpen}
        onClose={closeCredentialsModal}
        title="🎉 Account Delivered!"
        subtitle={`Order ID: ${purchasedCredentialsModal?.orderId || 'S1_000000'}`}
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

            {/* Instruction */}
            <div className="p-3 bg-[#181820] border border-[#262630] rounded-xl text-xs text-[#a1a1aa]">
              <span className="font-semibold text-white block mb-1">Login Guidance:</span>
              {purchasedCredentialsModal.account.credentialsSample?.loginInstruction ||
                'Import the downloaded .session into your client or enter the phone number with 2FA password.'}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => handleDownloadSession(purchasedCredentialsModal.account!.country)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold text-xs shadow-green-glow transition-all active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Download .Session File</span>
              </button>
              <button
                onClick={closeCredentialsModal}
                className="w-full py-2.5 rounded-xl bg-[#1f1f2a] border border-[#262630] text-xs font-semibold text-white hover:bg-[#262630]"
              >
                Done / Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
