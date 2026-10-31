import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { PaymentMethodType } from '../../types';
import { depositApi, ManualMethodItem } from '../../api/endpoints';
import {
  Copy,
  Check,
  ShieldCheck,
  Zap,
  Building,
  Coins,
  AlertTriangle,
  Clock,
  FileText,
  RotateCcw,
  Receipt,
  QrCode,
  Clipboard
} from 'lucide-react';
import { hapticFeedback } from '../../utils/haptics';

export const DepositHub: React.FC = () => {
  const { submitDeposit, addToast, activeInvoice, setActiveInvoice, refreshUser } = useApp();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType>(() => {
    try {
      const saved = localStorage.getItem('krish_deposit_method');
      if (saved === 'fampay' || saved === 'upi_direct' || saved === 'usdt_bep20') return saved as PaymentMethodType;
    } catch {}
    return 'fampay';
  });
  const [amount, setAmount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('krish_deposit_amount');
      if (saved && Number(saved) > 0) return Number(saved);
    } catch {}
    return 250;
  });
  const [utrNumber, setUtrNumber] = useState<string>(() => {
    try {
      return localStorage.getItem('krish_deposit_utr') || '';
    } catch {
      return '';
    }
  });
  const [isVerifying, setIsVerifying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  // Dynamic live payment gateways
  const [merchantUpi, setMerchantUpi] = useState<string>('');
  const [manualMethods, setManualMethods] = useState<ManualMethodItem[]>([]);
  const [selectedManualId, setSelectedManualId] = useState<number | null>(null);
  const [isLoadingManual, setIsLoadingManual] = useState<boolean>(false);

  // Real-world countdown timer for active invoice
  const [timeLeft, setTimeLeft] = useState<number>(() => {
    if (!activeInvoice) return 900;
    return Math.max(0, Math.floor((activeInvoice.expiresAt - Date.now()) / 1000));
  });

  // Persist form inputs across app closes
  useEffect(() => {
    try {
      localStorage.setItem('krish_deposit_method', selectedMethod);
      localStorage.setItem('krish_deposit_amount', String(amount));
      if (utrNumber) {
        localStorage.setItem('krish_deposit_utr', utrNumber);
      } else {
        localStorage.removeItem('krish_deposit_utr');
      }
    } catch {}
  }, [selectedMethod, amount, utrNumber]);

  const quickAmounts = [100, 250, 500, 1000, 2500];

  // Load live manual payment methods & merchant UPI on mount
  useEffect(() => {
    let isMounted = true;
    setIsLoadingManual(true);
    depositApi
      .getManualMethods()
      .then((res) => {
        if (isMounted && res && res.success) {
          if (res.merchant_upi) {
            setMerchantUpi(res.merchant_upi);
          }
          if (res.methods && res.methods.length > 0) {
            setManualMethods(res.methods);
            setSelectedManualId(res.methods[0].id);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load live manual methods:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingManual(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const activeManualMethod =
    manualMethods.find((m) => m.id === selectedManualId) || manualMethods[0] || null;

  // 15-minute countdown timer for active invoice
  useEffect(() => {
    if (!activeInvoice) return;

    const tick = () => {
      const remaining = Math.max(0, Math.floor((activeInvoice.expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeInvoice?.expiresAt]);

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleCopyUpi = () => {
    const targetUpi = activeInvoice ? activeInvoice.upiId : merchantUpi;
    if (!targetUpi) return;
    navigator.clipboard?.writeText(targetUpi);
    setCopiedUpi(true);
    addToast(`UPI ID ${targetUpi} copied to clipboard!`, 'info', 'Copied');
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleCopyCustom = (textToCopy: string) => {
    if (!textToCopy) return;
    navigator.clipboard?.writeText(textToCopy);
    setCopiedText(true);
    addToast('Details copied to clipboard!', 'info', 'Copied');
    setTimeout(() => setCopiedText(false), 2000);
  };

  // Explicit user trigger: Generates the dynamic QR invoice only when requested
  const handleMakeInvoice = async () => {
    if (amount < 10) {
      addToast('Minimum deposit amount is ₹10.', 'error', 'Invalid Amount');
      return;
    }

    setIsGenerating(true);
    addToast(`Generating dynamic UPI invoice for ₹${amount}...`, 'info', 'Creating Invoice');

    try {
      const res = await depositApi.createFamPay(amount);
      if (res && res.success && res.reference) {
        const genUpiId = res.upi_id || merchantUpi || '';
        const genRef = res.reference;
        const genQr = res.qr_url || '';

        setActiveInvoice({
          reference: genRef,
          amount: res.amount || amount,
          upiId: genUpiId,
          qrUrl: genQr,
          upiUri: res.upi_uri,
          expiresAt: Date.now() + 15 * 60 * 1000,
        });
        setTimeLeft(900);
        addToast(`Invoice ${genRef} ready! Scan QR to complete payment.`, 'success', 'Invoice Ready');
      } else {
        addToast(
          res?.error || 'UPI Gateway is temporarily unconfigured or offline. Please use UPI Direct (UTR) or Crypto below.',
          'error',
          'Gateway Offline'
        );
      }
    } catch {
      addToast(
        'Unable to connect to UPI payment gateway. Please check connection or use manual deposit.',
        'error',
        'Connection Error'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCancelInvoice = () => {
    setActiveInvoice(null);
    addToast('Invoice cancelled. You can select another amount.', 'info', 'Invoice Cancelled');
  };

  const handlePasteUtr = async () => {
    hapticFeedback.light();
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        const cleaned = text.trim();
        if (cleaned) {
          setUtrNumber(cleaned);
          addToast('Pasted UTR from clipboard!', 'info', 'Clipboard');
          return;
        }
      }
      addToast('Clipboard is empty or access denied', 'warning', 'Clipboard');
    } catch {
      addToast('Unable to read clipboard. Please paste manually.', 'warning', 'Clipboard');
    }
  };

  const handleUtrSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanUtr = utrNumber.trim();
    if (!cleanUtr || cleanUtr.length < 6) {
      hapticFeedback.error();
      addToast('Please enter a valid transaction reference or 12-digit UTR.', 'error', 'Invalid Reference');
      return;
    }

    const payAmount = activeInvoice ? activeInvoice.amount : amount;

    setIsVerifying(true);
    hapticFeedback.light();
    addToast('Verifying transaction reference...', 'info', 'Verifying');

    try {
      const methodId =
        selectedMethod === 'usdt_bep20' && activeManualMethod ? activeManualMethod.id : 1;
      const res = await depositApi.submitManual(methodId, cleanUtr, payAmount);

      if (res && res.success) {
        if (res.auto_verified) {
          hapticFeedback.success();
          addToast(
            res.message || `Payment of ₹${payAmount} auto-verified! Your balance has been credited.`,
            'success',
            'Auto-Verified'
          );
          await refreshUser();
        } else {
          hapticFeedback.medium();
          addToast(
            res.message || 'Deposit submitted successfully! Queued for instant admin verification.',
            'info',
            'Submitted'
          );
        }
        submitDeposit(selectedMethod, payAmount, cleanUtr, true);
        setUtrNumber('');
        setActiveInvoice(null);
      } else {
        hapticFeedback.error();
        addToast(
          res?.error || 'Failed to submit reference. Please try again.',
          'error',
          'Submission Failed'
        );
      }
    } catch {
      hapticFeedback.error();
      addToast(
        'Network error while submitting reference. Please verify your connection.',
        'error',
        'Submission Error'
      );
    } finally {
      setIsVerifying(false);
    }
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
          <span className="text-[9px] text-[#22c55e] mt-0.5 font-medium">Auto QR</span>
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

        {/* Crypto / Manual */}
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
          <span className="text-xs font-bold leading-tight">Crypto & Custom</span>
          <span className="text-[9px] text-[#a1a1aa] mt-0.5 font-medium">Cwallet / USDT</span>
        </button>
      </div>

      {/* METHOD 1: FAMPAY INSTANT QR INVOICE */}
      {selectedMethod === 'fampay' && (
        <>
          {/* STATE A: NO ACTIVE INVOICE (Select Amount, View Guidelines & Make Invoice) */}
          {!activeInvoice ? (
            <div className="flex flex-col gap-4">
              {/* Amount Selector Card */}
              <div className="p-4 rounded-2xl bg-[#181820] border border-[#262630]">
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

              {/* Deposit Rules & Guidelines Card */}
              <div className="p-4 rounded-2xl bg-[#181820] border border-[#262630]">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-[#7c3aed]/20 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-[#8b5cf6]" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">Deposit Guidelines & Rules</h3>
                    <span className="text-[10px] text-[#a1a1aa]">Read before generating your invoice</span>
                  </div>
                </div>

                <div className="space-y-2.5 text-xs text-[#a1a1aa]">
                  <div className="flex items-start gap-2.5 bg-[#121217] p-2.5 rounded-xl border border-[#262630]/60">
                    <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-white block text-[11px]">15-Minute Dynamic Invoice</span>
                      <span className="text-[10px] text-[#a1a1aa] leading-tight block">
                        Each generated QR code and reference is reserved strictly for 15 minutes.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 bg-[#121217] p-2.5 rounded-xl border border-[#262630]/60">
                    <Zap className="w-4 h-4 text-[#22c55e] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-white block text-[11px]">Exact Amount Matching</span>
                      <span className="text-[10px] text-[#a1a1aa] leading-tight block">
                        Transfer the exact invoice amount (₹{amount}) for instant 100% automated credit.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 bg-[#121217] p-2.5 rounded-xl border border-[#262630]/60">
                    <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-white block text-[11px]">Single-Use Secure QR</span>
                      <span className="text-[10px] text-[#a1a1aa] leading-tight block">
                        Never reuse an old or expired QR. Always click below to create a fresh invoice.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 bg-[#121217] p-2.5 rounded-xl border border-[#262630]/60">
                    <Building className="w-4 h-4 text-[#8b5cf6] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-white block text-[11px]">Zero Transaction Fees</span>
                      <span className="text-[10px] text-[#a1a1aa] leading-tight block">
                        100% of your deposited money is credited directly to your Transferable Main Balance.
                      </span>
                    </div>
                  </div>
                </div>

                {/* MAKE YOUR INVOICE BUTTON */}
                <button
                  onClick={handleMakeInvoice}
                  disabled={isGenerating || amount < 10}
                  className="w-full mt-4 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] hover:from-[#6d28d9] hover:to-[#5b21b6] text-white font-extrabold text-sm shadow-violet-glow transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Generating Invoice...</span>
                    </>
                  ) : (
                    <>
                      <Receipt className="w-4 h-4" />
                      <span>Make Your Invoice — ₹{amount}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* STATE B: ACTIVE INVOICE VIEW (Prominent Step-by-Step 12-Digit UTR Verification Card) */
            <div className="p-4 sm:p-5 rounded-2xl bg-[#181820] border border-[#262630] flex flex-col items-center shadow-xl relative overflow-hidden">
              {/* Header with Title + 15-min countdown timer */}
              <div className="w-full flex items-center justify-between pb-3 mb-3 border-b border-[#262630]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#22c55e]/15 border border-[#22c55e]/30 flex items-center justify-center">
                    <QrCode className="w-4 h-4 text-[#22c55e]" />
                  </div>
                  <div className="text-left">
                    <span className="text-xs font-bold text-white block">UPI Instant Invoice</span>
                    <span className="text-[10px] text-[#a1a1aa]">Auto-credited via 12-Digit UTR</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs font-bold font-mono text-amber-300">
                    {timeLeft > 0 ? formatCountdown(timeLeft) : 'Expired'}
                  </span>
                </div>
              </div>

              {/* STEP 1: Pay exact amount via QR or UPI ID */}
              <div className="w-full bg-[#121217] border border-[#262630] rounded-xl p-3 sm:p-3.5 mb-3.5 text-left">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-[#a78bfa] uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-[#7c3aed] text-white flex items-center justify-center text-[10px] font-bold">1</span>
                    <span>Step 1: Transfer Exact Amount</span>
                  </span>
                  <span className="text-[10px] font-mono text-[#a1a1aa]">Ref: <code className="text-[#8b5cf6]">{activeInvoice.reference}</code></span>
                </div>

                {/* Amount Highlight */}
                <div className="flex items-center justify-between bg-[#181820] border border-[#262630] rounded-xl p-2.5 sm:p-3 mb-2.5">
                  <span className="text-xs text-[#a1a1aa] font-medium">Amount to Transfer:</span>
                  <span className="text-xl font-black font-mono text-[#22c55e]">₹{activeInvoice.amount}</span>
                </div>

                {/* Dynamic QR Code or Fallback */}
                {activeInvoice.qrUrl ? (
                  <div className="w-44 h-44 mx-auto bg-white p-2.5 rounded-2xl shadow-xl flex items-center justify-center my-2 relative">
                    <div className="w-full h-full border-2 border-black flex flex-col items-center justify-center bg-white p-1">
                      <img
                        src={activeInvoice.qrUrl}
                        alt={`FamPay ₹${activeInvoice.amount}`}
                        className="w-36 h-36 object-contain"
                        onError={() => {
                          setActiveInvoice((prev) => (prev ? { ...prev, qrUrl: '' } : null));
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="w-full bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 text-center my-2 flex flex-col items-center">
                    <AlertTriangle className="w-5 h-5 text-amber-400 mb-1" />
                    <span className="text-xs font-bold text-white">QR Code Unavailable</span>
                    <span className="text-[11px] text-[#a1a1aa] mt-0.5">Please copy the UPI VPA below to pay</span>
                  </div>
                )}

                <div className="text-center text-[10px] text-[#71717a] my-1.5">
                  Scan using GPay, PhonePe, Paytm, CRED, FamPay or any UPI app
                </div>

                {/* UPI ID Copy Box */}
                {activeInvoice.upiId ? (
                  <div className="w-full flex items-center justify-between bg-[#0b0b0e] border border-[#262630] rounded-xl px-3 py-2 mt-2">
                    <div className="flex flex-col text-left min-w-0 pr-2">
                      <span className="text-[9px] text-[#71717a] uppercase font-bold">UPI VPA</span>
                      <span className="text-xs font-mono font-bold text-white truncate">{activeInvoice.upiId}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyUpi}
                      className="min-h-[36px] flex items-center gap-1.5 bg-[#1f1f2a] hover:bg-[#262630] active:scale-95 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#262630] text-white transition-all shrink-0 cursor-pointer"
                    >
                      {copiedUpi ? <Check className="w-3.5 h-3.5 text-[#22c55e]" /> : <Copy className="w-3.5 h-3.5 text-[#8b5cf6]" />}
                      <span>{copiedUpi ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                ) : null}
              </div>

              {/* STEP 2: Input 12-Digit UTR with Paste button & Auto-Credit */}
              <div className="w-full bg-[#121217] border border-[#262630] rounded-xl p-3 sm:p-3.5 text-left mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-[#22c55e] uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-[#22c55e] text-black flex items-center justify-center text-[10px] font-bold">2</span>
                    <span>Step 2: Enter 12-Digit UTR</span>
                  </span>
                  <span className="text-[10px] font-mono text-[#a1a1aa]">Instant Auto-Credit</span>
                </div>

                <form onSubmit={handleUtrSubmit} className="flex flex-col gap-3">
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={utrNumber}
                      onChange={(e) => setUtrNumber(e.target.value)}
                      placeholder="Enter 12-digit UTR (e.g. 429812345678)"
                      maxLength={22}
                      className="w-full bg-[#0b0b0e] border border-[#262630] focus:border-[#7c3aed] rounded-xl pl-3.5 pr-20 py-3 text-xs font-mono text-white placeholder-[#71717a] focus:outline-none transition-colors"
                      required
                    />
                    <button
                      type="button"
                      onClick={handlePasteUtr}
                      className="absolute right-2 min-h-[34px] px-2.5 py-1 rounded-lg bg-[#1f1f2a] hover:bg-[#2a2a38] active:scale-95 text-[11px] font-semibold text-[#a78bfa] border border-[#38384a] flex items-center gap-1 transition-all cursor-pointer"
                      title="Paste UTR from clipboard"
                    >
                      <Clipboard className="w-3.5 h-3.5" />
                      <span>Paste</span>
                    </button>
                  </div>

                  {/* Primary CTA: Verify UTR & Auto-Credit Balance */}
                  <button
                    type="submit"
                    disabled={isVerifying || !utrNumber.trim()}
                    className="w-full min-h-[46px] flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-[#22c55e] to-[#16a34a] hover:from-[#16a34a] hover:to-[#15803d] text-black font-extrabold text-xs shadow-green-glow transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                  >
                    <Zap className="w-4 h-4 fill-black" />
                    <span>{isVerifying ? 'Verifying with Bank...' : '⚡ Verify UTR & Auto-Credit Balance'}</span>
                  </button>
                </form>
              </div>

              {/* Cancel / Change Amount button */}
              <button
                type="button"
                onClick={handleCancelInvoice}
                className="w-full min-h-[40px] flex items-center justify-center gap-1.5 py-2 rounded-xl bg-transparent hover:bg-[#181820] text-[#71717a] hover:text-[#a1a1aa] text-xs font-medium border border-transparent hover:border-[#262630] transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Cancel / Change Amount</span>
              </button>
            </div>
          )}
        </>
      )}

      {/* METHOD 2: UPI DIRECT MANUAL TRANSFER */}
      {selectedMethod === 'upi_direct' && (
        <div className="flex flex-col gap-4">
          {/* Amount Selector Card */}
          <div className="p-4 rounded-2xl bg-[#181820] border border-[#262630]">
            <label className="text-xs font-bold text-white block mb-2">
              Select Deposit Amount (INR)
            </label>
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

          <div className="p-4 rounded-2xl bg-[#181820] border border-[#262630] flex flex-col text-left">
            <span className="text-xs font-bold text-white mb-1">
              Step 1: Send payment to Merchant UPI
            </span>
            <div className="w-full flex items-center justify-between bg-[#0b0b0e] border border-[#262630] rounded-xl px-3.5 py-2.5 mb-3">
              <div className="flex flex-col">
                <span className="text-[10px] text-[#a1a1aa] uppercase font-semibold">Merchant UPI</span>
                <span className="text-xs font-mono font-bold text-white">
                  {merchantUpi || 'Contact @patelkrish_99bot for UPI'}
                </span>
              </div>
              {merchantUpi ? (
                <button
                  onClick={handleCopyUpi}
                  className="flex items-center gap-1.5 bg-[#1f1f2a] text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[#262630] text-white hover:bg-[#262630]"
                >
                  {copiedUpi ? <Check className="w-3.5 h-3.5 text-[#22c55e]" /> : <Copy className="w-3.5 h-3.5 text-[#8b5cf6]" />}
                  <span>{copiedUpi ? 'Copied' : 'Copy'}</span>
                </button>
              ) : null}
            </div>

            <span className="text-xs font-bold text-white mb-1">
              Step 2: Enter 12-digit UTR Transaction ID
            </span>
            <form onSubmit={handleUtrSubmit} className="flex flex-col gap-2.5">
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value)}
                  placeholder="Enter 12-digit UTR (e.g. 429812345678)"
                  className="w-full bg-[#0b0b0e] border border-[#262630] focus:border-[#7c3aed] rounded-xl pl-3.5 pr-20 py-2.5 text-xs font-mono text-white placeholder-[#71717a] focus:outline-none transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={handlePasteUtr}
                  className="absolute right-2 min-h-[32px] px-2.5 py-1 rounded-lg bg-[#1f1f2a] hover:bg-[#2a2a38] active:scale-95 text-[11px] font-semibold text-[#a78bfa] border border-[#38384a] flex items-center gap-1 transition-all cursor-pointer"
                  title="Paste UTR from clipboard"
                >
                  <Clipboard className="w-3 h-3" />
                  <span>Paste</span>
                </button>
              </div>
              <button
                type="submit"
                disabled={isVerifying || !utrNumber.trim()}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-[#22c55e] to-[#16a34a] hover:from-[#16a34a] hover:to-[#15803d] text-black font-extrabold text-xs shadow-green-glow transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                <Zap className="w-4 h-4 fill-black" />
                <span>{isVerifying ? 'Verifying UTR...' : `⚡ Verify UTR & Auto-Credit Balance (₹${amount})`}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* METHOD 3: LIVE CRYPTO & MANUAL CUSTOM METHODS */}
      {selectedMethod === 'usdt_bep20' && (
        <div className="flex flex-col gap-4">
          {/* Amount Selector Card */}
          <div className="p-4 rounded-2xl bg-[#181820] border border-[#262630]">
            <label className="text-xs font-bold text-white block mb-2">
              Select Deposit Amount (INR)
            </label>
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

          {isLoadingManual ? (
            <div className="p-8 rounded-2xl bg-[#181820] border border-[#262630] flex flex-col items-center justify-center">
              <div className="w-6 h-6 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin mb-2" />
              <span className="text-xs text-[#a1a1aa]">Loading payment methods...</span>
            </div>
          ) : manualMethods.length === 0 ? (
            <div className="p-6 rounded-2xl bg-[#181820] border border-[#262630] flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-3">
                <AlertTriangle className="w-6 h-6 text-amber-400" />
              </div>
              <span className="text-sm font-bold text-white">No Crypto Gateways Active</span>
              <p className="text-xs text-[#a1a1aa] mt-1 max-w-xs">
                Custom crypto payment methods (Cwallet / USDT) are currently not configured. Please use FamPay QR or contact support @patelkrish_99bot.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Selector Pills if multiple methods exist */}
              {manualMethods.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {manualMethods.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedManualId(m.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        (selectedManualId === m.id || (!selectedManualId && manualMethods[0].id === m.id))
                          ? 'bg-[#7c3aed] text-white shadow-violet-glow-sm'
                          : 'bg-[#181820] text-[#a1a1aa] border border-[#262630]'
                      }`}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              )}

              {activeManualMethod && (
                <div className="p-4 rounded-2xl bg-[#181820] border border-[#262630] flex flex-col text-left">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-white flex items-center gap-2">
                      <Coins className="w-4 h-4 text-amber-400" />
                      {activeManualMethod.name}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#22c55e]/10 border border-[#22c55e]/30 text-[#22c55e] font-semibold">
                      Manual Verification
                    </span>
                  </div>

                  {/* Instructions / Caption */}
                  {activeManualMethod.caption && (
                    <div className="p-3 bg-[#121217] border border-[#262630] rounded-xl mb-3 flex items-start justify-between gap-2">
                      <span className="text-xs text-[#e4e4e7] leading-relaxed break-words whitespace-pre-wrap">
                        {activeManualMethod.caption.replace(/<[^>]+>/g, ' ')}
                      </span>
                      <button
                        onClick={() => handleCopyCustom(activeManualMethod.caption.replace(/<[^>]+>/g, ' '))}
                        className="p-1.5 bg-[#1f1f2a] rounded-lg border border-[#262630] text-white hover:bg-[#262630] shrink-0"
                        title="Copy instructions"
                      >
                        {copiedText ? (
                          <Check className="w-3.5 h-3.5 text-[#22c55e]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-[#8b5cf6]" />
                        )}
                      </button>
                    </div>
                  )}

                  {/* QR Code image if exists */}
                  {activeManualMethod.qr_url ? (
                    <div className="flex flex-col items-center justify-center my-2 p-3 bg-[#121217] rounded-xl border border-[#262630]">
                      <img
                        src={activeManualMethod.qr_url}
                        alt={activeManualMethod.name}
                        className="w-44 h-44 object-contain rounded-xl bg-white p-2"
                      />
                      <span className="text-[10px] text-[#a1a1aa] mt-2 flex items-center gap-1">
                        <QrCode className="w-3 h-3 text-[#8b5cf6]" />
                        Scan QR code with your {activeManualMethod.name} app
                      </span>
                    </div>
                  ) : null}

                  {/* Step 2: Submit Reference */}
                  <span className="text-xs font-bold text-white mb-1 mt-2">
                    Submit Transaction ID / Reference
                  </span>
                  <form onSubmit={handleUtrSubmit} className="flex flex-col gap-2.5">
                    <input
                      type="text"
                      value={utrNumber}
                      onChange={(e) => setUtrNumber(e.target.value)}
                      placeholder="Enter Transaction ID / Hash / Reference"
                      className="w-full bg-[#0b0b0e] border border-[#262630] rounded-xl px-3.5 py-2.5 text-xs font-mono text-white placeholder-[#a1a1aa] focus:outline-none focus:border-[#7c3aed]"
                      required
                    />
                    <button
                      type="submit"
                      disabled={isVerifying}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold text-xs shadow-violet-glow transition-all active:scale-95 disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      <span>{isVerifying ? 'Submitting Reference...' : `Submit Reference for ₹${amount}`}</span>
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
