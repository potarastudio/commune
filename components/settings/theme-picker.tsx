"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

/** Theme (§5 Settings): light, dark or follow the OS. Stored by next-themes in localStorage. */
export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const current = mounted ? (theme ?? "system") : "system";

  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
      {OPTIONS.map((o) => {
        const active = current === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(o.value)}
            className={`flex flex-col items-center gap-2 rounded-lg border p-3 text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
              active ? "border-primary bg-accent text-accent-foreground" : "border-border hover:bg-muted"
            }`}
          >
            <span
              className={`flex h-14 w-full items-end gap-1 rounded-md border p-1.5 ${
                o.value === "dark" ? "border-[#2a2e2c] bg-[#131514]" : o.value === "light" ? "border-[#e4e4df] bg-white" : "border-border bg-gradient-to-r from-white to-[#131514]"
              }`}
              aria-hidden="true"
            >
              <span className={`h-full w-1/3 rounded-sm ${o.value === "light" ? "bg-[#1e2a28]" : "bg-[#0e1514]"}`} />
              <span className={`h-2/3 flex-1 rounded-sm ${o.value === "dark" ? "bg-[#1a1d1c]" : o.value === "light" ? "bg-[#f3f3f0]" : "bg-muted/60"}`} />
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <o.icon className="size-3.5" aria-hidden="true" />
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
