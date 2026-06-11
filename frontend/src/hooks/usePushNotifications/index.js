import { useEffect, useRef, useCallback } from "react";
import api from "../../services/api";

const urlBase64ToUint8Array = base64String => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

const usePushNotifications = () => {
  const subscriptionRef = useRef(null);

  const subscribe = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;

      const registration = await navigator.serviceWorker.ready;

      const { data } = await api.get("/push/vapid-public-key");
      if (!data?.publicKey) return;

      const applicationServerKey = urlBase64ToUint8Array(data.publicKey);

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey
        });
      }

      subscriptionRef.current = subscription;

      await api.post("/push/subscribe", {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: btoa(
            String.fromCharCode(...new Uint8Array(subscription.getKey("p256dh")))
          ),
          auth: btoa(
            String.fromCharCode(...new Uint8Array(subscription.getKey("auth")))
          )
        }
      });
    } catch (err) {
      console.warn("[Push] Subscribe failed:", err);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    if (!subscriptionRef.current) return;
    try {
      await api.post("/push/unsubscribe", {
        endpoint: subscriptionRef.current.endpoint
      });
      await subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    } catch (err) {
      console.warn("[Push] Unsubscribe failed:", err);
    }
  }, []);

  useEffect(() => {
    subscribe();
    return () => {
      // não faz unsubscribe no unmount — mantém o push ativo mesmo sem a aba aberta
    };
  }, [subscribe]);

  // Escuta mensagens vindas do service worker (quando a aba está aberta)
  useEffect(() => {
    if (!navigator.serviceWorker) return;

    const handler = event => {
      if (event.data?.type === "navigate") {
        window.location.href = event.data.url;
      }
    };

    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, []);

  return { subscribe, unsubscribe };
};

export default usePushNotifications;
