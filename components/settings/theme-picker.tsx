"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

/**
 * Theme (§5 Settings): light, dark or follow the OS. Stored by next-themes in
 * localStorage. Each card carries a miniature of the shell — rail, channel
 * column, three lines of message — so the choice is shown, not described. Those
 * miniatures are the one place literal hexes belong: a light preview has to
 * stay light while you are looking at it in dark mode.
 */
const OPTIONS = [
  {
    value: "light",
    label: "Light",
    frame: "border-border bg-white",
    rail: "bg-[#101010]",
    column: "bg-[#fafafa] border-r border-[#e2e2e2]",
    line: "bg-[#e2e2e2]",
  },
  {
    value: "dark",
    label: "Dark",
    frame: "border-border bg-[#171717]",
    rail: "bg-[#0a0a0a]",
    column: "bg-[#0f0f0f] border-r border-[#2e2e2e]",
    line: "bg-[#2e2e2e]",
  },
  {
    value: "system",
    label: "Match system",
    frame: "border-border bg-gradient-to-r from-white from-50% to-[#171717] to-50%",
    rail: "bg-[#101010]",
    column: "bg-[#fafafa] border-r border-[#c8c8c8]",
    line: "bg-[#c8c8c8]",
  },
] as const;

export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const current = mounted ? (theme ?? "system") : "system";

  return (
    <div role="radiogroup" aria-label="Theme" className="flex flex-wrap gap-[9px]">
      {OPTIONS.map((o) => {
        const active = current === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(o.value)}
            className={`flex min-w-0 flex-1 flex-col gap-[9px] rounded-[11px] border p-[11px] text-left transition-colors ${
              active
                ? "border-primary bg-accent-surface"
                : "border-border-strong bg-bg-card hover:border-border-hover hover:bg-bg-card-hover"
            }`}
          >
            <span className={`block overflow-hidden rounded-[7px] border ${o.frame}`} aria-hidden="true">
              <span className="flex h-[52px]">
                <span className={`block w-[14px] ${o.rail}`} />
                <span className={`block w-[26px] ${o.column}`} />
                <span className="flex min-w-0 flex-1 flex-col gap-1 px-[6px] py-[7px]">
                  <span className={`block h-1 w-[60%] rounded-full ${o.line}`} />
                  <span className={`block h-1 w-[85%] rounded-full ${o.line}`} />
                  <span className="block h-1 w-[44%] rounded-full bg-primary" />
                </span>
              </span>
            </span>
            <span className="flex items-center gap-[7px]">
              <span
                aria-hidden="true"
                className={`grid size-[16px] shrink-0 place-items-center rounded-full border-[1.5px] bg-bg-card ${
                  active ? "border-primary" : "border-border-input"
                }`}
              >
                <span className={`block size-[9px] rounded-full ${active ? "bg-primary" : "bg-transparent"}`} />
              </span>
              <span className="text-[13px] font-semibold text-ink">{o.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
