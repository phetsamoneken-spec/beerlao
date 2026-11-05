import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { schemaPackage } from "../../scripts/prepare-schema.mjs";
test("the review package installs atomically and refuses an existing schema without changing data", async () => {
  const db = new PGlite();
  const { sql, sources, sha256 } = await schemaPackage();
  assert.equal(sources.length, 2);
  assert.match(sha256, /^[a-f0-9]{64}$/);
  await db.exec(
    "create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,service_role;",
  );
  await db.exec(sql);
  let result = await db.query<{ n: number }>(
    "select count(*)::int n from pg_tables where schemaname='public' and rowsecurity",
  );
  assert.equal(result.rows[0].n, 12);
  await db.exec(
    "insert into public.organizations(name) values('Keep this organization')",
  );
  await assert.rejects(() => db.exec(sql), /REVIEW_REQUIRED_EXISTING_SCHEMA/);
  await db.exec("rollback;");
  const preserved = await db.query<{ name: string }>(
    "select name from public.organizations",
  );
  assert.deepEqual(preserved.rows, [{ name: "Keep this organization" }]);
});
