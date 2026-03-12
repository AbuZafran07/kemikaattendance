import { supabase } from "@/integrations/supabase/client";
import logger from "@/lib/logger";

interface NotificationPayload {
  fcmToken: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Send a push notification to a specific user via FCM
 */
export const sendPushNotification = async (payload: NotificationPayload): Promise<boolean> => {
  try {
    const { data, error } = await supabase.functions.invoke('send-notification', {
      body: payload
    });

    if (error) {
      logger.error('Error sending notification:', error);
      return false;
    }

    logger.debug('Notification sent successfully:', data);
    return true;
  } catch (error) {
    logger.error('Failed to send notification:', error);
    return false;
  }
};

/**
 * Send notification to all admins
 */
export const notifyAdmins = async (title: string, body: string, data?: Record<string, string>): Promise<void> => {
  try {
    // Get all admin user IDs
    const { data: adminRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    if (rolesError || !adminRoles?.length) {
      logger.debug('No admins found or error:', rolesError);
      return;
    }

    const adminIds = adminRoles.map(r => r.user_id);

    // Get FCM tokens for all admins
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, fcm_token')
      .in('id', adminIds)
      .not('fcm_token', 'is', null);

    if (profilesError || !profiles?.length) {
      logger.debug('No admin profiles with FCM tokens found:', profilesError);
      return;
    }

    // Send notification to each admin
    for (const profile of profiles) {
      if (profile.fcm_token) {
        await sendPushNotification({
          fcmToken: profile.fcm_token,
          title,
          body,
          data
        });
      }
    }
  } catch (error) {
    logger.error('Failed to notify admins:', error);
  }
};

/**
 * Send notification to a specific employee
 */
export const notifyEmployee = async (
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> => {
  try {
    // Get FCM token for the employee
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('fcm_token')
      .eq('id', userId)
      .single();

    if (error || !profile?.fcm_token) {
      logger.debug('No FCM token found for employee:', userId);
      return false;
    }

    return await sendPushNotification({
      fcmToken: profile.fcm_token,
      title,
      body,
      data
    });
  } catch (error) {
    logger.error('Failed to notify employee:', error);
    return false;
  }
};

/**
 * Notification templates for common events
 */
export const NotificationTemplates = {
  // Leave request notifications
  leaveRequestSubmitted: (employeeName: string, leaveType: string, days: number) => ({
    title: '📋 Pengajuan Cuti Baru',
    body: `${employeeName} mengajukan ${leaveType} selama ${days} hari`
  }),

  leaveRequestApproved: (leaveType: string, startDate: string, endDate: string) => ({
    title: '✅ Cuti Disetujui',
    body: `Pengajuan ${leaveType} Anda tanggal ${startDate} - ${endDate} telah disetujui`
  }),

  leaveRequestRejected: (leaveType: string, reason?: string) => ({
    title: '❌ Cuti Ditolak',
    body: `Pengajuan ${leaveType} Anda ditolak${reason ? `: ${reason}` : ''}`
  }),

  // Overtime notifications
  overtimeRequestSubmitted: (employeeName: string, hours: number, date: string) => ({
    title: '⏰ Pengajuan Lembur Baru',
    body: `${employeeName} mengajukan lembur ${hours} jam pada ${date}`
  }),

  overtimeRequestApproved: (date: string, hours: number) => ({
    title: '✅ Lembur Disetujui',
    body: `Pengajuan lembur ${hours} jam pada ${date} telah disetujui`
  }),

  overtimeRequestRejected: (date: string, reason?: string) => ({
    title: '❌ Lembur Ditolak',
    body: `Pengajuan lembur pada ${date} ditolak${reason ? `: ${reason}` : ''}`
  }),

  // Business travel notifications
  businessTravelSubmitted: (employeeName: string, destination: string, days: number) => ({
    title: '✈️ Pengajuan Perjalanan Dinas',
    body: `${employeeName} mengajukan perjalanan dinas ke ${destination} selama ${days} hari`
  }),

  businessTravelApproved: (destination: string, startDate: string) => ({
    title: '✅ Perjalanan Dinas Disetujui',
    body: `Perjalanan dinas ke ${destination} mulai ${startDate} telah disetujui`
  }),

  businessTravelRejected: (destination: string, reason?: string) => ({
    title: '❌ Perjalanan Dinas Ditolak',
    body: `Perjalanan dinas ke ${destination} ditolak${reason ? `: ${reason}` : ''}`
  }),

  // Attendance notifications
  checkInNotification: (employeeName: string, time: string) => ({
    title: '📍 Karyawan Check-In',
    body: `${employeeName} melakukan check-in pada ${time}`
  }),

  checkOutNotification: (employeeName: string, time: string, duration: string) => ({
    title: '🏠 Karyawan Check-Out',
    body: `${employeeName} melakukan check-out pada ${time}. Durasi kerja: ${duration}`
  }),

  lateCheckInNotification: (employeeName: string, time: string, lateMinutes: number) => ({
    title: '⚠️ Karyawan Terlambat',
    body: `${employeeName} check-in terlambat ${lateMinutes} menit pada ${time}`
  }),

  // Company event notifications
  companyEventCreated: (eventTitle: string, eventDate: string) => ({
    title: '📅 Event Kantor Baru',
    body: `Event "${eventTitle}" dijadwalkan pada ${eventDate}`
  })
};

/**
 * Format leave type for display
 */
export const formatLeaveTypeForNotification = (type: string): string => {
  const typeMap: Record<string, string> = {
    cuti_tahunan: "Cuti Tahunan",
    izin: "Izin",
    sakit: "Sakit",
    lupa_absen: "Lupa Absen",
  };
  return typeMap[type] || type;
};

/**
 * Send notification to all employees (all authenticated users with FCM tokens)
 */
export const notifyAllEmployees = async (title: string, body: string, data?: Record<string, string>): Promise<void> => {
  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, fcm_token')
      .not('fcm_token', 'is', null);

    if (error || !profiles?.length) {
      logger.debug('No profiles with FCM tokens found:', error);
      return;
    }

    for (const profile of profiles) {
      if (profile.fcm_token) {
        await sendPushNotification({
          fcmToken: profile.fcm_token,
          title,
          body,
          data
        });
      }
    }
  } catch (error) {
    logger.error('Failed to notify all employees:', error);
  }
};

/**
 * Format date for notification
 */
export const formatDateForNotification = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};
