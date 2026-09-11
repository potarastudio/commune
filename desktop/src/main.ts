import {
  app,
  BrowserWindow,
  desktopCapturer,
  ipcMain,
  Menu,
  nativeImage,
  nativeTheme,
  Notification,
  session,
  shell,
  Tray,
  type MenuItemConstructorOptions,
} from "electron";
import path from "node:path";
import { ALLOWED_ORIGINS, APP_ORIGIN, HANDOFF_PATH, IS_DEV, LOGIN_PATH, PROTOCOL, resourcePath, VERSION } from "./config";
import { installScreenSharePicker } from "./screen-share";
import { installUpdater } from "./updater";
import { restoreWindowState, trackWindowState } from "./window-state";

/**
 * Commune for the desktop: one window onto commune.potarastudio.com, plus the
 * things a browser tab cannot do: a dock and taskbar presence with an unread
 * badge, system notifications while hidden, a menu bar, a tray on Windows,
 * and a huddle that keeps running when you close the window.
 *
 * Everything the app does happens on the site. This process only frames it.
 */

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
/** True once the user has chosen Quit; closing the window otherwise only hides it. */
let quitting = false;

// A separate profile for a dev or test run, so it never shares cookies or
// window state with the installed app. Must be set before the instance lock,
// which lives inside it.
if (IS_DEV && process.env.COMMUNE_USER_DATA) app.setPath("userData", process.env.COMMUNE_USER_DATA);

// ---- Single instance and the commune:// scheme --------------------------------

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  // A second launch, or a commune:// link on Windows while running, lands here.
  app.on("second-instance", (_event, argv) => {
    const link = argv.find((a) => a.startsWith(`${PROTOCOL}://`));
    if (link) void handleDeepLink(link);
    focusWindow();
  });
}

// Only the installed app claims commune:// links. A run from source (`pnpm
// dev`, `pnpm smoke`) is the bare Electron runtime, and on macOS registering
// from it makes that runtime the handler for every commune:// link on the
// machine: the browser's "Open Commune" then launches an empty Electron
// window instead of the installed app. Dev runs never need the registration;
// the smoke test delivers deep links with app.emit("open-url").
if (app.isPackaged) app.setAsDefaultProtocolClient(PROTOCOL);

// macOS delivers deep links here, on first launch and thereafter.
app.on("open-url", (event, url) => {
  event.preventDefault();
  void handleDeepLink(url);
  focusWindow();
});

// ---- Helpers -----------------------------------------------------------------

function focusWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function isAllowedUrl(raw: string): boolean {
  try {
    return ALLOWED_ORIGINS.has(new URL(raw).origin);
  } catch {
    return false;
  }
}

/** Send sign-in to the system browser; the handoff route brings the session back. */
function openSignIn() {
  void shell.openExternal(`${APP_ORIGIN}${LOGIN_PATH}`);
}

/** Resolves once the window is showing a page on the app's origin. */
function whenOnSite(): Promise<void> {
  return new Promise((resolve) => {
    const wc = win?.webContents;
    if (!wc) return resolve();
    if (!wc.isLoading() && isAllowedUrl(wc.getURL())) return resolve();
    const done = () => {
      if (isAllowedUrl(wc.getURL())) {
        wc.off("did-finish-load", done);
        resolve();
      }
    };
    wc.on("did-finish-load", done);
  });
}

/**
 * commune://auth?handoff=<id>. Claim it from inside the window's own session so
 * the cookies land where the site will read them, then load the app. The id is
 * single-use and expires in two minutes; see app/desktop/handoff/route.ts.
 */
async function handleDeepLink(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return;
  }
  if (url.protocol !== `${PROTOCOL}:` || url.hostname !== "auth") return;
  const handoff = url.searchParams.get("handoff");
  if (!handoff || !win) return;

  await whenOnSite();
  const ok = await win.webContents
    .executeJavaScript(
      `fetch(${JSON.stringify(`${APP_ORIGIN}/api/desktop/session`)}, {
         method: "POST", credentials: "include",
         headers: { "content-type": "application/json" },
         body: ${JSON.stringify(JSON.stringify({ handoff }))}
       }).then((r) => r.ok).catch(() => false)`,
      true,
    )
    .catch(() => false);

  await win.loadURL(ok ? `${APP_ORIGIN}/` : `${APP_ORIGIN}/login?error=link`);
}

// ---- Unread badge --------------------------------------------------------------

/** Pre-rendered badge images for Windows, where there is no dock count. */
function badgeImage(count: number) {
  const name = count > 9 ? "9plus" : String(count);
  return nativeImage.createFromPath(resourcePath(path.join("badges", `${name}.png`)));
}

function applyBadge(count: number) {
  if (process.platform === "win32") {
    win?.setOverlayIcon(count > 0 ? badgeImage(count) : null, count > 0 ? `${count} unread` : "");
  } else {
    app.setBadgeCount(count);
  }
  tray?.setToolTip(count > 0 ? `Commune — ${count} unread` : "Commune");
}

// ---- Window ------------------------------------------------------------------

