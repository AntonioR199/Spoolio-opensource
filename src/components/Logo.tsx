"use client";

import { useState } from "react";
import { Boxes } from "lucide-react";
import { cn } from "@/lib/utils";

// Logo Spoolio (/public/spoolio-logo.png). Se manca, fallback all'icona.
export function Logo({ className }: { className?: string }) {
  const [err, setErr] = useState(false);
  if (!err) {
    return (
      <span className={cn("overflow-hidden rounded-xl flex items-center justify-center", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/spoolio-logo.png"
          alt="Spoolio"
          onError={() => setErr(true)}
          className="w-full h-full object-contain scale-[1.35]"
        />
      </span>
    );
  }
  return (
    <span
      className={cn(
        "grid place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white",
        className
      )}
    >
      <Boxes className="h-1/2 w-1/2" />
    </span>
  );
}
