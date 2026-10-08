import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { adminApi, AdminPermissions } from '../api/adminApi';
import { getAdminToken, setAdminToken, getTelegramInitData } from '../api/client';
import { AdminEntryChoiceModal } from '../components/admin/AdminEntryChoiceModal';
import { AdminPassphraseModal } from '../components/admin/AdminPassphraseModal';

export type AdminTab = 'overview' | 'servers' | 'payments' | 'users' | 'marketing';

const ADMIN_ENTRY_CHOICE_KEY = 'krish_admin_entry_choice';
const KNOWN_MASTER_ADMIN_IDS = ['7507183871', '1928631932'];

export interface AdminContextType {
  // State
  isAdmin: boolean;
  isAdminMode: boolean;
  adminToken: string | null;
  activeAdminTab: AdminTab;
  showEntryChoiceModal: boolean;
  showPassphraseModal: boolean;
  isAuthenticating: boolean;
  authError: string | null;
  permissions: AdminPermissions | null;

  // Actions
  authenticateAdmin: (secret: string) => Promise<boolean>;
  enterUserMode: () => void;
  enterAdminMode: () => void;
  logoutAdmin: () => void;
  setActiveAdminTab: (tab: AdminTab) => void;
  setShowEntryChoiceModal: (show: boolean) => void;
  setShowPassphraseModal: (show: boolean) => void;
}

const defaultAdminContextValue: AdminContextType = {
  isAdmin: false,
  isAdminMode: false,
  adminToken: null,
  activeAdminTab: 'overview',
  showEntryChoiceModal: false,
  showPassphraseModal: false,
  isAuthenticating: false,
  authError: null,
  permissions: null,
  authenticateAdmin: async () => false,
  enterUserMode: () => {},
  enterAdminMode: () => {},
  logoutAdmin: () => {},
  setActiveAdminTab: () => {},
  setShowEntryChoiceModal: () => {},
  setShowPassphraseModal: () => {},
};

export const AdminContext = createContext<AdminContextType>(defaultAdminContextValue);

/**
 * Helper to extract current Telegram User ID from WebApp SDK.
 */
function extractTelegramUserId(): string | null {
  try {
    const tg = (window as unknown as {
      Telegram?: {
        WebApp?: {
          initDataUnsafe?: {
            user?: { id?: number | string };
          };
        };
      };
    })?.Telegram;
    const uid = tg?.WebApp?.initDataUnsafe?.user?.id;
    if (uid !== undefined && uid !== null) {
      return String(uid);
    }
  } catch {
    // Ignore context access errors
  }
  return null;
}

