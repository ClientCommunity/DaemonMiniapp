import React, { useEffect, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AdminProvider, useAdmin } from './context/AdminContext';
import { ToastContainer } from './components/common/Toast';
import { InitialLoadingScreen } from './components/common/InitialLoadingScreen';
import { MaintenanceScreen } from './components/common/MaintenanceScreen';
import { TelegramShell } from './components/shells/TelegramShell';
import { WebShell } from './components/shells/WebShell';

// Code-split heavy non-customer components
const AdminDashboard = React.lazy(() => import('./components/admin/AdminDashboard'));
const LandingPage = React.lazy(() =>
  import('./components/landing/LandingPage').then((m) => ({ default: m.LandingPage }))
);
import { isTelegramWebApp, getWebUserToken, setWebUserToken } from './api/client';
import { downloadApi, webAuthApi } from './api/endpoints';
import { MergeCelebrationModal } from './components/common/MergeCelebrationModal';

const AppContent: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    isInitialLoading,
    initialLoadingStep,
    initialLoadingMessage,
    backendConnected,
    isMaintenanceMode,
    isCheckingBackend,
    recheckConnection,
    refreshUser,
    refreshStore,
    refreshHistory,
    refreshReseller,
    theme,
    addToast,
  } = useApp();

  const { isAdminMode } = useAdmin();
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [mergeCelebration, setMergeCelebration] = useState<{
    telegramId: number | string;
    message?: string;
  } | null>(null);

  // First-time visitor Terms & Conditions acceptance gate
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState<boolean>(() => {
    try {
      return localStorage.getItem('deamon_terms_accepted_v1') === 'true';
    } catch {
      return false;
    }
  });

  const handleAcceptTerms = () => {
    try {
      localStorage.setItem('deamon_terms_accepted_v1', 'true');
      localStorage.setItem('deamon_terms_accepted_at', new Date().toISOString());
    } catch {}
    setHasAcceptedTerms(true);
  };

  const isTg = isTelegramWebApp();
  const [webToken, setWebToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search || '';
      if (search.includes('action=reset-password')) {
        setWebUserToken(null);
        return null;
      }
    }
    return getWebUserToken();
  });

  useEffect(() => {
    const handleUnauthorized = () => {
      setWebToken(null);
    };
    window.addEventListener('krish:web_unauthorized', handleUnauthorized);
    return () => window.removeEventListener('krish:web_unauthorized', handleUnauthorized);
  }, []);

  const handleLoginSuccess = async (
    token: string,
    _user?: unknown,
    targetTab?: 'home' | 'store' | 'deposit' | 'history' | 'profile'
  ) => {
    setWebToken(token);
    if (targetTab) {
      setActiveTab(targetTab);
    }
    // Check if login/register auto-merged a Telegram account
    const userObj = _user as any;
    const mergeData = userObj?.account_merged || userObj?.user?.account_merged;
    if (mergeData?.telegram_user_id) {
      setMergeCelebration({
        telegramId: mergeData.telegram_user_id,
        message: mergeData.message,
      });
    }
    await refreshUser();
    await refreshStore();
  };

  // 1-Click Fast Connect: Capture ?merge_token=... from URL on website load
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const params = new URLSearchParams(window.location.search);
      const mToken = params.get('merge_token');
      if (mToken) {
        sessionStorage.setItem('krish_merge_token', mToken);
        try {
          localStorage.setItem('krish_merge_token', mToken);
        } catch {}
        const cleanUrl = window.location.pathname + (window.location.hash || '');
        window.history.replaceState({}, document.title, cleanUrl);
      }
    } catch {}
  }, []);

  // 1-Click Fast Connect: If logged in on website and pending merge_token exists, claim it
  useEffect(() => {
    if (!isTg && webToken && backendConnected) {
      let pendingToken: string | null = null;
      try {
        pendingToken = sessionStorage.getItem('krish_merge_token') || localStorage.getItem('krish_merge_token');
      } catch {}
      if (pendingToken) {
        webAuthApi
          .claimMergeToken(pendingToken)
          .then((res) => {
            try {
              sessionStorage.removeItem('krish_merge_token');
              localStorage.removeItem('krish_merge_token');
            } catch {}
            if (res.success && res.merged_telegram_id) {
              setMergeCelebration({
                telegramId: res.merged_telegram_id,
                message: res.message || 'Accounts merged successfully!',
              });
              refreshUser().catch(() => {});
            }
          })
          .catch((err: any) => {
            try {
              sessionStorage.removeItem('krish_merge_token');
              localStorage.removeItem('krish_merge_token');
            } catch {}
            const errMsg =
              err?.response?.data?.error ||
              err?.message ||
              'Fast Connect link has expired. Please generate a fresh one from Telegram.';
            addToast(errMsg, 'error', 'Connection Expired');
          });
      }
    }
  }, [isTg, webToken, backendConnected, refreshUser, addToast]);

  // Stale-While-Revalidate (SWR): Refresh active tab data seamlessly in background
  useEffect(() => {
    if (!backendConnected) return;

    // Refresh wallet balance on every tab transition
    refreshUser().catch(() => {});

    if (activeTab === 'store') {
      refreshStore().catch(() => {});
    } else if (activeTab === 'history') {
      refreshHistory().catch(() => {});
    } else if (activeTab === 'profile') {
      refreshReseller().catch(() => {});
    }
  }, [activeTab, backendConnected, refreshUser, refreshStore, refreshHistory, refreshReseller]);

  // Initialize Telegram WebApp SDK
  useEffect(() => {
    try {
      if (window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();
        tg.enableClosingConfirmation?.();
        const headerColor = theme === 'light' ? '#ffffff' : '#0b0b0e';
        tg.setHeaderColor?.(headerColor);
        tg.setBackgroundColor?.(headerColor);
      }
    } catch {
      // not in telegram webview
    }
  }, [theme]);

  // Handle frontend download query parameters (e.g. ?download=session&phone=... or ?download=zip&order_id=...)
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const params = new URLSearchParams(window.location.search);
      const dlType = params.get('download');
      const dlPhone = params.get('phone');
      const dlOrder = params.get('order_id') || params.get('id');

      if (dlType === 'session' && dlPhone) {
        const url = downloadApi.getSessionDownloadUrl(dlPhone);
        downloadApi.triggerDownload(url, `${dlPhone}.session`);
      } else if ((dlType === 'zip' || dlType === 'bulk') && dlOrder) {
        const url = downloadApi.getBulkZipDownloadUrl(dlOrder);
        downloadApi.triggerDownload(url, `bulk_sessions_${dlOrder}.zip`);
      }
    } catch {
      // Ignore URL parsing errors
    }
  }, []);

  // 1. When accessed via website without an authenticated web session, present full responsive Landing Page directly
  if (!isTg && !webToken) {
    return (
      <div className="relative w-full min-h-screen flex flex-col">
        <ToastContainer />
        <React.Suspense fallback={null}>
          <LandingPage onLoginSuccess={handleLoginSuccess} />
        </React.Suspense>
      </div>
    );
  }

  // 2. Initial synchronization loading screen (for Telegram WebApp or returning web users)
  if (isInitialLoading) {
    if (isTg) {
      return (
        <InitialLoadingScreen
          step={initialLoadingStep}
          statusMessage={initialLoadingMessage}
        />
      );
    }

    // Modern minimal circling spinner for returning logged-in web users
    return (
      <div className="relative w-full min-h-screen bg-[#0b0b0e] text-white flex flex-col items-center justify-center p-4 select-none">
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="relative w-12 h-12 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full border-2 border-violet-500/20 border-t-violet-500 animate-spin" />
          </div>
          <div className="flex flex-col items-center gap-1 text-center">
            <span className="text-sm font-semibold text-white tracking-wide">
              Connecting to Daemon OTP...
            </span>
            <span className="text-xs text-zinc-400">
              {initialLoadingMessage || 'Restoring your session'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (backendConnected === false || (isMaintenanceMode && !isAdminMode)) {
    return (
      <MaintenanceScreen
        onRetry={() => recheckConnection(true)}
        isRetrying={isCheckingBackend}
      />
    );
  }

  // When Admin Mode is active, render the comprehensive 5-tab Admin Dashboard UI
  if (isAdminMode) {
    return (
      <div className="relative w-full min-h-screen bg-[#0b0b0e] text-white flex flex-col shadow-2xl">
        <ToastContainer />
        <React.Suspense fallback={<InitialLoadingScreen />}>
          <AdminDashboard />
        </React.Suspense>
      </div>
    );
  }

  // Dual-Shell Architecture: Isolated presentation shells for Telegram vs Standalone Web
  if (isTg) {
    return (
      <TelegramShell
        isTransferModalOpen={isTransferModalOpen}
        onOpenTransferModal={() => setIsTransferModalOpen(true)}
        onCloseTransferModal={() => setIsTransferModalOpen(false)}
        hasAcceptedTerms={hasAcceptedTerms}
        onAcceptTerms={handleAcceptTerms}
      />
    );
  }

  return (
    <>
      <MergeCelebrationModal
        isOpen={Boolean(mergeCelebration)}
        onClose={() => setMergeCelebration(null)}
        telegramId={mergeCelebration?.telegramId || ''}
        message={mergeCelebration?.message}
      />
      <WebShell
        isTransferModalOpen={isTransferModalOpen}
        onOpenTransferModal={() => setIsTransferModalOpen(true)}
        onCloseTransferModal={() => setIsTransferModalOpen(false)}
        hasAcceptedTerms={hasAcceptedTerms}
        onAcceptTerms={handleAcceptTerms}
      />
    </>
  );
};

export const App: React.FC = () => {
  return (
    <AdminProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </AdminProvider>
  );
};

export default App;
