const CACHE = "sheplates-v6-ultra-shell";
const SHELL = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/sheplates-logo.png", "/sheplates-hero.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then((response) => {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then((cached) => cached || caches.match("/"))));
});

self.addEventListener("push", (event) => {
  let payload = { title: "ShePlates update", body: "Your order or schedule has an update.", url: "/" };
  try { payload = { ...payload, ...event.data.json() }; } catch { /* safe defaults */ }
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: payload.url },
    tag: "sheplates-update",
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const target = event.notification.data?.url || "/";
    const visible = clients.find((client) => "focus" in client);
    return visible ? visible.focus() : self.clients.openWindow(target);
  }));
});
