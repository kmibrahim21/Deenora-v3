import { useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { sendPushNotification, playNotificationSound } from '../lib/pushNotifications';

export function isForStudentClass(
  targetClass: string | null | undefined,
  studentClassName: string | null | undefined,
  studentClassId: string | null | undefined
): boolean {
  if (!targetClass) return true;
  const norm = targetClass.trim().toLowerCase();
  if (
    norm === 'all' ||
    norm === 'all classes' ||
    norm === 'all_classes' ||
    norm === 'সকল' ||
    norm === 'সকল শ্রেণী' ||
    norm === 'সকল শ্রেণি' ||
    norm === 'সকলের জন্য' ||
    norm === 'সব' ||
    norm === 'সব শ্রেণি' ||
    norm === 'সব শ্রেণী' ||
    norm === 'all parents' ||
    norm === 'all students'
  ) {
    return true;
  }

  const sName = (studentClassName || '').trim().toLowerCase();
  const sId = (studentClassId || '').trim().toLowerCase();

  if (!sName && !sId) return true;

  if (sName && norm === sName) return true;
  if (sId && (norm === sId || norm.includes(sId) || sId.includes(norm))) return true;

  const normBengali = (str: string) => str.replace(/শ্রেণী/g, 'শ্রেণি').replace(/[\s_-]+/g, '').toLowerCase();
  const cleanNorm = normBengali(norm);
  const cleanSName = normBengali(sName);

  if (cleanNorm && cleanSName && (cleanNorm === cleanSName || cleanNorm.includes(cleanSName) || cleanSName.includes(cleanNorm))) return true;

  return false;
}

function parseMessageText(msgText: any): string {
  if (!msgText) return 'নতুন বার্তা এসেছে';
  if (typeof msgText === 'string') {
    if (msgText.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(msgText);
        if (parsed.desc) return parsed.desc;
        if (parsed.message) return parsed.message;
        if (parsed.note) return parsed.note;
        if (Array.isArray(parsed.subjects)) {
          return parsed.subjects.map((s: any) => `${s.subject}: ${s.details || ''}`).filter(Boolean).join(', ');
        }
      } catch {
        return msgText;
      }
    }
    return msgText;
  }
  if (typeof msgText === 'object') {
    if (msgText.desc) return msgText.desc;
    if (msgText.message) return msgText.message;
    if (msgText.note) return msgText.note;
    if (Array.isArray(msgText.subjects)) {
      return msgText.subjects.map((s: any) => `${s.subject}: ${s.details || ''}`).filter(Boolean).join(', ');
    }
  }
  return 'নতুন বার্তা এসেছে';
}

interface GlobalNotificationsOptions {
  institutionId?: string | null;
  userId?: string | null;
  userRole?: string | null;
  studentClassId?: string | null;
  studentClassName?: string | null;
  onNewNotification?: (newMsg: any) => void;
}

