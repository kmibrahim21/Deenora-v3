import { supabase } from '../supabase';

export interface NotificationSettings {
  institution_id: string;
  attendance_notify_enabled: boolean;
  fee_notify_enabled: boolean;
  absent_title: string;
  absent_body_template: string;
  present_title: string;
  present_body_template: string;
  fee_title: string;
  fee_body_template: string;
  updated_at?: string;
}

export interface AppNotification {
  id: string;
  institution_id: string;
  student_id?: string | null;
  guardian_phone?: string | null;
  title: string;
  message: string;
  type: 'attendance' | 'fee' | 'general';
  is_read: boolean;
  created_at: string;
}

export const DEFAULT_NOTIFICATION_SETTINGS: Omit<NotificationSettings, 'institution_id'> = {
  attendance_notify_enabled: false,
  fee_notify_enabled: false,
  absent_title: 'অনুপস্থিতি নোটিফিকেশন',
  absent_body_template: 'আস-সালামু আলাইকুম, {student_name} (রোল: {roll}, শ্রেণি: {class_name}) আজ {date} তারিখে ক্লাসে অনুপস্থিত রয়েছে।',
  present_title: 'উপস্থিতি নোটিফিকেশন',
  present_body_template: 'আস-সালামু আলাইকুম, {student_name} আজ {date} তারিখে যথাসময়ে ক্লাসে উপস্থিত হয়েছে।',
  fee_title: 'ফি আদায় নোটিফিকেশন',
  fee_body_template: 'আস-সালামু আলাইকুম, {student_name}-এর বেতন বাবদ {amount} ৳ সফলভাবে জমা হয়েছে। মাস: {month}।',
};

const toBanglaDigits = (num: any): string => {
  if (num === null || num === undefined) return '';
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(num).replace(/[0-9]/g, (d) => bnDigits[parseInt(d, 10)]);
};

