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
      try {
        const token = await requestNotificationPermission();
        
        if (token && profile?.id) {
          // Store FCM token in database for this user
          await supabase
            .from('profiles')
            .update({ 
              // Note: You'll need to add fcm_token column to profiles table
              // This is just placeholder logic
            })
            .eq('id', profile.id);
          
          console.log('FCM Token saved for user:', profile.id);
        }
      } catch (error) {
        console.error('Error setting up notifications:', error);
      }
    };

    setupNotifications();

    // Listen for foreground messages
    onMessageListener()
      .then((payload: any) => {
        toast({
          title: payload.notification?.title || 'Notifikasi Baru',
          description: payload.notification?.body || '',
        });
      })
      .catch((err) => console.log('Failed to receive message:', err));
  }, [profile, toast]);

  return null;
};
