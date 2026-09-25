// Service Worker for Background Push Notifications
self.addEventListener('push', function(event) {
    let data = { title: 'New Signal Broadcast', body: 'A new spot trading signal has been posted.' };
    
    if (event.data) {
        data = event.data.json();
    }

    const options = {
        body: data.body,
        icon: 'https://cryptologos.cc/logos/tether-usdt-logo.png',
        badge: 'https://cryptologos.cc/logos/tether-usdt-logo.png',
        vibrate: [200, 100, 200]
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('/')
    );
});
