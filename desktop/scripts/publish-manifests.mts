/**
 * Publishes the update feed for the current version.
 *
 * electron-builder writes `latest-mac.yml` and `latest.yml` last, after every
 * app has been uploaded, and its own publisher has failed at exactly that step
 * on all three releases so far: it tries to create a release that already
 * exists and stops with a 422. The apps land, the feed does not, and no
 * installed app ever learns there is an update.
 *
 * So the feed is published here instead, from the artifacts on disk, and only
 * for files that are actually on the release with a matching size. Run by
 * `pnpm release` after the build; safe to run again at any time.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const releaseDir = path.join(root, "release");
const { version } = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as { version: string };
const tag = `v${version}`;
const gh = (args: string[]) => execFileSync("gh", [...args, "--repo", "potarastudio/commune"], { encoding: "utf8" });

const published = new Map<string, number>(
  (JSON.parse(gh(["release", "view", tag, "--json", "assets"])) as { assets: { name: string; size: number }[] }).assets.map((a) => [a.name, a.size]),
);

/** A file is worth advertising only if it is on the release, byte for byte. */
function entry(name: string): { url: string; sha512: string; size: number } | null {
  const file = path.join(releaseDir, name);
  if (!fs.existsSync(file)) return null;
  const size = fs.statSync(file).size;
  if (published.get(name) !== size) {
    console.warn(`skipping ${name}: ${published.has(name) ? "size differs from the published asset" : "not on the release"}`);
    return null;
  }
  const sha512 = execFileSync("sh", ["-c", `openssl dgst -sha512 -binary "${file}" | openssl base64 -A`], { encoding: "utf8" }).trim();
  return { url: name, sha512, size };
}

function feed(names: string[]): string | null {
  const files = names.map(entry).filter((f): f is NonNullable<typeof f> => f !== null);
  if (files.length === 0) return null;
  const releaseDate = new Date(fs.statSync(path.join(releaseDir, files[0].url)).mtime).toISOString();
  return (
    `version: ${version}\nfiles:\n` +
    files.map((f) => `  - url: ${f.url}\n    sha512: ${f.sha512}\n    size: ${f.size}\n`).join("") +
    `path: ${files[0].url}\nsha512: ${files[0].sha512}\nreleaseDate: '${releaseDate}'\n`
  );
}

// The updater takes the first file that matches the machine; zips update in
// place, the disk images are for a fresh install.
const feeds: [string, string | null][] = [
  ["latest-mac.yml", feed([`Commune-${version}-mac-x64.zip`, `Commune-${version}-mac-arm64.zip`, `Commune-${version}-mac-x64.dmg`, `Commune-${version}-mac-arm64.dmg`])],
  ["latest.yml", feed([`Commune-${version}-win-x64.exe`])],
];

const written: string[] = [];
for (const [name, body] of feeds) {
  if (!body) {
    console.error(`✗ ${name}: none of its files are on ${tag}`);
    continue;
  }
  fs.writeFileSync(path.join(releaseDir, name), body);
  written.push(path.join(releaseDir, name));
}
if (written.length === 0) {
  console.error(`No update feed could be published for ${tag}. The apps are missing from the release.`);
  process.exit(1);
}

gh(["release", "upload", tag, ...written, "--clobber"]);

// Read back through the API rather than the download URL, which is cached.
for (const [name] of feeds) {
  const asset = (JSON.parse(gh(["release", "view", tag, "--json", "assets"])) as { assets: { name: string; size: number }[] }).assets.find((a) => a.name === name);
  const local = written.find((w) => w.endsWith(name));
  const ok = Boolean(asset && local && asset.size === fs.statSync(local).size);
  console.log(`${ok ? "✓" : "✗"} ${name} on ${tag}${asset ? ` (${asset.size} bytes)` : " missing"}`);
  if (!ok && local) process.exit(1);
}
