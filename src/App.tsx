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
import { isTelegramWebApp, getWebUserToken } from './api/client';
import { downloadApi } from './api/endpoints';

const AppContent: React.FC = () => {
  const {
    activeTab,
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
  } = useApp();

  const { isAdminMode } = useAdmin();
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

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
  const [webToken, setWebToken] = useState<string | null>(getWebUserToken());

  const handleGoogleLoginSuccess = async (token: string) => {
    setWebToken(token);
    await refreshUser();
    await refreshStore();
  };

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

  // 1. When accessed via website without an authenticated Google session, present full responsive Landing Page
  if (!isTg && !webToken) {
    return (
      <div className="relative w-full min-h-screen bg-[#0b0b0e] text-white flex flex-col">
        <ToastContainer />
        <React.Suspense fallback={<InitialLoadingScreen />}>
          <LandingPage onLoginSuccess={handleGoogleLoginSuccess} />
        </React.Suspense>
      </div>
    );
  }

  // 2. Initial synchronization loading screen (for Telegram WebApp or returning web users)
  if (isInitialLoading) {
    return (
      <InitialLoadingScreen
        step={initialLoadingStep}
        statusMessage={initialLoadingMessage}
      />
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
    <WebShell
      isTransferModalOpen={isTransferModalOpen}
      onOpenTransferModal={() => setIsTransferModalOpen(true)}
      onCloseTransferModal={() => setIsTransferModalOpen(false)}
      hasAcceptedTerms={hasAcceptedTerms}
      onAcceptTerms={handleAcceptTerms}
    />
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
