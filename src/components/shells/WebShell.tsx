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
import { SettingsView } from '../settings/SettingsView';
import { P2PTransferModal } from '../profile/P2PTransferModal';
import { TermsAcceptanceModal } from '../common/TermsAcceptanceModal';
import {
  LayoutDashboard,
  ShoppingBag,
  Wallet,
  Clock,
  User,
  Settings,
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
  { id: 'settings', label: 'Settings', icon: Settings },
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
  const { activeTab, setActiveTab, theme } = useApp();
  const isLight = theme === 'light';

  return (
    <div
      className={`relative w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 min-h-screen flex flex-col transition-colors duration-200 ${
        isLight ? 'bg-[#FAF8FF] text-[#211536]' : 'bg-[#0b0b0e] text-white shadow-2xl'
      }`}
    >
      {/* Toast Notifications */}
      <ToastContainer />

      {/* Header with Website layout (Brand on left, Profile & Balance on right) */}
      <Header isWeb={true} />

      {/* Desktop Top Navigation Bar (Visible only on md+ screens) */}
      <nav
        className={`hidden md:flex items-center justify-between gap-2 p-1.5 mt-3 mb-2 backdrop-blur-md border rounded-2xl transition-all ${
          isLight
            ? 'bg-white/95 border-[#E5DCF4] shadow-sm'
            : 'bg-[#121217]/90 border-[#262630] shadow-sm'
        }`}
      >
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
                    ? 'btn-25d-primary font-bold'
                    : isLight
                    ? 'text-[#514364] hover:text-[#211536] hover:bg-[#F3EEFF]'
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
      <main className="flex-1 w-full pb-24 md:pb-8 pt-2 overflow-y-auto no-scrollbar">
        {activeTab === 'home' && (
          <DashboardView onOpenTransferModal={onOpenTransferModal} />
        )}
        {activeTab === 'store' && <StorefrontView />}
        {activeTab === 'deposit' && <DepositHub />}
        {activeTab === 'history' && <HistoryView />}
        {activeTab === 'profile' && <ProfileView />}
        {activeTab === 'settings' && <SettingsView />}
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
