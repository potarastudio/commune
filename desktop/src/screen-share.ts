import { BrowserWindow, session, type DesktopCapturerSource, type desktopCapturer as DesktopCapturer } from "electron";
import { IS_DEV } from "./config";

/**
 * Screen share needs a picker. In a browser, getDisplayMedia opens the OS's
 * "share which screen or window?" dialog. Electron has no such dialog; it
 * hands the request to the app and expects a source back. Without a handler
 * the huddle's share button silently fails.
 *
 * This opens a small window listing every screen and window with a live
 * thumbnail, in the same dark surface as the huddle stage, and resolves the
 * request with whatever is clicked. Closing it cancels, which LiveKit reports
 * as the user changing their mind, exactly as a browser would.
 */
export function installScreenSharePicker(getParent: () => BrowserWindow | null, capturer: typeof DesktopCapturer) {
  // macOS 15 has a native picker that also avoids the monthly screen-recording
  // nag; when it is available Electron uses it and never calls this handler.
  // Dev forces our own picker so the flow can be exercised end to end.
  const useSystemPicker = process.platform === "darwin" && !IS_DEV;
  session.defaultSession.setDisplayMediaRequestHandler(
    async (_request, callback) => {
      const sources = await capturer.getSources({
        types: ["screen", "window"],
        thumbnailSize: { width: 320, height: 200 },
        fetchWindowIcons: true,
      });
      const chosen = await pick(getParent(), sources);
      if (!chosen) return callback({});
      callback(process.platform === "win32" ? { video: chosen, audio: "loopback" } : { video: chosen });
    },
    { useSystemPicker },
  );
}

function pick(parent: BrowserWindow | null, sources: DesktopCapturerSource[]): Promise<DesktopCapturerSource | null> {
  return new Promise((resolve) => {
    const picker = new BrowserWindow({
      parent: parent ?? undefined,
      modal: Boolean(parent),
      width: 720,
      height: 520,
      resizable: false,
      minimizable: false,
      maximizable: false,
      title: "Share your screen",
      backgroundColor: "#171717",
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    picker.setMenu(null);

    let settled = false;
    const done = (s: DesktopCapturerSource | null) => {
      if (settled) return;
      settled = true;
      resolve(s);
      if (!picker.isDestroyed()) picker.close();
    };

    // The page posts the chosen id through the title; no preload needed for a one-shot picker.
    picker.webContents.on("page-title-updated", (event, title) => {
      event.preventDefault();
      if (title.startsWith("pick:")) done(sources.find((s) => s.id === title.slice(5)) ?? null);
      if (title === "cancel") done(null);
    });
    picker.on("closed", () => done(null));

    const items = sources
      .map((s) => {
        const thumb = s.thumbnail.toDataURL();
        const icon = s.appIcon && !s.appIcon.isEmpty() ? s.appIcon.toDataURL() : "";
        const kind = s.id.startsWith("screen:") ? "Screen" : "Window";
        return `<button type="button" data-id="${escape(s.id)}" title="${escape(s.name)}">
          <span class="thumb"><img src="${thumb}" alt=""></span>
          <span class="meta">${icon ? `<img class="icon" src="${icon}" alt="">` : ""}<span class="name">${escape(s.name)}</span><span class="kind">${kind}</span></span>
        </button>`;
      })
      .join("");

    picker.loadURL(
      "data:text/html;charset=utf-8," +
        encodeURIComponent(`<!doctype html><html><head><meta charset="utf-8"><title>Share your screen</title>
<style>
  :root{color-scheme:dark}
  body{margin:0;background:#171717;color:#ededed;font:13px/1.4 ui-sans-serif,system-ui,sans-serif;-webkit-user-select:none}
  header{display:flex;align-items:center;justify-content:space-between;height:52px;padding:0 20px;border-bottom:1px solid #262626}
  h1{margin:0;font-size:15.5px;font-weight:600;letter-spacing:-.015em}
  .cancel{height:30px;padding:0 11px;border-radius:8px;border:1px solid #333;background:#1f1f1f;color:#ededed;font:inherit;font-weight:600;cursor:pointer}
  .cancel:hover{background:#262626}
  main{padding:16px 20px 20px;height:calc(100vh - 52px);overflow:auto;box-sizing:border-box}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
  button.src{display:flex;flex-direction:column;gap:8px;padding:8px;border-radius:10px;border:1px solid #262626;background:#1f1f1f;color:inherit;font:inherit;text-align:left;cursor:pointer}
  button.src:hover,button.src:focus-visible{border-color:#f05710;outline:none;box-shadow:0 0 0 3px rgba(240,87,16,.25)}
  .thumb{display:block;aspect-ratio:16/10;border-radius:6px;overflow:hidden;background:#0f0f0f}
  .thumb img{display:block;width:100%;height:100%;object-fit:contain}
  .meta{display:flex;align-items:center;gap:6px;min-width:0}
  .icon{width:14px;height:14px;flex:none}
  .name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .kind{flex:none;font-size:11px;color:#9d9d9d}
  .empty{color:#9d9d9d;padding:40px 0;text-align:center}
</style></head><body>
<header><h1>Share your screen</h1><button class="cancel" type="button" onclick="document.title='cancel'">Cancel</button></header>
<main>${sources.length ? `<div class="grid">${items.replace(/<button type="button"/g, '<button class="src" type="button"')}</div>` : `<p class="empty">Nothing to share. Grant Screen Recording permission in System Settings, then try again.</p>`}</main>
<script>
  document.querySelectorAll('button.src').forEach(b => b.addEventListener('click', () => { document.title = 'pick:' + b.dataset.id; }));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') document.title = 'cancel'; });
</script></body></html>`),
    );
  });
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}
