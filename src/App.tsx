import React, { useEffect, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AdminProvider, useAdmin } from './context/AdminContext';
import { Header } from './components/Header';
import { BottomNav } from './components/common/BottomNav';
import { ToastContainer } from './components/common/Toast';
import { InitialLoadingScreen } from './components/common/InitialLoadingScreen';
import { MaintenanceScreen } from './components/common/MaintenanceScreen';
import { DashboardView } from './components/dashboard/DashboardView';
import { StorefrontView } from './components/store/StorefrontView';
import { DepositHub } from './components/deposit/DepositHub';
import { HistoryView } from './components/history/HistoryView';
import { ProfileView } from './components/profile/ProfileView';
import { P2PTransferModal } from './components/profile/P2PTransferModal';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminEntryChoiceModal } from './components/admin/AdminEntryChoiceModal';
import { AdminPassphraseModal } from './components/admin/AdminPassphraseModal';
import { LandingPage } from './components/landing/LandingPage';
import { isTelegramWebApp, getWebUserToken } from './api/client';
import { downloadApi } from './api/endpoints';

const AppContent: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    isInitialLoading,
    initialLoadingStep,
    initialLoadingMessage,
    backendConnected,
    isCheckingBackend,
    recheckConnection,
    refreshUser,
    refreshStore,
    refreshHistory,
    refreshReseller,
  } = useApp();

  const { isAdminMode } = useAdmin();
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

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
        tg.setHeaderColor?.('#0b0b0e');
        tg.setBackgroundColor?.('#0b0b0e');
      }
    } catch {
      // not in telegram webview
    }
  }, []);

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

  // Sync Telegram native BackButton with active tab
  useEffect(() => {
    try {
      const backButton = window.Telegram?.WebApp?.BackButton;
      if (backButton) {
        if (activeTab !== 'home' && !isAdminMode) {
          backButton.show();
          const handleBack = () => setActiveTab('home');
          backButton.onClick(handleBack);
          return () => {
            backButton.offClick(handleBack);
          };
        } else {
          backButton.hide();
        }
      }
    } catch {
      // not in telegram webview
    }
  }, [activeTab, setActiveTab, isAdminMode]);

  // 1. When accessed via website without an authenticated Google session, present full responsive Landing Page
  if (!isTg && !webToken) {
    return (
      <div className="relative w-full min-h-screen bg-[#0b0b0e] text-white flex flex-col">
        <ToastContainer />
        <LandingPage onLoginSuccess={handleGoogleLoginSuccess} />
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

  if (backendConnected === false) {
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
        <AdminDashboard />
      </div>
    );
  }

  // Normal Customer Storefront workspace (responsive on web, native phone width on Telegram)
  return (
    <div
      className={`relative w-full ${
        isTg
          ? 'max-w-[430px] mx-auto border-x border-[#181820]/40'
          : 'max-w-4xl mx-auto px-2 sm:px-4 md:border-x md:border-[#181820]/40'
      } min-h-screen bg-[#0b0b0e] text-white flex flex-col shadow-2xl`}
    >
      {/* Toast Notifications */}
      <ToastContainer />

      {/* Persistent Sticky Header with Telegram profile & testing switcher for admins */}
      <Header />

      {/* Main View Container */}
      <main className="flex-1 px-4 pb-28 pt-2 overflow-y-auto no-scrollbar">
        {activeTab === 'home' && (
          <DashboardView onOpenTransferModal={() => setIsTransferModalOpen(true)} />
        )}
        {activeTab === 'store' && <StorefrontView />}
        {activeTab === 'deposit' && <DepositHub />}
        {activeTab === 'history' && <HistoryView />}
        {activeTab === 'profile' && <ProfileView />}
      </main>

      {/* Persistent Sticky Bottom Navigation Bar */}
      <BottomNav />

      {/* Global P2P Transfer Modal */}
      <P2PTransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
      />
    </div>
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

export { AdminEntryChoiceModal, AdminPassphraseModal };
export default App;
