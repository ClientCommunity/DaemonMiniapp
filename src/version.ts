/**
 * Auto-Update & Cache Management Service
 * Ensures Telegram Mini App users always run the freshest bundle without manual cache wipes.
 */

declare const __APP_BUILD_VERSION__: string;

export const APP_VERSION = typeof __APP_BUILD_VERSION__ !== 'undefined'
  ? __APP_BUILD_VERSION__
  : 'dev';

let isChecking = false;

export async function checkForAppUpdate(): Promise<boolean> {
  if (isChecking) return false;
  isChecking = true;

  try {
    // Aggressively bypass any cache using timestamp query and no-store headers
    const res = await fetch(`/version.json?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });

    if (!res.ok) {
      isChecking = false;
      return false;
    }

    const data = await res.json();
    if (data && data.version && data.version !== APP_VERSION) {
      const lastReloaded = sessionStorage.getItem('last_reloaded_version');
      if (lastReloaded !== data.version) {
        sessionStorage.setItem('last_reloaded_version', data.version);
        console.warn(`[AutoUpdate] Upgrading from ${APP_VERSION} to ${data.version}...`);

        // Append query param to force WebView to fetch fresh HTML and assets
        const url = new URL(window.location.href);
        url.searchParams.set('_v', data.version);
        window.location.replace(url.toString());
        return true;
      }
    }
  } catch {
    // Network or parse error - silent fail
  } finally {
    isChecking = false;
  }
  return false;
}

export function initAutoUpdate(): void {
  // 1. Initial check shortly after app boot
  setTimeout(() => {
    checkForAppUpdate();
  }, 1500);

  // 2. Check whenever user switches back into Telegram Mini App or focuses tab
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForAppUpdate();
    }
  });

  window.addEventListener('focus', () => {
    checkForAppUpdate();
  });

  // 3. Periodic freshness check every 45 seconds while open
  setInterval(() => {
    checkForAppUpdate();
  }, 45000);

  // 4. Handle obsolete chunk load errors (happens when old bundle tries to fetch a deleted Vite chunk)
  window.addEventListener('error', (e) => {
    const msg = e.message || '';
    if (/Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError/i.test(msg)) {
      console.warn('[AutoUpdate] Detected obsolete chunk error. Reloading latest bundle...');
      window.location.reload();
    }
  });

  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason?.message || String(e.reason || '');
    if (/Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError/i.test(reason)) {
      console.warn('[AutoUpdate] Detected obsolete chunk rejection. Reloading latest bundle...');
      window.location.reload();
    }
  });
}
