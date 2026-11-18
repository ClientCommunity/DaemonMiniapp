import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { webBroadcastApi, WebsiteBroadcastRecord } from '../api/endpoints';
import { isTelegramWebApp } from '../api/client';
import { useApp } from './AppContext';

interface BroadcastLocalState {
  opened: boolean;
  popupCount: number;
}

type BroadcastStateMap = Record<string, BroadcastLocalState>;

export interface WebsiteNotificationsContextValue {
  isEnabled: boolean;
  broadcasts: WebsiteBroadcastRecord[];
  loading: boolean;
  unreadCount: number;
  isOpened: (id: number) => boolean;
  markOpened: (id: number) => void;
  markAllOpened: () => void;
  refreshBroadcasts: () => Promise<void>;

  // Auto-popup state (capped strictly at 1 or 2 views)
  activePopup: WebsiteBroadcastRecord | null;
  dismissPopup: (markAsOpened?: boolean) => void;

  // Notification Inbox modal state
  isInboxOpen: boolean;
  openInbox: () => void;
  closeInbox: () => void;

  // Browser Web Push state
  pushSupported: boolean;
  pushServerReady: boolean;
  pushPermission: NotificationPermission | 'unsupported';
  isPushSubscribed: boolean;
  pushBusy: boolean;
  enablePush: () => Promise<void>;
  disablePush: () => Promise<void>;
}

const NOOP_CONTEXT: WebsiteNotificationsContextValue = {
  isEnabled: false,
  broadcasts: [],
  loading: false,
  unreadCount: 0,
  isOpened: () => true,
  markOpened: () => {},
  markAllOpened: () => {},
  refreshBroadcasts: async () => {},
  activePopup: null,
  dismissPopup: () => {},
  isInboxOpen: false,
  openInbox: () => {},
  closeInbox: () => {},
  pushSupported: false,
  pushServerReady: false,
  pushPermission: 'unsupported',
  isPushSubscribed: false,
  pushBusy: false,
  enablePush: async () => {},
  disablePush: async () => {},
};

const WebsiteNotificationsContext =
  createContext<WebsiteNotificationsContextValue>(NOOP_CONTEXT);

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function readStateMap(storageKey: string): BroadcastStateMap {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStateMap(storageKey: string, map: BroadcastStateMap): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(map));
  } catch {}
}

function readSessionShown(sessionKey: string): Set<number> {
  try {
    const raw = sessionStorage.getItem(sessionKey);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.map(Number)) : new Set();
  } catch {
    return new Set();
  }
}

function writeSessionShown(sessionKey: string, ids: Set<number>): void {
  try {
    sessionStorage.setItem(sessionKey, JSON.stringify(Array.from(ids)));
  } catch {}
}

const SW_BASE = ((import.meta as unknown as { env?: { BASE_URL?: string } })?.env?.BASE_URL || '/').replace(/\/$/, '');
const SW_URL = `${SW_BASE}/sw.js`;

