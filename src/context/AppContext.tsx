import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import {
  UserProfile,
  CurrencyPreference,
  Server1AccountItem,
  Server2StockItem,
  Server2DeliveryFormat,
  VirtualOtpServiceItem,
  ActiveOtpSession,
  ActiveNumberItem,
  ActiveInvoice,
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
  Server1AccountMetadata,
  otpApi,
  downloadApi,
  transferApi,
  depositApi,
  resellerApi,
  historyApi,
} from '../api/endpoints';
import { api, isTelegramWebApp, getWebUserToken, setWebUserToken } from '../api/client';
import { hapticFeedback } from '../utils/haptics';
import {
  adaptBackendUser,
  adaptHistoryItem,
  adaptActiveNumberItem,
  adaptResellerConfig,
  adaptServer1Item,
  adaptServer2Item,
  adaptServer34Item,
  adaptServer5Item,
} from '../api/adapters';

const LOCAL_STORAGE_KEY = 'krish_telebot_miniapp_state_v2';

export interface AppContextType {
  // State
  user: UserProfile;
  transferableBalance: number;
  currency: CurrencyPreference;
  activeTab: 'home' | 'store' | 'deposit' | 'history' | 'profile';
  selectedServer: 1 | 2 | 3 | 4 | 5;
  activeOtpSession: ActiveOtpSession | null;
  activeNumbers: ActiveNumberItem[];
  activeInvoice: ActiveInvoice | null;
  setActiveInvoice: React.Dispatch<React.SetStateAction<ActiveInvoice | null>>;
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
  isServerLoading: Record<1 | 2 | 3 | 4 | 5, boolean>;

  // Modals & Navigation
  purchasedCredentialsModal: {
    isOpen: boolean;
    account?: Server1AccountItem;
    orderId?: string;
    downloadUrl?: string;
    otpCode?: string;
    isLoading?: boolean;
    metadata?: Server1AccountMetadata;
  } | null;
  purchasedServer2Modal: {
    isOpen: boolean;
    stockItem?: Server2StockItem;
    orderId?: string;
    quantity?: number;
    format?: Server2DeliveryFormat;
    downloadUrl?: string;
  } | null;
  selectedReceiptItem: HistoryItem | null;
  closeServer2Modal: () => void;

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
  submitDeposit: (method: PaymentMethodType, amount: number, utr?: string, skipApiCall?: boolean) => boolean;
  transferP2P: (recipient: string, amount: number) => { success: boolean; message: string };
  transferBalance: (recipient: string, amount: number) => { success: boolean; message: string };
  buyItem: (
    server: number,
    item: Record<string, unknown>,
    qty?: number,
    tier?: string,
    format?: string
  ) => Promise<boolean>;
  updateResellerMargin: (newMargin: number, servers?: number[]) => { success: boolean; message: string };
  closeCredentialsModal: () => void;
  openReceiptDrawer: (item: HistoryItem) => void;
  closeReceiptDrawer: () => void;
  fetchOtpForNumber: (orderIdOrPhone: string) => Promise<string | null>;
  archiveActiveNumber: (orderIdOrPhone: string) => Promise<void>;
  archiveAllActiveNumbers: () => Promise<void>;
  refreshActiveNumbers: () => Promise<void>;

  // Theme
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  setTheme: (theme: 'dark' | 'light') => void;

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

  const [theme, setThemeState] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('krish_theme');
      if (saved === 'light' || saved === 'dark') return saved;
      if (typeof window !== 'undefined' && window.Telegram?.WebApp?.colorScheme === 'light') {
        return 'light';
      }
      return 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    try {
      const root = document.documentElement;
      if (theme === 'light') {
        root.classList.remove('dark');
        root.classList.add('light');
        root.style.colorScheme = 'light';
      } else {
        root.classList.remove('light');
        root.classList.add('dark');
        root.style.colorScheme = 'dark';
      }
      localStorage.setItem('krish_theme', theme);

      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', theme === 'light' ? '#ffffff' : '#0b0b0e');
      }

