"use client";

import { useCallback, useEffect, useState } from "react";

export function useBrowserNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    () => (typeof Notification !== "undefined" ? Notification.permission : "denied"),
  );

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    // Il permesso può cambiare da un'altra tab/scheda del sito o dalle impostazioni
    // del browser senza che questo componente venga rimontato: risincronizziamo
    // quando la finestra torna in primo piano invece di fidarci solo dello state
    // letto al mount.
    const sync = () => setPermission(Notification.permission);
    sync();
    window.addEventListener("focus", sync);
    return () => window.removeEventListener("focus", sync);
  }, []);

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (permission !== "default") return;
    Notification.requestPermission().then((p) => {
      setPermission(p);
    });
  }, [permission]);

  const notify = useCallback(
    (title: string, opts?: NotificationOptions) => {
      if (typeof Notification === "undefined") {
        console.warn("[notify] Notification API non disponibile in questo browser.");
        return;
      }
      if (Notification.permission !== "granted") {
        console.warn(`[notify] permesso notifiche non concesso (${Notification.permission}).`);
        return;
      }
      try {
        new Notification(title, { icon: "/spoolio-logo.png", ...opts });
      } catch (e) {
        console.error("[notify] creazione Notification fallita:", e);
      }
    },
    [],
  );

  return {
    supported: typeof Notification !== "undefined",
    permission,
    notify,
  } as const;
}
