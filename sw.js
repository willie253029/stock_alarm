const CACHE_NAME = 'stock-pwa-v1';
const ASSETS = [
    'index.html',
    'app.js',
    'manifest.json',
    'icon-192.png',
    'icon-512.png'
];

// 安裝 Service Worker 並快取檔案 (離線可用)
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS);
        })
    );
});

// 攔截網路請求 (基本 PWA 離線功能)
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});

// 🔥 重頭戲：監聽來自 Render 後端傳來的背景推播事件
self.addEventListener('push', event => {
    let data = { title: '台股提醒', body: '有新通知！' };
    
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: 'icon-192.png',
        badge: 'icon-192.png',
        vibrate: [300, 100, 300], // 手機震動節奏
        data: { dateOfArrival: Date.now() }
    };

    // 叫作業系統彈出通知
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// 點擊通知時的反應 (可選：點擊後打開網頁)
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('/')
    );
});