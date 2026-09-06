/**
 * Firebase Cloud Messaging (FCM) Service
 * Lightweight push notification dispatcher for Parent Android App
 * No notification history or records are stored in Supabase.
 */

export interface FCMNotificationPayload {
  topics?: string[];
  tokens?: string[];
  title: string;
  body: string;
  data?: Record<string, any>;
}

export const FCMService = {
  /**
   * Generic sender
   */
  sendPushNotification: async (
    topics: string[],
    title: string,
    body: string,
    data: Record<string, any> = {}
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      const cleanTopics = topics
        .map(t => String(t || '').trim())
        .filter(t => t.length > 0);

      if (cleanTopics.length === 0) return { success: false, message: 'No topics provided' };

      const response = await fetch('/api/fcm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topics: cleanTopics,
          title,
          body,
          data
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn('[FCMService] Error response:', errText);
        return { success: false, message: errText };
      }

      const result = await response.json();
      return result;
    } catch (err: any) {
      console.warn('[FCMService] Failed to send push notification:', err.message);
      return { success: false, message: err.message };
    }
  },

  /**
   * Check if FCM server configuration is loaded
   */
  checkStatus: async (): Promise<{ status: string; configured: boolean; message: string }> => {
    try {
      const res = await fetch('/api/fcm');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {}
    return { status: 'error', configured: false, message: 'Unable to connect to FCM server route' };
  },

  /**
   * Attendance Push Notification
   */
  sendAttendanceNotification: async (params: {
    studentId: string;
    studentName: string;
    guardianPhone?: string;
    status: 'present' | 'absent' | 'late' | 'leave' | string;
    date: string;
    institutionId?: string;
    arrivalTime?: string | null;
    institutionName?: string;
  }) => {
    const { studentId, studentName, guardianPhone, status, date, institutionId, arrivalTime, institutionName } = params;
    
    let title = 'হাজিরা নোটিফিকেশন';
    let body = '';

    const cleanPhone = (guardianPhone || '').replace(/\D/g, '');

    switch (status) {
      case 'absent':
        title = 'অনুপস্থিতি এলার্ট';
        body = `${studentName} আজ (${date}) ক্লাসে অনুপস্থিত রয়েছে।`;
        break;
      case 'present':
        title = 'উপস্থিতি আপডেট';
        body = `${studentName} আজ (${date}) ক্লাসে উপস্থিত হয়েছে।`;
        break;
      case 'late':
        title = 'বিলম্বিত উপস্থিতি';
        body = `${studentName} আজ (${date}) দেরিতে উপস্থিত হয়েছে${arrivalTime ? ` (${arrivalTime})` : ''}।`;
        break;
      case 'leave':
        title = 'ছুটি অনুমোদন';
        body = `${studentName} আজ (${date}) ছুটির তালিকায় রয়েছে।`;
        break;
      default:
        body = `${studentName}-এর হাজিরা স্টেটাস: ${status} (${date})`;
    }

    if (institutionName) {
      title = `${institutionName} - ${title}`;
    }

    const topics: string[] = [
      `student_${studentId}`,
      `parent_student_${studentId}`
    ];

    if (cleanPhone) {
      topics.push(`parent_${cleanPhone}`);
    }
    if (institutionId) {
      topics.push(`inst_${institutionId}_student_${studentId}`);
    }

    return FCMService.sendPushNotification(topics, title, body, {
      type: 'attendance',
      student_id: studentId,
      status,
      date,
      institution_id: institutionId || '',
      screen: 'attendance'
    });
  },

  /**
   * Fee Reminder / Payment Received Notification
   */
  sendFeeNotification: async (params: {
    studentId: string;
    studentName: string;
    guardianPhone?: string;
    amount?: number | string;
    month?: string;
    type: 'reminder' | 'payment_received' | 'due';
    institutionName?: string;
    institutionId?: string;
    dueAmount?: number | string;
  }) => {
    const { studentId, studentName, guardianPhone, amount, month, type, institutionName, institutionId, dueAmount } = params;
    const cleanPhone = (guardianPhone || '').replace(/\D/g, '');

    let title = 'ফি নোটিফিকেশন';
    let body = '';

    if (type === 'payment_received') {
      title = 'ফি জমা রশিদ';
      body = `${studentName}-এর ${month ? `${month} মাসের ` : ''}ফি বাবদ ${amount ? `${amount} টাকা` : 'টাকা'} সফলভাবে জমা হয়েছে।`;
    } else if (type === 'reminder' || type === 'due') {
      title = 'ফি বকেয়া নোটিশ';
      body = `${studentName}-এর ${month ? `${month} মাসের ` : ''}বকেয়া ফি${dueAmount ? ` ${dueAmount} টাকা` : ''} দ্রুত পরিশোধ করার জন্য বিনীত অনুরোধ করা হচ্ছে।`;
    }

    if (institutionName) {
      title = `${institutionName} - ${title}`;
    }

    const topics: string[] = [
      `student_${studentId}`,
      `parent_student_${studentId}`
    ];
    if (cleanPhone) {
      topics.push(`parent_${cleanPhone}`);
    }
    if (institutionId) {
      topics.push(`inst_${institutionId}_student_${studentId}`);
    }

    return FCMService.sendPushNotification(topics, title, body, {
      type: 'fee',
      fee_type: type,
      student_id: studentId,
      amount: String(amount || ''),
      month: String(month || ''),
      institution_id: institutionId || '',
      screen: 'fees'
    });
  },

  /**
   * Exam / Result Published Notification
   */
  sendExamResultNotification: async (params: {
    examName: string;
    institutionId: string;
    classId?: string;
    className?: string;
    studentId?: string;
    institutionName?: string;
    type?: 'result_published' | 'routine_published' | 'admit_card';
  }) => {
    const { examName, institutionId, classId, className, studentId, institutionName, type = 'result_published' } = params;

    let title = 'পরীক্ষার ফলাফল প্রকাশিত';
    let body = `${examName} পরীক্ষার ফলাফল প্রকাশিত হয়েছে। প্যারেন্ট অ্যাপে বিস্তারিত ফলাফল দেখুন।`;

    if (type === 'routine_published') {
      title = 'পরীক্ষার রুটিন প্রকাশিত';
      body = `${examName} পরীক্ষার সময়সূচি (রুটিন) প্রকাশিত হয়েছে।`;
    } else if (type === 'admit_card') {
      title = 'প্রবেশপত্র (Admit Card) তৈরি';
      body = `${examName} পরীক্ষার প্রবেশপত্র ডাউনলোডের জন্য প্রস্তুত।`;
    }

    if (institutionName) {
      title = `${institutionName} - ${title}`;
    }

    const topics: string[] = [
      `inst_${institutionId}`,
      `madrasah_${institutionId}`
    ];

    if (classId) {
      topics.push(`class_${classId}`);
      topics.push(`inst_${institutionId}_class_${classId}`);
    }

    if (studentId) {
      topics.push(`student_${studentId}`);
      topics.push(`parent_student_${studentId}`);
    }

    return FCMService.sendPushNotification(topics, title, body, {
      type: 'exam_result',
      exam_name: examName,
      institution_id: institutionId,
      class_id: classId || '',
      class_name: className || '',
      student_id: studentId || '',
      screen: 'results'
    });
  },

  /**
   * Notice / Important Announcement Notification
   */
  sendNoticeNotification: async (params: {
    title: string;
    description: string;
    institutionId: string;
    classId?: string;
    className?: string;
    category?: 'notice' | 'holiday' | 'event' | 'ptm' | 'announcement' | 'diary' | string;
    institutionName?: string;
  }) => {
    const { title: noticeTitle, description, institutionId, classId, className, category = 'notice', institutionName } = params;

    let displayTitle = noticeTitle || 'নতুন নোটিশ';
    if (category === 'holiday') displayTitle = `ছুটির বিজ্ঞপ্তি: ${noticeTitle}`;
    else if (category === 'event') displayTitle = `ইভেন্ট নোটিশ: ${noticeTitle}`;
    else if (category === 'ptm') displayTitle = `অভিভাবক সমাবেশ: ${noticeTitle}`;
    else if (category === 'announcement') displayTitle = `জরুরি ঘোষণা: ${noticeTitle}`;
    else if (category === 'diary') displayTitle = `দৈনিক ডায়েরি / বাড়ির কাজ (${className || ''})`;

    if (institutionName) {
      displayTitle = `${institutionName} - ${displayTitle}`;
    }

    const cleanBody = description
      ? (description.length > 150 ? description.substring(0, 147) + '...' : description)
      : 'প্যারেন্ট অ্যাপে বিস্তারিত নোটিশ দেখুন।';

    const topics: string[] = [
      `inst_${institutionId}`,
      `madrasah_${institutionId}`,
      'all_parents'
    ];

    if (classId) {
      topics.push(`class_${classId}`);
      topics.push(`inst_${institutionId}_class_${classId}`);
    }

    return FCMService.sendPushNotification(topics, displayTitle, cleanBody, {
      type: 'notice',
      category,
      institution_id: institutionId,
      class_id: classId || '',
      class_name: className || '',
      screen: 'notices'
    });
  }
};
