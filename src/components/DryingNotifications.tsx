"use client";

import { useEffect, useRef } from "react";
import { useBrowserNotifications } from "@/lib/useBrowserNotifications";

export default function DryingNotifications({ dryCount }: { dryCount: number }) {
  const { notify } = useBrowserNotifications();
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (dryCount > 0 && !notifiedRef.current) {
      notifiedRef.current = true;
      notify("Bobine da asciugare", {
        body: `Hai ${dryCount} bobine da asciugare nell'inventario.`,
      });
    }
  }, [dryCount, notify]);

  return null;
}
