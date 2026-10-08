import React from 'react';
import { useAdmin } from '../../context/AdminContext';
import { Shield, ShoppingBag, Sliders, ArrowRight, Sparkles } from 'lucide-react';

export interface AdminEntryChoiceModalProps {
  isOpen?: boolean;
  onEnterUser?: () => void;
  onEnterAdmin?: () => void;
}

/**
 * Startup dual-entry gatekeeping modal shown to verified administrators.
 * Offers two pathways:
 * 1. "Enter as User": Sets session to customer storefront for testing.
 * 2. "Enter as Admin Panel": Opens the secret passphrase challenge modal.
 */
export const AdminEntryChoiceModal: React.FC<AdminEntryChoiceModalProps> = ({
  isOpen: propIsOpen,
  onEnterUser,
  onEnterAdmin,
}) => {
  const admin = useAdmin();

  const isVisible = propIsOpen !== undefined ? propIsOpen : admin.showEntryChoiceModal;

  if (!isVisible) {
    return null;
  }

  const handleSelectUser = () => {
    if (onEnterUser) {
      onEnterUser();
    } else {
      admin.enterUserMode();
    }
  };

  const handleSelectAdmin = () => {
    if (onEnterAdmin) {
      onEnterAdmin();
    } else {
      admin.enterAdminMode();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0b0b0e]/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="entry-choice-title"
    >
      <div className="w-full max-w-sm bg-[#181820] border border-[#262630] rounded-2xl p-5 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col gap-4">
        {/* Header with Privileged Shield Badge */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#7c3aed]/15 border border-[#7c3aed]/30 flex items-center justify-center text-[#a78bfa] shrink-0 shadow-inner">
            <Shield className="w-6 h-6 text-[#8b5cf6]" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-[#8b5cf6] uppercase tracking-wider">
                RBAC Gatekeeper
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
            </div>
            <h2 id="entry-choice-title" className="text-base font-bold text-white tracking-tight">
              Administrator Detected
            </h2>
          </div>
        </div>

        <p className="text-xs text-[#a1a1aa] leading-relaxed">
          Your Telegram account has authorized administrator privileges. Select your entry workspace for this session:
        </p>

        {/* Choice 1: Customer Storefront */}
        <button
          onClick={handleSelectUser}
          className="group w-full text-left bg-[#121217] hover:bg-[#171720] border border-[#262630] hover:border-[#3b3b4a] rounded-xl p-3.5 transition-all active:scale-[0.98] shadow-sm flex items-start gap-3"
        >
          <div className="w-9 h-9 rounded-lg bg-[#22c55e]/10 border border-[#22c55e]/20 flex items-center justify-center text-[#22c55e] shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="font-semibold text-sm text-white group-hover:text-[#22c55e] transition-colors">
                Enter as User
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 font-medium">
                Storefront
              </span>
            </div>
            <p className="text-[11px] text-[#71717a] leading-normal">
              Test customer order flows, buy virtual numbers/accounts, and simulate wallet deposits.
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-[#71717a] group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0 mt-2" />
        </button>

        {/* Choice 2: Admin Panel */}
        <button
          onClick={handleSelectAdmin}
          className="group w-full text-left bg-[#121217] hover:bg-[#1a142c] border border-[#7c3aed]/40 hover:border-[#8b5cf6] rounded-xl p-3.5 transition-all active:scale-[0.98] shadow-md shadow-[#7c3aed]/5 flex items-start gap-3 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#7c3aed]/5 rounded-full blur-xl pointer-events-none" />
          <div className="w-9 h-9 rounded-lg bg-[#7c3aed]/15 border border-[#7c3aed]/30 flex items-center justify-center text-[#a78bfa] shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
            <Sliders className="w-5 h-5 text-[#8b5cf6]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1 mb-1">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm text-white group-hover:text-[#a78bfa] transition-colors">
                  Enter as Admin Panel
                </span>
                <Sparkles className="w-3 h-3 text-[#f59e0b]" />
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#7c3aed]/20 text-[#a78bfa] border border-[#7c3aed]/30 font-medium">
                Full Control
              </span>
            </div>
            <p className="text-[11px] text-[#71717a] leading-normal">
              Manage Servers 1–5, stock uploads, UTR approvals, user balances, and system settings.
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-[#8b5cf6] group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0 mt-2" />
        </button>

        {/* Persistence Notice */}
        <div className="pt-1 text-center">
          <p className="text-[10px] text-[#71717a]">
            💡 You can switch workspaces at any time using the Header toggle button.
          </p>
        </div>
      </div>
    </div>
  );
};
