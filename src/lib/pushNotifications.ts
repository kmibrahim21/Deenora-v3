// Push Notification Utility for Live Chat, PWA & Android WebView

// Unlock Web Audio context on first user touch/click for reliable sound playback
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        ctx.resume().then(() => ctx.close()).catch(() => {});
      }
    } catch {}
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
  };
  window.addEventListener('click', unlockAudio, { once: true });
  window.addEventListener('touchstart', unlockAudio, { once: true });
}

export function isAndroidWebView(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Android/i.test(ua) && (/wv/i.test(ua) || /Version\/[\d.]+/i.test(ua) || (window as any).Android !== undefined);
}

export function isPushNotificationSupported(): boolean {
  return typeof window !== 'undefined' && ('Notification' in window || isAndroidWebView() || 'serviceWorker' in navigator);
}

export function getNotificationPermissionState(): NotificationPermission {
  if (typeof window === 'undefined') return 'denied';
  
  const localEnabled = localStorage.getItem('deenora_notification_enabled') === 'true';
  
  if (typeof Notification !== 'undefined' && 'permission' in Notification) {
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied' && !localEnabled) return 'denied';
  }

  // In Android WebView or when user explicitly clicked enable in app
  if (localEnabled || isAndroidWebView()) {
    return 'granted';
  }

  return 'default';
}

export async function requestPushNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined') return 'denied';

  // Ensure ServiceWorker is registered and active
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    } catch (e) {
      console.warn('[PushNotifications] SW registration notice:', e);
    }
  }

  let result: NotificationPermission = 'default';

  if (typeof window !== 'undefined' && typeof Notification !== 'undefined' && 'requestPermission' in Notification) {
    try {
      const p = Notification.requestPermission((status) => {
        if (status) result = status;
      });
      if (p && typeof p.then === 'function') {
        result = await p;
      }
    } catch (error) {
      console.warn('[PushNotifications] Notification.requestPermission warning:', error);
    }
  } else if (isAndroidWebView()) {
    result = 'granted';
  }

  if (result === 'granted' || localStorage.getItem('deenora_notification_enabled') === 'true') {
    localStorage.setItem('deenora_notification_enabled', 'true');
    playNotificationSound();
    
    // Immediate test push notification on device
    sendPushNotification(
      'Deenora নোটিফিকেশন চালু হয়েছে! 🔔',
      'এখন থেকে এডমিন, শিক্ষক ও অভিভাবকদের নতুন মেসেজ সরাসরি মোবাইলে পুশ নোটিফিকেশন পাবেন।',
      '/Deenora192.png'
    );
    return 'granted';
  }

  if (result === 'denied') {
    localStorage.setItem('deenora_notification_enabled', 'false');
  }

  playNotificationSound();
  return result;
}

function triggerNativeNotification(title: string, options: NotificationOptions): boolean {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const notification = new Notification(title, options);
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
      return true;
    }
  } catch (err) {
    // Note: Android Chrome deliberately throws on new Notification() and requires ServiceWorker showNotification
    console.log('[PushNotifications] Native Notification not supported on this device/browser:', err);
  }
  return false;
}

