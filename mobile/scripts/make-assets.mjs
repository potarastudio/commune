/**
 * Builds the source art for the app icons and splash screens from the one logo
 * the web app already has, then `pnpm assets` hands it to @capacitor/assets.
 *
 *   assets/icon-only.png         1024  the tile edge to edge: the iOS icon, Android's pre-8.0 icon
 *   assets/icon-foreground.png   1024  the mark alone on transparent: Android's adaptive foreground
 *   assets/icon-background.png   1024  the tile's orange: Android's adaptive background
 *   assets/splash.png            2732  the tile, rounded, centred on #ffffff
 *   assets/splash-dark.png       2732  the same on #171717
 *
 * plus one native file @capacitor/assets does not make:
 *
 *   android/app/src/main/res/drawable-nodpi/splash_icon.png
 *       Android 12 and later draw their own launch screen, an icon on a colour
 *       (windowSplashScreen* in styles.xml). Left alone it scales the launcher
 *       icon up to 160dp and comes out soft, so it gets its own large icon.
 *
 * The logo is a near-black mark on an orange tile drawn edge to edge. Android
 * insets both adaptive layers by 16.7% (see the generated mipmap-anydpi-v26
 * XML), so each layer is drawn at the tile's proportions, like iOS.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const src = path.resolve(root, "../public/commune-logo.png");
const out = path.join(root, "assets");
fs.mkdirSync(out, { recursive: true });

const ICON = 1024;
const SPLASH = 2732;
// The splash canvas is cropped to fill the screen, so the tile's share of the
// canvas is its share of the screen's height: about 100pt on a current iPhone.
const SPLASH_TILE = 320;
// Apple's app icon corner, 22.37% of the side, as the desktop icon uses.
const CORNER = 0.2237;

// Sampled from the logo: the tile and the mark.
const ORANGE = { r: 0xf9, g: 0x5b, b: 0x00 };
const MARK = { r: 0x10, g: 0x10, b: 0x10 };

const tile = await sharp(src).resize(ICON, ICON, { fit: "cover" }).removeAlpha().png().toBuffer();
await sharp(tile).toFile(path.join(out, "icon-only.png"));

// The mark alone: every pixel is a blend of the orange and the mark, so the
// red channel (249 on orange, 16 on the mark) gives its coverage exactly,
// antialiased edges included.
const coverage = await sharp(tile)
  .extractChannel("red")
  .linear(-255 / (ORANGE.r - MARK.r), (255 * ORANGE.r) / (ORANGE.r - MARK.r))
  .toBuffer();
await sharp({ create: { width: ICON, height: ICON, channels: 3, background: MARK } })
  .joinChannel(coverage)
  .png()
  .toFile(path.join(out, "icon-foreground.png"));

await sharp({ create: { width: ICON, height: ICON, channels: 3, background: ORANGE } })
  .png()
  .toFile(path.join(out, "icon-background.png"));

const radius = Math.round(SPLASH_TILE * CORNER);
const roundMask = Buffer.from(
  `<svg width="${SPLASH_TILE}" height="${SPLASH_TILE}"><rect width="${SPLASH_TILE}" height="${SPLASH_TILE}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`,
);
const splashTile = await sharp(tile)
  .resize(SPLASH_TILE, SPLASH_TILE)
  .ensureAlpha()
  .composite([{ input: roundMask, blend: "dest-in" }])
  .png()
  .toBuffer();

for (const [name, background] of [
  ["splash.png", "#ffffff"],
  ["splash-dark.png", "#171717"],
]) {
  const splash = await sharp({ create: { width: SPLASH, height: SPLASH, channels: 3, background } })
    .composite([{ input: splashTile, gravity: "center" }])
    .png()
    .toBuffer();
  // Compositing a transparent tile adds an alpha channel; a splash has no use for one.
  await sharp(splash).removeAlpha().png().toFile(path.join(out, name));
}

console.log("source art written to", out);

// Android's launch icon: a 288dp box (drawn here at 4x) holding the tile as a
// disc, which is how Android shows app icons, at about the size of the tile on
// the iOS launch screen.
const androidRes = path.join(root, "android/app/src/main/res");
if (fs.existsSync(androidRes)) {
  const BOX = 1152;
  const DISC = 448;
  const discSvg = Buffer.from(
    `<svg width="${DISC}" height="${DISC}"><circle cx="${DISC / 2}" cy="${DISC / 2}" r="${DISC / 2}" fill="#f95b00"/></svg>`,
  );
  const mark = await sharp(path.join(out, "icon-foreground.png")).resize(DISC, DISC).png().toBuffer();
  const disc = await sharp(discSvg).composite([{ input: mark }]).png().toBuffer();
  const dir = path.join(androidRes, "drawable-nodpi");
  fs.mkdirSync(dir, { recursive: true });
  await sharp({ create: { width: BOX, height: BOX, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: disc, gravity: "center" }])
    .png()
    .toFile(path.join(dir, "splash_icon.png"));
  console.log("android launch icon written to", dir);
}