export function useGlobalNotifications({
  institutionId,
  userId,
  userRole,
  studentClassId,
  studentClassName,
  onNewNotification
}: GlobalNotificationsOptions) {
  const onNewNotifRef = useRef(onNewNotification);
  useEffect(() => {
    onNewNotifRef.current = onNewNotification;
  }, [onNewNotification]);

  useEffect(() => {
    if (!institutionId) return;

    const channelName = `global_notifs_${institutionId}`;
    const userChannelName = `global_notifs_${institutionId}_${userId || 'anon'}`;
    console.log(`[useGlobalNotifications] Subscribing to notification channels for institution: ${institutionId}`);

    const handleIncomingMsg = (newMsg: any) => {
      if (!newMsg) return;

      // Don't notify if sent by current user
      if (userId && (newMsg.sender_id === userId || newMsg.sender_id === `parent-${userId}`)) {
        return;
      }

      let isRelevant = false;
      let notifTitle = newMsg.title || newMsg.sender_name || 'নতুন নোটিশ / চ্যাট মেসেজ';
      let notifBody = parseMessageText(newMsg.message);

      const convId = (newMsg.conversation_id || newMsg.class_name || '').toLowerCase();
      const className = (newMsg.class_name || '').toLowerCase();

      if (userRole === 'parent') {
        // Check Live Chat matching
        if (convId) {
          const matchesClassGroup = isForStudentClass(convId, studentClassName, studentClassId) || (studentClassId && (convId === `class-group-${studentClassId}`.toLowerCase() || convId.includes(studentClassId.toLowerCase())));
          const matchesAnnouncement = convId.startsWith('announcement-');
          const matchesDirect = userId && convId.includes(userId.toLowerCase());

          if (matchesClassGroup || matchesAnnouncement || matchesDirect) {
            isRelevant = true;
            if (matchesClassGroup) {
              notifTitle = `${studentClassName || 'শ্রেণী'} গ্রুপ মেসেজ`;
            } else if (matchesAnnouncement) {
              notifTitle = 'প্রতিষ্ঠান অফিসিয়াল নোটিশ';
            }
          }
        }

        // Check Notice / Daily Diary matching
        if (!isRelevant && className) {
          let targetClass = className;
          try {
            if (typeof newMsg.message === 'string' && newMsg.message.trim().startsWith('{')) {
              const p = JSON.parse(newMsg.message);
              if (p.classGroup) targetClass = p.classGroup;
            } else if (typeof newMsg.message === 'object' && newMsg.message?.classGroup) {
              targetClass = newMsg.message.classGroup;
            }
          } catch {
            // ignore
          }

          if (className.startsWith('app_syllabus_')) {
            targetClass = className.replace('app_syllabus_', '');
          } else if (className.startsWith('app_suggestion_')) {
            targetClass = className.replace('app_suggestion_', '');
          } else if (className.startsWith('app_routine_')) {
            targetClass = className.replace('app_routine_', '');
          }

          if (isForStudentClass(targetClass, studentClassName, studentClassId) || isForStudentClass(className, studentClassName, studentClassId)) {
            isRelevant = true;
            if (className === 'app_notice' || className === 'app_holiday' || className === 'app_ptm') {
              notifTitle = newMsg.title || 'গুরুত্বপূর্ণ নোটিশ';
            } else {
              notifTitle = `${studentClassName || 'শ্রেণী'} বার্তা / ডায়েরি`;
            }
          }
        }
      } else {
        // Staff / Admin / Teacher
        isRelevant = true;
      }

      if (isRelevant) {
        console.log('[useGlobalNotifications] Relevant notification received:', newMsg);
        playNotificationSound();
        sendPushNotification(notifTitle, notifBody, '/Deenora192.png', `msg-${newMsg.id || Date.now()}`);

        if (onNewNotifRef.current) {
          onNewNotifRef.current(newMsg);
        }
      }
    };

    const channel1 = supabase
      .channel(channelName)
      .on(
        'broadcast',
        { event: 'new_message' },
        (payload) => {
          if (payload?.payload) handleIncomingMsg(payload.payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          if (payload?.new) handleIncomingMsg(payload.new);
        }
      )
      .subscribe();

    const channel2 = supabase
      .channel(userChannelName)
      .on(
        'broadcast',
        { event: 'new_message' },
        (payload) => {
          if (payload?.payload) handleIncomingMsg(payload.payload);
        }
      )
      .subscribe();

    // BroadcastChannel tab-to-tab sync fallback
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bc = new BroadcastChannel(`deenora_msg_channel_${institutionId}`);
        bc.onmessage = (event) => {
          if (event.data && event.data.type === 'NEW_MESSAGE') {
            const msg = event.data.payload;
            if (msg) {
              handleIncomingMsg(msg);
            }
          }
        };
      }
    } catch {
      // ignore BroadcastChannel errors
    }

    return () => {
      console.log(`[useGlobalNotifications] Unsubscribing from notification channels for: ${institutionId}`);
      supabase.removeChannel(channel1);
      supabase.removeChannel(channel2);
      if (bc) bc.close();
    };
  }, [institutionId, userId, userRole, studentClassId, studentClassName]);
}
