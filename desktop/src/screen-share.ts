import {
  BrowserWindow,
  screen,
  session,
  shell,
  systemPreferences,
  type DesktopCapturerSource,
  type desktopCapturer as DesktopCapturer,
  type Display,
  type NativeImage,
  type Streams,
} from "electron";
import { PICKER_HTML } from "./picker-page";

/**
 * Screen share needs a picker. In a browser, getDisplayMedia opens the
 * browser's own "share which screen or window?" dialog. Electron has no such
 * dialog; it hands the request to the app and expects a source back.
 *
 * Commune draws its own, on every platform: every screen and every window by
 * name, with live thumbnails, a search, and on Windows a "Share sound"
 * option. Macs used the macOS system picker (`useSystemPicker`) until
 * 2026-09-14, but that only offers "this window" or "the entire screen" and
 * then asks you to point at one, and the team wanted to see what they can
 * share, the way Slack and Zoom show it.
 *
 * The cost is macOS's Screen Recording permission, which the system picker
 * never needed. When it is missing the picker says how to grant it, and that
 * macOS wants Commune reopened afterwards.
 */

const SCREEN_RECORDING_SETTINGS = "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture";
/** How often thumbnails and the window list refresh while the picker is open. */
const REFRESH_MS = 3000;

type PickerItem = { id: string; kind: "screen" | "window"; name: string; detail: string; thumb: string; icon: string };
type PickerState = { items: PickerItem[]; offerSound: boolean; permission: "granted" | "missing" };
type Choice = { source: { id: string; name: string }; sound: boolean };

export function installScreenSharePicker(getParent: () => BrowserWindow | null, capturer: typeof DesktopCapturer) {
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    // Electron can only capture system sound on Windows.
    const offerSound = process.platform === "win32" && request.audioRequested;
    let choice: Choice | null = null;
    try {
      choice = await pick(getParent(), capturer, offerSound);
    } catch (err) {
      console.error("screen share picker", err);
    }
    // Deny with null. An empty object is not a refusal: Electron 44 throws "Video was
    // requested, but no video stream was provided" and the page gets an AbortError
    // instead of the NotAllowedError that means "changed their mind". The native
    // check accepts null ("must be called with null or a valid object"); the
    // TypeScript definition just doesn't say so.
    if (!choice) return callback(null as unknown as Streams);
    callback(choice.sound ? { video: choice.source, audio: "loopback" } : { video: choice.source });
  });
}

function pick(parent: BrowserWindow | null, capturer: typeof DesktopCapturer, offerSound: boolean): Promise<Choice | null> {
  return new Promise((resolve) => {
    const picker = new BrowserWindow({
      parent: parent ?? undefined,
      modal: Boolean(parent),
      width: 820,
      height: 600,
      minWidth: 640,
      minHeight: 440,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      show: false,
      title: "Share your screen",
      backgroundColor: "#121212",
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    picker.setMenu(null);

    // Every id the page has been shown, so a choice maps back to a source even after a refresh.
    const names = new Map<string, string>();
    let settled = false;
    const done = (choice: Choice | null) => {
      if (settled) return;
      settled = true;
      resolve(choice);
      if (!picker.isDestroyed()) picker.close();
    };

    picker.webContents.on("page-title-updated", (event, title) => {
      event.preventDefault();
      if (title === "cancel") return done(null);
      if (title.startsWith("settings:")) {
        void shell.openExternal(SCREEN_RECORDING_SETTINGS);
        return;
      }
      if (title.startsWith("share:")) {
        let asked: { id?: unknown; sound?: unknown } = {};
        try {
          asked = JSON.parse(title.slice("share:".length)) as typeof asked;
        } catch {
          return done(null);
        }
        const id = typeof asked.id === "string" ? asked.id : "";
        const name = names.get(id);
        done(name === undefined ? null : { source: { id, name }, sound: offerSound && asked.sound === true });
      }
    });
    picker.webContents.on("will-navigate", (event) => event.preventDefault());
    picker.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    picker.on("closed", () => done(null));
    picker.once("ready-to-show", () => picker.show());

    const push = async () => {
      const state = await snapshot(capturer, offerSound);
      for (const item of state.items) names.set(item.id, item.name);
      if (settled || picker.isDestroyed()) return;
      await picker.webContents.executeJavaScript(`window.render(${JSON.stringify(state)})`);
    };

    picker.webContents.once("did-finish-load", () => {
      void (async () => {
        try {
          await push();
        } catch (err) {
          console.error("screen share picker: first list", err);
        }
        while (!settled) {
          await new Promise((r) => setTimeout(r, REFRESH_MS));
          if (settled || picker.isDestroyed()) break;
          try {
            await push();
          } catch {
            // The picker can close mid-refresh; the next loop check ends it.
          }
        }
      })();
    });

    void picker.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(PICKER_HTML)}`);
  });
}

async function snapshot(capturer: typeof DesktopCapturer, offerSound: boolean): Promise<PickerState> {
  // Commune's own windows are left out, the picker included: sharing one only
  // mirrors the huddle back at everyone in it.
  const own = new Set(BrowserWindow.getAllWindows().map((w) => w.getMediaSourceId()));
  const sources = await capturer.getSources({
    types: ["screen", "window"],
    thumbnailSize: { width: 400, height: 250 },
    fetchWindowIcons: true,
  });

  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay().id;
  const screens = sources.filter((s) => s.id.startsWith("screen:"));
  const items: PickerItem[] = screens.map((s, i) => ({
    id: s.id,
    kind: "screen",
    ...screenLabel(s, i, screens.length, displays, primary),
    thumb: dataUrl(s.thumbnail, "jpeg"),
    icon: "",
  }));
  for (const s of sources) {
    if (!s.id.startsWith("window:") || own.has(s.id) || !s.name.trim()) continue;
    items.push({
      id: s.id,
      kind: "window",
      name: s.name.trim(),
      detail: "",
      thumb: dataUrl(s.thumbnail, "jpeg"),
      icon: s.appIcon ? dataUrl(s.appIcon, "png") : "",
    });
  }

  const permission = process.platform === "darwin" && systemPreferences.getMediaAccessStatus("screen") !== "granted" ? "missing" : "granted";
  return { items, offerSound, permission };
}

/** "Entire screen" when there is one; otherwise the display's own name, with "Main display" and its size. */
function screenLabel(source: DesktopCapturerSource, index: number, count: number, displays: Display[], primary: number) {
  const display = displays.find((d) => String(d.id) === source.display_id);
  const size = display ? `${display.size.width} × ${display.size.height}` : "";
  if (count === 1) return { name: "Entire screen", detail: size };
  const name = display?.label?.trim() || source.name || `Screen ${index + 1}`;
  return { name, detail: [display?.id === primary ? "Main display" : "", size].filter(Boolean).join(" · ") };
}

function dataUrl(image: NativeImage, format: "jpeg" | "png"): string {
  if (image.isEmpty()) return "";
  return format === "jpeg" ? `data:image/jpeg;base64,${image.toJPEG(80).toString("base64")}` : image.toDataURL();
}
