import React, { Suspense } from 'react';
import { useAdmin } from '../../context/AdminContext';
import { AdminHeader } from './AdminHeader';
import { AdminNav } from './AdminNav';

// Code-split admin tabs to ensure fast initial page load and tiny customer bundles
const OverviewTab = React.lazy(() =>
  import('./tabs/OverviewTab').then((m) => ({ default: m.OverviewTab }))
);
const ServerManagementTab = React.lazy(() =>
  import('./tabs/ServerManagementTab').then((m) => ({ default: m.ServerManagementTab }))
);
const PaymentsHubTab = React.lazy(() =>
  import('./tabs/PaymentsHubTab').then((m) => ({ default: m.PaymentsHubTab }))
);
const UserManagementTab = React.lazy(() =>
  import('./tabs/UserManagementTab').then((m) => ({ default: m.UserManagementTab }))
);
const MarketingSettingsTab = React.lazy(() =>
  import('./tabs/MarketingSettingsTab').then((m) => ({ default: m.MarketingSettingsTab }))
);

const AdminTabSkeleton: React.FC = () => (
  <div className="w-full space-y-4 animate-pulse pt-2">
    <div className="h-12 bg-[#181820] border border-[#262630] rounded-2xl w-full" />
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      <div className="h-24 bg-[#181820] border border-[#262630] rounded-2xl" />
      <div className="h-24 bg-[#181820] border border-[#262630] rounded-2xl" />
      <div className="h-24 bg-[#181820] border border-[#262630] rounded-2xl" />
      <div className="h-24 bg-[#181820] border border-[#262630] rounded-2xl" />
    </div>
    <div className="h-64 bg-[#181820] border border-[#262630] rounded-2xl w-full" />
  </div>
);

export const AdminDashboard: React.FC = () => {
  const { activeAdminTab } = useAdmin();

  return (
    <div className="min-h-screen w-full bg-[#0b0b0e] text-white flex flex-col font-sans selection:bg-[#7c3aed]/30 selection:text-white">
      {/* Sticky Header with branding, user ID, connection status, and mode switch button */}
      <AdminHeader />

      {/* 5-Tab Navigation Pill Bar */}
      <AdminNav />

      {/* Main Tab Content Viewport */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-3 sm:px-4 pt-4 sm:pt-6 overflow-y-auto no-scrollbar">
        <Suspense fallback={<AdminTabSkeleton />}>
          {activeAdminTab === 'overview' && <OverviewTab />}
          {activeAdminTab === 'servers' && <ServerManagementTab />}
          {activeAdminTab === 'payments' && <PaymentsHubTab />}
          {activeAdminTab === 'users' && <UserManagementTab />}
          {activeAdminTab === 'marketing' && <MarketingSettingsTab />}
        </Suspense>
      </main>
    </div>
  );
};

export default AdminDashboard;
