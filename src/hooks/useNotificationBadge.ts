import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useNotificationBadge = () => {
  const [badgeCount, setBadgeCount] = useState(0);
  const { profile } = useAuth();

  const updateAppBadge = useCallback((count: number) => {
    if ('setAppBadge' in navigator) {
      if (count > 0) {
        (navigator as any).setAppBadge(count);
      } else {
        (navigator as any).clearAppBadge();
      }
    }
  }, []);

  const fetchBadgeCount = useCallback(async () => {
    if (!profile?.id) return;

    try {
      // For employees: count pending leave & overtime requests (their own)
      const [leaveRes, overtimeRes, travelRes] = await Promise.all([
        supabase
          .from('leave_requests')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .eq('status', 'pending'),
        supabase
          .from('overtime_requests')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .eq('status', 'pending'),
        supabase
          .from('business_travel_requests')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .eq('status', 'pending'),
      ]);

      // Also check for recently approved/rejected (last 7 days) that employee might not have seen
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const cutoff = sevenDaysAgo.toISOString();

      const [leaveUpdated, overtimeUpdated, travelUpdated] = await Promise.all([
        supabase
          .from('leave_requests')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .in('status', ['approved', 'rejected'])
          .gte('updated_at', cutoff),
        supabase
          .from('overtime_requests')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .in('status', ['approved', 'rejected'])
          .gte('updated_at', cutoff),
        supabase
          .from('business_travel_requests')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .in('status', ['approved', 'rejected'])
          .gte('updated_at', cutoff),
      ]);

      const total =
        (leaveRes.count || 0) +
        (overtimeRes.count || 0) +
        (travelRes.count || 0) +
        (leaveUpdated.count || 0) +
        (overtimeUpdated.count || 0) +
        (travelUpdated.count || 0);

      setBadgeCount(total);
      updateAppBadge(total);
    } catch (error) {
      console.error('Error fetching badge count:', error);
    }
  }, [profile?.id, updateAppBadge]);

  useEffect(() => {
    fetchBadgeCount();

    // Refresh every 60 seconds
    const interval = setInterval(fetchBadgeCount, 60000);

    return () => {
      clearInterval(interval);
      if ('clearAppBadge' in navigator) {
        (navigator as any).clearAppBadge();
      }
    };
  }, [fetchBadgeCount]);

  return { badgeCount, refreshBadge: fetchBadgeCount };
};
