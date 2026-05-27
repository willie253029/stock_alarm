const CACHE_NAME = 'stock-pwa-v2'; // 更新快取版本號

const ASSETS = [
    './',
    './index.html',
    './app.js',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

// ==========================================
// 第一部分：快取與更新策略 (網路優先 Network First)
// ==========================================

// 1. 安裝並寫入快取 (加入強制更新機制)
self.addEventListener('install', event => {
    self.skipWaiting(); // 強制立即更新 Service Worker，不讓舊版卡住
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS);
        })
    );
});

// 2. 清除舊版快取 (確保不會讀到舊畫面)
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
});

// 3. 攔截請求：採用「網路優先」策略
self.addEventListener('fetch', event => {
    event.respondWith(
        fetch(event.request)
            .then(networkResponse => {
                // 如果網路連線正常，就把最新的檔案存進快取備用
                return caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                });
            })
            .catch(() => {
                // 如果斷網了，才從快取拿舊檔案出來擋著用
                return caches.match(event.request);
            })
    );
});

// ==========================================
// 第二部分：背景推播與通知顯示 (與 Render 後端連動)
// ==========================================

// 4. 🔥 重頭戲：監聽來自 Render 後端傳來的背景推播事件
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
        badge: 'icon-192.png', // 顯示在 Android 狀態列的小圖示
        vibrate: [300, 100, 300], // 手機震動節奏：震動-暫停-震動
        data: { dateOfArrival: Date.now() }
    };

    // 叫作業系統彈出通知
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// 5. 點擊通知時的反應
self.addEventListener('notificationclick', event => {
    event.notification.close(); // 點擊後自動關閉通知面板
    
    // 點擊通知後，自動開啟或切換到我們的 PWA 網頁
    event.waitUntil(
        clients.openWindow('./')
    );
});