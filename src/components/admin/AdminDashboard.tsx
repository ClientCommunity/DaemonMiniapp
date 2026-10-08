import React from 'react';
import { useAdmin } from '../../context/AdminContext';
import { AdminHeader } from './AdminHeader';
import { AdminNav } from './AdminNav';
import { OverviewTab } from './tabs/OverviewTab';
import { ServerManagementTab } from './tabs/ServerManagementTab';
import { PaymentsHubTab } from './tabs/PaymentsHubTab';
import { UserManagementTab } from './tabs/UserManagementTab';
import { MarketingSettingsTab } from './tabs/MarketingSettingsTab';

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
        {activeAdminTab === 'overview' && <OverviewTab />}
        {activeAdminTab === 'servers' && <ServerManagementTab />}
        {activeAdminTab === 'payments' && <PaymentsHubTab />}
        {activeAdminTab === 'users' && <UserManagementTab />}
        {activeAdminTab === 'marketing' && <MarketingSettingsTab />}
      </main>
    </div>
  );
};

export default AdminDashboard;
