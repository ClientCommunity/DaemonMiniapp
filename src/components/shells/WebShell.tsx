import React from 'react';
import { useApp } from '../../context/AppContext';
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

export interface WebShellProps {
  isTransferModalOpen: boolean;
  onOpenTransferModal: () => void;
  onCloseTransferModal: () => void;
  hasAcceptedTerms: boolean;
  onAcceptTerms: () => void;
}

/**
 * Dedicated Shell for Standalone Web Visitors (Chrome, Safari, Edge, etc.)
 * Completely isolated from Telegram SDK hooks and mobile-only container limits.
 */
export const WebShell: React.FC<WebShellProps> = ({
  isTransferModalOpen,
  onOpenTransferModal,
  onCloseTransferModal,
  hasAcceptedTerms,
  onAcceptTerms,
}) => {
  const { activeTab } = useApp();

  return (
    <div className="relative w-full max-w-4xl mx-auto px-2 sm:px-4 md:border-x md:border-[#181820]/40 min-h-screen bg-[#0b0b0e] text-white flex flex-col shadow-2xl">
      {/* Toast Notifications */}
      <ToastContainer />

      {/* Header */}
      <Header />

      {/* Recovery Banner */}
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

      {/* Bottom Navigation */}
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
