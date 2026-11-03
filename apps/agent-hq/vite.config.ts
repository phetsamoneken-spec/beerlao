import { assertPublicEnvironment } from "./scripts/public-env.mjs";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
export default defineConfig(({ mode }) => {
  assertPublicEnvironment({
    ...process.env,
    ...loadEnv(mode, process.cwd(), ""),
  });
  return {
    base: "./",
    plugins: [react(), tailwindcss(), {
      name: "hq-offline-shell",
      async closeBundle() {
        // This hook runs for production builds. Cache only the generated app shell.
        const assets = await readdir("dist/assets");
        const files = [
          "./",
          "./index.html",
          "./manifest.webmanifest",
          "./hq-192.png",
          "./hq-512.png",
          ...assets.map((f) => "./assets/" + f),
        ];
        const hash = createHash("sha256").update(
          await readFile("dist/index.html"),
        ).digest("hex").slice(0, 12);
        await writeFile(
          "dist/sw.js",
          `const CACHE='agent-hq-${hash}';const FILES=${JSON.stringify(files)};
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('agent-hq-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;const urls=FILES.map(p=>new URL(p,self.registration.scope).href);if(!urls.includes(u.href))return;e.respondWith(fetch(e.request).catch(()=>caches.match(e.request,{ignoreVary:true})));});`,
        );
      },
    }],
  };
});
