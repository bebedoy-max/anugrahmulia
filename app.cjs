// Titik masuk produksi untuk cPanel / LiteSpeed (lsnode) dan Phusion Passenger.
// File ini SENGAJA ditulis dengan sintaks CommonJS karena Passenger/lsnode
// memuat startup file dengan require(). Server hasil build (ESM) dimuat lewat
// dynamic import().
//
// Alur deploy: npm install -> npm run build:node -> restart app.
// Application startup file di cPanel: app.cjs   (Node.js version: 20 atau 22)

const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const { pathToFileURL } = require("node:url");

const root = __dirname;

// Muat .env bila ada. Variabel yang sudah diset (mis. lewat panel cPanel
// "Environment variables") selalu menang dan tidak ditimpa.
function loadEnvFile(file) {
  if (!existsSync(file)) return;
  for (const rawLine of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim().replace(/^export\s+/, "");
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(join(root, ".env"));

if (!process.env.NODE_ENV) process.env.NODE_ENV = "production";

const major = Number(process.versions.node.split(".")[0]);
if (major < 18) {
  console.error(
    "[startup] Node " +
      process.versions.node +
      " terlalu lama. Pilih Node.js 20 atau 22 di cPanel > Setup Node.js App.",
  );
  process.exit(1);
}

const entry = join(root, ".output", "server", "index.mjs");
if (!existsSync(entry)) {
  console.error(
    "[startup] .output/server/index.mjs tidak ditemukan. Jalankan `npm run build:node` lebih dulu.",
  );
  process.exit(1);
}

// Jangan matikan proses hanya karena satu permintaan gagal (mis. database sedang down).
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});

import(pathToFileURL(entry).href).catch((error) => {
  console.error("[startup] gagal memuat server:", error);
  process.exit(1);
});
