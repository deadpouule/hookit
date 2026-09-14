/**
 * Pull TradingView Advanced Charts into web/public/charting_library/.
 *
 * The library is licensed and may not live in this public repo, so the build
 * fetches it from TradingView's private GitHub repo with a token that has read
 * access (granted once the Advanced Charts application is approved).
 *
 *   TV_CHARTING_LIBRARY_TOKEN  GitHub token with access to the repo (required)
 *   TV_CHARTING_LIBRARY_REPO   default tradingview/charting_library
 *   TV_CHARTING_LIBRARY_REF    default master
 *
 * Without a token the script is a no-op and the app keeps its lightweight
 * fallback chart. Run: node scripts/fetch-charting-library.mjs
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(here, "..", "public", "charting_library");
const token = process.env.TV_CHARTING_LIBRARY_TOKEN;
const repo = process.env.TV_CHARTING_LIBRARY_REPO || "tradingview/charting_library";
const ref = process.env.TV_CHARTING_LIBRARY_REF || "master";

if (!token) {
  if (existsSync(path.join(target, "charting_library.standalone.js"))) {
    console.log("[tv] charting_library already present, skipping download");
  } else {
    console.log("[tv] TV_CHARTING_LIBRARY_TOKEN not set — token chart uses the lightweight fallback");
  }
  process.exit(0);
}

const url = `https://api.github.com/repos/${repo}/tarball/${ref}`;
console.log(`[tv] downloading ${repo}@${ref}`);
const res = await fetch(url, {
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "hookit-build",
  },
  redirect: "follow",
});
if (!res.ok) {
  console.error(`[tv] download failed: ${res.status} ${res.statusText}`);
  process.exit(1);
}

const scratch = mkdtempSync(path.join(tmpdir(), "tv-charting-"));
try {
  const tarball = path.join(scratch, "lib.tgz");
  writeFileSync(tarball, Buffer.from(await res.arrayBuffer()));
  execFileSync("tar", ["-xzf", tarball, "-C", scratch]);
  const extracted = execFileSync("find", [scratch, "-type", "d", "-name", "charting_library", "-not", "-path", "*/node_modules/*"], {
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean)
    .find((dir) => existsSync(path.join(dir, "charting_library.standalone.js")));
  if (!extracted) {
    console.error("[tv] archive has no charting_library/charting_library.standalone.js");
    process.exit(1);
  }
  rmSync(target, { recursive: true, force: true });
  mkdirSync(path.dirname(target), { recursive: true });
  execFileSync("cp", ["-R", extracted, target]);
  console.log(`[tv] installed to ${path.relative(process.cwd(), target)}`);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
