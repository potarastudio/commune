# Commune for iPhone and Android

A thin Capacitor app around `commune.potarastudio.com`. Nothing of the app is
bundled: the site that serves the browser serves this window, exactly as with
the desktop shell in `../desktop`. What the shell adds is what a browser tab
cannot do on a phone — an app icon and launch screen, the `commune://` scheme
for handing sign-in back from the browser, native push once the accounts
exist, the keyboard and status bar handled by the OS, and a switch for the iOS
back swipe.

## Develop

    pnpm install
    pnpm dev:ios        # build, install and launch on an iOS simulator against http://localhost:3001
    pnpm dev:android    # the same on an Android emulator, which reaches the host at http://10.0.2.2:3001

Run `pnpm dev` in the repo root first. Both commands ask which simulator or
emulator to use; skip the question with `--target`, and list the ids with
`pnpm exec cap run ios --list` (or `android`):

    pnpm dev:ios --target 2CFC69F5-1B79-4EBF-9E77-E45F528460D8
    pnpm dev:android --target Pixel_8_API_34     # boots the AVD if it is not running

`COMMUNE_MOBILE_URL` moves the target when the dev server is on another port:
`COMMUNE_MOBILE_URL=http://localhost:3005 pnpm dev:ios`.

What the machine needs: Xcode 26 or later (no CocoaPods — iOS uses Swift
Package Manager, Capacitor 8's default), JDK 21, and the Android SDK with an
emulator image. `ANDROID_HOME` defaults to `~/Library/Android/sdk`. Gradle
downloads the SDK platform it needs (36) on the first build. `pnpm open:android`
needs Android Studio in `/Applications`, or `CAPACITOR_ANDROID_STUDIO_PATH`.

## How it loads the site

`capacitor.config.ts` sets `server.url`, which is read when `cap sync` copies
the config into the native projects. So the URL is fixed per build:

    pnpm sync                                              production
    COMMUNE_MOBILE_URL=http://localhost:3001 pnpm sync     iOS simulator against the dev server
    COMMUNE_MOBILE_URL=http://10.0.2.2:3001 pnpm sync      Android emulator against the dev server

The copied config (`ios/App/App/capacitor.config.json`,
`android/app/src/main/assets/capacitor.config.json`) is generated and
gitignored, so a fresh clone needs `pnpm install && pnpm sync` before Xcode or
Gradle will build. `dev:*` leave the dev URL behind; `open:*` and
`build:android` sync first, so a build from Xcode or Android Studio loads
production unless `COMMUNE_MOBILE_URL` says otherwise.

Plain http is allowed only for a dev server: `server.cleartext` is on only when
the URL starts with `http://`, and on iOS `NSAllowsLocalNetworking` lets the
simulator load `localhost` without opening App Transport Security to anything
else. `www/index.html` is a placeholder Capacitor insists on; it is never
shown. A phone that is offline at launch sees a blank page until it is opened
again. `server.errorPath` is deliberately unset: iOS loads it for any failed
navigation, including cancelled ones and downloads it cannot display, which
would strand people on it.

Links to the app's own host stay in the window. Every other top-level
navigation opens in the system browser — `allowNavigation` holds only the app
host. The app keeps its own cookies, apart from Safari and Chrome, so it never
shares the browser's session, for the reason `../CLAUDE.md` §11 gives for the
desktop app.

## Telling the app apart

Every request carries `CommuneMobile/<version>` at the end of the user agent,
as the desktop app carries `CommuneDesktop/<version>`. The version is
`package.json`'s. On the page, `window.Capacitor.isNativePlatform()` is true and
`Capacitor.getPlatform()` is `"ios"` or `"android"`.

The plugins are on `window.Capacitor.Plugins` without the page bundling
anything: App, Browser, Haptics, Keyboard, PushNotifications, SplashScreen,
StatusBar and SystemBars on both platforms, plus CommuneNav on iOS. Check
before calling one that only exists on one platform:
`Capacitor.isPluginAvailable("CommuneNav")`.

## Safe areas, keyboard and status bar

On iOS the web view runs under the status bar and home indicator
(`contentInset: "never"`), and the page pads itself with
`env(safe-area-inset-*)` under `viewport-fit=cover`. The document itself does
not scroll or bounce (`scrollEnabled: false`); the page scrolls its own
containers. The keyboard shrinks the web view (`Keyboard.resize: "native"`).

Android follows Capacitor 8's SystemBars. With `viewport-fit=cover` and a
system WebView of 140 or later, the page is drawn edge to edge and `env()`
holds the real insets; on an older WebView it is padded below the status bar
instead, `env()` reads 0, and the insets are also set as `--safe-area-inset-*`
CSS variables. A fresh emulator image can show the padded layout until the Play
Store updates its WebView (Pixel_8_API_34 went from 126 to 153 on its first
boot). MainActivity uses `adjustResize`, and
SystemBars pads the web view by the keyboard's height. Leave
`Keyboard.resizeOnFullScreen` unset; SystemBars warns against it.

The page sets the status bar's text colour to suit whatever it draws under it,
through the StatusBar or SystemBars plugin.

Both apps are portrait only, and the iOS app is iPhone only.

## Sign-in and the `commune://` scheme

Google will not run inside an embedded web view, so sign-in happens in the
system browser, as on the desktop, and the browser hands the result back
through `commune://auth?handoff=<id>`. Both apps register the scheme (iOS
`CFBundleURLTypes`, an intent filter on Android's MainActivity) and pass the
link to the page as the App plugin's `appUrlOpen` event. The event is held
until the page listens, including when the link is what launched the app, and
`App.getLaunchUrl()` returns it too. The shell claims nothing itself: the page
claims the handoff, as the desktop's `/api/desktop/session` does.

iOS may ask "Open in “Commune”?" when a browser opens the link. That prompt is
the system's; the app cannot skip it.

## CommuneNav (iOS)

WKWebView's back swipe walks the web view's own history, which in a
single-page app is every route change, and it fights any horizontal gesture
the page runs. So it starts off, and the page turns it on where a swipe back
means what people expect:

    window.Capacitor.Plugins.CommuneNav.setSwipeBackEnabled({ enabled: true })

It resolves once the web view has changed, and rejects without a boolean
`enabled`. The plugin is `ios/App/App/CommuneNavPlugin.swift`. Capacitor 8 does
not find plugins inside the app target, so `MainViewController` (a
`CAPBridgeViewController`) registers it in `capacitorDidLoad()`. `SceneDelegate`
creates that controller, and `Main.storyboard` names it too. Android has no
counterpart: its system back gesture reaches the page as the App plugin's
`backButton` event.

## Icons and launch screen

    pnpm assets

`scripts/make-assets.mjs` builds the source art in `assets/` from
`../public/commune-logo.png`, then `@capacitor/assets` writes the iOS icon and
launch images and Android's icons and splash drawables. The icon is the tile
edge to edge, on the logo's own orange (`#f95b00`). The launch screen is the
tile, rounded, centred on `#ffffff`, and on `#171717` in dark mode.

Android 12 and later draw their own launch screen, an icon on a colour, which
`@capacitor/assets` does not cover. Left alone it enlarges the launcher icon
and comes out soft on the system's grey. So the same script writes
`android/app/src/main/res/drawable-nodpi/splash_icon.png`, and `styles.xml`
sets it on `@color/splash_background` (`values/` and `values-night/`).
Re-running `pnpm assets` reproduces every file byte for byte.

The launch screen shows for 600 ms and then gives way to the page.
`SplashScreen.hide()` ends it sooner.

## What needs the owner's accounts

Nothing below is needed for the simulator or emulator.

| what | for | where |
|---|---|---|
| Apple development team | running on an iPhone; archives | Set: `DEVELOPMENT_TEAM = 7R59U6AY8A` in the Xcode project. Signing is automatic, through the Apple account signed in to Xcode › Settings › Accounts |
| Push on iOS | APNs registration | Already declared: `App/App.entitlements` has `aps-environment` (development; distribution builds get production from their profile). Automatic signing turns Push on for the App ID once a team is set. Sending needs an APNs auth key (.p8) from the Apple Developer account |
| Firebase project | push on Android | Add an Android app `com.potarastudio.commune`, put its `google-services.json` in `android/app/`. The build applies the google-services plugin only when that file exists. Sending goes through FCM with a service account |
| Play Console, App Store Connect | distribution | see below |

Web Push through the service worker does not reach the app's web views, so
inside the app the page registers through the PushNotifications plugin
(`lib/push/client.ts`) and files its token with the server, which sends
through APNs and FCM (`lib/push/native.ts`) once the `APNS_*` and `FCM_*`
variables are set on Vercel. A TestFlight or App Store build talks to APNs
production, so set `APNS_PRODUCTION=true` there.

## Release builds

Bump the version in three places: `package.json` (the user agent), Xcode's
`MARKETING_VERSION`, and `versionName` and `versionCode` in
`android/app/build.gradle`.

iOS goes to TestFlight in one command:

    pnpm testflight

It syncs production, archives a Release build whose build number is the UTC
minute (so every upload is new), and uploads it with the options in
`ios/ExportOptions.plist`. Automatic signing makes or reuses the Apple
Distribution certificate and App Store profile. The app record has to exist
in App Store Connect first (bundle ID `com.potarastudio.commune`), or the
upload stops at "Error Downloading App Information". Archives and logs land
in `build/testflight/<build>/`. Apple then processes the build, usually within
half an hour, and it appears under TestFlight.

Android needs an upload key, kept out of the repo (`.gitignore` refuses
`*.jks` and `*.keystore`):

    keytool -genkey -v -keystore ~/commune-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
    pnpm sync
    pnpm exec cap build android --androidreleasetype AAB \
      --keystorepath ~/commune-upload.jks --keystorealias upload \
      --keystorepass <password> --keystorealiaspass <password>

Upload the `.aab` to the Play Console's internal testing track first.
`pnpm build:android` is the debug APK (`android/app/build/outputs/apk/debug/`),
for sideloading onto a test phone.

## Upgrading Capacitor

    pnpm up "@capacitor/*"
    pnpm sync

`sync` rewrites `ios/App/CapApp-SPM/Package.swift` and
`android/capacitor.settings.gradle`, which point into pnpm's store by version.
Commit them with the lockfile. Major versions have `pnpm exec cap migrate`.
Keep `typescript` on 5. The CLI loads `capacitor.config.ts` through
TypeScript 5's transpiler; with TypeScript 7 it falls back to Node's own
loader, where the config's `import pkg from "./package.json"` would need
`with { type: "json" }`.
