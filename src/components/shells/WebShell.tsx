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
import {
  LayoutDashboard,
  ShoppingBag,
  Wallet,
  Clock,
  User,
} from 'lucide-react';

export interface WebShellProps {
  isTransferModalOpen: boolean;
  onOpenTransferModal: () => void;
  onCloseTransferModal: () => void;
  hasAcceptedTerms: boolean;
  onAcceptTerms: () => void;
}

const navTabs = [
  { id: 'home', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'store', label: 'Storefront', icon: ShoppingBag },
  { id: 'deposit', label: 'Deposit Funds', icon: Wallet },
  { id: 'history', label: 'Order History', icon: Clock },
  { id: 'profile', label: 'My Account', icon: User },
] as const;

/**
 * Dedicated Shell for Standalone Web Visitors (Chrome, Safari, Edge, etc.)
 * Features responsive desktop top-bar tabs on wide screens and mobile bottom nav on small viewports.
 * Completely isolated from Telegram SDK hooks and mobile-only container limits.
 */
export const WebShell: React.FC<WebShellProps> = ({
  isTransferModalOpen,
  onOpenTransferModal,
  onCloseTransferModal,
  hasAcceptedTerms,
  onAcceptTerms,
}) => {
  const { activeTab, setActiveTab } = useApp();

  return (
    <div className="relative w-full max-w-5xl mx-auto px-2 sm:px-6 md:border-x md:border-[#181820]/40 min-h-screen bg-[#0b0b0e] text-white flex flex-col shadow-2xl">
      {/* Toast Notifications */}
      <ToastContainer />

      {/* Header */}
      <Header />

      {/* Desktop Top Navigation Bar (Visible only on md+ screens) */}
      <nav className="hidden md:flex items-center justify-between gap-2 p-1.5 mt-2 mb-1 bg-[#121217]/90 backdrop-blur-md border border-[#262630] rounded-2xl shadow-sm">
        <div className="flex items-center gap-1.5 flex-1">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#7c3aed] text-white shadow-md shadow-[#7c3aed]/30 font-bold'
                    : 'text-[#a1a1aa] hover:text-white hover:bg-[#181820]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Recovery Banner */}
      <GlobalRecoveryBanner />

      {/* Main View Container: responsive pb-24 on mobile vs pb-8 on desktop */}
      <main className="flex-1 px-2 sm:px-4 pb-24 md:pb-8 pt-2 overflow-y-auto no-scrollbar">
        {activeTab === 'home' && (
          <DashboardView onOpenTransferModal={onOpenTransferModal} />
        )}
        {activeTab === 'store' && <StorefrontView />}
        {activeTab === 'deposit' && <DepositHub />}
        {activeTab === 'history' && <HistoryView />}
        {activeTab === 'profile' && <ProfileView />}
      </main>

      {/* Bottom Navigation (Only visible on mobile viewports, hidden on desktop md+) */}
      <div className="md:hidden">
        <BottomNav />
      </div>

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
