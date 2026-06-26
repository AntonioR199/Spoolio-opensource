"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Combobox a testo libero: mostra TUTTE le opzioni esistenti (anche con un
// valore predefinito) e permette di digitare un valore nuovo, che resta tale.
export function Combobox({
  value,
  onChange,
  options,
  placeholder,
  id,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  id?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const q = value.trim().toLowerCase();
  const exact = options.some((o) => o.toLowerCase() === q);
  // Tutte le opzioni quando il campo è vuoto o contiene un valore già completo;
  // filtra mentre l'utente sta digitando un valore parziale.
  const list = q === "" || exact ? options : options.filter((o) => o.toLowerCase().includes(q));

  return (
    <div ref={ref} className={cn("relative", className)}>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        className="pr-8"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Mostra opzioni"
        onClick={() => setOpen((o) => !o)}
        className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground"
      >
        <ChevronDown className="h-4 w-4" />
      </button>

      {open && list.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-md">
          {list.map((o) => (
            <button
              key={o}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(o);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                o.toLowerCase() === q && "bg-accent/60"
              )}
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
