// ═══════════════════════════════════════════════════════════
// SETU — Firebase Messaging Service Worker
// Place this file at: /public/firebase-messaging-sw.js
// Must live at root scope so FCM can intercept background messages.
// ═══════════════════════════════════════════════════════════

importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging-compat.js');

// Public config — replace with your Firebase Console values
const firebaseConfig = self.__FIREBASE_CONFIG__ || {
  apiKey:            'AIzaSyAA1wco51UV8cYNnAxA-b8qqu710Y8OL_s',
  authDomain:        'setu-rural-commerce-os.firebaseapp.com',
  projectId:         'setu-rural-commerce-os',
  storageBucket:     'setu-rural-commerce-os.firebasestorage.app',
  messagingSenderId: '998807137849',
  appId:             '1:998807137849:web:2be69239f9e5448d3b27e8',
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
