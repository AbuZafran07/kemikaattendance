import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { requestNotificationPermission, onMessageListener } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { playNotificationSound } from '@/lib/notificationSound';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const FCMNotifications = () => {
  const { toast } = useToast();
  const { profile } = useAuth();
  const navigate = useNavigate();

  // The Firebase worker sends OPEN_PATH after a notification click; navigate inside the app.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (data?.type !== 'OPEN_PATH' || typeof data.path !== 'string') return;
      try {
        const url = new URL(data.path, window.location.origin);
        if (url.origin === window.location.origin) navigate(url.pathname + url.search + url.hash);
      } catch { /* ignore invalid destinations */ }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [navigate]);

  useEffect(() => {
    const setupNotifications = async () => {
      if (!profile?.id) return;

      try {
        // Refresh the token every session so tokens bound to the old "/" registration are replaced.
        if (!('Notification' in window) || Notification.permission === 'denied') return;
        const token = await requestNotificationPermission();
        
        if (token) {
          // Store FCM token in database
          const { error } = await supabase
            .from('profiles')
            .update({ fcm_token: token } as any)
            .eq('id', profile.id);
          
          if (error) {
            console.error('Error storing FCM token:', error);
          } else {
            console.log('FCM token stored successfully');
          }
        }
      } catch (error) {
        console.error('Error setting up notifications:', error);
      }
    };

    setupNotifications();

    // Listen for foreground messages
    const unsubscribe = onMessageListener()
      .then((payload: any) => {
        playNotificationSound();
        toast({
          title: payload.notification?.title || 'Notifikasi Baru',
          description: payload.notification?.body || '',
        });
      })
      .catch((err) => {
        // Silently fail if Firebase is not configured
        if (err.message !== 'Firebase Messaging not initialized') {
          console.log('Failed to receive message:', err);
        }
      });

    return () => {
      // Cleanup if needed
    };
  }, [profile, toast]);

  return null;
};
