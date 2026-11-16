// Public web configuration: available even when every application tab is closed.
importScripts('https://www.gstatic.com/firebasejs/13.3.0/firebase-app-compat.js');
firebase.initializeApp({
  apiKey: 'AIzaSyBXwJkGmCBOF8BH2adnl1ErEUX3vHAq07M',
  authDomain: 'hris-kemika.firebaseapp.com',
  projectId: 'hris-kemika',
  storageBucket: 'hris-kemika.firebasestorage.app',
  messagingSenderId: '154403918893',
  appId: '1:154403918893:web:0c567375ae6fcd325f14a4'
});

// Register before Firebase's click handler so it cannot replace our dated route.
self.addEventListener('notificationclick', (event) => {
  event.stopImmediatePropagation();
  event.notification.close();
  const data = event.notification.data;
  const path = data?.FCM_MSG?.data?.path || data?.path;
  const fallback = new URL('/employee/notifications', self.location.origin);
  let target = fallback;
  try {
    const candidate = new URL(path || fallback.href, self.location.origin);
    if (candidate.origin === self.location.origin) target = candidate;
  } catch { /* Invalid destinations fall back to employee notifications. */ }

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      await existing.focus();
      await existing.navigate(target.href);
      return;
    }
    await self.clients.openWindow(target.href);
  })());
});

importScripts('https://www.gstatic.com/firebasejs/13.3.0/firebase-messaging-compat.js');
firebase.messaging().onBackgroundMessage((payload) => {
  // Notification payloads are already displayed by Firebase; never display twice.
  if (payload.notification) return;
  return self.registration.showNotification(payload.data?.title || 'Kemika', {
    body: payload.data?.body || '',
    icon: '/logo.png',
    badge: '/logo.png',
    tag: payload.messageId,
    data: payload.data || {}
  });
});
