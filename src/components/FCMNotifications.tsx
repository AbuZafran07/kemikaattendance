import { useEffect } from 'react';
import { requestNotificationPermission, onMessageListener } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const FCMNotifications = () => {
  const { toast } = useToast();
  const { profile } = useAuth();

  useEffect(() => {
    const setupNotifications = async () => {
      if (!profile?.id) return;

      try {
        const token = await requestNotificationPermission();
        
        if (token) {
          // FCM token retrieved successfully
          // TODO: Store token in database once fcm_token column is added
        }
      } catch (error) {
        console.error('Error setting up notifications:', error);
      }
    };

    setupNotifications();

    // Listen for foreground messages
    const unsubscribe = onMessageListener()
      .then((payload: any) => {
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
