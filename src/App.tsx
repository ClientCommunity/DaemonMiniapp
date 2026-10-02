import React, { useEffect, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/common/Header';
import { BottomNav } from './components/common/BottomNav';
import { ToastContainer } from './components/common/Toast';
import { DashboardView } from './components/dashboard/DashboardView';
import { StorefrontView } from './components/store/StorefrontView';
import { DepositHub } from './components/deposit/DepositHub';
import { HistoryView } from './components/history/HistoryView';
import { ProfileView } from './components/profile/ProfileView';
import { P2PTransferModal } from './components/profile/P2PTransferModal';

const AppContent: React.FC = () => {
  const { activeTab } = useApp();
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  // Initialize Telegram WebApp SDK
  useEffect(() => {
    try {
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
      }
    } catch {
      // not in telegram webview
    }
  }, []);

  return (
    <div className="relative w-full max-w-[430px] mx-auto min-h-screen bg-[#0b0b0e] text-white flex flex-col shadow-2xl border-x border-[#181820]/40">
      {/* Toast Notifications */}
      <ToastContainer />

      {/* Persistent Sticky Header */}
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
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;
