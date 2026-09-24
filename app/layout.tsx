import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { headers } from "next/headers";
import { isPhoneUserAgent } from "@/lib/mobile";
import { NativeBridge } from "@/components/mobile/native-bridge";
import { Providers } from "@/components/providers";
import "./globals.css";

/**
 * The design's font stack: Inter for UI, JetBrains Mono for code, both loaded
 * as variable faces and exposed as the CSS variables globals.css maps onto
 * --font-sans / --font-mono. The 14px base and the "cv11","ss01","calt"
 * feature settings live in globals.css, so nothing here restates them.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  fallback: ["ui-monospace", "SF Mono", "Menlo", "monospace"],
});

export const metadata: Metadata = {
  title: { default: "Commune", template: "%s · Commune" },
  description: "Potara Studio's team chat.",
};

/**
 * theme-color is deliberately absent here. The theme is a class the reader picks
 * in Settings, not the OS preference, so a prefers-color-scheme-keyed meta tag
 * would wrap a forced-light app in dark chrome — and its two hexes would have to
 * be hand-synced with --bg-main forever. Providers writes the tag from the
 * resolved token instead. next-themes writes `color-scheme` onto <html> itself.
 */
export async function generateViewport(): Promise<Viewport> {
  const phone = isPhoneUserAgent((await headers()).get("user-agent"));
  return {
    width: "device-width",
    initialScale: 1,
    // The phone shell draws under the notch and home indicator and pads itself
    // with env(safe-area-inset-*); the keyboard resizes the page rather than
    // covering the composer.
    viewportFit: "cover",
    interactiveWidget: "resizes-content",
    // iOS zooms into any field under 16px when it is focused, and never zooms
    // back out. The design sets the composer at 14.5px, so the zoom is capped
    // at 1 on phones; iOS still lets people pinch-zoom the page themselves.
    ...(phone ? { maximumScale: 1 } : {}),
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-dvh bg-bg-main text-ink">
        <Providers>
          {/* The phone app's links, notification taps, keyboard and status bar; nothing in a browser. */}
          <NativeBridge />
          {children}
        </Providers>
      </body>
    </html>
  );
}
