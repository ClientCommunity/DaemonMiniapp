import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  UserProfile,
  CurrencyPreference,
  Server1AccountItem,
  Server2StockItem,
  VirtualOtpServiceItem,
  ActiveOtpSession,
  SmmServiceItem,
  PaymentMethodType,
  HistoryItem,
  ResellerConfig,
  ToastMessage,
  ToastType
} from '../types';
import {
  initialUserProfile,
  initialHistoryItems,
  initialResellerConfig
} from '../data/mockData';

const LOCAL_STORAGE_KEY = 'krish_telebot_miniapp_state_v1';

export interface AppContextType {
  // State
  user: UserProfile;
  transferableBalance: number;
  currency: CurrencyPreference;
  activeTab: 'home' | 'store' | 'deposit' | 'history' | 'profile';
  selectedServer: 1 | 2 | 3 | 4 | 5;
  activeOtpSession: ActiveOtpSession | null;
  history: HistoryItem[];
  resellerConfig: ResellerConfig;
  toasts: ToastMessage[];

  // Modals & Navigation
  purchasedCredentialsModal: {
    isOpen: boolean;
    account?: Server1AccountItem;
    orderId?: string;
  } | null;
  selectedReceiptItem: HistoryItem | null;

  // Actions
  setActiveTab: (tab: 'home' | 'store' | 'deposit' | 'history' | 'profile') => void;
  setSelectedServer: (server: 1 | 2 | 3 | 4 | 5) => void;
  toggleCurrency: () => void;
  formatPrice: (amountInr: number) => string;
  addToast: (message: string, type?: ToastType, title?: string, durationMs?: number) => void;
  removeToast: (id: string) => void;

