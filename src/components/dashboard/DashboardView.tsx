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
      {/* Desktop: Realistic ATM Card + Quick Actions on Left (4-5 cols), Deals/Active/Activity on Right (7-8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column (4 cols on xl, 5 cols on lg): ATM Card + Quick Actions */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col">
          <DualBalanceCard onOpenTransferModal={onOpenTransferModal} />
          <QuickActions />
        </div>

        {/* Right Column (8 cols on xl, 7 cols on lg): Active Numbers, Pinned Deals & Recent Activity */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col min-w-0">
          <ActiveNumbersSection />
          <PinnedDealsSection />
          <RecentActivity />
        </div>
      </div>
    </div>
  );
};
