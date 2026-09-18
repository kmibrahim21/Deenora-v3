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
  // Mark user intention as enabled in local storage
  localStorage.setItem('deenora_notification_enabled', 'true');

  if (typeof window !== 'undefined' && typeof Notification !== 'undefined' && 'requestPermission' in Notification) {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        playNotificationSound();
        sendPushNotification(
          'Deenora নোটিফিকেশন চালু হয়েছে! 🔔',
          'এখন থেকে নতুন নোটিশ ও মেসেজের পুশ নোটিফিকেশন সরাসরি পাবেন।',
          '/Deenora192.png'
        );
        return 'granted';
      }
    } catch (error) {
      console.warn('[PushNotifications] Notification.requestPermission warning:', error);
    }
  }

  // Fallback confirmation
  playNotificationSound();
  return 'granted';
}

function triggerNativeNotification(title: string, options: NotificationOptions) {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const notification = new Notification(title, options);
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }
  } catch (err) {
    console.warn('[PushNotifications] Native Notification fallback error:', err);
  }
}

export function sendPushNotification(title: string, body: string, icon?: string, tag?: string) {
  // 1. Play soft audio chime on every incoming notification
  playNotificationSound();

  if (typeof window === 'undefined') return;

  const perm = getNotificationPermissionState();
  if (perm !== 'granted') return;

  try {
    const iconUrl = icon || '/Deenora192.png';
    const options: NotificationOptions = {
      body,
      icon: iconUrl,
      badge: iconUrl,
      tag: tag || `deenora-${Date.now()}`,
      silent: false,
      data: { url: window.location.href }
    };

    // 2. Prioritize Service Worker registration for mobile Android, Chrome & PWA
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(registration => {
        if (registration && registration.showNotification) {
          registration.showNotification(title, options).catch(() => {
            triggerNativeNotification(title, options);
          });
        } else if (navigator.serviceWorker.ready) {
          navigator.serviceWorker.ready.then(reg => {
            if (reg && reg.showNotification) {
              reg.showNotification(title, options).catch(() => {
                triggerNativeNotification(title, options);
              });
            } else {
              triggerNativeNotification(title, options);
            }
          }).catch(() => {
            triggerNativeNotification(title, options);
          });
        } else {
          triggerNativeNotification(title, options);
        }
      }).catch(() => {
        triggerNativeNotification(title, options);
      });
    } else {
      triggerNativeNotification(title, options);
    }
  } catch (error) {
    console.warn('[PushNotifications] Error firing notification:', error);
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
