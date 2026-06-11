/* eslint-disable no-restricted-globals */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

// Obrigatório para o Chrome considerar o app instalável como PWA
self.addEventListener("fetch", event => {
  event.respondWith(fetch(event.request));
});

self.addEventListener("push", event => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch (_e) {
    data = { title: "Ticketz", body: event.data.text(), tag: "default", url: "/" };
  }

  const handle = self.registration.showNotification(data.title, {
    body: data.body,
    icon: data.icon || "/android-chrome-192x192.png",
    badge: "/android-chrome-192x192.png",
    tag: data.tag,
    renotify: true,
    data: { url: data.url },
    vibrate: [200, 100, 200],
    actions: [{ action: "open", title: "Abrir" }]
  });

  event.waitUntil(handle);
});

self.addEventListener("notificationclick", event => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(clients => {
        if (clients.length > 0) {
          const client = clients[0];
          client.focus();
          client.postMessage({ type: "navigate", url: targetUrl });
          return;
        }
        return self.clients.openWindow(targetUrl);
      })
  );
});
