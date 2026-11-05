import { mkdtemp, mkdir, copyFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

// Exercise the same source-only condition as the hosted bundler. Checking in
// the app checkout can hide a manual-node_modules dependency behind npm ci.
const appRoot = fileURLToPath(new URL("../", import.meta.url));
const files = [
  "deno.json", "agent-api/index.ts", "drive-api/index.ts",
  "_shared/contracts.ts", "_shared/handler.ts", "_shared/ai.ts",
  "_shared/drive.ts", "_shared/drive-contracts.ts",
];
const directory = await mkdtemp(join(tmpdir(), "agent-hq-edge-clean-"));
let status = 1;
try {
  for (const file of files) {
    const target = join(directory, file);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(resolve(appRoot, "supabase/functions", file), target);
  }
  const env = { ...process.env, DENO_DIR: join(directory, ".deno-cache") };
  if (!env.DENO_CERT && env.NODE_EXTRA_CA_CERTS) env.DENO_CERT = env.NODE_EXTRA_CA_CERTS;
  const result = spawnSync(process.execPath, [
    resolve(appRoot, "node_modules/deno/bin.cjs"), "check", "--no-lock",
    "--config", "deno.json", "agent-api/index.ts", "drive-api/index.ts",
  ], { cwd: directory, env, stdio: "inherit", timeout: 120000 });
  if (result.error) process.stderr.write("Clean Edge check could not complete: " + result.error.message + "\n");
  status = result.status ?? 1;
  if (status === 0) process.stdout.write("Clean source-only Edge dependency check: PASS (both entry points).\n");
} finally {
  await rm(directory, { recursive: true, force: true });
}
process.exitCode = status;
