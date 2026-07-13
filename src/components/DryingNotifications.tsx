"use client";

import { useEffect, useRef } from "react";
import { useBrowserNotifications } from "@/lib/useBrowserNotifications";

const LAST_NOTIFY_KEY = "spoolio:dryingNotification:lastAt";
const MIN_INTERVAL_MS = 6 * 60 * 60 * 1000; // non ripetere la notifica prima di 6 ore

export default function DryingNotifications({ dryCount }: { dryCount: number }) {
  const { notify } = useBrowserNotifications();
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (dryCount <= 0 || notifiedRef.current) return;
    const lastAt = Number(localStorage.getItem(LAST_NOTIFY_KEY) ?? 0);
    if (Date.now() - lastAt < MIN_INTERVAL_MS) return;

    notifiedRef.current = true;
    localStorage.setItem(LAST_NOTIFY_KEY, String(Date.now()));
    notify("Bobine da asciugare", {
      body: `Hai ${dryCount} bobine da asciugare nell'inventario.`,
    });
  }, [dryCount, notify]);

  return null;
}
