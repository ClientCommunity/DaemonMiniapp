import React from 'react';
import { DualBalanceCard } from './DualBalanceCard';
import { QuickActions } from './QuickActions';
import { ActiveOtpCard } from './ActiveOtpCard';
import { RecentActivity } from './RecentActivity';

interface DashboardViewProps {
  onOpenTransferModal: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onOpenTransferModal }) => {
  return (
    <div className="w-full flex flex-col pt-3 pb-6">
      {/* Dual Balance Hero Card */}
      <DualBalanceCard onOpenTransferModal={onOpenTransferModal} />

      {/* Active OTP listener if any */}
      <ActiveOtpCard />

      {/* Quick Actions Touch Grid */}
      <QuickActions />

      {/* Recent Orders & Activity */}
      <RecentActivity />
    </div>
  );
};
