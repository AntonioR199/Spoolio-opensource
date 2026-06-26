"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

type Theme = "light" | "dark" | "system";
const KEY = "fs-theme";

export function applyTheme(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

const OPTIONS: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Chiaro", icon: Sun },
  { value: "dark", label: "Scuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
];

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    setTheme((localStorage.getItem(KEY) as Theme) ?? "system");
  }, []);

  function choose(t: Theme) {
    setTheme(t);
    localStorage.setItem(KEY, t);
    applyTheme(t);
  }

  return (
    <div className="inline-flex rounded-lg border p-1">
      {OPTIONS.map((o) => {
        const Icon = o.icon;
        return (
          <Button
            key={o.value}
            size="sm"
            variant={theme === o.value ? "secondary" : "ghost"}
            onClick={() => choose(o.value)}
          >
            <Icon className="h-4 w-4" /> {o.label}
          </Button>
        );
      })}
    </div>
  );
}
