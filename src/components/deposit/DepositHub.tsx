import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PaymentMethodType } from '../../types';
import {
  QrCode,
  Copy,
  Check,
  ShieldCheck,
  Zap,
  Building,
  Coins
} from 'lucide-react';

export const DepositHub: React.FC = () => {
  const { submitDeposit, addToast } = useApp();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType>('fampay');
  const [amount, setAmount] = useState<number>(250);
  const [utrNumber, setUtrNumber] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedCrypto, setCopiedCrypto] = useState(false);

  const quickAmounts = [100, 250, 500, 1000, 2500];

  const upiId = 'krishpay@fam';
  const cryptoAddress = '0x71C8F79d03223f66D60C8D6a72eBE8F990177B29';
  const referenceCode = `FAM_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  const handleCopyUpi = () => {
    navigator.clipboard?.writeText(upiId);
    setCopiedUpi(true);
    addToast(`UPI ID ${upiId} copied to clipboard!`, 'info', 'Copied');
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleCopyCrypto = () => {
    navigator.clipboard?.writeText(cryptoAddress);
    setCopiedCrypto(true);
    addToast(`BEP20 Address copied!`, 'info', 'Copied');
    setTimeout(() => setCopiedCrypto(false), 2000);
  };

  const handleSimulatePayment = () => {
    if (amount < 10) {
      addToast('Minimum deposit amount is ₹10.', 'error', 'Invalid Amount');
      return;
    }

    setIsVerifying(true);
    addToast('Contacting payment gateway to verify status...', 'info', 'Verifying');

    setTimeout(() => {
      setIsVerifying(false);
      submitDeposit(selectedMethod, amount, utrNumber || undefined);
      setUtrNumber('');
    }, 1800);
  };

  const handleUtrSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!utrNumber || utrNumber.trim().length < 6) {
      addToast('Please enter a valid 12-digit UTR transaction reference number.', 'error', 'Invalid UTR');
      return;
    }
    handleSimulatePayment();
  };

  return (
    <div className="w-full flex flex-col pt-2 pb-10">
      {/* Header Banner */}
      <div className="p-4 mb-4 rounded-2xl bg-gradient-to-r from-[#181820] to-[#121217] border border-[#262630] relative overflow-hidden shadow-lg">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#22c55e]/10 rounded-full filter blur-2xl pointer-events-none" />
        <span className="text-[10px] font-bold text-[#22c55e] uppercase tracking-wider block mb-1">
          Zero Fee Gateway
        </span>
        <h2 className="text-base font-extrabold text-white tracking-tight">
          Wallet Top-Up Hub
        </h2>
        <p className="text-xs text-[#a1a1aa] mt-0.5">
          Fast automated balance credit via UPI & Instant QR.
        </p>
      </div>

      {/* Payment Method Selector Grid */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {/* FamPay */}
        <button
          onClick={() => setSelectedMethod('fampay')}
          className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all ${
            selectedMethod === 'fampay'
              ? 'bg-[#7c3aed]/20 border-[#7c3aed] text-white shadow-violet-glow-sm'
              : 'bg-[#181820] border-[#262630] text-[#a1a1aa] hover:text-white'
          }`}
        >
          <div className="w-8 h-8 rounded-xl bg-[#7c3aed]/20 flex items-center justify-center mb-1.5">
            <Zap className="w-4 h-4 text-[#8b5cf6]" />
          </div>
          <span className="text-xs font-bold leading-tight">FamPay QR</span>
          <span className="text-[9px] text-[#22c55e] mt-0.5 font-medium">Instant</span>
        </button>

        {/* UPI Direct */}
        <button
          onClick={() => setSelectedMethod('upi_direct')}
          className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all ${
            selectedMethod === 'upi_direct'
              ? 'bg-[#7c3aed]/20 border-[#7c3aed] text-white shadow-violet-glow-sm'
              : 'bg-[#181820] border-[#262630] text-[#a1a1aa] hover:text-white'
          }`}
        >
          <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center mb-1.5">
            <Building className="w-4 h-4 text-blue-400" />
          </div>
          <span className="text-xs font-bold leading-tight">UPI Direct</span>
          <span className="text-[9px] text-[#a1a1aa] mt-0.5 font-medium">Any UPI App</span>
        </button>

        {/* USDT BEP20 */}
        <button
          onClick={() => setSelectedMethod('usdt_bep20')}
          className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all ${
            selectedMethod === 'usdt_bep20'
              ? 'bg-[#7c3aed]/20 border-[#7c3aed] text-white shadow-violet-glow-sm'
              : 'bg-[#181820] border-[#262630] text-[#a1a1aa] hover:text-white'
          }`}
        >
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center mb-1.5">
            <Coins className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-xs font-bold leading-tight">USDT BEP20</span>
          <span className="text-[9px] text-[#a1a1aa] mt-0.5 font-medium">Crypto</span>
        </button>
      </div>

      {/* Amount Selector Card */}
      <div className="p-4 rounded-2xl bg-[#181820] border border-[#262630] mb-4">
        <label className="text-xs font-bold text-white block mb-2">
          Select Deposit Amount (INR)
        </label>

        {/* Quick Amount Chips */}
        <div className="grid grid-cols-5 gap-1.5 mb-3">
          {quickAmounts.map((q) => (
            <button
              key={q}
              onClick={() => setAmount(q)}
              className={`py-2 rounded-xl text-xs font-bold font-mono transition-all ${
                amount === q
                  ? 'bg-[#7c3aed] text-white shadow-violet-glow-sm'
                  : 'bg-[#121217] text-[#a1a1aa] border border-[#262630] hover:text-white'
              }`}
            >
              ₹{q}
            </button>
          ))}
        </div>

        {/* Custom Amount Input */}
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#22c55e]">
            ₹
          </span>
          <input
            type="number"
            value={amount || ''}
            onChange={(e) => setAmount(Number(e.target.value))}
            placeholder="Custom amount (Min ₹10)"
            className="w-full bg-[#0b0b0e] border border-[#262630] rounded-xl pl-8 pr-4 py-2.5 text-sm font-bold font-mono text-white focus:outline-none focus:border-[#7c3aed] transition-colors"
          />
        </div>
      </div>

      {/* Payment Details Container */}
      <div className="p-4 rounded-2xl bg-[#181820] border border-[#262630] flex flex-col items-center">
        {selectedMethod === 'fampay' && (
          <div className="w-full flex flex-col items-center text-center">
            {/* Simulated Dynamic QR Code */}
            <div className="w-44 h-44 bg-white p-3 rounded-2xl shadow-xl flex items-center justify-center my-2 relative">
              <div className="w-full h-full border-2 border-black flex flex-col items-center justify-center bg-white p-2">
                <QrCode className="w-24 h-24 text-black" strokeWidth={1.5} />
                <span className="text-[10px] font-mono font-bold text-black mt-1">
                  FamPay ₹{amount}
                </span>
              </div>
            </div>

            <span className="text-xs font-bold text-white mt-1">
              Scan with GPay, PhonePe, Paytm, or FamPay
            </span>
            <span className="text-[11px] text-[#a1a1aa] mt-0.5">
              Ref Code: <span className="font-mono text-[#8b5cf6]">{referenceCode}</span>
            </span>

            {/* UPI ID Copy Box */}
            <div className="w-full flex items-center justify-between bg-[#0b0b0e] border border-[#262630] rounded-xl px-3.5 py-2.5 my-3">
              <div className="flex flex-col text-left">
                <span className="text-[10px] text-[#a1a1aa] uppercase font-semibold">UPI VPA</span>
                <span className="text-xs font-mono font-bold text-white">{upiId}</span>
              </div>
              <button
                onClick={handleCopyUpi}
                className="flex items-center gap-1.5 bg-[#1f1f2a] hover:bg-[#262630] text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[#262630] text-white transition-colors"
              >
                {copiedUpi ? <Check className="w-3.5 h-3.5 text-[#22c55e]" /> : <Copy className="w-3.5 h-3.5 text-[#8b5cf6]" />}
                <span>{copiedUpi ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Simulated Instant Check Button */}
            <button
              onClick={handleSimulatePayment}
              disabled={isVerifying}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#22c55e] hover:bg-[#16a34a] text-black font-extrabold text-xs shadow-green-glow transition-all active:scale-95 disabled:opacity-50"
            >
              <Zap className="w-4 h-4" />
              <span>{isVerifying ? 'Checking Bank Gateway...' : `I have paid ₹${amount} — Check Status`}</span>
            </button>
          </div>
        )}

        {selectedMethod === 'upi_direct' && (
          <div className="w-full flex flex-col text-left">
            <span className="text-xs font-bold text-white mb-1">
              Step 1: Send payment to Merchant UPI
            </span>
            <div className="w-full flex items-center justify-between bg-[#0b0b0e] border border-[#262630] rounded-xl px-3.5 py-2.5 mb-3">
              <div className="flex flex-col">
                <span className="text-[10px] text-[#a1a1aa] uppercase font-semibold">Merchant UPI</span>
                <span className="text-xs font-mono font-bold text-white">{upiId}</span>
              </div>
              <button
                onClick={handleCopyUpi}
                className="flex items-center gap-1.5 bg-[#1f1f2a] text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[#262630] text-white"
              >
                {copiedUpi ? <Check className="w-3.5 h-3.5 text-[#22c55e]" /> : <Copy className="w-3.5 h-3.5 text-[#8b5cf6]" />}
                <span>{copiedUpi ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <span className="text-xs font-bold text-white mb-1">
              Step 2: Enter 12-digit UTR Transaction ID
            </span>
            <form onSubmit={handleUtrSubmit} className="flex flex-col gap-2.5">
              <input
                type="text"
                value={utrNumber}
                onChange={(e) => setUtrNumber(e.target.value)}
                placeholder="Enter 12-digit UTR / Ref Number"
                className="w-full bg-[#0b0b0e] border border-[#262630] rounded-xl px-3.5 py-2.5 text-xs font-mono text-white placeholder-[#a1a1aa] focus:outline-none focus:border-[#7c3aed]"
                required
              />
              <button
                type="submit"
                disabled={isVerifying}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold text-xs shadow-violet-glow transition-all active:scale-95 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{isVerifying ? 'Verifying UTR...' : 'Submit UTR & Credit Balance'}</span>
              </button>
            </form>
          </div>
        )}

        {selectedMethod === 'usdt_bep20' && (
          <div className="w-full flex flex-col text-left">
            <div className="p-3 bg-[#7c3aed]/15 border border-[#7c3aed]/30 rounded-xl mb-3 flex items-center justify-between">
              <span className="text-xs text-white">Fixed Exchange Rate:</span>
              <span className="text-xs font-bold text-[#22c55e] font-mono">$1.00 USDT = ₹94.00</span>
            </div>

            <span className="text-xs font-bold text-white mb-1">
              USDT (BEP20 / BSC) Deposit Address:
            </span>
            <div className="w-full flex items-center justify-between bg-[#0b0b0e] border border-[#262630] rounded-xl px-3 py-2.5 mb-3">
              <span className="text-[11px] font-mono text-[#8b5cf6] break-all mr-2">
                {cryptoAddress}
              </span>
              <button
                onClick={handleCopyCrypto}
                className="shrink-0 p-2 bg-[#1f1f2a] rounded-lg border border-[#262630] text-white hover:bg-[#262630]"
              >
                {copiedCrypto ? <Check className="w-3.5 h-3.5 text-[#22c55e]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <button
              onClick={handleSimulatePayment}
              disabled={isVerifying}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#f59e0b] hover:bg-amber-600 text-black font-bold text-xs shadow-amber-glow transition-all active:scale-95 disabled:opacity-50"
            >
              <Coins className="w-4 h-4" />
              <span>{isVerifying ? 'Detecting on Blockchain...' : `Verify Crypto Transfer ($${(amount / 94).toFixed(2)})`}</span>
            </button>
          </div>
        )}
      </div>

      {/* Security Assurance */}
      <div className="mt-4 p-3 bg-[#181820]/60 border border-[#262630] rounded-xl flex items-center gap-2.5 text-xs text-[#a1a1aa]">
        <ShieldCheck className="w-4 h-4 text-[#22c55e] shrink-0" />
        <span>
          Deposited funds are instantly credited to your Transferable Main Balance.
        </span>
      </div>
    </div>
  );
};
