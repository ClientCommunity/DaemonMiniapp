import cwalletCardImg from '../../assets/cwallet-card.jpg';
import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { PaymentMethodType } from '../../types';
import { depositApi, ManualMethodItem } from '../../api/endpoints';
import { QRCodeSVG } from 'qrcode.react';
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
  Clipboard,
  Loader2,
  X
} from 'lucide-react';
import { hapticFeedback } from '../../utils/haptics';

interface VerifyingDepositState {
  depositId: number;
  amount: number;
  utr: string;
  method: PaymentMethodType;
  orderReference?: string;
  expiresAt: number;
}

interface EscalatedNoticeState {
  depositId: number;
  amount: number;
  utr: string;
}

type DetectedRefKind = 'fampay_txn' | 'upi_utr' | 'upi_vpa' | 'invoice_ref' | 'short' | 'other';

function inspectPaymentRef(
  raw: string,
  invoiceRef?: string,
  expectedAmt?: number
): { normalized: string; kind: DetectedRefKind; hint: string; isWarning?: boolean } {
  const trimmed = raw.trim();
  if (!trimmed) return { normalized: '', kind: 'short', hint: '' };
  if (trimmed.includes('@')) {
    return {
      normalized: trimmed,
      kind: 'upi_vpa',
      hint: 'Looks like a UPI ID — paste your FamPay Txn ID (FMP...) or 12-digit UTR from the receipt.',
      isWarning: true,
    };
  }
  const clean = trimmed.replace(/\s+/g, '').toUpperCase();
  if (
    invoiceRef &&
    clean.replace(/[^A-Z0-9]/g, '') === invoiceRef.toUpperCase().replace(/[^A-Z0-9]/g, '')
  ) {
    return {
      normalized: clean,
      kind: 'invoice_ref',
      hint: 'That is your Invoice Ref — paste the Txn ID (FMP...) or 12-digit UTR from your payment app.',
      isWarning: true,
    };
  }
  if (expectedAmt && expectedAmt > 0 && clean === String(Math.floor(expectedAmt))) {
    return {
      normalized: clean,
      kind: 'other',
      hint: 'Enter your Payment Txn ID or UTR, not the deposit amount.',
      isWarning: true,
    };
  }
  if (/^\d{12}$/.test(clean)) {
    return { normalized: clean, kind: 'upi_utr', hint: '12-digit UPI UTR detected' };
  }
  if (/^(?:FMP|FP|TXN)[A-Z0-9_-]{3,44}$/.test(clean)) {
    return { normalized: clean, kind: 'fampay_txn', hint: 'FamPay Transaction ID detected' };
  }
  if (clean.length < 6) {
    return { normalized: clean, kind: 'short', hint: 'At least 6 characters required' };
  }
  return { normalized: clean, kind: 'other', hint: 'Transaction reference detected' };
}

