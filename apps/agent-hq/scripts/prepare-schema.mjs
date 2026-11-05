import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const appRoot = fileURLToPath(new URL("../", import.meta.url));
export async function schemaPackage() {
  const names = [
    "202611040001_phase2_schema.sql",
    "202611040002_phase2_operations.sql",
  ];
  const parts = [];
  const sources = [];
  for (const name of names) {
    const text = await readFile(
      resolve(appRoot, "supabase/migrations", name),
      "utf8",
    );
    const lines = text.split(/\r?\n/);
    if (
      lines.filter((line) => line === "begin;").length !== 1 ||
      lines.filter((line) => line === "commit;").length !== 1
    ) throw Error("Unexpected migration transaction boundaries: " + name);
    parts.push(
      "-- Source: " + name + "\n" +
        lines.filter((line) => line !== "begin;" && line !== "commit;").join(
          "\n",
        ),
    );
    sources.push({
      file: name,
      sha256: createHash("sha256").update(text).digest("hex"),
    });
  }
  const guard =
    `-- REVIEW PACKAGE ONLY. This script does not authorize live execution.
-- Creates AGENT HQ schema/RLS/RPCs; imports no local or sample records.
begin;
do $$begin
perform pg_advisory_xact_lock(hashtextextended('agent-hq-phase2-schema-install',0));
if exists(select 1 from pg_namespace where nspname='private') or exists(
select 1 from unnest(array['organizations','memberships','agents','agent_revisions','tasks','ai_runs','drafts','reviews','artifacts','connections','data_sources','audit_events']) names(table_name)
where to_regclass('public.'||table_name) is not null) then raise exception 'REVIEW_REQUIRED_EXISTING_SCHEMA';end if;
end$$;
`;
  const sql = guard + parts.join("\n\n") + "\ncommit;\n";
  return {
    sql,
    sources,
    sha256: createHash("sha256").update(sql).digest("hex"),
  };
}
if (
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = await schemaPackage();
  const target = resolve(appRoot, "supabase/.local/phase2-schema-review.sql");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, result.sql);
  await writeFile(
    target + ".manifest.json",
    JSON.stringify(
      { sources: result.sources, sha256: result.sha256 },
      null,
      2,
    ) + "\n",
  );
  process.stdout.write(
    "Prepared " + target + "\nSHA-256: " + result.sha256 +
      "\nNo database connection or SQL execution performed.\n",
  );
}
