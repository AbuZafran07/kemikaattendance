import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import logger from '@/lib/logger';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBXwJkGmCBOF8BH2adnl1ErEUX3vHAq07M',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'hris-kemika.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'hris-kemika',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'hris-kemika.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '154403918893',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:154403918893:web:0c567375ae6fcd325f14a4'
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

export const FIREBASE_SW_SCOPE = '/firebase-cloud-messaging-push-scope';

// Wait for this registration's own worker; navigator.serviceWorker.ready belongs to the PWA worker.
const waitForActive = (registration: ServiceWorkerRegistration) =>
  new Promise<ServiceWorkerRegistration>((resolve) => {
    if (registration.active) return resolve(registration);
    const worker = registration.installing || registration.waiting;
    if (!worker) return resolve(registration);
    worker.addEventListener('statechange', () => {
      if (worker.state === 'activated') resolve(registration);
    });
  });

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

// The messaging worker initializes itself, including when all tabs are closed.
const initializeServiceWorker = () => {
  if (!('serviceWorker' in navigator)) {
    logger.warn('Service workers are not supported in this browser');
    return Promise.resolve(null);
  }
  registrationPromise ??= navigator.serviceWorker
    .register('/firebase-messaging-sw.js', { scope: FIREBASE_SW_SCOPE })
    .then(waitForActive)
    .catch((error) => {
      logger.error('Service worker registration failed:', error);
      registrationPromise = null;
      return null;
    });
  return registrationPromise;
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
      
      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || 'BIuZgyw3MozVFL3e4EzZvw7sdvIaf2zWvtApxiSkc43EV7veXUBXPCZpt6Ud7guxhp5sdUa7CRLk_Zzznf_vyCk';
      if (!vapidKey) {
        logger.warn('Firebase VAPID key not configured.');
        return null;
      }

      // Ensure the messaging worker is registered before getting a token
      const swRegistration = await initializeServiceWorker();
      
      if (!swRegistration) return null;
      const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swRegistration });
      
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