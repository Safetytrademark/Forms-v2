// ── Trademark Safety — Service Worker ────────────────────────────────────────
// Handles background push notifications and notification clicks.

self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e  => e.waitUntil(clients.claim()));

// ── Notification click — focus or open the app tab ───────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // Focus an existing tab if one is open
      for (const c of list) {
        if (c.url.includes(targetUrl) && 'focus' in c) return c.focus();
      }
      // Otherwise open a new tab
      return clients.openWindow(targetUrl);
    })
  );
});
