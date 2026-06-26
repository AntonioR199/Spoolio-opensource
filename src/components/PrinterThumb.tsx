"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import { printerImage } from "@/lib/printerPresets";
import { cn } from "@/lib/utils";

// Thumbnail della stampante reale (immagine fornita da noi in /public/printers/).
// Se l'immagine non esiste o la stampante non è un preset noto, mostra l'icona.
export function PrinterThumb({
  brand,
  model,
  size = "md",
  className,
}: {
  brand: string | null;
  model: string | null;
  size?: "sm" | "md";
  className?: string;
}) {
  const src = printerImage(brand, model);
  const [err, setErr] = useState(false);
  const box = size === "sm" ? "h-8 w-8 rounded-lg" : "h-12 w-12 rounded-xl";

  if (src && !err) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={`${brand ?? ""} ${model ?? ""}`.trim() || "Stampante"}
        onError={() => setErr(true)}
        className={cn(box, "shrink-0 border bg-white object-cover", className)}
      />
    );
  }

  return (
    <span
      className={cn(
        box,
        "grid shrink-0 place-items-center bg-gradient-to-br from-violet-500 to-indigo-600 text-white",
        className
      )}
    >
      <Printer className={size === "sm" ? "h-4 w-4" : "h-6 w-6"} />
    </span>
  );
}
