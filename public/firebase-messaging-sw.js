// ═══════════════════════════════════════════════════════════
// SETU — Firebase Messaging Service Worker
// Place this file at: /public/firebase-messaging-sw.js
// Must live at root scope so FCM can intercept background messages.
// ═══════════════════════════════════════════════════════════

importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging-compat.js');

// Public config — replace with your Firebase Console values
const firebaseConfig = self.__FIREBASE_CONFIG__ || {
  apiKey:            '__VITE_FIREBASE_API_KEY__',
  authDomain:        '__VITE_FIREBASE_AUTH_DOMAIN__',
  projectId:         '__VITE_FIREBASE_PROJECT_ID__',
  storageBucket:     '__VITE_FIREBASE_STORAGE_BUCKET__',
  messagingSenderId: '__VITE_FIREBASE_MESSAGING_SENDER_ID__',
  appId:             '__VITE_FIREBASE_APP_ID__',
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// ── Background push handler (tab not in focus) ────────────
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification ?? {};
  const data = payload.data ?? {};

  self.registration.showNotification(title ?? 'SETU', {
    body:    body ?? '',
    icon:    icon ?? '/icons/icon-192x192.png',
    badge:   '/icons/badge-72x72.png',
    tag:     data.type ?? 'setu-notification',
    data,
    actions: data.order_id
      ? [{ action: 'view_order', title: 'View Order' }]
      : [],
    vibrate: [200, 100, 200],
  });
});

// ── Notification click: open / focus the relevant page ────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data ?? {};

  let url = '/';
  if (data.order_id) url = `/customer/orders/${data.order_id}`;
  else if (data.url) url = data.url;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
