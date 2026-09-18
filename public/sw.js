// Deenora Service Worker for PWA & Push Notifications
const CACHE_NAME = 'deenora-cache-v1';

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

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a tab is already open, focus it
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
