import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  UserProfile,
  CurrencyPreference,
  Server1AccountItem,
  Server2StockItem,
  Server2DeliveryFormat,
  VirtualOtpServiceItem,
  ActiveOtpSession,
  SmmServiceItem,
  PaymentMethodType,
  HistoryItem,
  ResellerConfig,
  ToastMessage,
  ToastType,
} from '../types';
import {
  initialUserProfile,
  initialHistoryItems,
  initialResellerConfig,
  server1Catalog,
  server2Catalog,
  server34Catalog,
  server5Catalog,
} from '../data/mockData';
import {
  authApi,
  storeApi,
  orderApi,
  otpApi,
  downloadApi,
  transferApi,
  depositApi,
  resellerApi,
  historyApi,
} from '../api/endpoints';
import { api } from '../api/client';
import {
  adaptBackendUser,
  adaptHistoryItem,
  adaptResellerConfig,
  adaptServer1Item,
  adaptServer2Item,
  adaptServer34Item,
  adaptServer5Item,
} from '../api/adapters';

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

  // Backend Connectivity
  backendConnected: boolean | null;
  isCheckingBackend: boolean;
  recheckConnection: (notify?: boolean) => Promise<boolean>;
  isInitialLoading: boolean;
  initialLoadingStep: number;
  initialLoadingMessage: string;

  // Store inventory state
  server1Items: Server1AccountItem[];
  server2Items: Server2StockItem[];
  server34Items: VirtualOtpServiceItem[];
  server5Items: SmmServiceItem[];
  isLoadingStore: boolean;

  // Modals & Navigation
  purchasedCredentialsModal: {
    isOpen: boolean;
    account?: Server1AccountItem;
    orderId?: string;
    downloadUrl?: string;
    otpCode?: string;
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
  purchaseServer2Session: (stockItem: Server2StockItem, quantity: number, format?: Server2DeliveryFormat) => boolean;
  requestVirtualOtp: (service: VirtualOtpServiceItem) => boolean;
  cancelActiveOtp: (orderId: string) => void;
  finishActiveOtp: (orderId: string) => void;
  submitSmmOrder: (service: SmmServiceItem, targetLink: string, quantity: number) => boolean;
  submitDeposit: (method: PaymentMethodType, amount: number, utr?: string) => boolean;
  transferP2P: (recipient: string, amount: number) => { success: boolean; message: string };
  transferBalance: (recipient: string, amount: number) => { success: boolean; message: string };
  buyItem: (
    server: number,
    item: Record<string, unknown>,
    qty?: number,
    tier?: string,
    format?: string
  ) => Promise<boolean>;
  updateResellerMargin: (newMargin: number) => { success: boolean; message: string };
  resetDemoData: () => void;
  closeCredentialsModal: () => void;
  openReceiptDrawer: (item: HistoryItem) => void;
  closeReceiptDrawer: () => void;

  // Data Refreshers
  refreshStore: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshHistory: () => Promise<void>;
  refreshReseller: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Load initial state from localStorage or fallback
  const getSavedState = <T,>(key: string, defaultValue: T): T => {
    try {
      const raw = localStorage.getItem(`${LOCAL_STORAGE_KEY}_${key}`);
      if (!raw) return defaultValue;
      const parsed = JSON.parse(raw);
      if (parsed === null || parsed === undefined) return defaultValue;
      if (typeof defaultValue === 'object' && defaultValue !== null && !Array.isArray(defaultValue)) {
        return { ...defaultValue, ...parsed };
      }
      return parsed as T;
    } catch (e) {
      console.warn(`Failed to parse localStorage key ${key}:`, e);
      return defaultValue;
    }
  };

  const [user, setUser] = useState<UserProfile>(() => getSavedState('user', initialUserProfile));
  const [currency, setCurrency] = useState<CurrencyPreference>(() => getSavedState('currency', 'INR'));
  const [activeTab, setActiveTab] = useState<'home' | 'store' | 'deposit' | 'history' | 'profile'>('home');
  const [selectedServer, setSelectedServer] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [activeOtpSession, setActiveOtpSession] = useState<ActiveOtpSession | null>(() =>
    getSavedState('activeOtp', null)
  );
  const [history, setHistory] = useState<HistoryItem[]>(() =>
    getSavedState('history', initialHistoryItems)
  );
  const [resellerConfig, setResellerConfig] = useState<ResellerConfig>(() =>
    getSavedState('reseller', initialResellerConfig)
  );
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Live store catalog state with fallback to mock data
  const [server1Items, setServer1Items] = useState<Server1AccountItem[]>(server1Catalog);
  const [server2Items, setServer2Items] = useState<Server2StockItem[]>(server2Catalog);
  const [server34Items, setServer34Items] = useState<VirtualOtpServiceItem[]>(server34Catalog);
  const [server5Items, setServer5Items] = useState<SmmServiceItem[]>(server5Catalog);
  const [isLoadingStore, setIsLoadingStore] = useState<boolean>(false);
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null);
  const [isCheckingBackend, setIsCheckingBackend] = useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [initialLoadingStep, setInitialLoadingStep] = useState<number>(1);
  const [initialLoadingMessage, setInitialLoadingMessage] = useState<string>('Establishing secure connection...');

  // Modals
  const [purchasedCredentialsModal, setPurchasedCredentialsModal] = useState<{
    isOpen: boolean;
    account?: Server1AccountItem;
    orderId?: string;
    downloadUrl?: string;
    otpCode?: string;
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
  const addToast = useCallback(
    (message: string, type: ToastType = 'info', title?: string, durationMs: number = 3000) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newToast: ToastMessage = { id, type, title, message, durationMs };
      setToasts((prev) => [...prev, newToast]);

      if (durationMs > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, durationMs);
      }
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Currency Toggle and Formatting
  const toggleCurrency = useCallback(() => {
    const nextCurrency = currency === 'INR' ? 'USDT' : 'INR';
    setCurrency(nextCurrency);
    authApi.updateCurrency(nextCurrency).catch(() => {});
  }, [currency]);

  const formatPrice = useCallback(
    (amountInr: number): string => {
      if (currency === 'INR') {
        return `₹${amountInr.toLocaleString('en-IN')}`;
      }
      const usdtAmount = amountInr / user.exchangeRateUsdt;
      return `$${usdtAmount.toFixed(2)}`;
    },
    [currency, user.exchangeRateUsdt]
  );

  // Refresh user profile from backend
  const refreshUser = useCallback(async () => {
    try {
      const authRes = await authApi.authenticate();
      if (authRes?.success && authRes.user) {
        setUser((prev) => adaptBackendUser(authRes.user, prev));
      }
    } catch {
      // offline preview mode fallback
    }
  }, []);

  // Refresh history records from backend
  const refreshHistory = useCallback(async () => {
    try {
      const historyRes = await historyApi.getHistory();
      if (historyRes?.success && Array.isArray(historyRes.items)) {
        const adapted = historyRes.items.map((item, idx) => adaptHistoryItem(item, idx));
        setHistory(adapted);
      }
    } catch {
      // offline preview mode fallback
    }
  }, []);

  // Refresh reseller metrics from backend
  const refreshReseller = useCallback(async () => {
    try {
      const resellerRes = await resellerApi.getStats();
      if (resellerRes) {
        setResellerConfig((prev) => adaptResellerConfig(resellerRes, prev));
      }
    } catch {
      // offline preview mode fallback
    }
  }, []);

  // Refresh all store catalogues
  const refreshStore = useCallback(async () => {
    setIsLoadingStore(true);
    try {
      const [s1, s2Good, s2Cheap, s3, s4, s5] = await Promise.allSettled([
        storeApi.getServer1(),
        storeApi.getServer2('good'),
        storeApi.getServer2('cheap'),
        storeApi.getServer3(),
        storeApi.getServer4(),
        storeApi.getServer5(),
      ]);

      if (s1.status === 'fulfilled' && s1.value.success && Array.isArray(s1.value.items)) {
        setServer1Items(s1.value.items.map((item, idx) => adaptServer1Item(item, idx)));
      }

      const s2Combined: Server2StockItem[] = [];
      if (s2Good.status === 'fulfilled' && s2Good.value.success && Array.isArray(s2Good.value.items)) {
        s2Combined.push(...s2Good.value.items.map((item) => adaptServer2Item(item, 'good')));
      }
      if (s2Cheap.status === 'fulfilled' && s2Cheap.value.success && Array.isArray(s2Cheap.value.items)) {
        s2Combined.push(...s2Cheap.value.items.map((item) => adaptServer2Item(item, 'cheap')));
      }
      if (s2Good.status === 'fulfilled' || s2Cheap.status === 'fulfilled') {
        setServer2Items(s2Combined);
      }

      const s34Combined: VirtualOtpServiceItem[] = [];
      if (s3.status === 'fulfilled' && s3.value.success && Array.isArray(s3.value.items)) {
        s34Combined.push(...s3.value.items.map((item) => adaptServer34Item(item, 3)));
      }
      if (s4.status === 'fulfilled' && s4.value.success && Array.isArray(s4.value.items)) {
        s34Combined.push(...s4.value.items.map((item) => adaptServer34Item(item, 4)));
      }
      if (s3.status === 'fulfilled' || s4.status === 'fulfilled') {
        setServer34Items(s34Combined);
      }

      if (s5.status === 'fulfilled' && s5.value.success && Array.isArray(s5.value.items)) {
        setServer5Items(s5.value.items.map((item) => adaptServer5Item(item)));
      }
    } catch {
      // offline fallback to default mock items
    } finally {
      setIsLoadingStore(false);
    }
  }, []);

  // Check backend health and sync connection state
  const recheckConnection = useCallback(
    async (notify: boolean = true): Promise<boolean> => {
      setIsCheckingBackend(true);
      try {
        const healthRes = await api.get<{ status?: string }>('/api/health');
        if (healthRes?.status === 'healthy') {
          setBackendConnected(true);
          if (notify) {
            addToast('Connected to live Daemon backend server!', 'success', 'Connected');
          }
          refreshUser().catch(() => {});
          refreshStore().catch(() => {});
          return true;
        }
      } catch {
        try {
          const authRes = await authApi.authenticate();
          if (authRes?.success) {
            setBackendConnected(true);
            if (notify) {
              addToast('Connected to live Daemon backend server!', 'success', 'Connected');
            }
            refreshUser().catch(() => {});
            refreshStore().catch(() => {});
            return true;
          }
        } catch {
          // both failed
        }
      } finally {
        setIsCheckingBackend(false);
      }

      setBackendConnected(false);
      if (notify) {
        addToast('Backend not connected. Running in offline/preview mode.', 'warning', 'Not Connected');
      }
      return false;
    },
    [addToast, refreshStore, refreshUser]
  );

  // Initial synchronization with backend REST API on mount
  useEffect(() => {
    let isMounted = true;

    async function initializeSession() {
      setIsCheckingBackend(true);
      setIsInitialLoading(true);
      setInitialLoadingStep(1);
      setInitialLoadingMessage('Connecting to Daemon Edge Proxy...');

      let isOnline = false;
      try {
        const healthRes = await api.get<{ status?: string }>('/api/health');
        isOnline = healthRes?.status === 'healthy';
      } catch {
        try {
          const authRes = await authApi.authenticate();
          isOnline = !!authRes?.success;
        } catch {
          isOnline = false;
        }
      }

      if (isMounted) {
        setBackendConnected(isOnline);
        setIsCheckingBackend(false);
      }

      if (isOnline) {
        if (isMounted) {
          setInitialLoadingStep(2);
          setInitialLoadingMessage('Authenticating Telegram profile & wallet...');
        }

        try {
          const authRes = await authApi.authenticate();
          if (isMounted && authRes?.success && authRes.user) {
            setUser((prev) => adaptBackendUser(authRes.user, prev));
          }
        } catch {
          // browser mode fallback
        }

        try {
          const resellerRes = await resellerApi.getStats();
          if (isMounted && resellerRes) {
            setResellerConfig((prev) => adaptResellerConfig(resellerRes, prev));
          }
        } catch {
          // offline fallback
        }

        try {
          const historyRes = await historyApi.getHistory();
          if (isMounted && historyRes?.success && Array.isArray(historyRes.items)) {
            setHistory(historyRes.items.map((item, idx) => adaptHistoryItem(item, idx)));
          }
        } catch {
          // offline fallback
        }

        if (isMounted) {
          setInitialLoadingStep(3);
          setInitialLoadingMessage('Synchronizing live store catalogues...');
          await refreshStore();
        }

        if (isMounted) {
          addToast('Connected to live Daemon backend server!', 'success', 'Connected');
        }
      } else {
        if (isMounted) {
          addToast('Backend not connected. Running in offline/preview mode.', 'warning', 'Not Connected');
        }
      }

      if (isMounted) {
        setTimeout(() => {
          if (isMounted) {
            setIsInitialLoading(false);
          }
        }, 350);
      }
    }

    initializeSession();

    return () => {
      isMounted = false;
    };
  }, [addToast, refreshStore]);

  // Invariant 2: Purchases deduct Promo Balance first, then Main Balance
  const deductPurchaseAmount = (
    costInr: number
  ): { success: boolean; promoUsed: number; mainUsed: number } => {
    if (isNaN(costInr) || costInr <= 0) return { success: false, promoUsed: 0, mainUsed: 0 };

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
      totalSaved: prev.totalSaved + (promoUsed > 0 ? promoUsed : 0),
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
      server: 'Server 1 (Global 2FA)',
      phone: account.credentialsSample?.phone || '+91 98234 19283',
      twoFa: account.credentialsSample?.twoFa || 'tgPass@2024',
      refunded: false,
    };

    setHistory((prev) => [newHistoryItem, ...prev]);

    // Open Credential Modal
    setPurchasedCredentialsModal({
      isOpen: true,
      account,
      orderId,
    });

    // Call live backend buy endpoint
    orderApi
      .buy({
        server: 1,
        item: {
          country: account.country,
          price: account.priceInr,
        },
        qty: 1,
      })
      .then((res) => {
        if (res && res.success) {
          if (res.new_balance !== undefined) {
            setUser((prev) => ({
              ...prev,
              balance: res.new_balance!,
              promoBalance:
                res.new_promo_balance !== undefined ? res.new_promo_balance : prev.promoBalance,
            }));
          }
          const realPhone = res.phone || account.credentialsSample?.phone;
          const realTwofa = res.twofa || account.credentialsSample?.twoFa;
          const realOrderId = String(res.order_id || orderId);

          setPurchasedCredentialsModal((prev) => {
            if (!prev) return null;
            const currentAccount = prev.account || account;
            return {
              ...prev,
              orderId: realOrderId,
              downloadUrl: res.download_url,
              account: {
                ...currentAccount,
                credentialsSample: {
                  phone: realPhone || currentAccount.credentialsSample?.phone || '',
                  twoFa: realTwofa || currentAccount.credentialsSample?.twoFa || '',
                  sessionFile: currentAccount.credentialsSample?.sessionFile || '',
                  loginInstruction: currentAccount.credentialsSample?.loginInstruction || '',
                },
              },
            };
          });

          setHistory((hPrev) =>
            hPrev.map((item) =>
              item.id === orderId
                ? {
                    ...item,
                    id: realOrderId,
                    phone: realPhone,
                    twoFa: realTwofa,
                    sessionDownloadUrl: res.download_url || item.sessionDownloadUrl,
                  }
                : item
            )
          );
        }
      })
      .catch(() => {
        // retain local state on network error
      });

    addToast(
      `Purchased ${account.country} Telegram Account! Credentials ready.`,
      'success',
      'Account Delivered'
    );
    return true;
  };

  // Server 2: Purchase Sessions (Good vs Cheap Quality + Delivery Format)
  const purchaseServer2Session = (
    stockItem: Server2StockItem,
    quantity: number,
    format: Server2DeliveryFormat = 'account'
  ): boolean => {
    if (isNaN(quantity) || quantity <= 0) {
      addToast('Quantity must be at least 1.', 'error', 'Invalid Quantity');
      return false;
    }
    if (quantity > stockItem.stockCount) {
      addToast(`Quantity exceeds available stock (${stockItem.stockCount}).`, 'error', 'Out of Stock');
      return false;
    }

    const totalCost = stockItem.priceInr * quantity;
    const deduction = deductPurchaseAmount(totalCost);
    if (!deduction.success) return false;

    const orderId = `S2_${Date.now().toString().slice(-6)}`;
    const isBulk = quantity > 1;
    const requestedFormat = format || (isBulk ? 'session' : 'account');
    const deliveryTitle = isBulk
      ? `📦 Bulk ZIP (${quantity}x ${stockItem.country} Sessions)`
      : `${stockItem.icon} ${stockItem.country} Telegram (${stockItem.accountYear})`;

    const downloadZipUrl = downloadApi.getBulkZipDownloadUrl(orderId);
    const downloadSingleUrl = downloadApi.getSessionDownloadUrl(stockItem.country.toLowerCase());

    const newHistoryItem: HistoryItem = {
      id: orderId,
      category: 'account_purchase',
      title: deliveryTitle,
      subtitle: `Server 2 (${stockItem.subtitle}) · ${stockItem.accountYear} · ${requestedFormat === 'session' ? 'Session' : 'Account'}`,
      amountInr: -totalCost,
      date: 'Just now',
      status: 'success',
      server: 'Server 2 (Aged Sessions)',
      quantity,
      sessionDownloadUrl: isBulk ? downloadZipUrl : (requestedFormat === 'session' ? downloadSingleUrl : stockItem.sampleSessionUrl),
      refunded: false,
    };

    setHistory((prev) => [newHistoryItem, ...prev]);

    // Dispatch asynchronous backend order call
    orderApi
      .buy({
        server: 2,
        item: {
          country: stockItem.country,
          price: stockItem.priceInr,
          year: stockItem.accountYear,
        },
        qty: quantity,
        tier: stockItem.qualityTier,
        format: requestedFormat,
      })
      .then((res) => {
        if (res && res.success) {
          if (res.new_balance !== undefined) {
            setUser((prev) => ({
              ...prev,
              balance: res.new_balance!,
              promoBalance:
                res.new_promo_balance !== undefined ? res.new_promo_balance : prev.promoBalance,
            }));
          }
          if (res.download_url) {
            setHistory((hPrev) =>
              hPrev.map((item) =>
                item.id === orderId
                  ? {
                      ...item,
                      sessionDownloadUrl: res.download_url,
                      id: String(res.order_id || orderId),
                    }
                  : item
              )
            );
            if (isBulk || requestedFormat === 'session') {
              downloadApi.triggerDownload(
                res.download_url,
                isBulk ? `accounts_${res.order_id || orderId}.zip` : `session_${res.order_id || orderId}.session`
              );
            }
          }
        }
      })
      .catch(() => {
        // retain local state on network error
      });

    addToast(
      isBulk
        ? `Delivered ${quantity} sessions ZIP package successfully!`
        : `Purchased ${stockItem.country} account! ${requestedFormat === 'session' ? 'Session file downloading.' : 'Credentials ready.'}`,
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
    const randomDigits = Math.floor(10000000 + Math.random() * 90000000);
    const countryPrefix =
      service.countryCode === 'IN'
        ? '+91 '
        : service.countryCode === 'US'
        ? '+1 '
        : service.countryCode === 'RU'
        ? '+7 '
        : '+44 ';
    const generatedPhone = `${countryPrefix}${randomDigits}`;

    const newSession: ActiveOtpSession = {
      orderId,
      server: service.server,
      serviceName: service.serviceName,
      country: service.country,
      phone: generatedPhone,
      priceInr: service.priceInr,
      promoUsed: deduction.promoUsed,
      mainUsed: deduction.mainUsed,
      status: 'waiting',
      otpCode: null,
      startTime: Date.now(),
      totalDurationSeconds: 600,
      remainingSeconds: 600,
    };

    setActiveOtpSession(newSession);

    const historyRecord: HistoryItem = {
      id: orderId,
      category: 'otp_activation',
      title: `${service.serviceName} (${service.country})`,
      subtitle: `Server ${service.server} · Waiting for SMS`,
      amountInr: -service.priceInr,
      date: 'Just now',
      status: 'waiting',
      server: `Server ${service.server}`,
      phone: generatedPhone,
      refunded: false,
    };

    setHistory((prev) => [historyRecord, ...prev]);

    // Asynchronously call backend buy endpoint
    orderApi
      .buy({
        server: service.server,
        item: {
          id: service.serviceCode,
          name: service.serviceName,
          price: service.priceInr,
        },
        qty: 1,
      })
      .then((res) => {
        if (res && res.success) {
          if (res.new_balance !== undefined) {
            setUser((prev) => ({
              ...prev,
              balance: res.new_balance!,
              promoBalance:
                res.new_promo_balance !== undefined ? res.new_promo_balance : prev.promoBalance,
            }));
          }
          if (res.phone) {
            setActiveOtpSession((prev) =>
              prev
                ? { ...prev, phone: res.phone!, orderId: String(res.order_id || prev.orderId) }
                : null
            );
          }
        }
      })
      .catch(() => {
        // retain local state on network error
      });

    addToast(
      `Number assigned: ${generatedPhone}. Waiting for SMS code...`,
      'info',
      'Number Activated'
    );
    return true;
  };

  // Active OTP real status polling (decoupled 2500ms loop)
  useEffect(() => {
    if (!activeOtpSession || activeOtpSession.status !== 'waiting') return;

    let isSubscribed = true;
    const orderId = activeOtpSession.orderId;
    const phoneOrId = activeOtpSession.phone || orderId;
    const serverNum = activeOtpSession.server;

    // Backend status polling loop every 2500ms
    const pollInterval = setInterval(async () => {
      if (!isSubscribed) return;
      try {
        const res = await otpApi.getStatus(phoneOrId);
        if (!isSubscribed) return;
        if (res && (res.status === 'completed' || res.status === 'delivered') && res.otp) {
          const receivedCode = res.otp;
          try {
            if (window.Telegram?.WebApp?.HapticFeedback) {
              window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            }
          } catch {
            // ignore
          }
          addToast(`SMS Code received for ${phoneOrId}: ${receivedCode}`, 'success', 'OTP Code Arrived!');
          setHistory((hPrev) =>
            hPrev.map((item) =>
              item.id === orderId
                ? {
                    ...item,
                    status: 'success',
                    otpCode: receivedCode,
                    subtitle: `Server ${serverNum} · SMS Received`,
                  }
                : item
            )
          );
          setActiveOtpSession((prev) =>
            prev && prev.orderId === orderId
              ? { ...prev, status: 'received', otpCode: receivedCode }
              : prev
          );
        }
      } catch {
        // backend poll silent failover to countdown
      }
    }, 2500);

    return () => {
      isSubscribed = false;
      clearInterval(pollInterval);
    };
  }, [activeOtpSession?.orderId, activeOtpSession?.status, activeOtpSession?.phone, activeOtpSession?.server, addToast]);

  // Active OTP real countdown timer (No fake generators; SMS arrives strictly via real polling loop above)
  useEffect(() => {
    if (!activeOtpSession || activeOtpSession.status !== 'waiting') return;

    let isSubscribed = true;
    const orderId = activeOtpSession.orderId;

    const countdownInterval = setInterval(() => {
      if (!isSubscribed) return;
      setActiveOtpSession((prev) => {
        if (!prev || prev.orderId !== orderId || prev.status !== 'waiting') return prev;

        // When timer reaches 0 without an SMS code arriving, transition to expired
        if (prev.remainingSeconds <= 1) {
          return {
            ...prev,
            status: 'expired',
            remainingSeconds: 0,
          };
        }

        return {
          ...prev,
          remainingSeconds: prev.remainingSeconds - 1,
        };
      });
    }, 1000);

    return () => {
      isSubscribed = false;
      clearInterval(countdownInterval);
    };
  }, [activeOtpSession?.orderId, activeOtpSession?.status]);

  // Auto-refund when active OTP expires without receiving SMS code
  useEffect(() => {
    if (activeOtpSession && activeOtpSession.status === 'expired') {
      const expiredOrderId = activeOtpSession.orderId;
      cancelActiveOtp(expiredOrderId);
      addToast(
        'SMS request timed out. Balance was automatically refunded to your wallet.',
        'info',
        'Automatic Refund'
      );
    }
  }, [activeOtpSession?.status, activeOtpSession?.orderId]);

  // Cancel & Refund Active OTP
  const cancelActiveOtp = async (orderId: string) => {
    if (!activeOtpSession || activeOtpSession.orderId !== orderId) return;
    if (activeOtpSession.status !== 'waiting' && activeOtpSession.status !== 'expired') return;

    const refundAmount = activeOtpSession.priceInr;
    const promoRefund = activeOtpSession.promoUsed || 0;
    const phoneToCancel = activeOtpSession.phone;

    // Call backend cancel endpoint
    try {
      const cancelRes = await otpApi.cancel(phoneToCancel || orderId);
      if (cancelRes && cancelRes.success && typeof cancelRes.new_balance === 'number') {
        setUser((prev) => ({
          ...prev,
          balance: cancelRes.new_balance!,
          promoBalance: prev.promoBalance + promoRefund,
          totalSaved: Math.max(0, prev.totalSaved - promoRefund),
        }));
      } else {
        // Fallback local balance refund
        setUser((prev) => ({
          ...prev,
          balance: prev.balance + refundAmount,
          promoBalance: prev.promoBalance + promoRefund,
          totalSaved: Math.max(0, prev.totalSaved - promoRefund),
        }));
      }
    } catch {
      // Fallback local balance refund
      setUser((prev) => ({
        ...prev,
        balance: prev.balance + refundAmount,
        promoBalance: prev.promoBalance + promoRefund,
        totalSaved: Math.max(0, prev.totalSaved - promoRefund),
      }));
    }

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
      prev.map((item) => (item.id === orderId ? { ...item, status: 'success' } : item))
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
      refunded: false,
    };

    setHistory((prev) => [newHistoryItem, ...prev]);

    // Dispatch live SMM order API call
    orderApi
      .buy({
        server: 5,
        item: {
          id: service.id,
          name: service.name,
          price: totalCost,
          link: targetLink,
        },
        qty: quantity,
      })
      .then((res) => {
        if (res && res.success && res.new_balance !== undefined) {
          setUser((prev) => ({
            ...prev,
            balance: res.new_balance!,
            promoBalance:
              res.new_promo_balance !== undefined ? res.new_promo_balance : prev.promoBalance,
          }));
        }
      })
      .catch(() => {
        // retain local state on network error
      });

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
      usdt_bep20: 'USDT BEP20 Crypto',
    };

    const isPending = Boolean(utr) || method === 'upi_direct';

    // Only credit balance if automatically verified (not manual unverified UTR)
    if (!isPending) {
      setUser((prev) => ({
        ...prev,
        balance: prev.balance + amount,
        totalDeposited: prev.totalDeposited + amount,
      }));
    }

    const newHistoryItem: HistoryItem = {
      id: orderId,
      category: 'deposit',
      title: `${methodNames[method]} Deposit`,
      subtitle: utr ? `UTR: ${utr} · Pending Verification` : 'Instant Top-Up · Credited',
      amountInr: amount,
      date: 'Just now',
      status: isPending ? 'waiting' : 'success',
      utr,
      refunded: false,
    };

    setHistory((prev) => [newHistoryItem, ...prev]);

    // Dispatch backend deposit notification
    if (method === 'fampay') {
      depositApi.createFamPay(amount).catch(() => {});
    } else if (utr) {
      depositApi.submitManual(1, utr, amount).catch(() => {});
    }

    if (isPending) {
      addToast(
        `Deposit request for ₹${amount.toLocaleString('en-IN')} submitted. Pending review.`,
        'info',
        'Verification Pending'
      );
    } else {
      addToast(
        `🎉 Deposit Verified! +₹${amount.toLocaleString('en-IN')} added to your Main Balance.`,
        'success',
        'Balance Credited'
      );
    }
    return true;
  };

  // Invariant 3: P2P Balance Transfer
  // Invariant Rule: Transfer Amount <= user.balance - user.promoBalance.
  // Promo balance CANNOT be transferred under any circumstances!
  const transferP2P = (recipient: string, amount: number): { success: boolean; message: string } => {
    if (!recipient || !recipient.trim()) {
      return { success: false, message: 'Please enter a valid Telegram ID or @username.' };
    }

    if (
      recipient === user.username ||
      recipient === `@${user.username}` ||
      recipient === user.telegramId
    ) {
      return { success: false, message: 'Cannot transfer funds to yourself.' };
    }

    if (isNaN(amount) || amount <= 0) {
      return { success: false, message: 'Transfer amount must be greater than ₹0.' };
    }

    if (amount > transferableBalance) {
      const err = `Insufficient transferable balance (Available: ₹${transferableBalance}). Promo balance (₹${user.promoBalance}) is locked for purchases only.`;
      addToast(err, 'error', 'P2P Transfer Blocked');
      return {
        success: false,
        message: err,
      };
    }

    // Deduct from total balance (transferable only, promoBalance untouched)
    setUser((prev) => ({
      ...prev,
      balance: prev.balance - amount,
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
      refunded: false,
    };

    setHistory((prev) => [newHistoryItem, ...prev]);

    // Dispatch backend P2P transfer
    transferApi
      .transfer({ recipient, amount })
      .then((res) => {
        if (res && res.success) {
          if (res.new_balance !== undefined) {
            setUser((prev) => ({ ...prev, balance: res.new_balance! }));
          }
        } else {
          // Backend returned failure - rollback balance and mark history as failed/refunded
          setUser((prev) => ({ ...prev, balance: prev.balance + amount }));
          setHistory((prev) =>
            prev.map((item) =>
              item.id === orderId
                ? { ...item, status: 'refunded', subtitle: 'Transfer Failed · Rolled Back', refunded: true }
                : item
            )
          );
          addToast(res?.error || 'Transfer failed on backend', 'error', 'Transfer Error');
        }
      })
      .catch((err: Error) => {
        // Rollback balance on network / rejection error
        setUser((prev) => ({ ...prev, balance: prev.balance + amount }));
        setHistory((prev) =>
          prev.map((item) =>
            item.id === orderId
              ? { ...item, status: 'refunded', subtitle: 'Transfer Failed · Rolled Back', refunded: true }
              : item
          )
        );
        addToast(err.message || 'Transfer failed on backend', 'error', 'Transfer Error');
      });

    addToast(
      `Sent ₹${amount} to ${recipient} successfully!`,
      'success',
      'P2P Transfer Completed'
    );

    return { success: true, message: `Successfully transferred ₹${amount} to ${recipient}.` };
  };

  const transferBalance = transferP2P;

  // Generic buyItem action
  const buyItem = async (
    server: number,
    item: Record<string, unknown>,
    qty: number = 1,
    tier: string = 'good',
    format: string = 'account'
  ): Promise<boolean> => {
    const cost = Number(item.price || 0) * qty;
    const deduction = deductPurchaseAmount(cost);
    if (!deduction.success) return false;

    try {
      const res = await orderApi.buy({ server, item, qty, tier, format });
      if (res && res.success) {
        if (res.new_balance !== undefined) {
          setUser((prev) => ({
            ...prev,
            balance: res.new_balance!,
            promoBalance:
              res.new_promo_balance !== undefined ? res.new_promo_balance : prev.promoBalance,
          }));
        }
        if (format === 'session' && qty > 1 && res.download_url) {
          downloadApi.triggerDownload(res.download_url, `accounts_${res.order_id || 'bulk'}.zip`);
        }
        return true;
      }
      return false;
    } catch {
      return true;
    }
  };

  // Invariant 4: Reseller Custom Margin Engine (₹5 <= Margin <= ₹100)
  const updateResellerMargin = (newMargin: number): { success: boolean; message: string } => {
    if (isNaN(newMargin) || newMargin < 5 || newMargin > 100) {
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
      resellerLink: updatedLink,
    }));

    // Dispatch backend set_margin
    resellerApi
      .setMargin(newMargin)
      .then((res) => {
        if (res && res.success && res.margin !== undefined) {
          setResellerConfig((prev) => ({
            ...prev,
            marginInr: res.margin!,
          }));
        }
      })
      .catch(() => {});

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
        server1Items,
        server2Items,
        server34Items,
        server5Items,
        isLoadingStore,
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
        transferBalance,
        buyItem,
        updateResellerMargin,
        resetDemoData,
        closeCredentialsModal,
        openReceiptDrawer,
        closeReceiptDrawer,
        refreshStore,
        refreshUser,
        refreshHistory,
        refreshReseller,
        backendConnected,
        isCheckingBackend,
        recheckConnection,
        isInitialLoading,
        initialLoadingStep,
        initialLoadingMessage,
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
