/* Daemon OTP Website Push Notification Service Worker */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {
    title: 'Daemon OTP',
    body: 'You have a new announcement.',
    tag: 'daemon-broadcast',
    url: '/',
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch {
      const text = event.data.text();
      if (text) payload.body = text;
    }
  }

  const scopeBase = self.registration && self.registration.scope ? self.registration.scope : '/';
  const defaultUrl = new URL('./', scopeBase).href;
  const iconUrl = new URL('./deamon-logo.png', scopeBase).href;
  const resolvedUrl = payload.url && payload.url !== '/' ? payload.url : defaultUrl;

  const options = {
    body: payload.body,
    icon: iconUrl,
    badge: iconUrl,
    tag: payload.tag || 'daemon-broadcast',
    renotify: true,
    data: { url: resolvedUrl },
  };

  event.waitUntil(self.registration.showNotification(payload.title || 'Daemon OTP', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const scopeBase = self.registration && self.registration.scope ? self.registration.scope : '/';
  const fallbackUrl = new URL('./', scopeBase).href;
  const targetUrl = (event.notification.data && event.notification.data.url) || fallbackUrl;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
