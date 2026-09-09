"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * theme-color paints the browser/OS chrome around the app. It can't be a static
 * meta tag: the theme is a class the reader picks in Settings, so a tag keyed to
 * prefers-color-scheme wraps a forced-light app in dark chrome (and vice versa).
 * Reading the resolved --bg-main instead means there is no hex to hand-sync with
 * globals.css either — the token is the single source of truth, as everywhere else.
 */
function ThemeColorMeta() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const color = getComputedStyle(document.documentElement).getPropertyValue("--bg-main").trim();
    if (!color) return;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = color;
  }, [resolvedTheme]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  // One QueryClient per browser session; created lazily so SSR never shares state.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  );

  return (
    /* enableColorScheme (the default, stated here on purpose) writes `color-scheme`
       onto <html>, so native scrollbars and controls follow the chosen theme. */
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      enableColorScheme
      disableTransitionOnChange
    >
      <ThemeColorMeta />
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={300}>
          {children}
          {/* Toasts are top-centre cards on --bg-card with a hairline, per the design;
              richColors is off because it would fill them green/red and red is a text
              colour in this system, not a surface. The design lands them at top:108px —
              clear of the 56px view header and the 40px bookmarks bar — so the offset
              has to travel with the position or the card covers the channel name. */}
          <Toaster position="top-center" closeButton offset={{ top: 108 }} mobileOffset={{ top: 108 }} />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
