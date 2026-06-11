/* eslint-disable no-restricted-globals */

const CACHE_NAME = "ticketz-v1";

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

  const showNotification = self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then(clients => {
      // Se há uma janela visível e focada, manda mensagem para ela tratar
      const focusedClient = clients.find(
        c => c.visibilityState === "visible" && c.focused
      );
      if (focusedClient) {
        focusedClient.postMessage({ type: "push-received", data });
        return;
      }

      // App em background ou fechado: mostra notificação nativa
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

  event.waitUntil(showNotification);
});

self.addEventListener("notificationclick", event => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(clients => {
        // Tenta focar janela existente e navegar
        for (const client of clients) {
          if ("focus" in client) {
            client.focus();
            if ("navigate" in client) {
              client.navigate(targetUrl);
            } else {
              client.postMessage({ type: "navigate", url: targetUrl });
            }
            return;
          }
        }
        // Abre nova janela
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
