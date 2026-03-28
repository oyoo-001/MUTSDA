self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Mandatory for PWA Installability
self.addEventListener('fetch', (event) => {
  // Can be empty, but must exist
});

// This handles the actual Push Notification in the Android/Tablet status bar
self.addEventListener('push', (event) => {
  let data = { title: 'New Update', body: 'You have a new message from MUTSDA.' };
  if (event.data) {
    data = event.data.json();
  }

  const options = {
    body: data.body,
    icon: 'https://res.cloudinary.com/dxzmo0roe/image/upload/v1772797527/Christian_Globe_Design_e3befu.jpg',
    badge: 'https://res.cloudinary.com/dxzmo0roe/image/upload/v1772699359/seventh-day-adventist-church-seeklogo_abaiug.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' }
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});