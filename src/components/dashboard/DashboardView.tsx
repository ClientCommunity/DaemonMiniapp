import React from 'react';
import { DualBalanceCard } from './DualBalanceCard';
import { QuickActions } from './QuickActions';
import { ActiveNumbersSection } from '../common/ActiveNumbersSection';
import { RecentActivity } from './RecentActivity';
import { PinnedDealsSection } from './PinnedDealsSection';

interface DashboardViewProps {
  onOpenTransferModal: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onOpenTransferModal }) => {
  return (
    <div className="w-full flex flex-col pt-3 pb-6">
      {/* Desktop 2-Column Command Center (lg+) vs Mobile Stacking (< lg) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Main Column (8 cols on lg+): Balance, Active OTP Numbers & Deals */}
        <div className="lg:col-span-8 flex flex-col">
          {/* Dual Balance Hero Card */}
          <DualBalanceCard onOpenTransferModal={onOpenTransferModal} />

          {/* Persistent Active Numbers & Live OTP Retrieval Section */}
          <ActiveNumbersSection />

          {/* Featured & Pinned Hot Deals */}
          <PinnedDealsSection />
        </div>

        {/* Side Column (4 cols on lg+): Quick Actions & Activity Stream */}
        <div className="lg:col-span-4 flex flex-col">
          {/* Quick Actions Touch Grid */}
          <QuickActions />

          {/* Recent Orders & Activity */}
          <RecentActivity />
        </div>
      </div>
    </div>
  );
};
