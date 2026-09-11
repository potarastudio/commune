import { app, dialog, type BrowserWindow, type MessageBoxOptions } from "electron";
import { autoUpdater } from "electron-updater";

/**
 * Updates come from the GitHub Releases of potarastudio/commune, which
 * electron-builder publishes to. The check runs shortly after launch and
 * every six hours after that; a downloaded update installs on quit, or now
 * if the person says so. Nothing interrupts a huddle: the prompt is a
 * dialog they can dismiss.
 *
 * Runs only in a packaged build. From source there is nothing to update.
 */
const SIX_HOURS = 6 * 60 * 60 * 1000;

let getWindow: () => BrowserWindow | null = () => null;
let ready = false;

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.logger = null;

/** A message box attached to the window when there is one. */
function box(options: MessageBoxOptions) {
  const win = getWindow();
  return win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options);
}

autoUpdater.on("update-downloaded", (info) => {
  ready = true;
  void box({
    type: "info",
    title: "Update ready",
    message: `Commune ${info.version} is ready to install.`,
    detail: "It will install the next time you quit. Restart now to use it straight away.",
    buttons: ["Restart now", "Later"],
    defaultId: 1,
    cancelId: 1,
  }).then(({ response }) => {
    if (response === 0) autoUpdater.quitAndInstall();
  });
});

autoUpdater.on("error", (err) => {
  // A failed check is not the user's problem; the next one may succeed.
  console.error("updater", err?.message ?? err);
});

export const installUpdater = {
  start(windowGetter: () => BrowserWindow | null) {
    getWindow = windowGetter;
    if (!app.isPackaged) return;
    setTimeout(() => void autoUpdater.checkForUpdates().catch(() => {}), 15_000);
    setInterval(() => void autoUpdater.checkForUpdates().catch(() => {}), SIX_HOURS);
  },

  /** The menu item. Says something either way, unlike the silent background check. */
  checkNow() {
    if (!app.isPackaged) {
      void box({ type: "info", message: "Updates only apply to the installed app." });
      return;
    }
    if (ready) {
      autoUpdater.quitAndInstall();
      return;
    }
    autoUpdater
      .checkForUpdates()
      .then((r) => {
        const latest = r?.updateInfo.version;
        if (!latest || latest === app.getVersion()) {
          void box({ type: "info", message: `Commune ${app.getVersion()} is up to date.` });
        }
        // Otherwise the download is already under way and update-downloaded will prompt.
      })
      .catch((err: Error) => {
        void box({ type: "warning", message: "Couldn't check for updates.", detail: err.message });
      });
  },
};