function decodeHtmlEntities(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;#x27;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

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
  const [isCancellingVerify, setIsCancellingVerify] = useState(false);
  const [verifyingDeposit, setVerifyingDeposit] = useState<VerifyingDepositState | null>(() => {
    try {
      const raw = localStorage.getItem('krish_verifying_deposit');
      if (!raw) return null;
      const parsed = JSON.parse(raw) as VerifyingDepositState;
      if (!parsed?.depositId || !parsed?.expiresAt) return null;
      if (Date.now() - parsed.expiresAt > 4 * 60 * 1000) return null;
      return parsed;
    } catch {
      return null;
    }
  });
  const [verifySecondsLeft, setVerifySecondsLeft] = useState<number>(() => {
    try {
      const raw = localStorage.getItem('krish_verifying_deposit');
      if (!raw) return 0;
      const parsed = JSON.parse(raw) as VerifyingDepositState;
      if (!parsed?.expiresAt) return 0;
      return Math.max(0, Math.ceil((parsed.expiresAt - Date.now()) / 1000));
    } catch {
      return 0;
    }
  });
  const [escalatedNotice, setEscalatedNotice] = useState<EscalatedNoticeState | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [qrImgError, setQrImgError] = useState(false);

  useEffect(() => {
    setQrImgError(false);
  }, [activeInvoice?.reference]);

  useEffect(() => {
    try {
      if (verifyingDeposit) {
        localStorage.setItem('krish_verifying_deposit', JSON.stringify(verifyingDeposit));
      } else {
        localStorage.removeItem('krish_verifying_deposit');
      }
    } catch {}
  }, [verifyingDeposit]);

  // Dynamic live payment gateways
  const [merchantUpi, setMerchantUpi] = useState<string>('');
  const [fampayEnabled, setFampayEnabled] = useState<boolean>(true);
  const [upiEnabled, setUpiEnabled] = useState<boolean>(true);
  const [cwalletEnabled, setCwalletEnabled] = useState<boolean>(true);
  const [fampayMinDeposit, setFampayMinDeposit] = useState<number>(10);
  const [upiMinDeposit, setUpiMinDeposit] = useState<number>(50);
  const [cwalletMinDeposit, setCwalletMinDeposit] = useState<number>(50);
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
          const isFpOn = res.fampay_enabled !== false;
          const isUpiOn = res.upi_enabled !== false;
          const isCwOn = res.cwallet_enabled !== false;

          setFampayEnabled(isFpOn);
          setUpiEnabled(isUpiOn);
          setCwalletEnabled(isCwOn);

          if (res.fampay_min_deposit) setFampayMinDeposit(res.fampay_min_deposit);
          if (res.upi_min_deposit) setUpiMinDeposit(res.upi_min_deposit);
          if (res.cwallet_min_deposit) setCwalletMinDeposit(res.cwallet_min_deposit);

          if (!isFpOn && selectedMethod === 'fampay') {
            setSelectedMethod(isUpiOn ? 'upi_direct' : 'usdt_bep20');
          } else if (!isUpiOn && selectedMethod === 'upi_direct') {
            setSelectedMethod(isFpOn ? 'fampay' : 'usdt_bep20');
          }

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

  // Filter manual methods to crypto/custom only for the Crypto tab (exclude UPI which belongs in the UPI tabs)
  const cryptoMethods = React.useMemo(() => {
    return manualMethods.filter((m) => {
      if (m.name.toLowerCase().includes('upi')) return false;
      if (!cwalletEnabled && (m.name.toLowerCase().includes('cwallet') || (m.caption && m.caption.toLowerCase().includes('cwallet')))) {
        return false;
      }
      return true;
    });
  }, [manualMethods, cwalletEnabled]);

  const activeManualMethod =
    cryptoMethods.find((m) => m.id === selectedManualId) || cryptoMethods[0] || null;

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
    if (amount < fampayMinDeposit) {
      addToast(`Minimum deposit amount for Instant QR is ₹${fampayMinDeposit}.`, 'error', 'Invalid Amount');
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
        if ((res as any)?.code === 'GATEWAY_OFFLINE') {
          setFampayEnabled(false);
          setSelectedMethod('upi_direct');
        }
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

  // Live 1-second countdown + 4.5s status poller for 60s payment verification
  useEffect(() => {
    if (!verifyingDeposit) {
      setVerifySecondsLeft(0);
      return;
    }

    let active = true;
    let inFlight = false;

    const tickCountdown = () => {
      if (!active) return;
      const rem = Math.max(0, Math.ceil((verifyingDeposit.expiresAt - Date.now()) / 1000));
      setVerifySecondsLeft(rem);
    };

    const pollStatus = async () => {
      if (!active || inFlight) return;
      inFlight = true;
      try {
        const st = await depositApi.getManualStatus(verifyingDeposit.depositId);
        if (!active || !st || !st.success) return;

        if (st.status === 'success') {
          const finalAmt = st.amount || verifyingDeposit.amount;
          const finalRef = st.utr || verifyingDeposit.utr;
          hapticFeedback.success();
          addToast(
            `Payment verified! ₹${finalAmt} credited to your wallet.`,
            'success',
            'Auto-Verified'
          );
          await refreshUser();
          submitDeposit(verifyingDeposit.method, finalAmt, finalRef, true);
          setVerifyingDeposit(null);
          setEscalatedNotice(null);
          setUtrNumber('');
          setActiveInvoice(null);
        } else if (st.status === 'pending') {
          const finalAmt = st.amount || verifyingDeposit.amount;
          const finalRef = st.utr || verifyingDeposit.utr;
          hapticFeedback.medium();
          addToast(
            'Still awaiting bank email. Queued for priority verification & background auto-check.',
            'info',
            'Priority Review'
          );
          submitDeposit(verifyingDeposit.method, finalAmt, finalRef, true);
          setVerifyingDeposit(null);
          setEscalatedNotice({
            depositId: verifyingDeposit.depositId,
            amount: finalAmt,
            utr: finalRef,
          });
          setUtrNumber('');
          setActiveInvoice(null);
        } else if (st.status === 'rejected' || st.status === 'cancelled' || st.status === 'not_found') {
          setVerifyingDeposit(null);
          if (st.status === 'rejected') {
            hapticFeedback.error();
            addToast('Deposit request was declined during verification.', 'error', 'Declined');
          }
        } else if (typeof st.remaining_seconds === 'number') {
          const syncedExpires = Date.now() + st.remaining_seconds * 1000;
          if (Math.abs(syncedExpires - verifyingDeposit.expiresAt) > 4000) {
            setVerifyingDeposit((prev) => (prev ? { ...prev, expiresAt: syncedExpires } : null));
          }
        }
      } catch {
        // Silent retry on transient network glitch during 60s window
      } finally {
        inFlight = false;
      }
    };

    tickCountdown();
    const secTimer = setInterval(() => {
      tickCountdown();
      if (Date.now() >= verifyingDeposit.expiresAt) {
        void pollStatus();
      }
    }, 1000);
    const pollTimer = setInterval(() => {
      void pollStatus();
    }, 4500);
    const kickTimer = setTimeout(() => {
      void pollStatus();
    }, 2500);

    return () => {
      active = false;
      clearInterval(secTimer);
      clearInterval(pollTimer);
      clearTimeout(kickTimer);
    };
  }, [verifyingDeposit?.depositId, verifyingDeposit?.expiresAt]);

  const handlePasteUtr = async () => {
    hapticFeedback.light();
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        const cleaned = text.trim();
        if (cleaned) {
          setUtrNumber(cleaned);
          addToast('Pasted payment reference from clipboard!', 'info', 'Clipboard');
          return;
        }
      }
      addToast('Clipboard is empty or access denied', 'warning', 'Clipboard');
    } catch {
      addToast('Unable to read clipboard. Please paste manually.', 'warning', 'Clipboard');
    }
  };

  const handleCancelVerifying = async () => {
    if (!verifyingDeposit || isCancellingVerify) return;
    setIsCancellingVerify(true);
    hapticFeedback.light();
    try {
      const res = await depositApi.cancelManualVerify(verifyingDeposit.depositId);
      if (res && res.success) {
        setUtrNumber(res.utr || verifyingDeposit.utr);
        setVerifyingDeposit(null);
        addToast('Check cancelled. Edit your Transaction ID / UTR and retry.', 'info', 'Edit & Retry');
      } else {
        // Refresh status immediately in case it just verified or escalated during click
        const st = await depositApi.getManualStatus(verifyingDeposit.depositId).catch(() => null);
        if (st && st.status === 'success') {
          await refreshUser();
          setVerifyingDeposit(null);
          setActiveInvoice(null);
          setUtrNumber('');
          addToast(
            `Payment verified! ₹${st.amount || verifyingDeposit.amount} already credited.`,
            'success',
            'Auto-Verified'
          );
        } else {
          addToast(
            res?.error || 'Verification already completed or moved to review.',
            'warning',
            'Unable to Edit'
          );
          if (st?.status === 'pending') {
            setVerifyingDeposit(null);
          }
        }
      }
    } catch {
      addToast('Network error cancelling active check. Please try again.', 'error', 'Error');
    } finally {
      setIsCancellingVerify(false);
    }
  };

  const handleUtrSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (verifyingDeposit) {
      addToast('A verification check is already running. Wait or tap Edit & Retry.', 'info', 'Verifying');
      return;
    }

    const payAmount = activeInvoice ? activeInvoice.amount : amount;
    const refCheck = inspectPaymentRef(
      utrNumber,
      selectedMethod === 'fampay' ? activeInvoice?.reference : undefined,
      payAmount
    );
    if (!refCheck.normalized || refCheck.kind === 'short' || refCheck.isWarning) {
      hapticFeedback.error();
      addToast(
        refCheck.hint || 'Please enter a valid FamPay Transaction ID (FMP...) or 12-digit UTR.',
        'error',
        'Invalid Reference'
      );
      return;
    }

    const requiredMin =
      selectedMethod === 'upi_direct'
        ? upiMinDeposit
        : selectedMethod === 'fampay'
        ? fampayMinDeposit
        : cwalletMinDeposit;
    if (payAmount > 0 && payAmount < requiredMin) {
      hapticFeedback.error();
      addToast(`Minimum deposit amount is ₹${requiredMin}.`, 'error', 'Invalid Amount');
      return;
    }

    setIsVerifying(true);
    setEscalatedNotice(null);
    hapticFeedback.light();

    try {
      const methodId: number | string =
        selectedMethod === 'usdt_bep20' && activeManualMethod
          ? activeManualMethod.id
          : selectedMethod;
      const res = await depositApi.submitManual(methodId, refCheck.normalized, payAmount, {
        order_reference: selectedMethod === 'fampay' ? activeInvoice?.reference : undefined,
        method_type: selectedMethod,
      });

      if (res && res.success) {
        if (res.auto_verified || res.status === 'success') {
          hapticFeedback.success();
          addToast(
            res.message || `Payment of ₹${payAmount} auto-verified! Your balance has been credited.`,
            'success',
            'Auto-Verified'
          );
          await refreshUser();
          submitDeposit(selectedMethod, payAmount, refCheck.normalized, true);
          setUtrNumber('');
          setActiveInvoice(null);
        } else if (res.status === 'verifying' && res.deposit_id) {
          const waitSecs = Math.max(15, Number(res.wait_seconds || res.remaining_seconds || 60));
          hapticFeedback.medium();
          addToast(
            'Checking for bank confirmation email every 5 seconds...',
            'info',
            'Verifying Payment'
          );
          setVerifyingDeposit({
            depositId: res.deposit_id,
            amount: res.amount || payAmount,
            utr: res.utr || refCheck.normalized,
            method: selectedMethod,
            orderReference: res.order_reference || activeInvoice?.reference,
            expiresAt: Date.now() + waitSecs * 1000,
          });
          setVerifySecondsLeft(waitSecs);
        } else {
          hapticFeedback.medium();
          addToast(
            res.message || 'Deposit submitted successfully! Queued for admin verification.',
            'info',
            'Submitted'
          );
          submitDeposit(selectedMethod, payAmount, refCheck.normalized, true);
          setUtrNumber('');
          setActiveInvoice(null);
        }
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

  const currentPayAmount = selectedMethod === 'fampay' && activeInvoice ? activeInvoice.amount : amount;
  const currentRefInspection = inspectPaymentRef(
    utrNumber,
    selectedMethod === 'fampay' ? activeInvoice?.reference : undefined,
    currentPayAmount
  );

  const renderUpiVerificationSection = (isDynamicInvoice: boolean) => {
    const buttonPayAmount = isDynamicInvoice && activeInvoice ? activeInvoice.amount : amount;
    return (
      <div className="w-full bg-[#121217] border border-[#262630] rounded-xl p-3 sm:p-3.5 text-left mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-[#22c55e] uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-[#22c55e] text-black flex items-center justify-center text-[10px] font-bold">2</span>
            <span>Step 2: Enter FamPay Txn ID or 12-Digit UTR</span>
          </span>
          <span className="text-[10px] font-mono text-[#a1a1aa]">Auto-Verify (≤60s)</span>
        </div>

        {verifyingDeposit ? (
          <div className="bg-[#0b0b0e] border border-[#7c3aed]/50 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Loader2 className="w-4 h-4 text-[#a78bfa] animate-spin shrink-0" />
                <span className="text-xs font-bold text-white truncate">
                  Trying to Verify Payment...
                </span>
              </div>
              <span className="text-xs font-mono font-extrabold text-[#a78bfa] bg-[#7c3aed]/15 border border-[#7c3aed]/30 px-2 py-0.5 rounded-full shrink-0">
                {verifySecondsLeft}s
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] bg-[#14141b] border border-[#262630] rounded-lg px-2.5 py-1.5">
              <span className="text-[#a1a1aa] truncate">
                Ref: <code className="text-white font-mono">{verifyingDeposit.utr}</code>
              </span>
              <span className="font-mono font-bold text-[#22c55e] shrink-0">
                ₹{verifyingDeposit.amount}
              </span>
            </div>

            <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
              Checking bank / FamPay confirmation email automatically every 5 seconds. Please do not re-submit.
            </p>

            <button
              type="button"
              onClick={handleCancelVerifying}
              disabled={isCancellingVerify}
              className="w-full min-h-[36px] py-1.5 px-3 rounded-lg bg-[#181820] hover:bg-[#22222d] border border-[#2e2e3d] text-[11px] font-semibold text-[#e4e4e7] transition-colors cursor-pointer disabled:opacity-50"
            >
              {isCancellingVerify ? 'Releasing...' : 'Wrong ID? Edit & Retry'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleUtrSubmit} className="flex flex-col gap-2.5">
            {escalatedNotice && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 text-[11px] text-amber-200 flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="font-bold text-amber-300">
                    Priority Verification Queued (#{escalatedNotice.depositId})
                  </div>
                  <div className="text-amber-100/80 leading-relaxed">
                    Email hasn&apos;t arrived within 60s for ₹{escalatedNotice.amount} (
                    <code className="font-mono">{escalatedNotice.utr}</code>). Still checking automatically &amp; queued for admin review.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEscalatedNotice(null)}
                  className="text-amber-300 hover:text-white p-0.5 shrink-0 cursor-pointer"
                  aria-label="Dismiss notice"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="relative flex items-center">
              <input
                type="text"
                value={utrNumber}
                onChange={(e) => setUtrNumber(e.target.value)}
                placeholder="FamPay Txn ID (FMP...) or 12-digit UTR"
                maxLength={48}
                className="w-full bg-[#0b0b0e] border border-[#262630] focus:border-[#7c3aed] rounded-xl pl-3.5 pr-20 py-3 text-xs font-mono text-white placeholder-[#71717a] focus:outline-none transition-colors"
                required
              />
              <button
                type="button"
                onClick={handlePasteUtr}
                className="absolute right-2 min-h-[34px] px-2.5 py-1 rounded-lg bg-[#1f1f2a] hover:bg-[#2a2a38] active:scale-95 text-[11px] font-semibold text-[#a78bfa] border border-[#38384a] flex items-center gap-1 transition-all cursor-pointer"
                title="Paste FamPay Txn ID or UTR from clipboard"
              >
                <Clipboard className="w-3.5 h-3.5" />
                <span>Paste</span>
              </button>
            </div>

            {utrNumber.trim() ? (
              <div
                className={`text-[10px] font-medium flex items-center gap-1.5 ${
                  currentRefInspection.isWarning
                    ? 'text-amber-400'
                    : currentRefInspection.kind === 'fampay_txn' || currentRefInspection.kind === 'upi_utr'
                    ? 'text-[#22c55e]'
                    : 'text-[#a1a1aa]'
                }`}
              >
                {currentRefInspection.isWarning ? (
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                ) : (
                  <Check className="w-3 h-3 shrink-0" />
                )}
                <span>{currentRefInspection.hint}</span>
              </div>
            ) : (
              <div className="text-[10px] text-[#71717a]">
                Paid via FamPay? Paste <span className="text-[#a1a1aa] font-mono">FMP...</span> Txn ID. Used GPay/PhonePe/Paytm? Paste 12-digit UTR.
              </div>
            )}

            <button
              type="submit"
              disabled={isVerifying || !utrNumber.trim()}
              className="w-full min-h-[46px] flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-[#22c55e] to-[#16a34a] hover:from-[#16a34a] hover:to-[#15803d] text-black font-extrabold text-xs shadow-green-glow transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-black" />
              <span>
                {isVerifying
                  ? 'Verifying with Bank...'
                  : isDynamicInvoice
                  ? 'Verify & Auto-Credit Balance'
                  : `Verify & Auto-Credit Balance (₹${buttonPayAmount})`}
              </span>
            </button>
          </form>
        )}
      </div>
    );
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
          onClick={() => {
            if (!fampayEnabled) {
              addToast('FamPay instant automatic QR is currently disabled by administrator. Please use UPI Direct.', 'warning');
              return;
            }
            setSelectedMethod('fampay');
          }}
          className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all ${
            !fampayEnabled
              ? 'bg-[#181820]/40 border-[#262630]/50 text-[#71717a] cursor-not-allowed opacity-60'
              : selectedMethod === 'fampay'
              ? 'bg-[#7c3aed]/20 border-[#7c3aed] text-white shadow-violet-glow-sm cursor-pointer'
              : 'bg-[#181820] border-[#262630] text-[#a1a1aa] hover:text-white cursor-pointer'
          }`}
        >
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-1.5 ${
            !fampayEnabled ? 'bg-[#262630]/40' : 'bg-[#7c3aed]/20'
          }`}>
            <Zap className={`w-4 h-4 ${!fampayEnabled ? 'text-[#71717a]' : 'text-[#8b5cf6]'}`} />
          </div>
          <span className={`text-xs font-bold leading-tight ${!fampayEnabled ? 'line-through' : ''}`}>UPI Auto</span>
          <span className={`text-[9px] mt-0.5 font-medium ${!fampayEnabled ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
            {!fampayEnabled ? 'Disabled' : 'Instant QR'}
          </span>
        </button>

        {/* UPI Direct */}
        <button
          onClick={() => {
            if (!upiEnabled) {
              addToast('UPI Direct manual deposits are currently disabled by administrator.', 'warning');
              return;
            }
            setSelectedMethod('upi_direct');
          }}
          className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all ${
            !upiEnabled
              ? 'bg-[#181820]/40 border-[#262630]/50 text-[#71717a] cursor-not-allowed opacity-60'
              : selectedMethod === 'upi_direct'
              ? 'bg-[#7c3aed]/20 border-[#7c3aed] text-white shadow-violet-glow-sm cursor-pointer'
              : 'bg-[#181820] border-[#262630] text-[#a1a1aa] hover:text-white cursor-pointer'
          }`}
        >
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-1.5 ${
            !upiEnabled ? 'bg-[#262630]/40' : 'bg-blue-500/20'
          }`}>
            <Building className={`w-4 h-4 ${!upiEnabled ? 'text-[#71717a]' : 'text-blue-400'}`} />
          </div>
          <span className={`text-xs font-bold leading-tight ${!upiEnabled ? 'line-through' : ''}`}>UPI Direct</span>
          <span className={`text-[9px] mt-0.5 font-medium ${!upiEnabled ? 'text-[#ef4444]' : 'text-[#a1a1aa]'}`}>
            {!upiEnabled ? 'Disabled' : 'Any UPI App'}
          </span>
        </button>

        {/* Crypto / Manual */}
        <button
          onClick={() => setSelectedMethod('usdt_bep20')}
          className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all cursor-pointer ${
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
        !fampayEnabled ? (
          <div className="bg-[#181820] border border-[#ef4444]/30 rounded-2xl p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#ef4444]/15 flex items-center justify-center mx-auto text-[#ef4444]">
              <Zap className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">Instant UPI Auto is Currently Offline</h3>
              <p className="text-xs text-[#a1a1aa] max-w-sm mx-auto">
                Automatic QR deposits have been temporarily disabled by administrator. You can still deposit using UPI Direct or Crypto below.
              </p>
            </div>
            <button
              onClick={() => setSelectedMethod('upi_direct')}
              className="inline-flex items-center gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              <span>Continue with UPI Direct</span>
            </button>
          </div>
        ) : (
        <>
          {/* STATE A: NO ACTIVE INVOICE (Select Amount, View Guidelines & Make Invoice) */}
          {!activeInvoice ? (
            verifyingDeposit ? (
              renderUpiVerificationSection(false)
            ) : (
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
                  disabled={isGenerating || amount < fampayMinDeposit}
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
            )
          ) : (
            /* STATE B: ACTIVE INVOICE VIEW (Prominent Step-by-Step FamPay Txn ID / UTR Verification Card) */
            <div className="p-4 sm:p-5 rounded-2xl bg-[#181820] border border-[#262630] flex flex-col items-center shadow-xl relative overflow-hidden">
              {/* Header with Title + 15-min countdown timer */}
              <div className="w-full flex items-center justify-between pb-3 mb-3 border-b border-[#262630]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#22c55e]/15 border border-[#22c55e]/30 flex items-center justify-center">
                    <QrCode className="w-4 h-4 text-[#22c55e]" />
                  </div>
                  <div className="text-left">
                    <span className="text-xs font-bold text-white block">UPI Instant Invoice</span>
                    <span className="text-[10px] text-[#a1a1aa]">Auto-credited via Txn ID / UTR</span>
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

                {/* Dynamic QR Code (Dual Layer: Backend Base64 Data URI with Browser SVG Fallback) */}
                <div className="w-48 h-48 mx-auto bg-white p-2.5 rounded-2xl shadow-xl flex items-center justify-center my-2 relative">
                  <div className="w-full h-full border-2 border-black flex flex-col items-center justify-center bg-white p-1">
                    {!qrImgError && activeInvoice.qrUrl ? (
                      <img
                        src={activeInvoice.qrUrl}
                        alt={`UPI Auto ₹${activeInvoice.amount}`}
                        className="w-40 h-40 object-contain"
                        onError={() => setQrImgError(true)}
                      />
                    ) : (
                      <QRCodeSVG
                        value={
                          activeInvoice.upiUri ||
                          `upi://pay?pa=${activeInvoice.upiId || merchantUpi || 'Patel.96@fam'}&pn=Payment&am=${activeInvoice.amount}&tn=${activeInvoice.reference}&cu=INR`
                        }
                        size={152}
                        level="M"
                      />
                    )}
                  </div>
                </div>

                <div className="text-center text-[10px] text-[#71717a] my-1.5">
                  Scan using GPay, PhonePe, Paytm, CRED or any UPI app
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

              {/* STEP 2: Input FamPay Txn ID or 12-Digit UTR with 60s smart auto-verify */}
              {renderUpiVerificationSection(true)}

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
        )
      )}

      {/* METHOD 2: UPI DIRECT MANUAL TRANSFER */}
      {selectedMethod === 'upi_direct' && (
        !upiEnabled ? (
          <div className="bg-[#181820] border border-[#ef4444]/30 rounded-2xl p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#ef4444]/15 flex items-center justify-center mx-auto text-[#ef4444]">
              <Building className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">UPI Direct is Currently Offline</h3>
              <p className="text-xs text-[#a1a1aa] max-w-sm mx-auto">
                UPI Direct manual deposits have been temporarily disabled by administrator. You can still deposit using UPI Auto QR or Crypto below.
              </p>
            </div>
            <button
              onClick={() => setSelectedMethod(fampayEnabled ? 'fampay' : 'usdt_bep20')}
              className="inline-flex items-center gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              <span>{fampayEnabled ? 'Continue with UPI Auto' : 'Continue with Crypto'}</span>
            </button>
          </div>
        ) : (
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
                  {merchantUpi || 'Contact @DeamonOTPbot for UPI'}
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

            {merchantUpi ? (
              <div className="flex flex-col items-center justify-center my-2 p-3 bg-[#121217] rounded-xl border border-[#262630]">
                <div className="w-44 h-44 bg-white p-2.5 rounded-2xl shadow-xl flex items-center justify-center">
                  <div className="w-full h-full border-2 border-black flex flex-col items-center justify-center bg-white p-1">
                    <QRCodeSVG
                      value={`upi://pay?pa=${merchantUpi}&pn=Payment${amount ? `&am=${amount}` : ''}&cu=INR`}
                      size={144}
                      level="M"
                    />
                  </div>
                </div>
                <span className="text-[10px] text-[#a1a1aa] mt-2 flex items-center gap-1">
                  <QrCode className="w-3 h-3 text-[#8b5cf6]" />
                  Scan with GPay, PhonePe, Paytm or any UPI app
                </span>
              </div>
            ) : null}

            {renderUpiVerificationSection(false)}
          </div>
        </div>
        )
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
                Custom crypto payment methods (Cwallet / USDT) are currently not configured. Please use UPI Auto or contact support @DeamonOTPbot.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Selector Pills if multiple methods exist */}
              {cryptoMethods.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {cryptoMethods.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedManualId(m.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        (selectedManualId === m.id || (!selectedManualId && cryptoMethods[0].id === m.id))
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
                        {decodeHtmlEntities(activeManualMethod.caption)}
                      </span>
                      <button
                        onClick={() => handleCopyCustom(decodeHtmlEntities(activeManualMethod.caption))}
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
                  {((activeManualMethod.name && activeManualMethod.name.toLowerCase().includes('cwallet')) || (activeManualMethod.caption && (activeManualMethod.caption.toLowerCase().includes('cwallet') || activeManualMethod.caption.includes('61286356')))) ? (
                    <div className="flex flex-col items-center justify-center my-2 p-3 bg-[#121217] rounded-2xl border border-[#262630]">
                      <div className="max-w-[280px] w-full rounded-2xl overflow-hidden border border-[#262630] shadow-2xl bg-white p-1">
                        <img
                          src={cwalletCardImg}
                          alt="Cwallet QR"
                          className="w-full h-auto object-contain rounded-xl"
                        />
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-white bg-[#181820] px-3 py-1.5 rounded-xl border border-[#262630]">
                          UID: 61286356
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyCustom('61286356')}
                          className="px-3 py-1.5 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-bold transition-all shadow-violet-glow-sm flex items-center gap-1.5 active:scale-95"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy UID</span>
                        </button>
                      </div>
                      <span className="text-[10px] text-[#a1a1aa] mt-2 flex items-center gap-1">
                        <QrCode className="w-3 h-3 text-[#8b5cf6]" />
                        Scan with Cwallet app or transfer to UID 61286356
                      </span>
                    </div>
                  ) : activeManualMethod.qr_url ? (
                    <div className="flex flex-col items-center justify-center my-2 p-3 bg-[#121217] rounded-xl border border-[#262630]">
                      <div className="w-48 h-48 bg-white p-2.5 rounded-2xl shadow-xl flex items-center justify-center">
                        <div className="w-full h-full border-2 border-black flex flex-col items-center justify-center bg-white p-1">
                          <img
                            src={activeManualMethod.qr_url}
                            alt={activeManualMethod.name}
                            className="w-40 h-40 object-contain"
                          />
                        </div>
                      </div>
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
