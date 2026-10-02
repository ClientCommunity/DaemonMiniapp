import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../common/Modal';
import { Send, Lock, AlertCircle } from 'lucide-react';

interface P2PTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const P2PTransferModal: React.FC<P2PTransferModalProps> = ({ isOpen, onClose }) => {
  const { user, transferableBalance, formatPrice, transferP2P } = useApp();

  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const numAmount = Number(amount) || 0;
  const isAmountOverTransferable = numAmount > transferableBalance;
  const isAmountZeroOrNegative = numAmount <= 0;

  const handleMaxClick = () => {
    setAmount(transferableBalance);
    setErrorText(null);
  };

  const handleProceedClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient.trim()) {
      setErrorText('Please enter a recipient Telegram ID or @username.');
      return;
    }
    if (isAmountZeroOrNegative) {
      setErrorText('Transfer amount must be greater than ₹0.');
      return;
    }
    if (isAmountOverTransferable) {
      setErrorText(`Promo balance is locked. You can only transfer up to ₹${transferableBalance}.`);
      return;
    }
    setErrorText(null);
    setShowConfirmation(true);
  };

  const handleConfirmTransfer = () => {
    const result = transferP2P(recipient, numAmount);
    if (result.success) {
      setShowConfirmation(false);
      setRecipient('');
      setAmount('');
      onClose();
    } else {
      setErrorText(result.message);
      setShowConfirmation(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setShowConfirmation(false);
        setErrorText(null);
        onClose();
      }}
      title="P2P Balance Transfer"
      subtitle="Instantly send transferable balance to any Telegram user"
    >
      {!showConfirmation ? (
        <form onSubmit={handleProceedClick} className="flex flex-col gap-3.5">
          {/* Transferable Balance Header Card */}
          <div className="p-3.5 rounded-2xl bg-[#0b0b0e] border border-[#262630] flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-[#a1a1aa]">
                Available Transferable Balance
              </span>
              <span className="text-xl font-extrabold text-[#22c55e] font-mono">
                {formatPrice(transferableBalance)}
              </span>
            </div>
            <button
              type="button"
              onClick={handleMaxClick}
              className="px-2.5 py-1 rounded-lg bg-[#22c55e]/15 border border-[#22c55e]/30 text-[#22c55e] font-bold text-xs hover:bg-[#22c55e]/25 transition-colors"
            >
              USE MAX
            </button>
          </div>

          {/* Locked Promo Warning Callout */}
          <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-300">
            <Lock className="w-4 h-4 text-[#f59e0b] shrink-0 mt-0.5" />
            <div className="flex flex-col leading-snug">
              <span className="font-bold text-[#f59e0b]">Promo Balance Locked</span>
              <span className="text-[11px] text-amber-200/90 mt-0.5">
                Promo funds ({formatPrice(user.promoBalance)}) are strictly non-transferable and can only be used for store purchases.
              </span>
            </div>
          </div>

          {/* Recipient Input */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-white">Recipient User</label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => {
                setRecipient(e.target.value);
                setErrorText(null);
              }}
              placeholder="e.g. 7507183871 or @username"
              className="w-full bg-[#181820] border border-[#262630] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#a1a1aa] focus:outline-none focus:border-[#7c3aed]"
              required
            />
          </div>

          {/* Amount Input */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-white">Amount (INR)</span>
              <span className="text-[#a1a1aa] text-[10px]">Zero Transfer Fee</span>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#22c55e]">
                ₹
              </span>
              <input
                type="number"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value === '' ? '' : Number(e.target.value));
                  setErrorText(null);
                }}
                placeholder="Enter amount"
                className={`w-full bg-[#181820] border rounded-xl pl-8 pr-4 py-2.5 text-xs font-mono font-bold text-white focus:outline-none transition-colors ${
                  isAmountOverTransferable
                    ? 'border-[#ef4444] text-[#ef4444]'
                    : 'border-[#262630] focus:border-[#7c3aed]'
                }`}
                required
              />
            </div>
          </div>

          {/* Inline Validation Error */}
          {(isAmountOverTransferable || errorText) && (
            <div className="p-2.5 rounded-xl bg-red-950/20 border border-red-500/40 flex items-center gap-2 text-xs text-[#ef4444]">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                {errorText || `Amount exceeds transferable balance. Promo balance is locked.`}
              </span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isAmountOverTransferable || isAmountZeroOrNegative || !recipient.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold text-xs shadow-violet-glow transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none mt-2"
          >
            <Send className="w-4 h-4" />
            <span>Continue to Confirmation</span>
          </button>
        </form>
      ) : (
        /* Confirmation step */
        <div className="flex flex-col gap-4">
          <div className="p-4 rounded-2xl bg-[#0b0b0e] border border-[#262630] flex flex-col items-center text-center">
            <span className="text-[10px] text-[#a1a1aa] uppercase font-bold">Transfer Amount</span>
            <span className="text-3xl font-extrabold text-[#22c55e] font-mono mt-1">
              ₹{numAmount.toLocaleString('en-IN')}
            </span>
            <span className="text-xs text-white mt-1">Recipient: <span className="font-mono text-[#8b5cf6]">{recipient}</span></span>
          </div>

          <div className="p-3 bg-[#181820] border border-[#262630] rounded-xl flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between text-[#a1a1aa]">
              <span>Transfer Fee:</span>
              <span className="text-[#22c55e] font-semibold">₹0.00 (Free)</span>
            </div>
            <div className="flex items-center justify-between text-[#a1a1aa]">
              <span>Source Bucket:</span>
              <span className="text-white font-semibold">Transferable Main Balance</span>
            </div>
            <div className="flex items-center justify-between text-[#a1a1aa]">
              <span>Remaining Balance:</span>
              <span className="text-white font-mono">{formatPrice(user.balance - numAmount)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              onClick={() => setShowConfirmation(false)}
              className="py-2.5 rounded-xl bg-[#1f1f2a] border border-[#262630] text-xs font-semibold text-[#a1a1aa] hover:text-white"
            >
              Back
            </button>
            <button
              onClick={handleConfirmTransfer}
              className="py-2.5 rounded-xl bg-[#22c55e] hover:bg-[#16a34a] text-black font-extrabold text-xs shadow-green-glow transition-all active:scale-95"
            >
              Confirm & Dispatch
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
