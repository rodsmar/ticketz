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

  const handle = self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then(clients => {
      // Se há janela visível em foreground, ela já recebe via Socket.io
      // Ainda assim mostramos a notificação para garantir badge e som no iOS
      const hasVisibleClient = clients.some(
        c => c.visibilityState === "visible"
      );

      if (hasVisibleClient) {
        // Avisa o app para atualizar contadores sem mostrar notificação duplicada
        clients.forEach(c => {
          if (c.visibilityState === "visible") {
            c.postMessage({ type: "push-received", data });
          }
        });
        return;
      }

      // App em background ou fechado: notificação nativa
      return self.registration.showNotification(data.title, {
        body: data.body,
        icon: data.icon || "/android-chrome-192x192.png",
        badge: "/android-chrome-192x192.png",
        tag: data.tag,
        renotify: true,
        data: { url: data.url },
        vibrate: [200, 100, 200],
        actions: [{ action: "open", title: "Abrir" }]
      });
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
        // Foca janela existente e navega
        if (clients.length > 0) {
          const client = clients[0];
          client.focus();
          client.postMessage({ type: "navigate", url: targetUrl });
          return;
        }
        // Abre nova janela
        return self.clients.openWindow(targetUrl);
      })
  );
});