      if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        const color = theme === 'light' ? '#ffffff' : '#0b0b0e';
        tg.setHeaderColor?.(color);
        tg.setBackgroundColor?.(color);
      }
    } catch {
      // Ignore
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const setTheme = useCallback((newTheme: 'dark' | 'light') => {
    setThemeState(newTheme);
  }, []);

  const [user, setUser] = useState<UserProfile>(() => getSavedState('user', initialUserProfile));
  const [currency, setCurrency] = useState<CurrencyPreference>(() => getSavedState('currency', 'INR'));
  const [activeTab, setActiveTab] = useState<'home' | 'store' | 'deposit' | 'history' | 'profile'>(() =>
    getSavedState('activeTab', 'home')
  );
  const [selectedServer, setSelectedServer] = useState<1 | 2 | 3 | 4 | 5>(() =>
    getSavedState('selectedServer', 1)
  );
  const [activeOtpSession, setActiveOtpSession] = useState<ActiveOtpSession | null>(() => {
    const saved = getSavedState<ActiveOtpSession | null>('activeOtp', null);
    if (!saved) return null;
    if (saved.status === 'waiting' && saved.startTime && saved.totalDurationSeconds) {
      const elapsed = Math.floor((Date.now() - saved.startTime) / 1000);
      const remaining = Math.max(0, saved.totalDurationSeconds - elapsed);
      if (remaining <= 0) {
        return { ...saved, status: 'expired', remainingSeconds: 0 };
      }
      return { ...saved, remainingSeconds: remaining };
    }
    return saved;
  });
  const [activeNumbers, setActiveNumbers] = useState<ActiveNumberItem[]>(() => {
    const saved = getSavedState<ActiveNumberItem[]>('activeNumbers', []);
    if (!Array.isArray(saved)) return [];
    return saved.filter((item) => {
      const ageHours = (Date.now() - (item.createdAt || 0)) / (1000 * 3600);
      return ageHours < 24 && item.status !== 'expired';
    });
  });
  const [activeInvoice, setActiveInvoice] = useState<ActiveInvoice | null>(() => {
    const saved = getSavedState<ActiveInvoice | null>('activeInvoice', null);
    if (!saved || !saved.expiresAt) return null;
    if (saved.expiresAt <= Date.now()) return null;
    return saved;
  });
  const [history, setHistory] = useState<HistoryItem[]>(() =>
    getSavedState('history', initialHistoryItems)
  );
  const [resellerConfig, setResellerConfig] = useState<ResellerConfig>(() =>
    getSavedState('reseller', initialResellerConfig)
  );
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Live store catalog state with fallback to mock data
  const [server1Items, setServer1Items] = useState<Server1AccountItem[]>(() =>
    getSavedState('cache_s1', server1Catalog)
  );
  const [server2Items, setServer2Items] = useState<Server2StockItem[]>(() =>
    getSavedState('cache_s2', server2Catalog)
  );
  const [server34Items, setServer34Items] = useState<VirtualOtpServiceItem[]>(() =>
    getSavedState('cache_s34', server34Catalog)
  );
  const [server5Items, setServer5Items] = useState<SmmServiceItem[]>(() => {
    const saved = getSavedState<SmmServiceItem[]>('cache_s5', server5Catalog);
    return Array.isArray(saved) ? saved.slice(0, 50) : [];
  });
  const [isLoadingStore, setIsLoadingStore] = useState<boolean>(false);
  const [isServerLoading, setIsServerLoading] = useState<Record<1 | 2 | 3 | 4 | 5, boolean>>({
    1: true,
    2: true,
    3: true,
    4: true,
    5: true,
  });
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null);
  const [isCheckingBackend, setIsCheckingBackend] = useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(() => {
    if (isTelegramWebApp()) return true;
    return Boolean(getWebUserToken());
  });
  const [initialLoadingStep, setInitialLoadingStep] = useState<number>(1);
  const [initialLoadingMessage, setInitialLoadingMessage] = useState<string>('Establishing secure connection...');

  // Concurrency & Cache Refs
  const isRefreshingStoreRef = useRef(false);
  const server4LoadedRef = useRef(false);
  const [purchasedCredentialsModal, setPurchasedCredentialsModal] = useState<{
    isOpen: boolean;
    account?: Server1AccountItem;
    orderId?: string;
    downloadUrl?: string;
    otpCode?: string;
    isLoading?: boolean;
    metadata?: Server1AccountMetadata;
  } | null>(() => getSavedState('credentialsModal', null));

  const [purchasedServer2Modal, setPurchasedServer2Modal] = useState<{
    isOpen: boolean;
    stockItem?: Server2StockItem;
    orderId?: string;
    quantity?: number;
    format?: Server2DeliveryFormat;
    downloadUrl?: string;
  } | null>(() => getSavedState('server2Modal', null));

  const [selectedReceiptItem, setSelectedReceiptItem] = useState<HistoryItem | null>(null);

  // Invariant 1: Transferable Balance = Math.max(0, user.balance - user.promoBalance)
  const transferableBalance = Math.max(0, user.balance - user.promoBalance);

  // Persist state updates to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_user`, JSON.stringify(user));
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_currency`, JSON.stringify(currency));
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_activeTab`, JSON.stringify(activeTab));
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_selectedServer`, JSON.stringify(selectedServer));
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_activeOtp`, JSON.stringify(activeOtpSession));
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_activeNumbers`, JSON.stringify(activeNumbers));
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_activeInvoice`, JSON.stringify(activeInvoice));
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_history`, JSON.stringify(history));
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_reseller`, JSON.stringify(resellerConfig));
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_credentialsModal`, JSON.stringify(purchasedCredentialsModal));
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_server2Modal`, JSON.stringify(purchasedServer2Modal));
    } catch {
      // localStorage quota or private mode fallback
    }
  }, [
    user,
    currency,
    activeTab,
    selectedServer,
    activeOtpSession,
    activeNumbers,
    activeInvoice,
    history,
    resellerConfig,
    purchasedCredentialsModal,
    purchasedServer2Modal,
  ]);

  // Guarantee state preservation when user switches to external UPI / authenticator apps
  useEffect(() => {
    const handleSaveSnapshot = () => {
      try {
        localStorage.setItem(`${LOCAL_STORAGE_KEY}_activeTab`, JSON.stringify(activeTab));
        localStorage.setItem(`${LOCAL_STORAGE_KEY}_selectedServer`, JSON.stringify(selectedServer));
        localStorage.setItem(`${LOCAL_STORAGE_KEY}_activeOtp`, JSON.stringify(activeOtpSession));
        localStorage.setItem(`${LOCAL_STORAGE_KEY}_activeInvoice`, JSON.stringify(activeInvoice));
      } catch {}
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleSaveSnapshot();
      }
    };

    window.addEventListener('pagehide', handleSaveSnapshot);
    window.addEventListener('beforeunload', handleSaveSnapshot);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pagehide', handleSaveSnapshot);
      window.removeEventListener('beforeunload', handleSaveSnapshot);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeTab, selectedServer, activeOtpSession, activeInvoice]);

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
        if (authRes.token) {
          setWebUserToken(authRes.token);
        }
      }
    } catch {
      if (!isTelegramWebApp()) {
        setWebUserToken(null);
      }
    }
  }, []);

  // Refresh history records from backend & reconcile active OTP session
  const refreshHistory = useCallback(async () => {
    try {
      const historyRes = await historyApi.getHistory();
      if (historyRes?.success && Array.isArray(historyRes.items)) {
        const adapted = historyRes.items.map((item, idx) => adaptHistoryItem(item, idx));
        setHistory(adapted);
        refreshActiveNumbers().catch(() => {});

        // Backend reconciliation: If local activeOtpSession is null, check if backend has an ongoing waiting OTP order
        setActiveOtpSession((currentSession) => {
          if (currentSession && (currentSession.status === 'waiting' || currentSession.status === 'received')) {
            return currentSession;
          }

          const waitingOrder = adapted.find(
            (item) => item.status === 'waiting' && item.category === 'otp_activation' && item.phone
          );

          if (waitingOrder) {
            const sMatch = waitingOrder.server?.match(/(\d+)/);
            const serverNum = (sMatch ? Number(sMatch[1]) : 3) as 3 | 4;
            return {
              orderId: waitingOrder.id,
              server: serverNum,
              serviceName: waitingOrder.title || 'OTP Activation',
              country: (waitingOrder as any).country || 'Virtual',
              phone: waitingOrder.phone || '',
              priceInr: Math.abs(waitingOrder.amountInr),
              promoUsed: 0,
              mainUsed: Math.abs(waitingOrder.amountInr),
              status: 'waiting',
              otpCode: null,
              startTime: Date.now() - 60000,
              totalDurationSeconds: 600,
              remainingSeconds: 540,
            };
          }
          return currentSession;
        });
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

  // Refresh store catalogues: Fast catalogues (Servers 1, 2, 3 < 900ms) with background streaming for Server 4 & Server 5
  const refreshStore = useCallback(async (forceServer4: boolean = false) => {
    if (isRefreshingStoreRef.current) return;
    isRefreshingStoreRef.current = true;
    setIsLoadingStore(true);
    setIsServerLoading({
      1: true,
      2: true,
      3: true,
      4: true,
      5: true,
    });

    try {
      // 1. Fetch Fast Catalogues (Servers 1, 2, 3 - completes in < 900ms)
      const [s1, s2Good, s2Cheap, s3] = await Promise.allSettled([
        storeApi.getServer1(),
        storeApi.getServer2('good'),
        storeApi.getServer2('cheap'),
        storeApi.getServer3(),
      ]);

      if (s1.status === 'fulfilled' && s1.value.success && Array.isArray(s1.value.items)) {
        const adapted = s1.value.items.map((item, idx) => adaptServer1Item(item, idx));
        setServer1Items(adapted);
        try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_cache_s1`, JSON.stringify(adapted)); } catch {}
      }
      setIsServerLoading((prev) => ({ ...prev, 1: false }));

      const s2Combined: Server2StockItem[] = [];
      if (s2Good.status === 'fulfilled' && s2Good.value.success && Array.isArray(s2Good.value.items)) {
        s2Combined.push(...s2Good.value.items.map((item) => adaptServer2Item(item, 'good')));
      }
      if (s2Cheap.status === 'fulfilled' && s2Cheap.value.success && Array.isArray(s2Cheap.value.items)) {
        s2Combined.push(...s2Cheap.value.items.map((item) => adaptServer2Item(item, 'cheap')));
      }
      if (s2Good.status === 'fulfilled' || s2Cheap.status === 'fulfilled') {
        setServer2Items(s2Combined);
        try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_cache_s2`, JSON.stringify(s2Combined)); } catch {}
      }
      setIsServerLoading((prev) => ({ ...prev, 2: false }));

      if (s3.status === 'fulfilled' && s3.value.success && Array.isArray(s3.value.items)) {
        const s3Adapted = s3.value.items.map((item, idx) => adaptServer34Item(item, 3, idx));
        setServer34Items((prev) => {
          const existingS4 = prev.filter((item) => item.server === 4);
          const combined = [...s3Adapted, ...existingS4];
          try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_cache_s34`, JSON.stringify(combined)); } catch {}
          return combined;
        });
      }
      setIsServerLoading((prev) => ({ ...prev, 3: false }));

      // Fast catalogues (1, 2, 3) ready! Interactive store immediately unlocked
      setIsLoadingStore(false);

      // 2. Stream Server 5 initial batch in background asynchronously (paginated on-demand)
      storeApi
        .getServer5({ page: 1, limit: 50 })
        .then((s5) => {
          if (s5?.success && Array.isArray(s5.items)) {
            const s5Adapted = s5.items.slice(0, 50).map((item) => adaptServer5Item(item));
            setServer5Items(s5Adapted);
            try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_cache_s5`, JSON.stringify(s5Adapted)); } catch {}
          }
        })
        .catch(() => {
          // silent background failover
        })
        .finally(() => {
          setIsServerLoading((prev) => ({ ...prev, 5: false }));
        });

      // 3. Load Server 4 in background only if not yet loaded
      if (!server4LoadedRef.current || forceServer4) {
        storeApi
          .getServer4()
          .then((s4) => {
            if (s4?.success && Array.isArray(s4.items)) {
              server4LoadedRef.current = true;
              const s4Adapted = s4.items.map((item, idx) => adaptServer34Item(item, 4, idx));
              setServer34Items((prev) => {
                const existingS3 = prev.filter((item) => item.server === 3);
                const combined = [...existingS3, ...s4Adapted];
                try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_cache_s34`, JSON.stringify(combined)); } catch {}
                return combined;
              });
            }
          })
          .catch(() => {
            // silent background failover
          })
          .finally(() => {
            setIsServerLoading((prev) => ({ ...prev, 4: false }));
          });
      } else {
        setIsServerLoading((prev) => ({ ...prev, 4: false }));
      }
    } catch {
      // offline fallback to default mock items
      setIsServerLoading({ 1: false, 2: false, 3: false, 4: false, 5: false });
    } finally {
      setIsLoadingStore(false);
      isRefreshingStoreRef.current = false;
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
      // For web visitors without a saved session: bypass initial spinner directly to Google Login screen
      if (!isTelegramWebApp() && !getWebUserToken()) {
        if (isMounted) {
          setIsInitialLoading(false);
          setIsCheckingBackend(false);
          setBackendConnected(true);
        }
        return;
      }

      setIsCheckingBackend(true);
      setIsInitialLoading(true);
      setInitialLoadingStep(1);
      setInitialLoadingMessage('Connecting to Daemon Edge Proxy...');

      // Safety timeout: dismiss initial splash screen in <= 1.6s under all conditions
      const safetyTimeout = setTimeout(() => {
        if (isMounted) {
          setInitialLoadingStep(3);
          setIsInitialLoading(false);
          setIsCheckingBackend(false);
        }
      }, 1600);

      try {
        setInitialLoadingStep(2);
        setInitialLoadingMessage(
          isTelegramWebApp()
            ? 'Authenticating Telegram profile & wallet...'
            : 'Authenticating web profile & wallet...'
        );

        // Fast Direct Auth: Authenticate user in a single round-trip (< 800ms)
        const authRes = await authApi.authenticate().catch(() => null);
        const isOnline = !!authRes?.success;

        if (isMounted) {
          setBackendConnected(isOnline);
          setIsCheckingBackend(false);
          if (authRes?.success && authRes.user) {
            setUser((prev) => adaptBackendUser(authRes.user, prev));
            if (authRes.token) {
              setWebUserToken(authRes.token);
            }
          } else if (!isTelegramWebApp()) {
            setWebUserToken(null);
          }
        }

        if (isOnline) {
          // Asynchronously stream secondary profile data in parallel (non-blocking)
          resellerApi.getStats().then((resellerRes) => {
            if (isMounted && resellerRes) {
              setResellerConfig((prev) => adaptResellerConfig(resellerRes, prev));
            }
          }).catch(() => {});

          historyApi.getHistory().then((historyRes) => {
            if (isMounted && historyRes?.success && Array.isArray(historyRes.items)) {
              setHistory(historyRes.items.map((item, idx) => adaptHistoryItem(item, idx)));
            }
          }).catch(() => {});

          otpApi.getActiveNumbers().then((activeRes) => {
            if (isMounted && activeRes?.success && Array.isArray(activeRes.items)) {
              setActiveNumbers(activeRes.items.map(adaptActiveNumberItem));
            }
          }).catch(() => {});

          // Refresh store catalogues in background - DO NOT block initial splash!
          refreshStore().catch(() => {});
        } else {
          if (isMounted) {
            addToast('Backend not connected. Running in offline/preview mode.', 'warning', 'Not Connected');
          }
        }
      } catch {
        if (isMounted) {
          setBackendConnected(false);
          setIsCheckingBackend(false);
        }
      } finally {
        if (isMounted) {
          setInitialLoadingStep(3);
          // Graceful reveal: 120ms to allow smooth 100% transition then reveal Home dashboard
          setTimeout(() => {
            if (isMounted) {
              clearTimeout(safetyTimeout);
              setIsInitialLoading(false);
            }
          }, 120);
        }
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
      hapticFeedback.error();
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

  // Rollback deduction if backend purchase fails
  const rollbackPurchaseDeduction = (
    totalCost: number,
    promoUsed: number
  ) => {
    setUser((prev) => ({
      ...prev,
      balance: prev.balance + totalCost,
      promoBalance: prev.promoBalance + promoUsed,
      totalSaved: Math.max(0, prev.totalSaved - (promoUsed > 0 ? promoUsed : 0)),
    }));
  };

  // Server 1: Purchase Account
  const purchaseServer1Account = (account: Server1AccountItem): boolean => {
    hapticFeedback.medium();
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
      phone: account.credentialsSample?.phone || '',
      twoFa: account.credentialsSample?.twoFa || '',
      refunded: false,
    };

    setHistory((prev) => [newHistoryItem, ...prev]);

    // Open Credential Modal in allocating state (prevents dummy data flash)
    setPurchasedCredentialsModal({
      isOpen: true,
      account,
      orderId,
      isLoading: true,
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
              isLoading: false,
              downloadUrl: res.download_url,
              metadata: res.metadata,
              account: {
                ...currentAccount,
                credentialsSample: {
                  phone: realPhone || '',
                  twoFa: realTwofa || '',
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

          // Add to persistent active numbers section so user never loses it even on back navigation
          const newActiveItem: ActiveNumberItem = {
            orderId: realOrderId,
            server: 1,
            country: account.country,
            serviceName: 'Telegram',
            phone: realPhone || '',
            twoFa: realTwofa || undefined,
            otpCode: null,
            status: 'waiting',
            createdAt: Date.now(),
            totalDurationSeconds: 86400,
            remainingSeconds: 86400,
            canFetchOtp: true,
            isAutoPolling: false,
          };
          setActiveNumbers((prev) => [
            newActiveItem,
            ...prev.filter((x) => x.orderId !== realOrderId && x.phone !== realPhone),
          ]);

          addToast(
            `Purchased ${account.country} Telegram Account! Credentials ready.`,
            'success',
            'Account Delivered'
          );
        } else {
          // Backend reported purchase failure: rollback balance and close modal
          rollbackPurchaseDeduction(account.priceInr, deduction.promoUsed);
          setPurchasedCredentialsModal(null);
          setHistory((prev) => prev.filter((item) => item.id !== orderId));
          addToast(
            res?.error || 'Purchase could not be completed. Your balance was refunded.',
            'error',
            'Purchase Failed'
          );
        }
      })
      .catch((err: any) => {
        // Network or HTTP error: rollback balance and close modal
        rollbackPurchaseDeduction(account.priceInr, deduction.promoUsed);
        setPurchasedCredentialsModal(null);
        setHistory((prev) => prev.filter((item) => item.id !== orderId));
        addToast(
          err?.message || 'Server purchase failed. Your balance was refunded.',
          'error',
          'Purchase Failed'
        );
      });

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
      ? `Bulk ZIP (${quantity}x ${stockItem.country} Sessions)`
      : `${stockItem.country} Telegram (${stockItem.accountYear})`;




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
      sessionDownloadUrl: undefined,
      refunded: false,
    };

    setHistory((prev) => [newHistoryItem, ...prev]);

    // Open delivery fulfillment modal immediately so user sees their credentials / files!
    setPurchasedServer2Modal({
      isOpen: true,
      stockItem,
      orderId,
      quantity,
      format: requestedFormat,
      downloadUrl: undefined,
    });

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
            setPurchasedServer2Modal((prev) =>
              prev
                ? {
                    ...prev,
                    orderId: String(res.order_id || prev.orderId),
                    downloadUrl: res.download_url,
                  }
                : null
            );
            if (isBulk || requestedFormat === 'session') {
              downloadApi.triggerDownload(
                res.download_url,
                isBulk ? `accounts_${res.order_id || orderId}.zip` : `session_${res.order_id || orderId}.session`
              );
            }
          }

          if (requestedFormat === 'account') {
            const realPhone = res.phone || stockItem.country;
            const newActiveItem: ActiveNumberItem = {
              orderId: String(res.order_id || orderId),
              server: 2,
              country: stockItem.country,
              serviceName: 'Telegram',
              phone: realPhone,
              twoFa: (res as any).twofa || (stockItem.twoFaRequired ? 'Included' : undefined),
              otpCode: null,
              status: 'waiting',
              createdAt: Date.now(),
              totalDurationSeconds: 86400,
              remainingSeconds: 86400,
              canFetchOtp: true,
              isAutoPolling: false,
              downloadUrl: res.download_url,
            };
            setActiveNumbers((prev) => [
              newActiveItem,
              ...prev.filter((x) => x.orderId !== newActiveItem.orderId),
            ]);
          }

          addToast(
            isBulk
              ? `Delivered ${quantity} sessions ZIP package successfully!`
              : `Purchased ${stockItem.country} account! ${requestedFormat === 'session' ? 'Session file downloading.' : 'Credentials ready.'}`,
            'success',
            'Purchase Complete'
          );
        } else {
          // Failure returned from API: rollback balance, close modal, remove history
          rollbackPurchaseDeduction(totalCost, deduction.promoUsed);
          setPurchasedServer2Modal(null);
          setHistory((prev) => prev.filter((item) => item.id !== orderId));
          addToast(
            res?.error || 'Server 2 purchase could not be completed. Your balance was refunded.',
            'error',
            'Purchase Failed'
          );
        }
      })
      .catch((err: any) => {
        // Network or HTTP error: rollback balance, close modal, remove history
        rollbackPurchaseDeduction(totalCost, deduction.promoUsed);
        setPurchasedServer2Modal(null);
        setHistory((prev) => prev.filter((item) => item.id !== orderId));
        addToast(
          err?.message || 'Server 2 order failed. Your balance was refunded.',
          'error',
          'Purchase Failed'
        );
      });

    return true;
  };

  // Server 3 & 4: Virtual OTP Numbers (Fast OTP & Fresh Numbers)
  const requestVirtualOtp = (service: VirtualOtpServiceItem): boolean => {
    hapticFeedback.medium();
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
    const pendingPhone = 'Allocating number...';

    const newSession: ActiveOtpSession = {
      orderId,
      server: service.server,
      serviceName: service.serviceName,
      country: service.country,
      phone: pendingPhone,
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
      phone: pendingPhone,
      refunded: false,
    };

    setHistory((prev) => [historyRecord, ...prev]);

    // Asynchronously call backend buy endpoint
    orderApi
      .buy({
        server: service.server,
        item: {
          id: service.serviceCode,
          service_code: service.serviceCode,
          country: service.country,
          country_code: service.countryCode,
          operator_code: service.operatorCode || '1',
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
            const realPhone = res.phone;
            const realOrderId = String(res.order_id || orderId);
            setActiveOtpSession((prev) =>
              prev
                ? { ...prev, phone: realPhone, orderId: realOrderId }
                : null
            );
            setHistory((hPrev) =>
              hPrev.map((item) =>
                item.id === orderId
                  ? { ...item, phone: realPhone, id: realOrderId }
                  : item
              )
            );
            const newActiveItem: ActiveNumberItem = {
              orderId: realOrderId,
              server: service.server,
              country: service.country,
              serviceName: service.serviceName,
              phone: realPhone,
              otpCode: null,
              status: 'waiting',
              createdAt: Date.now(),
              totalDurationSeconds: 600,
              remainingSeconds: 600,
              canFetchOtp: true,
              isAutoPolling: true,
            };
            setActiveNumbers((prev) => [
              newActiveItem,
              ...prev.filter((x) => x.orderId !== realOrderId && x.phone !== realPhone),
            ]);
            addToast(`Number allocated: ${realPhone}. Waiting for SMS code...`, 'info', 'Number Ready');
          }
        } else {
          // Failure returned from API: rollback balance, cancel session, remove history
          rollbackPurchaseDeduction(service.priceInr, deduction.promoUsed);
          setActiveOtpSession(null);
          setActiveNumbers((prev) => prev.filter((item) => item.orderId !== orderId));
          setHistory((prev) => prev.filter((item) => item.id !== orderId));
          addToast(
            res?.error || 'Virtual number could not be allocated. Your balance was refunded.',
            'error',
            'Allocation Failed'
          );
        }
      })
      .catch((err: any) => {
        // Network or HTTP error: rollback balance, cancel session, remove history
        rollbackPurchaseDeduction(service.priceInr, deduction.promoUsed);
        setActiveOtpSession(null);
        setActiveNumbers((prev) => prev.filter((item) => item.orderId !== orderId));
        setHistory((prev) => prev.filter((item) => item.id !== orderId));
        addToast(
          err?.message || 'Virtual number allocation failed. Your balance was refunded.',
          'error',
          'Allocation Failed'
        );
      });

    addToast(
      `Request dispatched. Allocating virtual number for ${service.serviceName}...`,
      'info',
      'Activating Number'
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

    // Immediate status check on mount / app re-open
    const checkImmediately = async () => {
      try {
        const res = await otpApi.getStatus(phoneOrId);
        if (!isSubscribed) return;
        if (res && (res.status === 'completed' || res.status === 'delivered') && res.otp) {
          const receivedCode = res.otp;
          try {
            if (window.Telegram?.WebApp?.HapticFeedback) {
              window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            }
          } catch {}
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
      } catch {}
    };
    checkImmediately();

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

        const elapsed = Math.floor((Date.now() - prev.startTime) / 1000);
        const remaining = Math.max(0, prev.totalDurationSeconds - elapsed);

        if (remaining <= 0) {
          return {
            ...prev,
            status: 'expired',
            remainingSeconds: 0,
          };
        }

        return {
          ...prev,
          remainingSeconds: remaining,
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
    setActiveNumbers((prev) => prev.filter((item) => item.orderId !== orderId && item.phone !== orderId));

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
    setActiveNumbers((prev) => prev.filter((item) => item.orderId !== orderId && item.phone !== orderId));
    addToast('Order completed successfully! Stored in History.', 'success', 'Done');
  };

  // Fetch Telegram Login Code / OTP on demand
  const fetchOtpForNumber = useCallback(
    async (orderIdOrPhone: string): Promise<string | null> => {
      if (!orderIdOrPhone) return null;
      try {
        const res = await otpApi.getStatus(orderIdOrPhone);
        if (res && (res.status === 'completed' || res.status === 'delivered') && res.otp) {
          const code = res.otp;
          hapticFeedback.success();
          addToast(`Received OTP Code: ${code}`, 'success', 'Code Received!');
          setActiveNumbers((prev) =>
            prev.map((item) =>
              item.orderId === orderIdOrPhone || item.phone === orderIdOrPhone
                ? {
                    ...item,
                    status: 'received',
                    otpCode: code,
                    twoFa: res.twofa || item.twoFa,
                  }
                : item
            )
          );
          setHistory((prev) =>
            prev.map((h) =>
              h.id === orderIdOrPhone || h.phone === orderIdOrPhone
                ? {
                    ...h,
                    otpCode: code,
                    status: 'success',
                    twoFa: res.twofa || h.twoFa,
                  }
                : h
            )
          );
          setPurchasedCredentialsModal((prev) => {
            if (!prev) return null;
            if (
              prev.orderId === orderIdOrPhone ||
              prev.account?.credentialsSample?.phone === orderIdOrPhone
            ) {
              return { ...prev, otpCode: code };
            }
            return prev;
          });
          return code;
        } else {
          addToast(
            'Code not received yet. Request login code inside official Telegram for this number, then tap Get OTP.',
            'info',
            'Waiting for Code'
          );
          return null;
        }
      } catch (err: any) {
        addToast(err?.message || 'Failed to check OTP. Please try again.', 'error', 'Error');
        return null;
      }
    },
    [addToast]
  );

  // Archive / Dismiss an active number
  const archiveActiveNumber = useCallback(
    async (orderIdOrPhone: string) => {
      hapticFeedback.light();
      setActiveNumbers((prev) => {
        const filtered = prev.filter((item) => item.orderId !== orderIdOrPhone && item.phone !== orderIdOrPhone);
        try {
          localStorage.setItem(`${LOCAL_STORAGE_KEY}_activeNumbers`, JSON.stringify(filtered));
        } catch {}
        return filtered;
      });
      setActiveOtpSession((prev) => {
        if (prev && (prev.orderId === orderIdOrPhone || prev.phone === orderIdOrPhone)) {
          return null;
        }
        return prev;
      });
      try {
        await otpApi.archive(orderIdOrPhone);
      } catch {}
      addToast('Active number dismissed. Saved in History.', 'info', 'Archived');
    },
    [addToast]
  );

  // Archive / Dismiss all active numbers at once
  const archiveAllActiveNumbers = useCallback(async () => {
    hapticFeedback.medium();
    setActiveNumbers([]);
    setActiveOtpSession(null);
    try {
      localStorage.removeItem(`${LOCAL_STORAGE_KEY}_activeNumbers`);
    } catch {}
    try {
      await otpApi.archive('all');
    } catch {}
    addToast('All active numbers dismissed. Saved in History.', 'info', 'Archived All');
  }, [addToast]);

  // Sync active numbers with live backend
  const refreshActiveNumbers = useCallback(async () => {
    try {
      const res = await otpApi.getActiveNumbers();
      if (res && res.success && Array.isArray(res.items)) {
        const adapted = res.items.map(adaptActiveNumberItem);
        setActiveNumbers((prev) => {
          const merged = [...adapted];
          for (const local of prev) {
            const idx = merged.findIndex(
              (m) => m.orderId === local.orderId || (local.phone && m.phone === local.phone)
            );
            if (idx >= 0) {
              merged[idx] = {
                ...merged[idx],
                otpCode: local.otpCode || merged[idx].otpCode,
                status: local.status === 'received' ? 'received' : merged[idx].status,
                twoFa: local.twoFa || merged[idx].twoFa,
              };
            } else if (local.createdAt && (Date.now() - local.createdAt < 60_000) && local.status === 'waiting') {
              // Retain very fresh (< 60s) in-flight orders not yet returned by backend
              merged.push(local);
            }
          }
          return merged;
        });
      }
    } catch {
      // offline / quiet fail
    }
  }, []);

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
        if (res && res.success) {
          if (res.new_balance !== undefined) {
            setUser((prev) => ({
              ...prev,
              balance: res.new_balance!,
              promoBalance:
                res.new_promo_balance !== undefined ? res.new_promo_balance : prev.promoBalance,
            }));
          }
          addToast(
            `SMM Order submitted for ${quantity.toLocaleString()} units! Starting shortly.`,
            'success',
            'SMM Boost Activated'
          );
        } else {
          // Backend returned failure
          rollbackPurchaseDeduction(totalCost, deduction.promoUsed);
          setHistory((prev) => prev.filter((item) => item.id !== orderId));
          addToast(
            res?.error || 'SMM order failed. Your balance was refunded.',
            'error',
            'Order Failed'
          );
        }
      })
      .catch((err: any) => {
        // Rollback on network or HTTP 400 error
        rollbackPurchaseDeduction(totalCost, deduction.promoUsed);
        setHistory((prev) => prev.filter((item) => item.id !== orderId));
        addToast(
          err?.message || 'SMM order failed. Your balance was refunded.',
          'error',
          'Order Failed'
        );
      });

    return true;
  };

  // Deposit Top-Up
  const submitDeposit = (
    method: PaymentMethodType,
    amount: number,
    utr?: string,
    skipApiCall: boolean = false
  ): boolean => {
    if (amount <= 0) {
      addToast('Deposit amount must be greater than ₹0.', 'error', 'Invalid Amount');
      return false;
    }

    const orderId = `DEP_${Date.now().toString().slice(-6)}`;
    const methodNames: Record<PaymentMethodType, string> = {
      fampay: 'UPI Auto Instant',
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

    // Dispatch backend deposit notification only if caller hasn't already sent it
    if (!skipApiCall) {
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
          `Deposit Verified! +₹${amount.toLocaleString('en-IN')} added to your Main Balance.`,
          'success',
          'Balance Credited'
        );
      }
    }
    return true;
  };

  // Invariant 3: P2P Balance Transfer
  // Invariant Rule: Transfer Amount <= user.balance - user.promoBalance.
  // Promo balance CANNOT be transferred under any circumstances!
  // Background Auto-Resolver for Active UPI Invoice
  useEffect(() => {
    if (!activeInvoice || !activeInvoice.reference) return;

    let isSubscribed = true;
    const refCode = activeInvoice.reference;
    const payAmount = activeInvoice.amount;

    const checkInvoiceStatus = async () => {
      if (!isSubscribed) return;

      if (Date.now() >= activeInvoice.expiresAt) {
        setActiveInvoice(null);
        addToast('UPI Invoice expired. Please generate a new invoice if needed.', 'info', 'Invoice Expired');
        return;
      }

      try {
        const checkRes = await depositApi.checkFamPay(refCode);
        if (!isSubscribed) return;
        if (
          checkRes &&
          (checkRes.status === 'approved' ||
            checkRes.status === 'verified' ||
            checkRes.status === 'success')
        ) {
          submitDeposit('fampay', payAmount, refCode, true);
          setActiveInvoice(null);
          try {
            if (window.Telegram?.WebApp?.HapticFeedback) {
              window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            }
          } catch {}
          addToast(`Payment of ₹${payAmount} confirmed and credited to your wallet!`, 'success', 'Deposit Completed');
          refreshUser().catch(() => {});
        }
      } catch {}
    };

    checkInvoiceStatus();
    const invoiceInterval = setInterval(checkInvoiceStatus, 4000);

    return () => {
      isSubscribed = false;
      clearInterval(invoiceInterval);
    };
  }, [activeInvoice?.reference, activeInvoice?.expiresAt, activeInvoice?.amount, submitDeposit, refreshUser, addToast]);

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

  // Invariant 4: Reseller Custom Margin Engine (₹5 <= Margin <= ₹100) with Multi-Server 1 URL Bundling
  const updateResellerMargin = (newMargin: number, servers?: number[]): { success: boolean; message: string } => {
    if (isNaN(newMargin) || newMargin < 5 || newMargin > 100) {
      const err = 'Custom margin must be between ₹5 and ₹100.';
      addToast(err, 'error', 'Invalid Margin');
      return { success: false, message: err };
    }

    const chosenServers = servers && servers.length > 0
      ? servers.filter((s) => s >= 1 && s <= 5)
      : (resellerConfig.selectedServers || [1, 2, 3, 4, 5]);

    const currentToken = resellerConfig.token || `resell_${Math.random().toString(36).substring(2, 8)}`;
    const baseToken = currentToken.startsWith('resell_') ? currentToken.replace('resell_', '') : currentToken;
    const serverSuffix = chosenServers.length < 5
      ? `_s${[...chosenServers].sort().join('_s')}`
      : '';
    const updatedLink = `https://t.me/DeamonOTPbot?start=resell_${baseToken}${serverSuffix}`;

    setResellerConfig((prev) => ({
      ...prev,
      token: baseToken,
      marginInr: newMargin,
      selectedServers: chosenServers,
      resellerLink: updatedLink,
    }));

    // Dispatch backend set_margin with selected servers
    resellerApi
      .setMargin(newMargin, chosenServers)
      .then((res) => {
        if (res && res.success) {
          setResellerConfig((prev) => ({
            ...prev,
            marginInr: res.margin !== undefined ? res.margin : prev.marginInr,
            selectedServers: res.servers || prev.selectedServers,
            resellerLink: res.link || prev.resellerLink,
          }));
        }
      })
      .catch(() => {});

    addToast(
      `Saved margin (+₹${newMargin}) for ${chosenServers.length} server(s)! Reseller 1 URL updated.`,
      'success',
      'Reseller Settings Saved'
    );

    return { success: true, message: 'Reseller margin updated.' };
  };

  const closeCredentialsModal = () => {
    setPurchasedCredentialsModal(null);
  };

  const closeServer2Modal = () => {
    setPurchasedServer2Modal(null);
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
        theme,
        toggleTheme,
        setTheme,
        activeTab,
        selectedServer,
        activeOtpSession,
        activeNumbers,
        history,
        resellerConfig,
        toasts,
        server1Items,
        server2Items,
        server34Items,
        server5Items,
        isLoadingStore,
        isServerLoading,
        activeInvoice,
        setActiveInvoice,
        purchasedCredentialsModal,
        purchasedServer2Modal,
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
        closeCredentialsModal,
        closeServer2Modal,
        openReceiptDrawer,
        closeReceiptDrawer,
        fetchOtpForNumber,
        archiveActiveNumber,
        archiveAllActiveNumbers,
        refreshActiveNumbers,
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
