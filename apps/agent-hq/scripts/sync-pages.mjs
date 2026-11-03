import { cp, mkdir, readFile, rm, writeFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(app, '../..');
const site = resolve(repo, 'agent-hq');
const marker = resolve(site, '.generated-site');
await access(resolve(repo, '.git'));
await access(resolve(app, 'dist/index.html'));
let owned = false;
try { owned = (await readFile(marker, 'utf8')).trim() === 'apps/agent-hq'; } catch {}
try { await access(site); if (!owned) throw new Error('Refusing to replace a site without the AGENT HQ generated-site marker.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await mkdir(site, { recursive: true });
// Only replace this app's generated assets. Existing root pages stay untouched.
if (owned) await rm(resolve(site, 'assets'), { recursive: true, force: true });
await cp(resolve(app, 'dist'), site, { recursive: true });
await writeFile(marker, 'apps/agent-hq\n');
console.log('Updated generated GitHub Pages files in agent-hq/. Commit and push to publish.');