export const AdminProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false);
  const [adminToken, setAdminTokenState] = useState<string | null>(getAdminToken());
  const [activeAdminTab, setActiveAdminTab] = useState<AdminTab>('overview');
  const [showEntryChoiceModal, setShowEntryChoiceModal] = useState<boolean>(false);
  const [showPassphraseModal, setShowPassphraseModal] = useState<boolean>(false);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<AdminPermissions | null>(null);

  // Initialize and verify admin credentials on mount
  useEffect(() => {
    let isMounted = true;

    async function checkAdminStatus() {
      const existingToken = getAdminToken();
      let recognizedAdmin = false;

      // 1. Check existing JWT session token if available
      if (existingToken) {
        try {
          const res = await adminApi.getAdminMe();
          if (res?.success && res.is_admin) {
            recognizedAdmin = true;
            if (isMounted) {
              setIsAdmin(true);
              setPermissions(res.permissions || null);
              setAdminTokenState(existingToken);
            }
          }
        } catch {
          // Token may be expired; do not clear admin status if Telegram ID matches
        }
      }

      // 2. Check Telegram ID against known master administrator list
      const tgId = extractTelegramUserId();
      const hasInitData = !!getTelegramInitData();

      if (tgId && KNOWN_MASTER_ADMIN_IDS.includes(tgId)) {
        recognizedAdmin = true;
      } else if (!tgId && !hasInitData) {
        // External browser / local preview development fallback defaults to master admin
        recognizedAdmin = true;
      }

      if (isMounted && recognizedAdmin) {
        setIsAdmin(true);

        // Check if an entry choice has already been made during this browser session
        let choice: string | null = null;
        try {
          choice = sessionStorage.getItem(ADMIN_ENTRY_CHOICE_KEY);
        } catch {
          choice = null;
        }

        if (choice === 'admin') {
          if (existingToken) {
            setIsAdminMode(true);
            setShowEntryChoiceModal(false);
            setShowPassphraseModal(false);
          } else {
            // Admin workspace was chosen previously but requires fresh secret unlock
            setShowPassphraseModal(true);
            setShowEntryChoiceModal(false);
          }
        } else if (choice === 'user') {
          setIsAdminMode(false);
          setShowEntryChoiceModal(false);
          setShowPassphraseModal(false);
        } else {
          // No choice made yet for this session: present the dual-mode prompt
          setShowEntryChoiceModal(true);
        }
      }
    }

    checkAdminStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * Verify passphrase against backend POST /api/admin/login.
   */
  const authenticateAdmin = useCallback(async (secret: string): Promise<boolean> => {
    setIsAuthenticating(true);
    setAuthError(null);

    try {
      const res = await adminApi.login(secret);
      if (res?.success && res.token) {
        setAdminToken(res.token);
        setAdminTokenState(res.token);
        setIsAdmin(true);
        setIsAdminMode(true);
        if (res.permissions) {
          setPermissions(res.permissions);
        }
        try {
          sessionStorage.setItem(ADMIN_ENTRY_CHOICE_KEY, 'admin');
        } catch {
          // Ignore storage errors
        }
        setShowPassphraseModal(false);
        setShowEntryChoiceModal(false);
        setAuthError(null);
        return true;
      } else {
        const errorMsg = res?.error || 'Invalid administrator secret key.';
        setAuthError(errorMsg);
        return false;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Authentication verification failed';
      setAuthError(message);
      return false;
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  /**
   * Directs the user to the customer storefront workspace.
   */
  const enterUserMode = useCallback(() => {
    try {
      sessionStorage.setItem(ADMIN_ENTRY_CHOICE_KEY, 'user');
    } catch {
      // Ignore
    }
    setIsAdminMode(false);
    setShowEntryChoiceModal(false);
    setShowPassphraseModal(false);
    setAuthError(null);
  }, []);

  /**
   * Enters the admin dashboard workspace, prompting for secret passphrase if unauthenticated.
   */
  const enterAdminMode = useCallback(() => {
    const token = getAdminToken();
    if (token) {
      setIsAdminMode(true);
      try {
        sessionStorage.setItem(ADMIN_ENTRY_CHOICE_KEY, 'admin');
      } catch {
        // Ignore
      }
      setShowEntryChoiceModal(false);
      setShowPassphraseModal(false);
    } else {
      setShowEntryChoiceModal(false);
      setShowPassphraseModal(true);
    }
  }, []);

  /**
   * Clears the current admin session token and returns to user mode.
   */
  const logoutAdmin = useCallback(() => {
    setAdminToken(null);
    setAdminTokenState(null);
    setIsAdminMode(false);
    setShowPassphraseModal(false);
    setShowEntryChoiceModal(false);
    setPermissions(null);
    try {
      sessionStorage.removeItem(ADMIN_ENTRY_CHOICE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  const value: AdminContextType = {
    isAdmin,
    isAdminMode,
    adminToken,
    activeAdminTab,
    showEntryChoiceModal,
    showPassphraseModal,
    isAuthenticating,
    authError,
    permissions,
    authenticateAdmin,
    enterUserMode,
    enterAdminMode,
    logoutAdmin,
    setActiveAdminTab,
    setShowEntryChoiceModal,
    setShowPassphraseModal,
  };

  return (
    <AdminContext.Provider value={value}>
      {children}
      {showEntryChoiceModal && <AdminEntryChoiceModal />}
      {showPassphraseModal && <AdminPassphraseModal />}
    </AdminContext.Provider>
  );
};

/**
 * Access the administrative gatekeeping and session state.
 */
export const useAdmin = (): AdminContextType => {
  const context = useContext(AdminContext);
  if (!context) {
    return defaultAdminContextValue;
  }
  return context;
};