export const WebsiteNotificationsProvider: React.FC<{
  children: React.ReactNode;
  suppressAutoPopup?: boolean;
}> = ({ children, suppressAutoPopup = false }) => {
  const { user, addToast } = useApp();
  const isTg = isTelegramWebApp();
  const resolvedUserId = String(user?.telegramId || '').trim();
  const isUserReady = Boolean(resolvedUserId);
  const storageKey = `krish_web_broadcast_state_v1_${resolvedUserId || 'pending'}`;
  const sessionKey = `krish_web_broadcast_session_v1_${resolvedUserId || 'pending'}`;

  const [broadcasts, setBroadcasts] = useState<WebsiteBroadcastRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [stateMap, setStateMap] = useState<BroadcastStateMap>(() =>
    isUserReady ? readStateMap(storageKey) : {}
  );
  const [activePopup, setActivePopup] = useState<WebsiteBroadcastRecord | null>(null);
  const [isInboxOpen, setIsInboxOpen] = useState(false);

  // Refs to guard async checks against overlapping modals / double quota burns
  const activePopupRef = useRef<WebsiteBroadcastRecord | null>(activePopup);
  activePopupRef.current = activePopup;
  const isInboxOpenRef = useRef<boolean>(isInboxOpen);
  isInboxOpenRef.current = isInboxOpen;
  const suppressAutoPopupRef = useRef<boolean>(suppressAutoPopup);
  suppressAutoPopupRef.current = suppressAutoPopup;

  // Browser Web Push states
  const pushSupported =
    !isTg &&
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  const [pushServerReady, setPushServerReady] = useState(false);
  const [vapidPublicKey, setVapidPublicKey] = useState('');
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>(
    pushSupported ? Notification.permission : 'unsupported'
  );
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  // Reload per-user local state once real user ID is ready
  useEffect(() => {
    if (!isUserReady) return;
    setStateMap(readStateMap(storageKey));
  }, [isUserReady, storageKey]);

  const updateStateMap = useCallback(
    (updater: (prev: BroadcastStateMap) => BroadcastStateMap) => {
      if (!isUserReady) return;
      setStateMap((prev) => {
        const next = updater(prev);
        writeStateMap(storageKey, next);
        return next;
      });
    },
    [isUserReady, storageKey]
  );

  // Try to surface at most ONE eligible unread popup ONLY when no other modal/popup is blocking
  const tryOpenEligiblePopup = useCallback(
    (list: WebsiteBroadcastRecord[], mapSnapshot: BroadcastStateMap) => {
      if (
        !isUserReady ||
        suppressAutoPopupRef.current ||
        isInboxOpenRef.current ||
        activePopupRef.current
      ) {
        return;
      }

      const sessionShown = readSessionShown(sessionKey);
      const candidate = list.find((b) => {
        const st = mapSnapshot[String(b.id)];
        const maxViews = Math.min(2, Math.max(1, Number(b.max_popup_views || 1)));
        if (st?.opened) return false;
        if ((st?.popupCount || 0) >= maxViews) return false;
        if (sessionShown.has(b.id)) return false;
        return true;
      });

      if (!candidate) return;

      // Record display ONLY right as we actually open the popup (never burns quota silently!)
      sessionShown.add(candidate.id);
      writeSessionShown(sessionKey, sessionShown);

      const prevEntry = mapSnapshot[String(candidate.id)] || { opened: false, popupCount: 0 };
      const nextMap: BroadcastStateMap = {
        ...mapSnapshot,
        [String(candidate.id)]: {
          opened: prevEntry.opened,
          popupCount: prevEntry.popupCount + 1,
        },
      };
      writeStateMap(storageKey, nextMap);
      setStateMap(nextMap);
      activePopupRef.current = candidate;
      setActivePopup(candidate);
    },
    [isUserReady, sessionKey, storageKey]
  );

  // Fetch active broadcasts & auto-prune expired local entries + decide auto-popup (max 1x/2x)
  const refreshBroadcasts = useCallback(async () => {
    if (isTg || !isUserReady) return;
    setLoading(true);
    try {
      const res = await webBroadcastApi.getActive();
      if (!res?.success || !Array.isArray(res.broadcasts)) return;
      const list = res.broadcasts;
      setBroadcasts(list);

      // Prune expired IDs from localStorage so it never grows unbounded
      const activeIdSet = new Set(list.map((b) => String(b.id)));
      const currentMap = readStateMap(storageKey);
      let pruned = false;
      const cleanedMap: BroadcastStateMap = {};
      for (const [k, v] of Object.entries(currentMap)) {
        if (activeIdSet.has(k)) {
          cleanedMap[k] = v;
        } else {
          pruned = true;
        }
      }
      if (pruned) {
        writeStateMap(storageKey, cleanedMap);
        setStateMap(cleanedMap);
      }

      tryOpenEligiblePopup(list, cleanedMap);
    } catch {
      // silent network resilience
    } finally {
      setLoading(false);
    }
  }, [isTg, isUserReady, storageKey, tryOpenEligiblePopup]);

  // Initial load (strictly after user identity resolves) + 60-second background check while tab is visible
  useEffect(() => {
    if (isTg || !isUserReady) return;
    refreshBroadcasts();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshBroadcasts();
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [isTg, isUserReady, refreshBroadcasts]);

  // When Terms / Merge Celebration modal closes, check if an eligible popup was waiting
  useEffect(() => {
    if (!suppressAutoPopup && isUserReady && broadcasts.length > 0) {
      tryOpenEligiblePopup(broadcasts, readStateMap(storageKey));
    }
  }, [suppressAutoPopup, isUserReady, broadcasts, storageKey, tryOpenEligiblePopup]);

  // Check VAPID availability & existing Service Worker Push subscription once
  useEffect(() => {
    if (!pushSupported) return;
    let cancelled = false;

    webBroadcastApi
      .getVapidPublicKey()
      .then((res) => {
        if (!cancelled && res?.success && res.enabled && res.public_key) {
          setPushServerReady(true);
          setVapidPublicKey(res.public_key);
        }
      })
      .catch(() => {});

    navigator.serviceWorker
      .getRegistration(SW_URL)
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => {
        if (!cancelled && sub) {
          setIsPushSubscribed(true);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [pushSupported]);

  const isOpened = useCallback(
    (id: number) => Boolean(stateMap[String(id)]?.opened),
    [stateMap]
  );

  const markOpened = useCallback(
    (id: number) => {
      updateStateMap((prev) => {
        const cur = prev[String(id)] || { opened: false, popupCount: 0 };
        if (cur.opened) return prev;
        return {
          ...prev,
          [String(id)]: { ...cur, opened: true },
        };
      });
      setActivePopup((curr) => (curr && curr.id === id ? null : curr));
    },
    [updateStateMap]
  );

  const markAllOpened = useCallback(() => {
    updateStateMap((prev) => {
      const next = { ...prev };
      for (const b of broadcasts) {
        const cur = next[String(b.id)] || { opened: false, popupCount: 0 };
        next[String(b.id)] = { ...cur, opened: true };
      }
      return next;
    });
    setActivePopup(null);
  }, [broadcasts, updateStateMap]);

  const dismissPopup = useCallback(
    (markAsOpened = true) => {
      if (activePopup && markAsOpened) {
        markOpened(activePopup.id);
      }
      setActivePopup(null);
    },
    [activePopup, markOpened]
  );

  const openInbox = useCallback(() => {
    setIsInboxOpen(true);
    refreshBroadcasts();
  }, [refreshBroadcasts]);

  const closeInbox = useCallback(() => {
    setIsInboxOpen(false);
  }, []);

  const enablePush = useCallback(async () => {
    if (!pushSupported) {
      addToast('Browser push notifications are not supported on this device/browser.', 'info');
      return;
    }
    if (!pushServerReady || !vapidPublicKey) {
      addToast('Browser push service is not enabled on the server yet. In-app alerts remain active.', 'info');
      return;
    }

    setPushBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPushPermission(perm);
      if (perm !== 'granted') {
        addToast(
          perm === 'denied'
            ? 'Notifications blocked in browser settings. You will still see in-app alerts.'
            : 'Notification permission dismissed.',
          'warning'
        );
        return;
      }

      const reg = await navigator.serviceWorker.register(SW_URL);
      await navigator.serviceWorker.ready;

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const appServerKey = urlBase64ToUint8Array(vapidPublicKey);
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: appServerKey.buffer as ArrayBuffer,
        });
      }

      const json = sub.toJSON();
      const p256dh = json.keys?.p256dh || '';
      const auth = json.keys?.auth || '';
      if (!sub.endpoint || !p256dh || !auth) {
        throw new Error('Incomplete push subscription keys');
      }

      const res = await webBroadcastApi.subscribePush({
        endpoint: sub.endpoint,
        keys: { p256dh, auth },
      });
      if (res?.success) {
        setIsPushSubscribed(true);
        addToast('Browser push notifications enabled!', 'success');
      } else {
        addToast(res?.error || 'Failed to save push subscription', 'error');
      }
    } catch {
      addToast('Could not enable browser push notifications.', 'error');
    } finally {
      setPushBusy(false);
    }
  }, [pushSupported, pushServerReady, vapidPublicKey, addToast]);

  const disablePush = useCallback(async () => {
    if (!pushSupported) return;
    setPushBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW_URL);
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const ep = sub.endpoint;
        await sub.unsubscribe();
        await webBroadcastApi.unsubscribePush(ep).catch(() => {});
      }
      setIsPushSubscribed(false);
      addToast('Browser push notifications turned off.', 'info');
    } catch {
      addToast('Could not disable browser push notifications.', 'error');
    } finally {
      setPushBusy(false);
    }
  }, [pushSupported, addToast]);

  const unreadCount = useMemo(() => {
    return broadcasts.reduce((acc, b) => (stateMap[String(b.id)]?.opened ? acc : acc + 1), 0);
  }, [broadcasts, stateMap]);

  const value = useMemo<WebsiteNotificationsContextValue>(
    () => ({
      isEnabled: !isTg,
      broadcasts,
      loading,
      unreadCount,
      isOpened,
      markOpened,
      markAllOpened,
      refreshBroadcasts,
      activePopup,
      dismissPopup,
      isInboxOpen,
      openInbox,
      closeInbox,
      pushSupported,
      pushServerReady,
      pushPermission,
      isPushSubscribed,
      pushBusy,
      enablePush,
      disablePush,
    }),
    [
      isTg,
      broadcasts,
      loading,
      unreadCount,
      isOpened,
      markOpened,
      markAllOpened,
      refreshBroadcasts,
      activePopup,
      dismissPopup,
      isInboxOpen,
      openInbox,
      closeInbox,
      pushSupported,
      pushServerReady,
      pushPermission,
      isPushSubscribed,
      pushBusy,
      enablePush,
      disablePush,
    ]
  );

  return (
    <WebsiteNotificationsContext.Provider value={value}>
      {children}
    </WebsiteNotificationsContext.Provider>
  );
};

export const useWebsiteNotifications = (): WebsiteNotificationsContextValue =>
  useContext(WebsiteNotificationsContext);
