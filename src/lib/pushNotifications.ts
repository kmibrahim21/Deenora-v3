// Push Notification Utility for Live Chat, PWA & Android WebView

// Custom event name for in-app notification banner
export const DEENORA_NOTIF_EVENT = 'deenora-inapp-notification';

export interface InAppNotificationPayload {
  id: string;
  title: string;
  body: string;
  icon?: string;
  timestamp: number;
}

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
  // Mark user intention as enabled in local storage
  localStorage.setItem('deenora_notification_enabled', 'true');

  let result: NotificationPermission = 'default';

  if (typeof window !== 'undefined' && typeof Notification !== 'undefined' && 'requestPermission' in Notification) {
    try {
      result = await Notification.requestPermission();
    } catch (error) {
      console.warn('[PushNotifications] Notification.requestPermission warning:', error);
    }
  }

  if (result === 'granted' || localStorage.getItem('deenora_notification_enabled') === 'true') {
    playNotificationSound();
    sendPushNotification(
      'Deenora নোটিফিকেশন চালু হয়েছে! 🔔',
      'এখন থেকে নতুন নোটিশ ও মেসেজের পুশ নোটিফিকেশন সরাসরি পাবেন।',
      '/Deenora192.png'
    );
    return 'granted';
  }

  playNotificationSound();
  return result;
}

function triggerNativeNotification(title: string, options: NotificationOptions) {
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
    console.warn('[PushNotifications] Native Notification constructor notice:', err);
  }
  return false;
}

export function sendPushNotification(title: string, body: string, icon?: string, tag?: string) {
  // 1. Play soft audio chime on every incoming notification
  playNotificationSound();

  // 2. Trigger vibration if supported
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([150, 80, 150]);
    }
  } catch {}

  if (typeof window === 'undefined') return;

  const iconUrl = icon || '/Deenora192.png';
  const notifId = tag || `deenora-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

  // 3. Dispatch in-app notification event so active screen shows floating animated banner
  try {
    const customEvent = new CustomEvent<InAppNotificationPayload>(DEENORA_NOTIF_EVENT, {
      detail: {
        id: notifId,
        title,
        body,
        icon: iconUrl,
        timestamp: Date.now()
      }
    });
    window.dispatchEvent(customEvent);
  } catch (e) {
    console.warn('[PushNotifications] In-app event dispatch notice:', e);
  }

  const perm = getNotificationPermissionState();
  if (perm !== 'granted') return;

  const options: NotificationOptions = {
    body,
    icon: iconUrl,
    badge: iconUrl,
    tag: notifId,
    silent: false,
    data: { url: window.location.href }
  };

  // 4. Try native Notification constructor first (Works instantly on Desktop Chrome, Firefox, Safari, Edge)
  const nativeShown = triggerNativeNotification(title, options);

  // 5. Also attempt Service Worker notification (Required for Mobile Android Chrome & PWA)
  if ('serviceWorker' in navigator) {
    try {
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration && registration.showNotification && !nativeShown) {
          registration.showNotification(title, options).catch((err) => {
            console.warn('[PushNotifications] SW showNotification error:', err);
          });
        }
      }).catch(() => {});
    } catch {}
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
