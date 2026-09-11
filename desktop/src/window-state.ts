import { app, screen, type BrowserWindow } from "electron";
import fs from "node:fs";
import path from "node:path";

/**
 * Remember where the window was. The design fixes the layout at 1440×900,
 * so that is the first-launch size; after that the app opens where it was
 * left, as long as that place is still on a connected display.
 */
type State = { x?: number; y?: number; width: number; height: number; maximized?: boolean };

const FILE = () => path.join(app.getPath("userData"), "window-state.json");
const DEFAULT: State = { width: 1440, height: 900 };

export function restoreWindowState(): State {
  try {
    const saved = JSON.parse(fs.readFileSync(FILE(), "utf8")) as State;
    if (typeof saved.width !== "number" || typeof saved.height !== "number") return DEFAULT;
    if (saved.x !== undefined && saved.y !== undefined) {
      const onScreen = screen.getAllDisplays().some((d) => {
        const { x, y, width, height } = d.workArea;
        return saved.x! >= x - 50 && saved.y! >= y - 50 && saved.x! < x + width && saved.y! < y + height;
      });
      if (!onScreen) {
        delete saved.x;
        delete saved.y;
      }
    }
    return { ...DEFAULT, ...saved };
  } catch {
    return DEFAULT;
  }
}

export function trackWindowState(win: BrowserWindow) {
  let timer: NodeJS.Timeout | undefined;
  const save = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (win.isDestroyed()) return;
      const maximized = win.isMaximized();
      const bounds = maximized ? win.getNormalBounds() : win.getBounds();
      const state: State = { ...bounds, maximized };
      try {
        fs.mkdirSync(path.dirname(FILE()), { recursive: true });
        fs.writeFileSync(FILE(), JSON.stringify(state));
      } catch {
        // Not worth surfacing: the next launch simply opens at the default size.
      }
    }, 250);
  };
  win.on("resize", save);
  win.on("move", save);
  win.on("maximize", save);
  win.on("unmaximize", save);
  if (restoreWindowState().maximized) win.maximize();
}
