// Post-build helper for Capacitor Android builds.
//
// TanStack Start / Nitro emits its static client assets to one of two
// locations depending on the deploy preset and Nitro version:
//   - `dist/client/`          (Cloudflare preset used by Lovable hosting)
//   - `.output/public/`       (default Nitro preset used by plain `nitro build`)
//
// Neither location contains an `index.html`, because the site is SSR-only.
// Capacitor's Android wrapper needs a `webDir` that contains an
// `index.html`, so this script assembles a separate `dist/capacitor/`
// folder that Capacitor uses as its `webDir`. The original client folder
// is left untouched so Cloudflare / Lovable hosting keeps serving SSR.
//
// The generated `index.html` is a lightweight loading shell. The Capacitor
// config sets `server.url` to the published Lovable site, so the WebView
// navigates there immediately after launch; the local `index.html` is only
// used as a fallback while the network request is in flight or offline.
import { cp, mkdir, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Candidate source directories in priority order. The first one that exists
// is used as the static asset source for the Capacitor shell.
const candidates = [
  "dist/client",       // Cloudflare / Lovable preset (this repo's default)
  ".output/public",    // Default Nitro preset
  "dist/public",       // Some Nitro presets
  "dist",              // Last-resort fallback if only PWA files landed here
];

const sourceDir = candidates
  .map((rel) => path.join(root, rel))
  .find((abs) => existsSync(abs));

if (!sourceDir) {
  console.error(
    "[capacitor] Could not find a client build directory. Looked for:\n  " +
      candidates.join("\n  ") +
      "\nRun `npm run build` (or `vite build`) first.",
  );
  process.exit(1);
}

const outDir = path.join(root, "dist/capacitor");
const PUBLISHED_URL = "https://bookary-boost-engine.lovable.app";

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
// Ship every static asset (icons, splash images, manifest, sw.js) alongside
// index.html so Capacitor packages them into the APK.
await cp(sourceDir, outDir, { recursive: true });

// If the PWA service worker landed in `dist/` (sibling of dist/client) rather
// than inside the client folder, copy it in too so the shell can register it.
const swSource = path.join(root, "dist/sw.js");
if (existsSync(swSource) && !existsSync(path.join(outDir, "sw.js"))) {
  await cp(swSource, path.join(outDir, "sw.js"));
}

// Minimal boot shell. Capacitor's server.url points the WebView at the
// published site; this HTML is only visible while that page loads or if the
// device is offline before any network response has been cached.
const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#1e1b4b" />
    <title>Bookary</title>
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="icon" type="image/png" sizes="192x192" href="/pwa-192.png" />
    <link rel="icon" type="image/png" sizes="512x512" href="/pwa-512.png" />
    <style>
      html, body { margin: 0; padding: 0; height: 100%; background: #0b0a1a; color: #e8e6ff; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
      .wrap { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; padding: 24px; }
      .logo { font-size: 28px; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 12px; }
      .sub { font-size: 14px; opacity: 0.75; margin-bottom: 24px; }
      .spinner { width: 32px; height: 32px; border: 3px solid rgba(255,255,255,0.15); border-top-color: #a78bfa; border-radius: 50%; animation: spin 0.9s linear infinite; }
      @keyframes spin { to { transform: rotate(360deg); } }
      .retry { display: none; margin-top: 20px; padding: 10px 18px; background: #4c1d95; color: white; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="logo">Bookary</div>
      <div class="sub">Loading your library…</div>
      <div class="spinner"></div>
      <button class="retry" id="retry" onclick="location.href='${PUBLISHED_URL}'">Retry</button>
    </div>
    <script>
      setTimeout(function () {
        var b = document.getElementById('retry');
        if (b) b.style.display = 'inline-block';
      }, 8000);
      if (!window.Capacitor && location.protocol.startsWith('http')) {
        location.replace('${PUBLISHED_URL}');
      }
    </script>
  </body>
</html>
`;

await writeFile(path.join(outDir, "index.html"), html, "utf8");
console.log(
  `[capacitor] source: ${path.relative(root, sourceDir)} → wrote ${path.relative(root, outDir)}/index.html + copied static assets`,
);
