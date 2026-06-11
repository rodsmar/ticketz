import { useEffect, useRef, useCallback } from "react";
import { useHistory } from "react-router-dom";
import api from "../../services/api";

const urlBase64ToUint8Array = base64String => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
};

const arrayBufferToBase64 = buffer => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

const usePushNotifications = () => {
  const subscriptionRef = useRef(null);
  const history = useHistory();

  const subscribe = useCallback(async () => {
    if (!("serviceWorker" in navigator)) {
      console.warn("[Push] Service Worker not supported");
      return;
    }
    if (!("PushManager" in window)) {
      console.warn("[Push] PushManager not supported");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        console.warn("[Push] Notification permission denied:", permission);
        return;
      }

      const registration = await navigator.serviceWorker.ready;

      const { data } = await api.get("/push/vapid-public-key");
      if (!data?.publicKey) {
        console.warn("[Push] No VAPID public key received");
        return;
      }

      const applicationServerKey = urlBase64ToUint8Array(data.publicKey);

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey
        });
        console.info("[Push] New subscription created");
      } else {
        console.info("[Push] Reusing existing subscription");
      }

      subscriptionRef.current = subscription;

      const p256dh = arrayBufferToBase64(subscription.getKey("p256dh"));
      const auth = arrayBufferToBase64(subscription.getKey("auth"));

      await api.post("/push/subscribe", {
        endpoint: subscription.endpoint,
        keys: { p256dh, auth }
      });

      console.info("[Push] Subscription saved to backend");
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
  }, [subscribe]);

  // Escuta mensagens do service worker para navegação
  useEffect(() => {
    if (!navigator.serviceWorker) return;

    const handler = event => {
      if (event.data?.type === "navigate") {
        history.push(event.data.url);
      }
    };

    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, [history]);

  return { subscribe, unsubscribe };
};

export default usePushNotifications;
