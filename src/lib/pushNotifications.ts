// Push Notification Utility for Live Chat

export function isPushNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermissionState(): NotificationPermission {
  if (!isPushNotificationSupported()) return 'denied';
  return Notification.permission;
}

export async function requestPushNotificationPermission(): Promise<NotificationPermission> {
  if (!isPushNotificationSupported()) return 'denied';
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      playNotificationSound();
      sendPushNotification(
        'Deenora Chat Notifications Enabled! 🔔',
        'আপনাকে Deenora লাইভ চ্যাটে স্বাগতম। এখন থেকে নতুন মেসেজের পুশ নোটিফিকেশন পাবেন।',
        '/icon.png'
      );
    }
    return permission;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return 'denied';
  }
}

export function sendPushNotification(title: string, body: string, icon?: string, tag?: string) {
  if (!isPushNotificationSupported() || Notification.permission !== 'granted') {
    return;
  }

  try {
    playNotificationSound();

    const options: NotificationOptions = {
      body,
      icon: icon || '/icon.png',
      badge: '/icon.png',
      tag: tag || 'chat-message',
      silent: false,
    };

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification(title, options);
      });
    } else {
      const notification = new Notification(title, options);
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }
  } catch (error) {
    console.error('Error firing push notification:', error);
  }
}

// Web Audio API Chime Sound Generator (No external audio file needed!)
export function playNotificationSound() {
  try {
    const AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
    if (!AudioContext) return;

    const audioCtx = new AudioContext();
    
    // Create dual tone soft pop chime (WhatsApp/Telegram style)
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';

    osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.12); // A5

    osc2.frequency.setValueAtTime(1174.66, audioCtx.currentTime + 0.12); // D6

    gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc1.start(audioCtx.currentTime);
    osc1.stop(audioCtx.currentTime + 0.35);
    osc2.start(audioCtx.currentTime + 0.12);
    osc2.stop(audioCtx.currentTime + 0.35);
  } catch {
    // Ignore audio context errors if blocked by browser policy
  }
}
