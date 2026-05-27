const CACHE_NAME = "stock-tracker-v1";
const urlsToCache = [
    "./index.html",
    "./manifest.json",
    "./app.js",
    "./icon-192.png",
    "./icon-512.png"
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener("fetch", event => {
    event.respondWith(
        caches.match(event.request).then(response => response || fetch(event.request))
    );
});

// 在原有的 install 和 fetch 監聽器之後加入：

self.addEventListener('push', event => {
    const data = event.data.json();
    console.log('背景收到推播:', data);

    const options = {
        body: data.body,
        icon: './icon-192.png',
        badge: './icon-192.png',
        vibrate: [200, 100, 200]
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});