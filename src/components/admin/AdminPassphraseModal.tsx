import React, { useState } from 'react';
import { useAdmin } from '../../context/AdminContext';
import { KeyRound, Eye, EyeOff, Loader2, AlertCircle, X } from 'lucide-react';

export interface AdminPassphraseModalProps {
  isOpen?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}

/**
 * Secret passphrase challenge modal for unlocking administrator privileges.
 * Verifies secret against ADMIN_PANEL_SECRET via backend POST /api/admin/login.
 */
export const AdminPassphraseModal: React.FC<AdminPassphraseModalProps> = ({
  isOpen: propIsOpen,
  onSuccess,
  onCancel,
}) => {
  const admin = useAdmin();
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const isVisible = propIsOpen !== undefined ? propIsOpen : admin.showPassphraseModal;

  if (!isVisible) {
    return null;
  }

  const handleCancel = () => {
    setPassphrase('');
    setLocalError(null);
    if (onCancel) {
      onCancel();
    } else {
      admin.enterUserMode();
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    const trimmed = passphrase.trim();
    if (!trimmed) {
      setLocalError('Please enter the administrator passphrase.');
      return;
    }

    setLocalError(null);
    const success = await admin.authenticateAdmin(trimmed);
    if (success) {
      setPassphrase('');
      setLocalError(null);
      if (onSuccess) {
        onSuccess();
      }
    } else {
      setLocalError(admin.authError || 'Invalid admin passphrase. Access denied.');
    }
  };

  const errorMessage = localError || admin.authError;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0b0b0e]/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="passphrase-modal-title"
    >
      <div className="w-full max-w-sm bg-[#181820] border border-[#262630] rounded-2xl p-5 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col gap-4 relative">
        {/* Close / Dismiss button */}
        <button
          onClick={handleCancel}
          className="absolute top-4 right-4 text-[#71717a] hover:text-white transition-colors p-1 rounded-lg hover:bg-[#262630]"
          aria-label="Close passphrase dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Lock Icon & Title */}
        <div className="flex flex-col items-center text-center gap-2 pt-1">
          <div className="w-12 h-12 rounded-2xl bg-[#7c3aed]/15 border border-[#7c3aed]/30 flex items-center justify-center text-[#a78bfa] shadow-inner mb-1">
            <KeyRound className="w-6 h-6 text-[#8b5cf6]" />
          </div>
          <h2 id="passphrase-modal-title" className="text-base font-bold text-white tracking-tight">
            Security Verification
          </h2>
          <p className="text-xs text-[#a1a1aa] max-w-[280px]">
            Enter the master secret passphrase configured in <code className="text-[#a78bfa] font-mono text-[11px] bg-[#121217] px-1 py-0.5 rounded border border-[#262630]">ADMIN_PANEL_SECRET</code> to unlock administrative controls.
          </p>
        </div>

        {/* Error Notice */}
        {errorMessage && (
          <div className="bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-xl p-3 flex items-start gap-2.5 text-xs text-[#ef4444] animate-in fade-in slide-in-from-top-1">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1 leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* Passphrase Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="admin-secret-input" className="text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wider">
              Admin Passphrase
            </label>
            <div className="relative">
              <input
                id="admin-secret-input"
                type={showPassphrase ? 'text' : 'password'}
                value={passphrase}
                onChange={(e) => {
                  setPassphrase(e.target.value);
                  if (errorMessage) {
                    setLocalError(null);
                  }
                }}
                placeholder="Enter secret passphrase..."
                autoFocus
                autoComplete="current-password"
                disabled={admin.isAuthenticating}
                className="w-full bg-[#121217] border border-[#262630] focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed] rounded-xl px-3.5 py-2.5 pr-10 text-sm text-white font-mono placeholder-[#71717a] outline-none transition-all disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassphrase(!showPassphrase)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-white transition-colors"
                tabIndex={-1}
                aria-label={showPassphrase ? 'Hide passphrase' : 'Show passphrase'}
              >
                {showPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 pt-1">
            <button
              type="submit"
              disabled={admin.isAuthenticating || !passphrase.trim()}
              className="w-full bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] hover:from-[#8b5cf6] hover:to-[#7c3aed] text-white font-semibold rounded-xl py-3 text-sm shadow-lg shadow-[#7c3aed]/25 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              {admin.isAuthenticating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Unlock Admin Panel</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleCancel}
              disabled={admin.isAuthenticating}
              className="w-full py-2 text-xs text-[#a1a1aa] hover:text-white transition-colors text-center cursor-pointer"
            >
              Cancel & Return to Storefront
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
