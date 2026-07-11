"use client";

import { useCallback, useEffect, useState } from "react";

export function useBrowserNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    () => (typeof Notification !== "undefined" ? Notification.permission : "denied"),
  );

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (permission === "granted" || permission === "denied") return;
    // permission === "default" → chiediamo
    Notification.requestPermission().then((p) => {
      setPermission(p);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const notify = useCallback(
    (title: string, opts?: NotificationOptions) => {
      if (typeof Notification === "undefined") return;
      if (permission !== "granted") return;
      try {
        new Notification(title, { icon: "/spoolio-logo.png", ...opts });
      } catch {
        // silenzioso
      }
    },
    [permission],
  );

  return {
    supported: typeof Notification !== "undefined",
    permission,
    notify,
  } as const;
}
