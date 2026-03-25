// sw.js

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

// --- NEW: Handle Push Notifications and Badging ---
self.addEventListener('push', (event) => {
  let data = { title: 'New Update', body: 'You have a new message.', count: 1 };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: 'https://res.cloudinary.com/dxzmo0roe/image/upload/v1772797527/Christian_Globe_Design_e3befu.jpg', // App icon for the notification
    badge: 'https://res.cloudinary.com/dxzmo0roe/image/upload/v1774457526/Christian_Globe_Design-monochrome_fgnqyb.png', // Monochrome icon for Android status bar
    data: { url: '/' } 
  };

  const promises = [];

  // 1. Update the Badge (Works on iOS 16.4+ and Desktop)
  if ('setAppBadge' in self.navigator) {
    const badgeCount = parseInt(data.count) || 1;
    promises.push(self.navigator.setAppBadge(badgeCount));
  }

  // 2. Show the notification (Required for Android to show a badge/dot)
  promises.push(self.registration.showNotification(data.title, options));

  event.waitUntil(Promise.all(promises));
});

// Clear the badge when the user interacts with the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if ('clearAppBadge' in self.navigator) {
    self.navigator.clearAppBadge();
  }

  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});