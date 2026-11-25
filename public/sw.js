// Deenora Service Worker for PWA & Push Notifications
const CACHE_NAME = 'deenora-cache-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    clients.claim().then(() => {
      console.log('[Deenora SW] Activated and claimed clients');
    })
  );
});

// Helper to display incoming call notification on lock screen / mobile screen
function showCallNotification(payload) {
  const callerName = payload.callerName || payload.caller || 'শিক্ষা প্রতিষ্ঠান';
  const studentName = payload.studentName ? `শিক্ষার্থী: ${payload.studentName}` : '';
  const callId = payload.callId || '';
  
  const title = `📞 ইনকামিং কল: ${callerName}`;
  const body = studentName 
    ? `${studentName}\nরিসিভ করতে এখানে ট্যাপ করুন` 
    : 'প্রতিষ্ঠান থেকে ভয়েস কল আসছে | রিসিভ করতে ট্যাপ করুন';

  const options = {
    body,
    icon: payload.icon || '/Deenora192.png',
    badge: '/Deenora192.png',
    tag: 'incoming-voice-call',
    renotify: true,
    requireInteraction: true, // Remains on mobile screen / lock screen until answered
    vibrate: [1000, 400, 1000, 400, 1000, 400, 1200],
    timestamp: Date.now(),
    silent: false,
    importance: 'high',
    priority: 2,
    data: {
      type: 'incoming_call',
      callId,
      url: `/?action=accept_call&call_id=${callId}&t=${Date.now()}`
    },
    actions: [
      { action: 'answer', title: '📞 রিসিভ করুন' },
      { action: 'decline', title: '❌ কেটে দিন' }
    ]
  };

  return self.registration.showNotification(title, options);
}

// Dismiss active incoming call notification when call ends or is answered
function dismissCallNotification() {
  return self.registration.getNotifications({ tag: 'incoming-voice-call' }).then((notifications) => {
    notifications.forEach((notif) => {
      try { notif.close(); } catch {}
    });
  });
}

// Handle client messages (e.g. from callService or pushNotification helpers)
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SHOW_INCOMING_CALL') {
    event.waitUntil(showCallNotification(event.data));
  } else if (event.data.type === 'DISMISS_CALL_NOTIFICATION') {
    event.waitUntil(dismissCallNotification());
  }
});

// Handle push events sent from server/cloud or local broadcast
self.addEventListener('push', (event) => {
  let data = { title: 'Deenora', body: 'নতুন মেসেজ এসেছে', icon: '/Deenora192.png' };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  // Bulk Internet Voice Alert (Zero-Cost Broadcast) — strictly separated from 1-to-1 incoming_call
  if (
    data.type === 'auto_voice_alert' ||
    data.call_mode === 'internet_voice_broadcast' ||
    String(data.call_id || data.callId || '').startsWith('ivc_')
  ) {
    const callId = data.call_id || data.callId || '';
    const alertUrl = data.click_action || data.url || `/parent-portal?action=auto_voice_alert&call_id=${encodeURIComponent(callId)}`;
    const options = {
      body: data.body || 'প্রতিষ্ঠান থেকে একটি ভয়েস বার্তা এসেছে। শুনতে ট্যাপ করুন।',
      icon: data.icon || '/Deenora192.png',
      badge: '/Deenora192.png',
      tag: `auto-voice-alert-${callId || Date.now()}`,
      renotify: true,
      requireInteraction: true,
      vibrate: [400, 200, 400],
      data: {
        type: 'auto_voice_alert',
        call_id: callId,
        audio_url: data.audio_url || '',
        title: data.title || 'জরুরি ভয়েস বার্তা',
        body: data.body || '',
        institution_name: data.institution_name || '',
        url: alertUrl
      },
      actions: [
        { action: 'open_voice_alert', title: '🔊 শুনুন' }
      ]
    };
    event.waitUntil(
      self.registration.showNotification(data.title || 'প্রতিষ্ঠান থেকে ভয়েস বার্তা', options)
    );
    return;
  }

  // Check if 1-to-1 incoming voice call push
  if (data.type === 'incoming_call' || data.tag === 'incoming-voice-call' || (data.title && data.title.includes('ইনকামিং'))) {
    event.waitUntil(showCallNotification(data));
    return;
  }

  const options = {
    body: data.body,
    icon: data.icon || '/Deenora192.png',
    badge: '/Deenora192.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/'
    },
    actions: [
      { action: 'open', title: 'ওপেন করুন' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Deenora', options)
  );
});

// Handle notification click (Lock screen & heads-up interactive buttons)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const notifData = event.notification.data || {};
  const action = event.action;
  const targetUrl = notifData.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 0. Bulk Internet Voice Alert click -> open Parent Portal voice overlay (never 1-to-1 WebRTC)
      if (notifData.type === 'auto_voice_alert') {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin)) {
            if ('focus' in client) {
              client.focus();
            }
            client.postMessage({
              type: 'AUTO_VOICE_ALERT',
              call_id: notifData.call_id,
              audio_url: notifData.audio_url,
              title: notifData.title,
              body: notifData.body,
              institution_name: notifData.institution_name,
            });
            return;
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
        return;
      }

      // 1. If user clicked "❌ কেটে দিন"
      if (action === 'decline') {
        dismissCallNotification();
        for (const client of windowClients) {
          client.postMessage({
            type: 'REJECT_CALL_FROM_NOTIFICATION',
            callId: notifData.callId
          });
        }
        return;
      }

      // 2. If user clicked "📞 রিসিভ করুন" or clicked the main notification card on mobile screen
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          if ('focus' in client) {
            client.focus();
          }
          client.postMessage({
            type: action === 'answer' ? 'ACCEPT_CALL_FROM_NOTIFICATION' : 'ACCEPT_CALL_FROM_NOTIFICATION',
            callId: notifData.callId,
            action: action || 'incoming_call'
          });
          return;
        }
      }

      // 3. If app was not open in any active window, open window directly to call screen
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
