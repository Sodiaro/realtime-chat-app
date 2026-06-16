import { axiosInstance } from "./axios";

const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

// register the service worker and subscribe this device to web push
export async function registerPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    const { data } = await axiosInstance.get("/push/public-key");
    if (!data.key) return; // server has no VAPID keys configured

    const existing = await reg.pushManager.getSubscription();
    const sub =
      existing ||
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.key),
      }));

    await axiosInstance.post("/push/subscribe", { subscription: sub });
  } catch {
    /* push unavailable — silently ignore */
  }
}
