#!/usr/bin/env node
/**
 * Menyusun hasil build Vite/Nitro menjadi struktur yang dimengerti Cloudflare Pages.
 *
 * Sumber  : dist/client (aset statis) + dist/server (worker SSR, preset cloudflare-module)
 * Keluaran: dist/pages/            -> aset statis
 *           dist/pages/_worker.js/ -> worker SSR (Advanced Mode, format direktori modul)
 *           dist/pages/_routes.json
 *
 * Jalankan lewat: npm run build:pages
 */
import { cp, mkdir, readdir, rm, rename, writeFile, access } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const clientDir = path.join(root, "dist/client");
const serverDir = path.join(root, "dist/server");
const outDir = path.join(root, "dist/pages");
const workerDir = path.join(outDir, "_worker.js");

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

for (const dir of [clientDir, serverDir]) {
  if (!(await exists(dir))) {
    console.error(`[pages] Tidak menemukan ${path.relative(root, dir)}. Jalankan "npm run build" lebih dulu.`);
    process.exit(1);
  }
}

// Nitro menulis pengalihan konfigurasi Wrangler untuk mode Workers; pada Pages
// berkas ini bikin Wrangler memakai konfigurasi worker (binding ASSETS) dan gagal.
await rm(path.join(root, ".wrangler/deploy"), { recursive: true, force: true });

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

// 1. Aset statis (hasil client build) menjadi akar output Pages.
await cp(clientDir, outDir, { recursive: true });

// 2. Worker SSR. Hanya berkas JS/MJS boleh ada di dalam _worker.js/.
await mkdir(workerDir, { recursive: true });
const skip = new Set(["wrangler.json", "wrangler.toml", "nitro.json", ".wrangler"]);
for (const entry of await readdir(serverDir, { withFileTypes: true })) {
  if (skip.has(entry.name)) continue;
  await cp(path.join(serverDir, entry.name), path.join(workerDir, entry.name), { recursive: true });
}

// Pages membutuhkan titik masuk bernama index.js di dalam direktori _worker.js.
if (await exists(path.join(workerDir, "index.mjs"))) {
  await rename(path.join(workerDir, "index.mjs"), path.join(workerDir, "index.js"));
}

// 3. Aset statis dilayani langsung tanpa membangunkan worker.
const staticRoots = new Set();
for (const entry of await readdir(clientDir, { withFileTypes: true })) {
  staticRoots.add(entry.isDirectory() ? `/${entry.name}/*` : `/${entry.name}`);
}
staticRoots.delete("/_headers");
staticRoots.delete("/_routes.json");

await writeFile(
  path.join(outDir, "_routes.json"),
  `${JSON.stringify({ version: 1, include: ["/*"], exclude: [...staticRoots].sort() }, null, 2)}\n`,
);

console.log(`[pages] Siap deploy: ${path.relative(root, outDir)}`);
console.log(`[pages] Aset statis dikecualikan dari worker: ${[...staticRoots].sort().join(", ")}`);
