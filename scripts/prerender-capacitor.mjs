// Post-build helper for Capacitor Android builds.
//
// TanStack Start ships an SSR bundle (dist/server) and static assets
// (dist/client), but never emits dist/client/index.html — Capacitor needs one.
// This script boots the built Nitro server, fetches "/", rewrites root-absolute
// asset URLs to relative ones, and writes dist/client/index.html.
//
// Web hosting is unaffected: Lovable / Cloudflare still serves the SSR entry.
// The generated index.html is only used when the app is packaged by Capacitor.
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverEntry = path.join(root, "dist/server/index.mjs");
const outFile = path.join(root, "dist/client/index.html");

if (!existsSync(serverEntry)) {
  console.error("[capacitor-prerender] dist/server/index.mjs missing — run `vite build` first");
  process.exit(1);
}

const port = 5199;
const child = spawn(process.execPath, [serverEntry], {
  env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", NITRO_PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
});
child.stdout.on("data", (d) => process.stdout.write(`[ssr] ${d}`));
child.stderr.on("data", (d) => process.stderr.write(`[ssr] ${d}`));

let html;
try {
  for (let i = 0; i < 60; i++) {
    await sleep(250);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`, {
        headers: { "user-agent": "capacitor-prerender" },
      });
      if (res.ok) {
        html = await res.text();
        break;
      }
    } catch {
      /* not ready yet */
    }
  }
  if (!html) throw new Error("SSR server did not become ready in time");

  // Rewrite root-absolute URLs so the Capacitor WebView (file:// or
  // https://localhost) can resolve JS/CSS/images relatively.
  html = html
    .replace(/(href|src)="\/(?!\/)/g, '$1="./')
    // Manifest and service worker paths must stay root-absolute for the
    // PWA registrar; Capacitor's https scheme resolves them fine.
    .replace(/href="\.\/manifest\.webmanifest"/g, 'href="/manifest.webmanifest"')
    .replace(/href="\.\/apple-touch-icon\.png"/g, 'href="/apple-touch-icon.png"');

  await writeFile(outFile, html, "utf8");
  console.log(`[capacitor-prerender] wrote ${outFile} (${html.length} bytes)`);
} finally {
  child.kill("SIGTERM");
}
