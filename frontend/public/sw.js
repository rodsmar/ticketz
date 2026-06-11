/* eslint-disable no-restricted-globals */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", event => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "Ticketz", body: event.data.text(), tag: "default", url: "/" };
  }

  // Sempre mostra a notificação nativa — confiável em background e foreground.
  // O app suprime a notificação do Socket.io quando a janela está visível,
  // evitando duplicatas sem depender do frágil visibilityState aqui.
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
