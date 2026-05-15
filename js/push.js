// ── Push Notifications ────────────────────────────────────────────────────────
// Registers the service worker and exposes helpers for chat notifications.
// Works when the browser tab is open but in the background (minimised, locked screen).

let _swReg = null;

// Call once after login — registers SW silently (no permission prompt yet)
async function initNotifications() {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return;
  try {
    _swReg = await navigator.serviceWorker.register('/sw.js');
  } catch (e) {
    console.warn('[push] SW registration failed:', e);
  }
}

// Request permission lazily — called the first time a chat message arrives
async function requestChatNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'default') return; // already granted or denied
  await Notification.requestPermission();
}

// Show a notification for an incoming chat message (only when tab is hidden)
async function showChatNotification(msg, projectName) {
  if (!document.hidden) return;                        // tab is active — skip
  if (Notification.permission !== 'granted') return;

  const reg = _swReg || (await navigator.serviceWorker.ready.catch(() => null));
  if (!reg) return;

  const title = msg.sender_name || 'New message';
  const body  = msg.body
    ? (msg.body.length > 80 ? msg.body.slice(0, 80) + '…' : msg.body)
    : '📎 Sent an attachment';

  reg.showNotification(title, {
    body,
    icon:      'assets/TradeMarkMas-Colour-RGB-Lrg.png',
    badge:     'assets/TradeMarkMas-Colour-RGB-Lrg.png',
    tag:       `chat-${msg.project_id}`,  // collapse multiple msgs per project
    renotify:  true,
    data:      { url: self?.location?.pathname || '/' }
  });
}