export const NotificationService = {
  /**
   * Fetches the notification settings for an institution
   */
  getSettings: async (institutionId: string): Promise<NotificationSettings> => {
    if (!institutionId) {
      return { institution_id: '', ...DEFAULT_NOTIFICATION_SETTINGS };
    }

    try {
      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('institution_id', institutionId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.warn('[NotificationService] getSettings warning:', error);
      }

      if (!data) {
        return {
          institution_id: institutionId,
          ...DEFAULT_NOTIFICATION_SETTINGS,
        };
      }

      return {
        institution_id: institutionId,
        attendance_notify_enabled: Boolean(data.attendance_notify_enabled),
        fee_notify_enabled: Boolean(data.fee_notify_enabled),
        absent_title: data.absent_title || DEFAULT_NOTIFICATION_SETTINGS.absent_title,
        absent_body_template: data.absent_body_template || DEFAULT_NOTIFICATION_SETTINGS.absent_body_template,
        present_title: data.present_title || DEFAULT_NOTIFICATION_SETTINGS.present_title,
        present_body_template: data.present_body_template || DEFAULT_NOTIFICATION_SETTINGS.present_body_template,
        fee_title: data.fee_title || DEFAULT_NOTIFICATION_SETTINGS.fee_title,
        fee_body_template: data.fee_body_template || DEFAULT_NOTIFICATION_SETTINGS.fee_body_template,
        updated_at: data.updated_at,
      };
    } catch (err) {
      console.error('[NotificationService] getSettings error:', err);
      return {
        institution_id: institutionId,
        ...DEFAULT_NOTIFICATION_SETTINGS,
      };
    }
  },

  /**
   * Saves or updates notification settings for an institution
   */
  saveSettings: async (institutionId: string, settings: Partial<NotificationSettings>): Promise<boolean> => {
    if (!institutionId) throw new Error('institution_id is required');

    const payload = {
      institution_id: institutionId,
      attendance_notify_enabled: settings.attendance_notify_enabled ?? false,
      fee_notify_enabled: settings.fee_notify_enabled ?? false,
      absent_title: settings.absent_title?.trim() || DEFAULT_NOTIFICATION_SETTINGS.absent_title,
      absent_body_template: settings.absent_body_template?.trim() || DEFAULT_NOTIFICATION_SETTINGS.absent_body_template,
      present_title: settings.present_title?.trim() || DEFAULT_NOTIFICATION_SETTINGS.present_title,
      present_body_template: settings.present_body_template?.trim() || DEFAULT_NOTIFICATION_SETTINGS.present_body_template,
      fee_title: settings.fee_title?.trim() || DEFAULT_NOTIFICATION_SETTINGS.fee_title,
      fee_body_template: settings.fee_body_template?.trim() || DEFAULT_NOTIFICATION_SETTINGS.fee_body_template,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('notification_settings')
      .upsert(payload, { onConflict: 'institution_id' });

    if (error) {
      console.error('[NotificationService] saveSettings error:', error);
      throw error;
    }

    return true;
  },

  /**
   * Checks whether the Parent Portal module is enabled for an institution
   */
  isParentPortalEnabled: async (institutionId: string, instConfig?: any): Promise<boolean> => {
    if (instConfig?.modules?.parent_portal !== undefined) {
      return Boolean(instConfig.modules.parent_portal === true);
    }
    if (!institutionId) return false;
    try {
      const { data } = await supabase
        .from('institutions')
        .select('config_json')
        .eq('id', institutionId)
        .maybeSingle();

      const config = typeof data?.config_json === 'string'
        ? JSON.parse(data.config_json)
        : (data?.config_json || {});

      return Boolean(config?.modules?.parent_portal === true);
    } catch {
      return false;
    }
  },

  /**
   * Helper to replace placeholders in notification templates
   */
  formatTemplate: (template: string, vars: Record<string, any>): string => {
    let result = template || '';
    Object.entries(vars).forEach(([key, val]) => {
      const regex = new RegExp(`\\{${key}\\}`, 'gi');
      result = result.replace(regex, val !== undefined && val !== null ? String(val) : '');
    });
    return result.trim();
  },

  /**
   * Triggers absent push & in-app notifications when attendance is submitted
   */
  sendAbsentNotifications: async (params: {
    institutionId: string;
    institutionName?: string;
    institutionConfig?: any;
    date: string;
    className?: string;
    absentees: Array<{
      id: string;
      student_name?: string;
      name_en?: string;
      roll?: string | number;
      guardian_phone?: string;
      guardian_phone_2?: string;
      class_name?: string;
    }>;
  }): Promise<{ success: boolean; sentCount: number; message?: string }> => {
    const { institutionId, date, className = '', absentees, institutionConfig } = params;
    if (!institutionId || !absentees || absentees.length === 0) {
      return { success: true, sentCount: 0 };
    }

    // STRICT CHECK: Push notifications are only active if Parent Portal is active
    const isPortalActive = await NotificationService.isParentPortalEnabled(institutionId, institutionConfig);
    if (!isPortalActive) {
      return { success: true, sentCount: 0, message: 'Parent Portal module is not enabled for this institution' };
    }

    try {
      const settings = await NotificationService.getSettings(institutionId);
      if (!settings.attendance_notify_enabled) {
        return { success: true, sentCount: 0, message: 'Attendance push notifications disabled' };
      }

      // Format date in Bengali
      const formattedDate = toBanglaDigits(date);

      // Build in-app notification rows
      const inAppRows: Array<{
        institution_id: string;
        student_id: string;
        guardian_phone: string;
        title: string;
        message: string;
        type: string;
        is_read: boolean;
        created_at: string;
      }> = [];

      const studentIdsToNotify: string[] = [];
      const phonesToNotify: string[] = [];

      for (const student of absentees) {
        const studentName = student.student_name || student.name_en || 'শিক্ষার্থী';
        const studentRoll = student.roll ? toBanglaDigits(student.roll) : '-';
        const studentClass = student.class_name || className || '';
        const phone = (student.guardian_phone || student.guardian_phone_2 || '').trim();

        const messageBody = NotificationService.formatTemplate(settings.absent_body_template, {
          student_name: studentName,
          class_name: studentClass,
          roll: studentRoll,
          date: formattedDate,
        });

        const notifTitle = settings.absent_title || 'অনুপস্থিতি নোটিফিকেশন';

        inAppRows.push({
          institution_id: institutionId,
          student_id: student.id,
          guardian_phone: phone || null,
          title: notifTitle,
          message: messageBody,
          type: 'attendance',
          is_read: false,
          created_at: new Date().toISOString(),
        });

        studentIdsToNotify.push(student.id);
        if (phone) phonesToNotify.push(phone);
      }

      // 1. Insert In-App Notifications
      if (inAppRows.length > 0) {
        const { error: insertErr } = await supabase
          .from('app_notifications')
          .insert(inAppRows);

        if (insertErr) {
          console.warn('[NotificationService] app_notifications insert warning:', insertErr);
        }
      }

      // 2. Dispatch FCM Push Notifications via backend
      try {
        const firstAbsent = absentees[0];
        const sampleBody = inAppRows[0]?.message || 'আপনার সন্তান আজ ক্লাসে অনুপস্থিত রয়েছে।';

        await fetch('/api/call?action=send_notification_push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            institution_id: institutionId,
            title: settings.absent_title || 'অনুপস্থিতি নোটিফিকেশন',
            body: absentees.length === 1 
              ? sampleBody 
              : `${absentees.length} জন শিক্ষার্থীর অনুপস্থিতি সংক্রান্ত নোটিফিকেশন।`,
            type: 'attendance',
            target: {
              type: 'students',
              student_ids: studentIdsToNotify,
              phones: phonesToNotify,
            },
          }),
        });
      } catch (fcmErr) {
        console.warn('[NotificationService] FCM push dispatch notice:', fcmErr);
      }

      return { success: true, sentCount: inAppRows.length };
    } catch (err: any) {
      console.error('[NotificationService] sendAbsentNotifications error:', err);
      return { success: false, sentCount: 0, message: err.message };
    }
  },

  /**
   * Triggers fee payment push & in-app notification when a payment is received
   */
  sendFeeNotification: async (params: {
    institutionId: string;
    institutionName?: string;
    institutionConfig?: any;
    student: {
      id: string;
      student_name?: string;
      name_en?: string;
      roll?: string | number;
      guardian_phone?: string;
      guardian_phone_2?: string;
      class_name?: string;
      classes?: { class_name?: string };
    };
    amount: number | string;
    month?: string;
    date?: string;
  }): Promise<{ success: boolean; message?: string }> => {
    const { institutionId, student, amount, month = '', date = new Date().toISOString().split('T')[0], institutionConfig } = params;
    if (!institutionId || !student) return { success: false, message: 'Missing parameters' };

    // STRICT CHECK: Push notifications are only active if Parent Portal is active
    const isPortalActive = await NotificationService.isParentPortalEnabled(institutionId, institutionConfig);
    if (!isPortalActive) {
      return { success: true, message: 'Parent Portal module is not enabled for this institution' };
    }

    try {
      const settings = await NotificationService.getSettings(institutionId);
      if (!settings.fee_notify_enabled) {
        return { success: true, message: 'Fee push notifications disabled' };
      }

      const studentName = student.student_name || student.name_en || 'শিক্ষার্থী';
      const studentClass = student.class_name || student.classes?.class_name || '';
      const studentRoll = student.roll ? toBanglaDigits(student.roll) : '-';
      const formattedAmount = toBanglaDigits(amount);
      const formattedDate = toBanglaDigits(date);
      const phone = (student.guardian_phone || student.guardian_phone_2 || '').trim();

      const notifTitle = settings.fee_title || 'ফি আদায় নোটিফিকেশন';
      const notifBody = NotificationService.formatTemplate(settings.fee_body_template, {
        student_name: studentName,
        class_name: studentClass,
        roll: studentRoll,
        amount: formattedAmount,
        month: month || 'চলতি মাস',
        date: formattedDate,
      });

      // 1. In-App Notification entry
      const { error: insertErr } = await supabase
        .from('app_notifications')
        .insert([{
          institution_id: institutionId,
          student_id: student.id,
          guardian_phone: phone || null,
          title: notifTitle,
          message: notifBody,
          type: 'fee',
          is_read: false,
          created_at: new Date().toISOString(),
        }]);

      if (insertErr) {
        console.warn('[NotificationService] Fee in-app notification insert warning:', insertErr);
      }

      // 2. Dispatch FCM Push Notification via backend
      try {
        await fetch('/api/call?action=send_notification_push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            institution_id: institutionId,
            title: notifTitle,
            body: notifBody,
            type: 'fee',
            target: {
              type: 'students',
              student_ids: [student.id],
              phones: phone ? [phone] : [],
            },
          }),
        });
      } catch (fcmErr) {
        console.warn('[NotificationService] Fee FCM push dispatch notice:', fcmErr);
      }

      return { success: true };
    } catch (err: any) {
      console.error('[NotificationService] sendFeeNotification error:', err);
      return { success: false, message: err.message };
    }
  },

  /**
   * Fetches in-app notifications for a guardian's phone or student ID
   */
  getInAppNotifications: async (params: {
    guardianPhone?: string | null;
    studentId?: string | null;
    institutionId?: string | null;
    limit?: number;
  }): Promise<AppNotification[]> => {
    const { guardianPhone, studentId, institutionId, limit = 50 } = params;
    if (!guardianPhone && !studentId) return [];

    try {
      let query = supabase
        .from('app_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (institutionId) {
        query = query.eq('institution_id', institutionId);
      }

      const orClauses: string[] = [];
      if (studentId) {
        orClauses.push(`student_id.eq.${studentId}`);
      }
      if (guardianPhone) {
        const cleanPhone = String(guardianPhone).replace(/\D/g, '');
        const last10 = cleanPhone.slice(-10);
        orClauses.push(`guardian_phone.eq.${guardianPhone}`);
        if (last10) {
          orClauses.push(`guardian_phone.ilike.%${last10}`);
        }
      }

      if (orClauses.length > 0) {
        query = query.or(orClauses.join(','));
      }

      const { data, error } = await query;
      if (error) {
        console.warn('[NotificationService] getInAppNotifications error:', error);
        return [];
      }

      return (data || []) as AppNotification[];
    } catch (err) {
      console.error('[NotificationService] getInAppNotifications exception:', err);
      return [];
    }
  },

  /**
   * Marks specified notifications as read
   */
  markAsRead: async (notificationIds: string[]): Promise<boolean> => {
    if (!notificationIds || notificationIds.length === 0) return true;

    try {
      const { error } = await supabase
        .from('app_notifications')
        .update({ is_read: true })
        .in('id', notificationIds);

      if (error) {
        console.warn('[NotificationService] markAsRead error:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[NotificationService] markAsRead exception:', err);
      return false;
    }
  },

  /**
   * Marks all notifications as read for a guardian phone or student
   */
  markAllAsRead: async (params: { guardianPhone?: string | null; studentId?: string | null }): Promise<boolean> => {
    const { guardianPhone, studentId } = params;
    if (!guardianPhone && !studentId) return true;

    try {
      let query = supabase
        .from('app_notifications')
        .update({ is_read: true })
        .eq('is_read', false);

      const orClauses: string[] = [];
      if (studentId) {
        orClauses.push(`student_id.eq.${studentId}`);
      }
      if (guardianPhone) {
        const cleanPhone = String(guardianPhone).replace(/\D/g, '');
        const last10 = cleanPhone.slice(-10);
        orClauses.push(`guardian_phone.eq.${guardianPhone}`);
        if (last10) {
          orClauses.push(`guardian_phone.ilike.%${last10}`);
        }
      }

      if (orClauses.length > 0) {
        query = query.or(orClauses.join(','));
      }

      const { error } = await query;
      if (error) {
        console.warn('[NotificationService] markAllAsRead error:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[NotificationService] markAllAsRead exception:', err);
      return false;
    }
  },
};
