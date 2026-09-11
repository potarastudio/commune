/**
 * Builds every image the shell ships, from the one logo the web app already has.
 *   pnpm icons
 *
 *   build/icon.png          1024 square, the .ico source and the Linux icon
 *   build/icon.icns         macOS, rounded per Apple's template (needs iconutil)
 *   build/icon.ico          Windows, seven sizes in one file
 *   build/tray.png, @2x     16 and 32, the Windows and Linux tray
 *   build/badges/N.png      1–9 and 9plus, the Windows taskbar overlay
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const src = path.resolve(root, "../public/commune-logo.png");
const build = path.join(root, "build");
fs.mkdirSync(path.join(build, "badges"), { recursive: true });

// The logo is the mark on an orange tile, drawn edge to edge. Windows applies
// its own corners; macOS wants them baked in, 22.37% of the side per Apple's
// template.
const SIZE = 1024;
const RADIUS = Math.round(SIZE * 0.2237);
const roundMask = (s: number, r: number) =>
  Buffer.from(`<svg width="${s}" height="${s}"><rect width="${s}" height="${s}" rx="${r}" ry="${r}" fill="#fff"/></svg>`);

const square = await sharp(src).resize(SIZE, SIZE, { fit: "cover" }).png().toBuffer();
const rounded = await sharp(square).composite([{ input: roundMask(SIZE, RADIUS), blend: "dest-in" }]).png().toBuffer();
fs.writeFileSync(path.join(build, "icon.png"), square);

// Windows .ico: several sizes in one container, PNG-compressed.
const icoSizes = [16, 24, 32, 48, 64, 128, 256];
const icoPngs = await Promise.all(icoSizes.map((s) => sharp(square).resize(s, s).png().toBuffer()));
fs.writeFileSync(path.join(build, "icon.ico"), buildIco(icoSizes, icoPngs));

// Tray: small, rounded so it reads as the app rather than a square swatch.
for (const [name, s] of [["tray.png", 16], ["tray@2x.png", 32]] as const) {
  fs.writeFileSync(path.join(build, name), await sharp(rounded).resize(s, s).png().toBuffer());
}

// Badges: the design's rail badge, an accent disc with bold white digits.
for (const label of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "9+"]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">
    <circle cx="16" cy="16" r="15" fill="#f05710"/>
    <text x="16" y="16" text-anchor="middle" dominant-baseline="central"
          font-family="Inter, Arial, Helvetica, sans-serif" font-weight="700"
          font-size="${label.length > 1 ? 15 : 19}" fill="#fff">${label}</text>
  </svg>`;
  fs.writeFileSync(path.join(build, "badges", `${label === "9+" ? "9plus" : label}.png`), await sharp(Buffer.from(svg)).png().toBuffer());
}

// macOS .icns: iconutil builds it from an iconset folder.
if (process.platform === "darwin") {
  const iconset = path.join(build, "icon.iconset");
  fs.rmSync(iconset, { recursive: true, force: true });
  fs.mkdirSync(iconset);
  for (const [name, s] of [
    ["icon_16x16", 16], ["icon_16x16@2x", 32], ["icon_32x32", 32], ["icon_32x32@2x", 64],
    ["icon_128x128", 128], ["icon_128x128@2x", 256], ["icon_256x256", 256], ["icon_256x256@2x", 512],
    ["icon_512x512", 512], ["icon_512x512@2x", 1024],
  ] as const) {
    fs.writeFileSync(path.join(iconset, `${name}.png`), await sharp(rounded).resize(s, s).png().toBuffer());
  }
  execFileSync("iconutil", ["-c", "icns", iconset, "-o", path.join(build, "icon.icns")]);
  fs.rmSync(iconset, { recursive: true, force: true });
}

console.log("images written to", build);

/** A minimal ICO writer: PNG-compressed entries, which every Windows since Vista reads. */
function buildIco(sizes: readonly number[], pngs: Buffer[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  const dir = Buffer.alloc(16 * sizes.length);
  let offset = 6 + dir.length;
  pngs.forEach((png, i) => {
    const s = sizes[i];
    const e = i * 16;
    dir.writeUInt8(s >= 256 ? 0 : s, e);
    dir.writeUInt8(s >= 256 ? 0 : s, e + 1);
    dir.writeUInt8(0, e + 2);
    dir.writeUInt8(0, e + 3);
    dir.writeUInt16LE(1, e + 4);
    dir.writeUInt16LE(32, e + 6);
    dir.writeUInt32LE(png.length, e + 8);
    dir.writeUInt32LE(offset, e + 12);
    offset += png.length;
  });
  return Buffer.concat([header, dir, ...pngs]);
}
