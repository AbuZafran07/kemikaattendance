// Firebase Messaging Service Worker
// This service worker handles background push notifications from Firebase Cloud Messaging.
// 
// IMPORTANT: Firebase configuration is dynamically fetched from the server.
// The actual API keys are stored as environment variables and are NOT exposed in this file.
// This approach prevents credential exposure while maintaining FCM functionality.

importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Flag to track initialization state
let isInitialized = false;

// Initialize Firebase with config received from the main app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FIREBASE_CONFIG') {
    const config = event.data.config;
    
    // Validate that we have the required configuration
    if (!config || !config.apiKey || !config.projectId || !config.messagingSenderId || !config.appId) {
      console.warn('Firebase SW: Invalid or incomplete configuration received');
      return;
    }
    
    if (!isInitialized) {
      try {
        firebase.initializeApp(config);
        const messaging = firebase.messaging();
        
        messaging.onBackgroundMessage((payload) => {
          console.log('Firebase SW: Received background message', payload);
          
          const notificationTitle = payload.notification?.title || 'Notification';
          const notificationOptions = {
            body: payload.notification?.body || '',
            icon: '/logo.png',
            badge: '/logo.png',
            tag: payload.messageId || 'default'
          };

          self.registration.showNotification(notificationTitle, notificationOptions);
        });
        
        isInitialized = true;
        console.log('Firebase SW: Successfully initialized');
      } catch (error) {
        console.error('Firebase SW: Initialization error', error);
      }
    }
  }
});

// Handle notification click events
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // Open the app when notification is clicked
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      // Open a new window if no existing window is found
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
