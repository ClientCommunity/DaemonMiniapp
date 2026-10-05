import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { server2Catalog } from '../../data/mockData';
import { Server2QualityTier, Server2DeliveryFormat, Server2StockItem } from '../../types';
import { Search, ShoppingBag, Shield, Zap, Package, Plus, Minus, Download } from 'lucide-react';
import { Modal } from '../common/Modal';

export const Server2Sessions: React.FC = () => {
  const { formatPrice, purchaseServer2Session, server2Items, backendConnected } = useApp();

  const [qualityTier, setQualityTier] = useState<Server2QualityTier>('good');
  const [deliveryFormat, setDeliveryFormat] = useState<Server2DeliveryFormat>('account');
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [search, setSearch] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [itemForPurchase, setItemForPurchase] = useState<Server2StockItem | null>(null);

  const years: (number | 'all')[] = ['all', 2021, 2022, 2023, 2024, 2025];

  // Strict real data: when connected to backend, only display real live stock
  const items = backendConnected
    ? server2Items
    : (server2Items && server2Items.length > 0 ? server2Items : server2Catalog);
  const filtered = items.filter((item) => {
    if (item.qualityTier !== qualityTier) return false;
    if (selectedYear !== 'all' && item.accountYear !== selectedYear) return false;
    if (search && !item.country.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleOpenPurchase = (item: Server2StockItem) => {
    setItemForPurchase(item);
    setQuantity(1);
  };

  const handleConfirmPurchase = () => {
    if (!itemForPurchase) return;
    const success = purchaseServer2Session(itemForPurchase, quantity, deliveryFormat);
    if (success) {
      setItemForPurchase(null);
    }
  };

  return (
    <div className="w-full flex flex-col pt-2">
      {/* Quality Tier Segmented Pill Control (Krish's Key Quality Split) */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-[#121217] border border-[#262630] rounded-2xl mb-3">
        <button
          onClick={() => setQualityTier('good')}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
            qualityTier === 'good'
              ? 'bg-emerald-500/20 text-[#22c55e] border border-emerald-500/50 shadow-green-glow/20'
              : 'text-[#a1a1aa] hover:text-white'
          }`}
        >
          <Shield className="w-4 h-4 text-[#22c55e]" />
          <span>Good Quality Accounts</span>
        </button>

        <button
          onClick={() => setQualityTier('cheap')}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
            qualityTier === 'cheap'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50 shadow-amber-glow/20'
              : 'text-[#a1a1aa] hover:text-white'
          }`}
        >
          <Zap className="w-4 h-4 text-amber-400" />
          <span>Cheap Quality Accounts</span>
        </button>
      </div>

      {/* Delivery Format Selector */}
      <div className="flex items-center gap-2 mb-3 bg-[#181820] p-1.5 rounded-xl border border-[#262630]">
        <span className="text-[10px] font-bold text-[#a1a1aa] uppercase px-2">Delivery:</span>
        <button
          onClick={() => setDeliveryFormat('account')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            deliveryFormat === 'account'
              ? 'bg-[#7c3aed] text-white shadow-violet-glow-sm'
              : 'text-[#a1a1aa] hover:text-white'
          }`}
        >
          👤 Single Account (OTP)
        </button>
        <button
          onClick={() => setDeliveryFormat('session')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            deliveryFormat === 'session'
              ? 'bg-[#7c3aed] text-white shadow-violet-glow-sm'
              : 'text-[#a1a1aa] hover:text-white'
          }`}
        >
          📁 Session (.session / ZIP)
        </button>
      </div>

      {/* Year Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2 mb-2">
        <span className="text-[10px] text-[#a1a1aa] uppercase font-bold shrink-0 mr-1">Year:</span>
        {years.map((y) => (
          <button
            key={String(y)}
            onClick={() => setSelectedYear(y)}
            className={`px-3 py-1 rounded-lg text-xs font-bold shrink-0 border transition-all ${
              selectedYear === y
                ? 'bg-[#7c3aed]/25 border-[#7c3aed] text-white'
                : 'bg-[#181820] border-[#262630] text-[#a1a1aa] hover:text-white'
            }`}
          >
            {y === 'all' ? 'All Years' : y}
          </button>
        ))}
      </div>

      {/* Country Search */}
      <div className="relative mb-3">
        <Search className="w-4 h-4 text-[#a1a1aa] absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter country (India, Vietnam, etc.)..."
          className="w-full bg-[#181820] border border-[#262630] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-[#a1a1aa] focus:outline-none focus:border-[#7c3aed] transition-colors"
        />
      </div>

      {/* Catalog List */}
      <div className="grid grid-cols-1 gap-2.5">
        {filtered.map((item) => (
          <div
            key={item.id}
            onClick={() => handleOpenPurchase(item)}
            className="flex items-center justify-between p-3.5 rounded-2xl bg-[#181820] border border-[#262630] hover:border-[#7c3aed]/50 transition-all cursor-pointer active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{item.icon}</span>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-white">{item.country}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#262630] text-[#a1a1aa] font-mono">
                    {item.accountYear}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-[#a1a1aa] mt-0.5">
                  <span>Stock: {item.stockCount}</span>
                  <span>•</span>
                  <span className={item.qualityTier === 'good' ? 'text-[#22c55e]' : 'text-amber-400'}>
                    {item.subtitle}
                  </span>
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
                  handleOpenPurchase(item);
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
            <Package className="w-8 h-8 text-[#8b5cf6]/50 mb-1" />
            <span className="text-sm font-bold text-white">No Server 2 accounts in stock</span>
            <span className="text-xs">Stock is uploaded periodically by administrators. Check back soon.</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center bg-[#181820] border border-[#262630] rounded-2xl text-xs text-[#a1a1aa]">
            No accounts match current filters.
          </div>
        ) : null}
      </div>

      {/* Purchase Modal with Quantity & Bulk ZIP Badge */}
      <Modal
        isOpen={!!itemForPurchase}
        onClose={() => setItemForPurchase(null)}
        title="Purchase Local Sessions"
        subtitle={itemForPurchase ? `${itemForPurchase.country} (${itemForPurchase.accountYear})` : ''}
      >
        {itemForPurchase && (
          <div className="flex flex-col gap-4">
            {/* Summary card */}
            <div className="p-3 bg-[#0b0b0e] border border-[#262630] rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{itemForPurchase.icon}</span>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white">
                    {itemForPurchase.country} Telegram
                  </span>
                  <span className="text-[10px] text-[#a1a1aa]">
                    Tier: {itemForPurchase.qualityTier === 'good' ? '🟢 Good Quality' : '🟡 Cheap Quality'}
                  </span>
                </div>
              </div>
              <div className="text-sm font-mono font-bold text-[#22c55e]">
                {formatPrice(itemForPurchase.priceInr)} / unit
              </div>
            </div>

            {/* Quantity Stepper (Especially for bulk sessions) */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#181820] border border-[#262630]">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white">Quantity</span>
                <span className="text-[10px] text-[#a1a1aa]">Select number of accounts</span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded-lg bg-[#1f1f2a] border border-[#262630] flex items-center justify-center text-white hover:bg-[#262630] active:scale-95"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="text-sm font-mono font-bold text-white w-6 text-center">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity((q) => Math.min(itemForPurchase.stockCount, q + 1))}
                  className="w-8 h-8 rounded-lg bg-[#1f1f2a] border border-[#262630] flex items-center justify-center text-white hover:bg-[#262630] active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Bulk ZIP package badge */}
            {quantity > 1 ? (
              <div className="p-3 bg-[#7c3aed]/15 border border-[#7c3aed]/40 rounded-xl flex items-center gap-2.5">
                <Package className="w-5 h-5 text-[#8b5cf6] shrink-0" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white">
                    📦 Bulk ZIP Archive Delivery
                  </span>
                  <span className="text-[10px] text-[#d1d5db]">
                    Bundled .ZIP archive containing {quantity} individual session strings + 2FA keys.
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-[#1f1f2a]/60 border border-[#262630] rounded-xl flex items-center gap-2 text-xs text-[#a1a1aa]">
                <Download className="w-4 h-4 text-[#22c55e] shrink-0" />
                <span>Instant single session file delivery after purchase.</span>
              </div>
            )}

            {/* Total Price & Confirmation */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#0b0b0e] border border-[#262630]">
              <span className="text-xs font-bold text-white">Total Amount</span>
              <span className="text-lg font-extrabold text-[#22c55e] font-mono">
                {formatPrice(itemForPurchase.priceInr * quantity)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                onClick={() => setItemForPurchase(null)}
                className="py-2.5 rounded-xl bg-[#1f1f2a] border border-[#262630] text-xs font-semibold text-[#a1a1aa] hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPurchase}
                className="py-2.5 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-xs font-bold text-white shadow-violet-glow-sm active:scale-95 transition-all"
              >
                Confirm & Pay
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
