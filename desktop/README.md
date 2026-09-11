# Commune for Mac and Windows

A thin Electron window onto `commune.potarastudio.com`. Nothing of the app is
bundled: the site that serves the browser serves this window. What the shell
adds is what a tab cannot do — a dock and taskbar icon with an unread badge,
system notifications while the window is hidden, a menu bar, a tray on
Windows, a screen-share picker, and a huddle that keeps running when the window
is closed.

## Develop

    pnpm install
    pnpm icons          # once: build/icon.*, tray and badge images from ../public/commune-logo.png
    pnpm dev            # against the web app on http://localhost:3001 (run `pnpm dev` in the repo root first)
    pnpm smoke          # boots the shell and checks sign-in, badge, notifications, screen share, links

`COMMUNE_DEV=1` (set by `pnpm dev`) points the window at the local server,
enables DevTools in the View menu, and uses our own screen-share picker instead
of the macOS one so the flow can be exercised.

## Sign-in

Google will not run inside an embedded browser, and a magic link opens in
whatever handles mail, so sign-in happens in the system browser:

1. The window shows `/login?next=/desktop/handoff`.
2. The Google button (or the emailed link) finishes in the browser, on
   `/desktop/handoff`, which parks the session's refresh token under a random
   id that expires in two minutes and opens `commune://auth?handoff=<id>`.
3. The app claims the id through `/api/desktop/session`, which deletes the row
   and exchanges the token for cookies inside the window. The link works once.

## Build

    pnpm pack           # unpacked app in release/, for a quick local run
    pnpm dist:mac       # signed .dmg and .zip for arm64 and x64
    pnpm dist:win       # NSIS installer for x64 (builds on a Mac too)
    pnpm release        # both, notarized, published to GitHub Releases

Signing picks up the Developer ID certificate in the keychain automatically.
The first signed build on a Mac must be run from Terminal: macOS asks whether
`codesign` may use the key, and a build started from anywhere that cannot show
that prompt fails with `errSecInternalComponent`. Click **Always Allow** once
and later builds run unattended. To skip signing for a local check:

    CSC_IDENTITY_AUTO_DISCOVERY=false pnpm pack

Notarization and publishing need:

| variable | what |
|---|---|
| `APPLE_ID` | the Apple ID that owns the Developer ID |
| `APPLE_APP_SPECIFIC_PASSWORD` | an app-specific password for it (appleid.apple.com) |
| `APPLE_TEAM_ID` | the team id shown on the certificate |
| `GH_TOKEN` | a GitHub token with `repo` scope, for the release upload |
| `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD` | optional: a Windows code-signing certificate; without it SmartScreen shows a warning on first install |

`pnpm release` creates and pushes the `v<version>` tag before building.
GitHub refuses to publish a release whose tag does not exist yet, and
electron-builder only discovers that after every upload has finished, so the
tag has to come first.

Updates: the installed app checks GitHub Releases fifteen seconds after launch
and every six hours, downloads in the background, and installs on quit or when
the person accepts the prompt. Bump `version` in `package.json` before
`pnpm release`; the release is tagged `v<version>`.
