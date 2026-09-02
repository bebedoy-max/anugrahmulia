// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// The user's Supabase URL + publishable key are stored as APP_SUPABASE_* secrets.
// Both are public values, so they are inlined into the client bundle as VITE_* env.
const supabaseUrl = process.env["APP_SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? "";
const supabasePublishableKey =
  process.env["APP_SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ?? "";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // @lovable.dev/vite-tanstack-config only points Nitro's output at dist/client +
  // dist/server when the build runs inside Lovable's own sandbox. Outside of it
  // (e.g. Cloudflare Pages CI, or `vite build` run locally) Nitro falls back to its
  // own default output (.output/public + .output/server), which is NOT where
  // scripts/build-cloudflare-pages.mjs looks — causing "Masih tidak menemukan
  // dist/client setelah build". Pin the output dirs explicitly so both
  // environments agree.
  nitro: {
    preset: "cloudflare-module",
    output: {
      dir: "dist",
      serverDir: "dist/server",
      publicDir: "dist/client",
    },
  },
  vite: {
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabasePublishableKey),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(supabasePublishableKey),
    },
  },
});
