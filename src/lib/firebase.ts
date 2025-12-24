import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import logger from '@/lib/logger';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Check if Firebase is configured
const isFirebaseConfigured = () => {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId
  );
};

let app: any;
let messaging: Messaging | null = null;

// Initialize service worker and send Firebase config securely
const initializeServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) {
    logger.warn('Service workers are not supported in this browser');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    
    // Wait for the service worker to be ready
    await navigator.serviceWorker.ready;
    
    // Send Firebase config to the service worker (only if configured)
    if (isFirebaseConfigured() && registration.active) {
      registration.active.postMessage({
        type: 'FIREBASE_CONFIG',
        config: firebaseConfig
      });
    }
    
    return registration;
  } catch (error) {
    logger.error('Service worker registration failed:', error);
    return null;
  }
};

// Only initialize if Firebase is properly configured
if (isFirebaseConfigured()) {
  try {
    app = initializeApp(firebaseConfig);
    messaging = getMessaging(app);
    
    // Initialize the service worker
    initializeServiceWorker();
  } catch (error) {
    logger.warn('Firebase initialization failed:', error);
  }
}

export const requestNotificationPermission = async () => {
  if (!messaging) {
    logger.warn('Firebase Messaging not initialized. Please configure Firebase environment variables.');
    return null;
  }

  if (!('Notification' in window)) {
    logger.warn('This browser does not support notifications.');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      logger.debug('Notification permission granted.');
      
      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
      if (!vapidKey) {
        logger.warn('Firebase VAPID key not configured.');
        return null;
      }

      // Ensure service worker is registered and configured before getting token
      const swRegistration = await initializeServiceWorker();
      
      const token = await getToken(messaging, { 
        vapidKey,
        serviceWorkerRegistration: swRegistration || undefined
      });
      
      if (token) {
        // Token retrieved successfully
        return token;
      } else {
        logger.debug('No registration token available.');
        return null;
      }
    } else {
      logger.debug('Unable to get permission to notify.');
      return null;
    }
  } catch (error) {
    logger.error('An error occurred while retrieving token.', error);
    return null;
  }
};

export const onMessageListener = () =>
  new Promise((resolve, reject) => {
    if (!messaging) {
      reject(new Error('Firebase Messaging not initialized'));
      return;
    }
    onMessage(messaging, (payload) => {
      logger.debug('Message received.');
      resolve(payload);
    });
  });

export { messaging };