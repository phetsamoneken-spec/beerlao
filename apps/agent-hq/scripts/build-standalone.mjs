import { assertPublicEnvironment } from './public-env.mjs';
import { build, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

assertPublicEnvironment({...process.env,...loadEnv('production',process.cwd(),'')});
// Inline the complete application so a downloaded file opens without a server.
const result = await build({
  configFile: false,
  plugins: [react(), tailwindcss()],
  build: {
    write: false,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
const output = (Array.isArray(result) ? result : [result]).flatMap(r => r.output);
const htmlAsset = output.find(f => f.type === 'asset' && f.fileName === 'index.html');
const entry = output.find(f => f.type === 'chunk' && f.isEntry);
const styles = output.filter(f => f.type === 'asset' && f.fileName.endsWith('.css'));
if (!htmlAsset || !entry) throw new Error('Expected HTML and bundled application entry');
let html = String(htmlAsset.source).replace('<html ', '<html data-standalone="true" ');
html = html.replace(/<link\b[^>]*\brel="manifest"[^>]*>/g, '');
html = html.replace(/<script\b[^>]*\bsrc="[^"]+"[^>]*>\s*<\/script>/g, () => `<script type="module">${entry.code.replace(/<\/script/gi, '<\\/script')}</script>`);
html = html.replace(/<link\b[^>]*\brel="stylesheet"[^>]*>/g, '');
html = html.replace(/<link\b[^>]*\brel="modulepreload"[^>]*>/g, '');
html = html.replace('</head>', () => `<style>${styles.map(f => String(f.source)).join('\n').replace(/<\/style/gi, '<\\/style')}</style></head>`);
const target = resolve(process.argv[2] || '../orbit-office-preview.html');
await writeFile(target, html);
console.log(`Standalone application saved: ${target}`);