  // Store & Wallet Operations
  purchaseServer1Account: (account: Server1AccountItem) => boolean;
  purchaseServer2Session: (stockItem: Server2StockItem, quantity: number) => boolean;
  requestVirtualOtp: (service: VirtualOtpServiceItem) => boolean;
  cancelActiveOtp: (orderId: string) => void;
  finishActiveOtp: (orderId: string) => void;
  submitSmmOrder: (service: SmmServiceItem, targetLink: string, quantity: number) => boolean;
  submitDeposit: (method: PaymentMethodType, amount: number, utr?: string) => boolean;
  transferP2P: (recipient: string, amount: number) => { success: boolean; message: string };
  updateResellerMargin: (newMargin: number) => { success: boolean; message: string };
  resetDemoData: () => void;
  closeCredentialsModal: () => void;
  openReceiptDrawer: (item: HistoryItem) => void;
  closeReceiptDrawer: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Load initial state from localStorage or fallback
  const getSavedState = <T,>(key: string, fallback: T): T => {
    try {
      const raw = localStorage.getItem(`${LOCAL_STORAGE_KEY}_${key}`);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return fallback;
  };

  const [user, setUser] = useState<UserProfile>(() => getSavedState('user', initialUserProfile));
  const [currency, setCurrency] = useState<CurrencyPreference>(() => getSavedState('currency', 'INR'));
  const [activeTab, setActiveTab] = useState<'home' | 'store' | 'deposit' | 'history' | 'profile'>('home');
  const [selectedServer, setSelectedServer] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [activeOtpSession, setActiveOtpSession] = useState<ActiveOtpSession | null>(() => getSavedState('activeOtp', null));
  const [history, setHistory] = useState<HistoryItem[]>(() => getSavedState('history', initialHistoryItems));
  const [resellerConfig, setResellerConfig] = useState<ResellerConfig>(() => getSavedState('reseller', initialResellerConfig));
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Modals
  const [purchasedCredentialsModal, setPurchasedCredentialsModal] = useState<{
    isOpen: boolean;
    account?: Server1AccountItem;
    orderId?: string;
  } | null>(null);

  const [selectedReceiptItem, setSelectedReceiptItem] = useState<HistoryItem | null>(null);

  // Invariant 1: Transferable Balance = Math.max(0, user.balance - user.promoBalance)
  const transferableBalance = Math.max(0, user.balance - user.promoBalance);

  // Persist state updates to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_user`, JSON.stringify(user));
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_currency`, JSON.stringify(currency));
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_activeOtp`, JSON.stringify(activeOtpSession));
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_history`, JSON.stringify(history));
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_reseller`, JSON.stringify(resellerConfig));
    } catch {
      // localStorage quota or private mode fallback
    }
  }, [user, currency, activeOtpSession, history, resellerConfig]);

  // Toast System
  const addToast = useCallback((message: string, type: ToastType = 'info', title?: string, durationMs: number = 3000) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newToast: ToastMessage = { id, type, title, message, durationMs };
    setToasts((prev) => [...prev, newToast]);

    if (durationMs > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, durationMs);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Currency Toggle and Formatting
  const toggleCurrency = useCallback(() => {
    setCurrency((prev) => (prev === 'INR' ? 'USDT' : 'INR'));
  }, []);

  const formatPrice = useCallback((amountInr: number): string => {
    if (currency === 'INR') {
      return `₹${amountInr.toLocaleString('en-IN')}`;
    }
    const usdtAmount = amountInr / user.exchangeRateUsdt;
    return `$${usdtAmount.toFixed(2)}`;
  }, [currency, user.exchangeRateUsdt]);

  // Invariant 2: Purchases deduct Promo Balance first, then Main Balance
  const deductPurchaseAmount = (costInr: number): { success: boolean; promoUsed: number; mainUsed: number } => {
    if (user.balance < costInr) {
      addToast(
        `Insufficient balance. Required: ${formatPrice(costInr)}, Available: ${formatPrice(user.balance)}.`,
        'error',
        'Purchase Failed'
      );
      return { success: false, promoUsed: 0, mainUsed: 0 };
    }

    const promoUsed = Math.min(user.promoBalance, costInr);
    const mainUsed = costInr - promoUsed;

    setUser((prev) => ({
      ...prev,
      balance: prev.balance - costInr,
      promoBalance: prev.promoBalance - promoUsed,
      totalSaved: prev.totalSaved + (promoUsed > 0 ? promoUsed : 0)
    }));

    return { success: true, promoUsed, mainUsed };
  };

  // Server 1: Purchase Account
  const purchaseServer1Account = (account: Server1AccountItem): boolean => {
    const deduction = deductPurchaseAmount(account.priceInr);
    if (!deduction.success) return false;

    const orderId = `S1_${Date.now().toString().slice(-6)}`;
    const newHistoryItem: HistoryItem = {
      id: orderId,
      category: 'account_purchase',
      title: `${account.icon} ${account.country} Telegram Account`,
      subtitle: `Server 1 · Instant Login Delivered`,
      amountInr: -account.priceInr,
      date: 'Just now',
      status: 'success',
      server: 'Server 1 (LZT Market)',
      phone: account.credentialsSample?.phone || '+91 98234 19283',
      twoFa: account.credentialsSample?.twoFa || 'tgPass@2024',
      refunded: false
    };

    setHistory((prev) => [newHistoryItem, ...prev]);

    // Open Credential Modal
    setPurchasedCredentialsModal({
      isOpen: true,
      account,
      orderId
    });

    addToast(
      `Purchased ${account.country} Telegram Account! Credentials ready.`,
      'success',
      'Account Delivered'
    );
    return true;
  };

  // Server 2: Purchase Sessions (Good vs Cheap Quality)
  const purchaseServer2Session = (stockItem: Server2StockItem, quantity: number): boolean => {
    const totalCost = stockItem.priceInr * quantity;
    const deduction = deductPurchaseAmount(totalCost);
    if (!deduction.success) return false;

    const orderId = `S2_${Date.now().toString().slice(-6)}`;
    const isBulk = quantity > 1;
    const deliveryTitle = isBulk
      ? `📦 Bulk ZIP (${quantity}x ${stockItem.country} Sessions)`
      : `${stockItem.icon} ${stockItem.country} Telegram (${stockItem.accountYear})`;

    const newHistoryItem: HistoryItem = {
      id: orderId,
      category: 'account_purchase',
      title: deliveryTitle,
      subtitle: `Server 2 (${stockItem.subtitle}) · ${stockItem.accountYear}`,
      amountInr: -totalCost,
      date: 'Just now',
      status: 'success',
      server: 'Server 2 (Sessions Stock)',
      quantity,
      sessionDownloadUrl: stockItem.sampleSessionUrl || `https://krishminiapp.mock/download/${orderId}.zip`,
      refunded: false
    };

    setHistory((prev) => [newHistoryItem, ...prev]);

    addToast(
      isBulk
        ? `Delivered ${quantity} sessions ZIP package successfully!`
        : `Purchased ${stockItem.country} account! Session file ready.`,
      'success',
      'Purchase Complete'
    );
    return true;
  };

  // Server 3 & 4: Virtual OTP Numbers (Fast OTP & Fresh Numbers)
  const requestVirtualOtp = (service: VirtualOtpServiceItem): boolean => {
    if (activeOtpSession && activeOtpSession.status === 'waiting') {
      addToast(
        'You already have an active OTP session in progress. Please finish or cancel it first.',
        'warning',
        'Active Session Exists'
      );
      return false;
    }

    const deduction = deductPurchaseAmount(service.priceInr);
    if (!deduction.success) return false;

    const orderId = `ACT_${Date.now().toString().slice(-6)}`;
    // Generate realistic phone number based on country code
    const randomDigits = Math.floor(10000000 + Math.random() * 90000000);
    const countryPrefix = service.countryCode === 'IN' ? '+91 ' : service.countryCode === 'US' ? '+1 ' : service.countryCode === 'RU' ? '+7 ' : '+44 ';
    const generatedPhone = `${countryPrefix}${randomDigits}`;

    const newSession: ActiveOtpSession = {
      orderId,
      server: service.server,
      serviceName: service.serviceName,
      country: service.country,
      phone: generatedPhone,
      priceInr: service.priceInr,
      status: 'waiting',
      otpCode: null,
      startTime: Date.now(),
      totalDurationSeconds: 600, // 10 minutes
      remainingSeconds: 600
    };

    setActiveOtpSession(newSession);

    const historyRecord: HistoryItem = {
      id: orderId,
      category: 'otp_activation',
      title: `${service.icon} ${service.serviceName} (${service.country})`,
      subtitle: `Server ${service.server} · Waiting for SMS`,
      amountInr: -service.priceInr,
      date: 'Just now',
      status: 'waiting',
      server: `Server ${service.server}`,
      phone: generatedPhone,
      refunded: false
    };

    setHistory((prev) => [historyRecord, ...prev]);

    addToast(
      `Number assigned: ${generatedPhone}. Waiting for SMS code...`,
      'info',
      'Number Activated'
    );
    return true;
  };

  // Countdown timer & mock auto-resolve for Active OTP
  useEffect(() => {
    if (!activeOtpSession) return;

    if (activeOtpSession.status === 'waiting') {
      const interval = setInterval(() => {
        setActiveOtpSession((prev) => {
          if (!prev || prev.status !== 'waiting') return prev;

          // Check if it's time to auto-resolve (e.g. after ~5 seconds from start)
          const elapsed = (Date.now() - prev.startTime) / 1000;
          if (elapsed >= 5 && !prev.otpCode) {
            // Generate a realistic 6-digit OTP code (e.g. 582-901)
            const d1 = Math.floor(100 + Math.random() * 900);
            const d2 = Math.floor(100 + Math.random() * 900);
            const sampleCode = `${d1}-${d2}`;

            // Trigger telegram haptic if available
            try {
              if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
              }
            } catch {
              // ignore
            }

            addToast(
              `SMS Code received for ${prev.phone}: ${sampleCode}`,
              'success',
              'OTP Code Arrived!'
            );

            // Update history
            setHistory((hPrev) =>
              hPrev.map((item) =>
                item.id === prev.orderId
                  ? { ...item, status: 'success', otpCode: sampleCode, subtitle: `Server ${prev.server} · SMS Received` }
                  : item
              )
            );

            return {
              ...prev,
              status: 'received',
              otpCode: sampleCode
            };
          }

          if (prev.remainingSeconds <= 1) {
            // Expired
            return {
              ...prev,
              status: 'expired',
              remainingSeconds: 0
            };
          }

          return {
            ...prev,
            remainingSeconds: prev.remainingSeconds - 1
          };
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [activeOtpSession, addToast]);

  // Cancel & Refund Active OTP
  const cancelActiveOtp = (orderId: string) => {
    if (!activeOtpSession || activeOtpSession.orderId !== orderId) return;

    // Refund cost to user
    const refundAmount = activeOtpSession.priceInr;
    setUser((prev) => ({
      ...prev,
      balance: prev.balance + refundAmount
    }));

    // Mark in history as refunded
    setHistory((prev) =>
      prev.map((item) =>
        item.id === orderId
          ? { ...item, status: 'refunded', refunded: true, subtitle: 'Order Cancelled & Refunded' }
          : item
      )
    );

    setActiveOtpSession(null);

    addToast(
      `Number cancelled. ₹${refundAmount} has been refunded to your balance.`,
      'info',
      'Refund Processed'
    );
  };

  // Finish Active OTP
  const finishActiveOtp = (orderId: string) => {
    if (!activeOtpSession || activeOtpSession.orderId !== orderId) return;

    setHistory((prev) =>
      prev.map((item) =>
        item.id === orderId ? { ...item, status: 'success' } : item
      )
    );

    setActiveOtpSession(null);
    addToast('Order completed successfully! Stored in History.', 'success', 'Done');
  };

  // Server 5: SMM Services Order
  const submitSmmOrder = (service: SmmServiceItem, targetLink: string, quantity: number): boolean => {
    if (quantity < service.minQuantity || quantity > service.maxQuantity) {
      addToast(
        `Quantity must be between ${service.minQuantity} and ${service.maxQuantity.toLocaleString()}.`,
        'error',
        'Invalid Quantity'
      );
      return false;
    }

    if (!targetLink || !targetLink.trim()) {
      addToast('Please provide a valid target URL or channel username.', 'error', 'Missing Link');
      return false;
    }

    const totalCost = Math.round((service.ratePer1000 * quantity) / 1000);
    const deduction = deductPurchaseAmount(totalCost);
    if (!deduction.success) return false;

    const orderId = `SMM_${Date.now().toString().slice(-6)}`;
    const newHistoryItem: HistoryItem = {
      id: orderId,
      category: 'smm_order',
      title: `${service.name} (${quantity.toLocaleString()})`,
      subtitle: `Target: ${targetLink} · Processing`,
      amountInr: -totalCost,
      date: 'Just now',
      status: 'in_progress',
      server: 'Server 5 (SMM)',
      quantity,
      targetLink,
      refunded: false
    };

    setHistory((prev) => [newHistoryItem, ...prev]);

    addToast(
      `SMM Order submitted for ${quantity.toLocaleString()} units! Starting shortly.`,
      'success',
      'SMM Boost Activated'
    );
    return true;
  };

  // Deposit Top-Up
  const submitDeposit = (method: PaymentMethodType, amount: number, utr?: string): boolean => {
    if (amount <= 0) {
      addToast('Deposit amount must be greater than ₹0.', 'error', 'Invalid Amount');
      return false;
    }

    const orderId = `DEP_${Date.now().toString().slice(-6)}`;
    const methodNames: Record<PaymentMethodType, string> = {
      fampay: 'FamPay Instant UPI',
      upi_direct: 'Manual UPI Direct',
      usdt_bep20: 'USDT BEP20 Crypto'
    };

    // Credit balance directly to main transferable balance
    setUser((prev) => ({
      ...prev,
      balance: prev.balance + amount,
      totalDeposited: prev.totalDeposited + amount
    }));

    const newHistoryItem: HistoryItem = {
      id: orderId,
      category: 'deposit',
      title: `${methodNames[method]} Deposit`,
      subtitle: utr ? `UTR: ${utr} · Verified` : 'Instant Top-Up · Credited',
      amountInr: amount,
      date: 'Just now',
      status: 'success',
      utr,
      refunded: false
    };

    setHistory((prev) => [newHistoryItem, ...prev]);

    addToast(
      `🎉 Deposit Verified! +₹${amount.toLocaleString('en-IN')} added to your Main Balance.`,
      'success',
      'Balance Credited'
    );
    return true;
  };

  // Invariant 3: P2P Balance Transfer
  // Invariant Rule: Transfer Amount <= user.balance - user.promoBalance.
  // Promo balance CANNOT be transferred under any circumstances!
  const transferP2P = (recipient: string, amount: number): { success: boolean; message: string } => {
    if (!recipient || !recipient.trim()) {
      return { success: false, message: 'Please enter a valid Telegram ID or @username.' };
    }

    if (amount <= 0) {
      return { success: false, message: 'Transfer amount must be greater than ₹0.' };
    }

    if (amount > transferableBalance) {
      const err = `Insufficient transferable balance (Available: ₹${transferableBalance}). Promo balance (₹${user.promoBalance}) is locked for purchases only.`;
      addToast(err, 'error', 'P2P Transfer Blocked');
      return {
        success: false,
        message: err
      };
    }

    // Deduct from total balance (transferable only, promoBalance untouched)
    setUser((prev) => ({
      ...prev,
      balance: prev.balance - amount
    }));

    const orderId = `TRF_${Date.now().toString().slice(-6)}`;
    const newHistoryItem: HistoryItem = {
      id: orderId,
      category: 'transfer',
      title: `P2P Transfer to ${recipient}`,
      subtitle: `Zero Fee · Dispatched Instantly`,
      amountInr: -amount,
      date: 'Just now',
      status: 'success',
      recipient,
      refunded: false
    };

    setHistory((prev) => [newHistoryItem, ...prev]);

    addToast(
      `Sent ₹${amount} to ${recipient} successfully!`,
      'success',
      'P2P Transfer Completed'
    );

    return { success: true, message: `Successfully transferred ₹${amount} to ${recipient}.` };
  };

  // Invariant 4: Reseller Custom Margin Engine (₹5 <= Margin <= ₹100)
  const updateResellerMargin = (newMargin: number): { success: boolean; message: string } => {
    if (newMargin < 5 || newMargin > 100) {
      const err = 'Custom margin must be between ₹5 and ₹100.';
      addToast(err, 'error', 'Invalid Margin');
      return { success: false, message: err };
    }

    const updatedToken = `resell_${Math.random().toString(36).substring(2, 8)}`;
    const updatedLink = `https://t.me/DeamonOTPbot?start=${updatedToken}`;

    setResellerConfig((prev) => ({
      ...prev,
      token: updatedToken,
      marginInr: newMargin,
      resellerLink: updatedLink
    }));

    addToast(
      `Custom profit margin set to ₹${newMargin}! Reseller link updated.`,
      'success',
      'Reseller Settings Saved'
    );

    return { success: true, message: 'Reseller margin updated.' };
  };

  // Reset Demo Data
  const resetDemoData = () => {
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_user`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_currency`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_activeOtp`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_history`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_reseller`);

    setUser(initialUserProfile);
    setCurrency('INR');
    setActiveOtpSession(null);
    setHistory(initialHistoryItems);
    setResellerConfig(initialResellerConfig);
    setActiveTab('home');

    addToast('Demo data restored to initial state!', 'info', 'Data Reset');
  };

  const closeCredentialsModal = () => {
    setPurchasedCredentialsModal(null);
  };

  const openReceiptDrawer = (item: HistoryItem) => {
    setSelectedReceiptItem(item);
  };

  const closeReceiptDrawer = () => {
    setSelectedReceiptItem(null);
  };

  return (
    <AppContext.Provider
      value={{
        user,
        transferableBalance,
        currency,
        activeTab,
        selectedServer,
        activeOtpSession,
        history,
        resellerConfig,
        toasts,
        purchasedCredentialsModal,
        selectedReceiptItem,
        setActiveTab,
        setSelectedServer,
        toggleCurrency,
        formatPrice,
        addToast,
        removeToast,
        purchaseServer1Account,
        purchaseServer2Session,
        requestVirtualOtp,
        cancelActiveOtp,
        finishActiveOtp,
        submitSmmOrder,
        submitDeposit,
        transferP2P,
        updateResellerMargin,
        resetDemoData,
        closeCredentialsModal,
        openReceiptDrawer,
        closeReceiptDrawer
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