export async function sendPushNotification(title: string, body: string, icon?: string, tag?: string) {
  // 1. Play soft audio chime on every incoming notification
  playNotificationSound();

  // 2. Trigger vibration if supported
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
  } catch {}

  if (typeof window === 'undefined') return;

  const perm = getNotificationPermissionState();
  if (perm !== 'granted') return;

  const iconUrl = icon || '/Deenora192.png';
  const notifId = tag || `deenora-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

  const options: NotificationOptions & { renotify?: boolean } = {
    body,
    icon: iconUrl,
    badge: iconUrl,
    tag: notifId,
    renotify: true,
    silent: false,
    data: { url: window.location.href, timestamp: Date.now() }
  };

  // 3. Deliver via Service Worker (Required for Mobile Android Chrome & PWA)
  let swDelivered = false;
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) {
        await reg.showNotification(title, options);
        swDelivered = true;
      } else {
        const readyReg = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 800))
        ]);
        if (readyReg && (readyReg as ServiceWorkerRegistration).showNotification) {
          await (readyReg as ServiceWorkerRegistration).showNotification(title, options);
          swDelivered = true;
        }
      }
    } catch (swErr) {
      console.warn('[PushNotifications] SW showNotification notice:', swErr);
    }
  }

  // 4. Fallback to native desktop Notification constructor if SW did not display it
  if (!swDelivered) {
    triggerNativeNotification(title, options);
  }
}

// Web Audio API Chime Sound Generator (Instant synthetic chime, no external MP3 needed)
export function playNotificationSound() {
  try {
    const AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
    if (!AudioContext) return;

    const audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    
    // Create dual tone soft pop chime (WhatsApp/Telegram style)
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';

    osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.12); // A5

    osc2.frequency.setValueAtTime(1174.66, audioCtx.currentTime + 0.12); // D6

    gainNode.gain.setValueAtTime(0.18, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.38);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc1.start(audioCtx.currentTime);
    osc1.stop(audioCtx.currentTime + 0.38);
    osc2.start(audioCtx.currentTime + 0.12);
    osc2.stop(audioCtx.currentTime + 0.38);
  } catch {
    // Ignore audio context errors if blocked by browser policy
  }
}

let wakeLockSentinel: any = null;

export async function requestScreenWakeLock() {
  if (typeof navigator !== 'undefined' && 'wakeLock' in navigator && (navigator as any).wakeLock) {
    try {
      wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
      wakeLockSentinel.addEventListener('release', () => {
        wakeLockSentinel = null;
      });
    } catch {}
  }
}

export function releaseScreenWakeLock() {
  if (wakeLockSentinel) {
    try {
      wakeLockSentinel.release().catch(() => {});
    } catch {}
    wakeLockSentinel = null;
  }
}

export interface IncomingCallNotificationOptions {
  callId: string;
  callerName: string;
  studentName?: string;
  photoUrl?: string;
}

/**
 * Display WhatsApp-style persistent incoming call notification on mobile screen / lock screen
 */
export async function showIncomingCallNotification({
  callId,
  callerName,
  studentName,
  photoUrl
}: IncomingCallNotificationOptions) {
  if (typeof window === 'undefined') return;

  // 1. Keep mobile screen awake
  requestScreenWakeLock();

  // 2. Vibrate phone immediately
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([800, 400, 800, 400, 1000]);
    }
  } catch {}

  // Auto-request permission if in 'default' state
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch {}
  }

  const title = `📞 Incoming Call: ${callerName || 'Institution Admin'}`;
  const body = studentName 
    ? `Student: ${studentName}\nTap to answer or open call` 
    : 'Deenora Voice Call | Tap to answer';
  const icon = photoUrl || '/Deenora192.png';

  // 3. Post to Service Worker to display full persistent lock-screen notification
  if ('serviceWorker' in navigator) {
    try {
      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        try {
          reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        } catch {}
      }

      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_INCOMING_CALL',
          callId,
          callerName,
          studentName,
          icon
        });
      }

      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          body,
          icon,
          badge: '/Deenora192.png',
          tag: 'incoming-voice-call',
          renotify: true,
          requireInteraction: true,
          vibrate: [1000, 400, 1000, 400, 1000, 400, 1200],
          timestamp: Date.now(),
          data: {
            type: 'incoming_call',
            callId,
            url: `/?action=accept_call&call_id=${callId}&t=${Date.now()}`
          },
          actions: [
            { action: 'answer', title: '📞 Answer' },
            { action: 'decline', title: '❌ Decline' }
          ]
        } as any);
        return;
      }
    } catch (e) {
      console.warn('[PushNotifications] SW showIncomingCallNotification notice:', e);
    }
  }

  // 4. Desktop native notification fallback if SW not ready
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const notif = new Notification(title, {
        body,
        icon,
        tag: 'incoming-voice-call',
        requireInteraction: true,
      } as any);
      notif.onclick = () => {
        window.focus();
        notif.close();
      };
    }
  } catch {}
}

/**
 * Dismiss incoming call notification and silence device vibration
 */
export function dismissIncomingCallNotification() {
  releaseScreenWakeLock();

  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(0);
    } catch {}
  }

  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'DISMISS_CALL_NOTIFICATION'
        });
      }

      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) {
          reg.getNotifications({ tag: 'incoming-voice-call' }).then((notifications) => {
            notifications.forEach((n) => {
              try { n.close(); } catch {}
            });
          });
        }
      }).catch(() => {});
    } catch {}
  }
}

