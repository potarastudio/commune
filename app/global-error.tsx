"use client";

import { useEffect } from "react";

/**
 * The last boundary. It catches what (app)/error.tsx cannot: a throw from the
 * root layout or from Providers, and a failed chunk load during hydration.
 * Without it those render Next's stock "Application error: a client-side
 * exception has occurred", which names the host and tells the reader to open
 * the browser console.
 *
 * Next replaces the root layout with this file, so there is no Providers, no
 * font variables and no globals.css to lean on. Everything here is inlined,
 * including both themes, because the class next-themes writes onto <html> is
 * gone too and prefers-color-scheme is all that is left.
 *
 * The action is a hard reload rather than reset(): the common cause is a tab
 * that outlived a deploy and is asking for chunks the new build no longer has,
 * and re-rendering the same broken tree cannot fix that.
 */
const CSS = `
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  .ge-body {
    margin: 0; min-height: 100dvh; display: grid; place-items: center; padding: 24px;
    background: #ffffff; color: #171717; text-align: center;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    font-size: 14px; line-height: normal;
  }
  .ge-tile {
    display: grid; place-items: center; width: 40px; height: 40px; margin: 0 auto;
    border: 1px solid #ebebeb; border-radius: 11px; background: #f6f6f6; color: #666666;
  }
  .ge-title { margin: 12px 0 0; font-size: 15.5px; font-weight: 600; letter-spacing: -0.015em; }
  .ge-body-text { margin: 5px auto 0; max-width: 400px; font-size: 13px; line-height: 1.55; color: #666666; text-wrap: pretty; }
  .ge-button {
    margin-top: 12px; height: 32px; padding: 0 13px; border-radius: 8px; cursor: pointer;
    border: 1px solid #d9490a; background: #f05710; color: #ffffff;
    font: inherit; font-size: 13px; font-weight: 600;
  }
  .ge-button:hover { background: #d9490a; }
  .ge-button:focus-visible { outline: 2px solid #f05710; outline-offset: 2px; }
  @media (prefers-color-scheme: dark) {
    .ge-body { background: #171717; color: #ededed; }
    .ge-tile { border-color: #262626; background: #1f1f1f; color: #9d9d9d; }
    .ge-body-text { color: #9d9d9d; }
  }
`;

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error("[commune] failed to start", { digest: error.digest, error });
  }, [error]);

  return (
    <html lang="en">
      <body className="ge-body">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <main>
          <span className="ge-tile" aria-hidden="true">
            {/* lucide "rotate-ccw", inlined so this page pulls in nothing. */}
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </span>
          <h1 className="ge-title">Commune didn&rsquo;t finish loading</h1>
          <p className="ge-body-text">
            This usually means the app updated while your tab was open. Reloading picks up the new version. Nothing
            you have written is lost.
          </p>
          <button type="button" className="ge-button" onClick={() => window.location.reload()}>
            Reload Commune
          </button>
        </main>
      </body>
    </html>
  );
}
