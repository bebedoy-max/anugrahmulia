// Production build config for a Node.js server (VPS / cPanel Node.js App).
// Usage: npm run build:node   (= vite build --config vite.config.node.ts)
// Output: .output/server/index.mjs + .output/public
// Start:  npm start           (= node .output/server/index.mjs), or via app.js (Passenger)
// Lihat DEPLOY-CPANEL.md untuk langkah lengkap.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  nitro: { preset: "node-server" },
});