function createWindow() {
  const state = restoreWindowState();
  win = new BrowserWindow({
    ...state,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: "Commune",
    // Painted before the page: the app's own ground, so there is no flash of the wrong theme.
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#171717" : "#ffffff",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      additionalArguments: [`--commune-version=${VERSION}`],
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });
  trackWindowState(win);

  win.once("ready-to-show", () => win?.show());

  // Links that leave the site open in the browser; the window stays on Commune.
  // Redirects count too: the Google button is a form post whose response is a
  // redirect to accounts.google.com, and Google refuses to sign in inside an
  // embedded browser, so that hop must leave the window as well.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedUrl(url)) return { action: "allow" };
    void shell.openExternal(url);
    return { action: "deny" };
  });
  const leaveForExternal = (event: { preventDefault: () => void }, url: string) => {
    if (isAllowedUrl(url)) return;
    event.preventDefault();
    void shell.openExternal(url);
  };
  win.webContents.on("will-navigate", leaveForExternal);
  win.webContents.on("will-redirect", leaveForExternal);

  // The site sends signed-out visitors to /login. That page works in the
  // window, but its sign-in must finish on the handoff route rather than in
  // the browser tab it will open, so the `next` it carries is rewritten. The
  // page shows as normal; only where it lands afterwards changes.
  win.webContents.on("did-navigate", (_event, raw) => {
    if (!isAllowedUrl(raw)) return;
    const url = new URL(raw);
    if (url.pathname !== "/login" || url.searchParams.get("next") === HANDOFF_PATH) return;
    url.searchParams.set("next", HANDOFF_PATH);
    void win?.loadURL(url.toString());
  });

  // The unread count already lives in the page title as "(3) Commune".
  win.webContents.on("page-title-updated", (event, title) => {
    event.preventDefault();
    const m = /^\((\d+)(\+?)\)/.exec(title);
    const count = m ? (m[2] ? 99 : Number.parseInt(m[1], 10)) : 0;
    applyBadge(count);
    if (process.platform !== "darwin") win?.setTitle(count > 0 ? `(${count}) Commune` : "Commune");
  });

  win.on("focus", () => win?.flashFrame(false));

  // Closing the window keeps the app, and any huddle, alive in the dock or
  // tray until the user actually quits: the behaviour every chat app has.
  win.on("close", (event) => {
    if (quitting) return;
    event.preventDefault();
    win?.hide();
  });
  win.on("closed", () => {
    win = null;
  });

  void win.loadURL(`${APP_ORIGIN}/`);
}

/** Windows and Linux have no dock; the tray is how a hidden app is reached. */
function createTray() {
  if (process.platform === "darwin") return;
  tray = new Tray(nativeImage.createFromPath(resourcePath("tray.png")));
  tray.setToolTip("Commune");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open Commune", click: focusWindow },
      { type: "separator" },
      {
        label: "Quit Commune",
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on("click", focusWindow);
}

function buildMenu() {
  const isMac = process.platform === "darwin";
  const checkForUpdates: MenuItemConstructorOptions = { label: "Check for Updates…", click: () => installUpdater.checkNow() };
  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" as const },
              { type: "separator" as const },
              checkForUpdates,
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          },
        ]
      : []),
    {
      label: "File",
      submenu: [{ label: "Sign In…", click: openSignIn }, { type: "separator" }, isMac ? { role: "close" } : { role: "quit" }],
    },
    { label: "Edit", role: "editMenu" },
    {
      label: "View",
      submenu: [
        { label: "Reload", accelerator: "CmdOrCtrl+R", click: () => win?.webContents.reload() },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
        ...(IS_DEV ? [{ type: "separator" as const }, { role: "toggleDevTools" as const }] : []),
      ],
    },
    { label: "Window", role: "windowMenu" },
    {
      role: "help",
      submenu: [{ label: "Open in Browser", click: () => void shell.openExternal(APP_ORIGIN) }, ...(isMac ? [] : [checkForUpdates])],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---- IPC the preload exposes ------------------------------------------------

ipcMain.handle("desktop:sign-in", () => openSignIn());

ipcMain.handle("desktop:notify", (_event, payload: { title: string; body: string; url: string; tag?: string }) => {
  if (!Notification.isSupported()) return false;
  // A focused window already shows the in-app toast, the way the service worker defers to a focused tab.
  if (win?.isFocused()) return false;
  // Silent: the page plays the chosen tone itself, and it keeps running while hidden.
  const n = new Notification({ title: payload.title, body: payload.body, silent: true });
  n.on("click", () => {
    focusWindow();
    if (payload.url) win?.webContents.send("desktop:navigate", payload.url);
  });
  n.show();
  if (process.platform === "win32") win?.flashFrame(true);
  return true;
});

// ---- Lifecycle ---------------------------------------------------------------

const GRANTED = new Set(["media", "notifications", "display-capture", "clipboard-sanitized-write", "fullscreen"]);

app.whenReady().then(() => {
  // Microphone, camera and screen are what a huddle needs; deny everything else silently.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback, details) => {
    const origin = "requestingUrl" in details && details.requestingUrl ? new URL(details.requestingUrl).origin : "";
    callback(ALLOWED_ORIGINS.has(origin) && GRANTED.has(permission));
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission, requestingOrigin) => {
    // Arrives as a serialised origin with a trailing slash; normalise before comparing.
    let origin = "";
    try {
      origin = new URL(requestingOrigin).origin;
    } catch {
      return false;
    }
    return ALLOWED_ORIGINS.has(origin) && GRANTED.has(permission);
  });

  // Identify the shell to the site. On the session, so it applies to every
  // request including the very first navigation.
  session.defaultSession.setUserAgent(`${session.defaultSession.getUserAgent()} CommuneDesktop/${VERSION}`);

  installScreenSharePicker(() => win, desktopCapturer);
  buildMenu();
  createTray();
  createWindow();
  installUpdater.start(() => win);

  // Windows passes a commune:// link on the command line of the first launch.
  const link = process.argv.find((a) => a.startsWith(`${PROTOCOL}://`));
  if (link) void handleDeepLink(link);

  app.on("activate", () => {
    if (win) focusWindow();
    else createWindow();
  });
});

app.on("before-quit", () => {
  quitting = true;
});

app.on("window-all-closed", () => {
  // Never fires while the close handler hides instead of closing; kept so a
  // destroyed window (a crash) on Windows or Linux does not leave a ghost process.
  if (process.platform !== "darwin") app.quit();
});
