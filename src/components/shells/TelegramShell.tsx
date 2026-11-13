import React, { useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAdmin } from '../../context/AdminContext';
import { Header } from '../Header';
import { BottomNav } from '../common/BottomNav';
import { ToastContainer } from '../common/Toast';
import { GlobalRecoveryBanner } from '../common/GlobalRecoveryBanner';
import { DashboardView } from '../dashboard/DashboardView';
import { StorefrontView } from '../store/StorefrontView';
import { DepositHub } from '../deposit/DepositHub';
import { HistoryView } from '../history/HistoryView';
import { ProfileView } from '../profile/ProfileView';
import { P2PTransferModal } from '../profile/P2PTransferModal';
import { TermsAcceptanceModal } from '../common/TermsAcceptanceModal';

export interface TelegramShellProps {
  isTransferModalOpen: boolean;
  onOpenTransferModal: () => void;
  onCloseTransferModal: () => void;
  hasAcceptedTerms: boolean;
  onAcceptTerms: () => void;
}

/**
 * 100% Frozen & Untouched Shell for Telegram Mini App
 * Preserves exact max-w-[430px] mobile container, Telegram BackButton lifecycle, and styling.
 */
export const TelegramShell: React.FC<TelegramShellProps> = ({
  isTransferModalOpen,
  onOpenTransferModal,
  onCloseTransferModal,
  hasAcceptedTerms,
  onAcceptTerms,
}) => {
  const {
    activeTab,
    setActiveTab,
    purchasedCredentialsModal,
    purchasedServer2Modal,
    selectedReceiptItem,
    closeCredentialsModal,
    closeServer2Modal,
    closeReceiptDrawer,
  } = useApp();

  const { isAdminMode } = useAdmin();

  const hasOpenModal = !!(
    purchasedCredentialsModal?.isOpen ||
    purchasedServer2Modal?.isOpen ||
    selectedReceiptItem ||
    isTransferModalOpen
  );

  // Sync Telegram native BackButton with active tab and open modals (prevents accidental loss of numbers)
  useEffect(() => {
    try {
      const backButton = window.Telegram?.WebApp?.BackButton;
      if (backButton) {
        if ((activeTab !== 'home' || hasOpenModal) && !isAdminMode) {
          backButton.show();
          const handleBack = () => {
            if (purchasedCredentialsModal?.isOpen) {
              closeCredentialsModal();
              return;
            }
            if (purchasedServer2Modal?.isOpen) {
              closeServer2Modal();
              return;
            }
            if (selectedReceiptItem) {
              closeReceiptDrawer();
              return;
            }
            if (isTransferModalOpen) {
              onCloseTransferModal();
              return;
            }
            if (activeTab !== 'home') {
              setActiveTab('home');
            }
          };
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
  }, [
    activeTab,
    setActiveTab,
    isAdminMode,
    hasOpenModal,
    purchasedCredentialsModal?.isOpen,
    purchasedServer2Modal?.isOpen,
    selectedReceiptItem,
    isTransferModalOpen,
    closeCredentialsModal,
    closeServer2Modal,
    closeReceiptDrawer,
    onCloseTransferModal,
  ]);

  return (
    <div className="relative w-full max-w-[430px] mx-auto border-x border-[#181820]/40 min-h-screen bg-[#0b0b0e] text-white flex flex-col shadow-2xl">
      {/* Toast Notifications */}
      <ToastContainer />

      {/* Persistent Sticky Header with Telegram profile & testing switcher for admins */}
      <Header />

      {/* Persistent Seamless Recovery Banner (Restores ongoing OTP or Deposit action) */}
      <GlobalRecoveryBanner />

      {/* Main View Container */}
      <main className="flex-1 px-4 pb-28 pt-2 overflow-y-auto no-scrollbar">
        {activeTab === 'home' && (
          <DashboardView onOpenTransferModal={onOpenTransferModal} />
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
        onClose={onCloseTransferModal}
      />

      {/* First-Time User Terms & Conditions Acceptance Modal */}
      <TermsAcceptanceModal
        isOpen={!hasAcceptedTerms}
        onAccept={onAcceptTerms}
      />
    </div>
  );
};
