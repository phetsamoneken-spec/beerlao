import { afterEach, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
const org = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
const [admin, manager, member, foreign, unconfirmed] = Array.from(
  { length: 5 },
  (_, i) => `00000000-0000-4000-8000-00000000000${i + 1}`,
);
const agent = "33333333-3333-4333-8333-333333333333",
  attempt = "44444444-4444-4444-8444-444444444444",
  sid = "55555555-5555-4555-8555-555555555555";
const scope = "https://www.googleapis.com/auth/drive.readonly";
async function value(sql: string, args: unknown[] = []) {
  return (await db.query<any>(sql, args)).rows[0]?.value;
}
async function denied(
  sql: string,
  args: unknown[],
  pattern = /FORBIDDEN|NOT_FOUND|permission denied/,
) {
  await db.exec("savepoint denied");
  await assert.rejects(() => db.query(sql, args), pattern);
  await db.exec("rollback to savepoint denied;release savepoint denied");
}
async function owner(sql: string, args: unknown[] = []) {
  await db.exec("reset role");
  const result = await db.query<any>(sql, args);
  await db.exec("set role service_role");
  return result.rows;
}
async function begin(
  actor = admin,
  dept = "sales",
  id = attempt,
  state = "a".repeat(64),
) {
  await db.query("select public.drive_begin($1,$2,$3,$4,$5,$6,$7)", [
    actor,
    sid,
    org,
    dept,
    id,
    state,
    "encrypted-verifier-placeholder",
  ]);
}
async function ready() {
  await begin();
  await value("select public.drive_claim_callback($1) value", ["a".repeat(64)]);
  await db.query(
    "select public.drive_complete_callback($1,$2,$3,$4,$5,now()+interval '1 hour',null)",
    [
      attempt,
      "encrypted-tokens-placeholder",
      "owner@example.test",
      "google-subject",
      [scope, "openid", "email"],
    ],
  );
}
async function connected() {
  await ready();
  return value("select public.drive_activate($1,$2,$3,$4) value", [
    admin,
    sid,
    org,
    attempt,
  ]);
}
async function source() {
  return value("select public.drive_add_source($1,$2,$3,$4,$5,$6,$7) value", [
    admin,
    org,
    attempt,
    agent,
    "approved_file_123",
    "Approved file",
    "text/plain",
  ]);
}
before(async () => {
  await db.exec(
    "create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,service_role;",
  );
  for (
    const name of [
      "202611040001_phase2_schema.sql",
      "202611040002_phase2_operations.sql",
      "202611050003_google_drive.sql",
    ]
  ) {
    await db.exec(
      await readFile(
        new URL("../../supabase/migrations/" + name, import.meta.url),
        "utf8",
      ),
    );
  }
});
beforeEach(async () => {
  await db.exec("begin");
  for (const user of [admin, manager, member, foreign, unconfirmed]) {
    await db.query("insert into auth.users values($1,$2)", [
      user,
      user === unconfirmed ? null : new Date().toISOString(),
    ]);
  }
  await db.query(
    "insert into public.organizations(id,name) values($1,'A'),($2,'B')",
    [org, other],
  );
  for (
    const [user, role, department, organization] of [
      [admin, "admin", "sales", org],
      [manager, "manager", "sales", org],
      [member, "member", "sales", org],
      [foreign, "admin", "sales", other],
      [unconfirmed, "admin", "sales", org],
    ]
  ) {
    await db.query(
      "insert into public.memberships(organization_id,user_id,role,department) values($1,$2,$3,$4)",
      [organization, user, role, department],
    );
  }
  await db.query(
    "insert into public.agents(id,organization_id,department,name,kind,configuration) values($1,$2,'sales','Reader','sales',$3)",
    [agent, org, { permissions: ["Read data"] }],
  );
  await db.exec("set role service_role");
});
afterEach(async () => {
  await db.exec("reset role;rollback");
});
test("Drive vault and every Drive RPC deny browser roles", async () => {
  const funcs = await owner(
    "select p.oid::regprocedure::text signature,has_function_privilege('anon',p.oid,'EXECUTE') anon,has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated,has_function_privilege('service_role',p.oid,'EXECUTE') service from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'drive_%'",
  );
  assert.equal(funcs.length, 13);
  for (const f of funcs) {
    assert.equal(f.anon, false, f.signature);
    assert.equal(f.authenticated, false, f.signature);
    assert.equal(f.service, true, f.signature);
  }
  await db.exec("reset role;set role authenticated");
  await denied("select * from private.drive_attempts", []);
  await denied("select * from private.google_tokens", []);
  await denied("select public.drive_begin($1,$2,$3,'sales',$4,$5,$6)", [
    admin,
    sid,
    org,
    attempt,
    "a".repeat(64),
    "x".repeat(30),
  ]);
});
test("Drive connections enforce confirmed admin or same-department manager", async () => {
  for (const actor of [member, foreign, unconfirmed]) {
    await denied("select public.drive_begin($1,$2,$3,'sales',$4,$5,$6)", [
      actor,
      sid,
      org,
      attempt,
      "a".repeat(64),
      "x".repeat(30),
    ]);
  }
  await denied("select public.drive_begin($1,$2,$3,'marketing',$4,$5,$6)", [
    manager,
    sid,
    org,
    attempt,
    "a".repeat(64),
    "x".repeat(30),
  ]);
  await begin(manager);
  assert.equal(
    (await value("select public.drive_status($1,$2,$3,$4) value", [
      manager,
      sid,
      org,
      attempt,
    ])).status,
    "pending",
  );
});
test("Callback state is single-use, expiring and rechecks membership", async () => {
  await begin();
  await denied(
    "select public.drive_claim_callback($1)",
    ["b".repeat(64)],
    /OAUTH_STATE_INVALID/,
  );
  await owner("update public.memberships set active=false where user_id=$1", [
    admin,
  ]);
  await denied("select public.drive_claim_callback($1)", ["a".repeat(64)]);
  await owner("update public.memberships set active=true where user_id=$1", [
    admin,
  ]);
  const claim = await value("select public.drive_claim_callback($1) value", [
    "a".repeat(64),
  ]);
  assert.equal(claim.id, attempt);
  await denied(
    "select public.drive_claim_callback($1)",
    ["a".repeat(64)],
    /OAUTH_STATE_INVALID/,
  );
  assert.equal(
    (await owner(
      "select verifier_cipher from private.drive_attempts where id=$1",
      [attempt],
    ))[0].verifier_cipher,
    null,
  );
  await owner(
    "update private.drive_attempts set status='pending',expires_at=now()-interval '1 second' where id=$1",
    [attempt],
  );
  await denied(
    "select public.drive_claim_callback($1)",
    ["a".repeat(64)],
    /OAUTH_STATE_INVALID/,
  );
});
test("Account activation requires the original session, organization and explicit second handoff", async () => {
  await ready();
  await denied("select public.drive_activate($1,$2,$3,$4)", [
    admin,
    crypto.randomUUID(),
    org,
    attempt,
  ]);
  await denied("select public.drive_status($1,$2,$3,$4)", [
    admin,
    sid,
    other,
    attempt,
  ]);
  assert.equal(
    (await owner("select count(*)::int n from public.connections"))[0].n,
    0,
  );
  assert.equal(
    await value("select public.drive_activate($1,$2,$3,$4) value", [
      admin,
      sid,
      org,
      attempt,
    ]),
    attempt,
  );
  assert.equal(
    await value("select public.drive_activate($1,$2,$3,$4) value", [
      admin,
      sid,
      org,
      attempt,
    ]),
    attempt,
  );
  assert.equal(
    (await owner("select count(*)::int n from public.connections"))[0].n,
    1,
  );
  const row = (await owner(
    "select token_cipher,verifier_cipher,status from private.drive_attempts where id=$1",
    [attempt],
  ))[0];
  assert.deepEqual(row, {
    token_cipher: null,
    verifier_cipher: null,
    status: "completed",
  });
  await denied(
    "select public.drive_complete_callback($1,'bad','x','x',null,null,null)",
    [attempt],
    /OAUTH_STATE_INVALID/,
  );
});
test("Activation rechecks revoked membership and never accepts missing scopes", async () => {
  await begin();
  await value("select public.drive_claim_callback($1) value", ["a".repeat(64)]);
  await denied(
    "select public.drive_complete_callback($1,'cipher','a@example.test','subject',null,now()+interval '1 hour',null)",
    [attempt],
    /INVALID_INPUT/,
  );
  await db.query(
    "select public.drive_complete_callback($1,'cipher','a@example.test','subject',$2,now()+interval '1 hour',null)",
    [attempt, [scope]],
  );
  await owner("update public.memberships set active=false where user_id=$1", [
    admin,
  ]);
  await denied("select public.drive_activate($1,$2,$3,$4)", [
    admin,
    sid,
    org,
    attempt,
  ]);
  assert.equal(
    (await owner("select count(*)::int n from private.google_tokens"))[0].n,
    0,
  );
});
test("Approved-file reads enforce source, organization, agent department and Read data permission", async () => {
  await connected();
  const id = await source();
  assert.equal(await source(), id);
  const context = await value(
    "select public.drive_read_context($1,$2,$3) value",
    [manager, org, id],
  );
  assert.equal(context.file_id, "approved_file_123");
  await denied("select public.drive_read_context($1,$2,$3)", [
    admin,
    other,
    id,
  ]);
  await denied("select public.drive_read_context($1,$2,$3)", [member, org, id]);
  await owner("update public.agents set configuration='{}' where id=$1", [
    agent,
  ]);
  await denied("select public.drive_read_context($1,$2,$3)", [admin, org, id]);
  await denied("select public.drive_finish_read($1,$2,$3,$4,20)", [
    admin,
    org,
    id,
    "f".repeat(64),
  ]);
  await owner("update public.agents set configuration=$2 where id=$1", [agent, {
    permissions: ["Read data"],
  }]);
  await db.query("select public.drive_finish_read($1,$2,$3,$4,20)", [
    admin,
    org,
    id,
    "f".repeat(64),
  ]);
  const audit = (await owner(
    "select metadata from public.audit_events where action='drive.file_read'",
  ))[0].metadata;
  assert.equal(audit.sha256, "f".repeat(64));
  assert.equal(audit.bytes, 20);
  assert.equal("content" in audit, false);
});
test("Refresh leases exclude concurrent/stale writes and disconnect erases stored tokens", async () => {
  await connected();
  const id = await source();
  const claim = crypto.randomUUID(), second = crypto.randomUUID();
  assert.equal(
    await value("select public.drive_claim_refresh($1,$2) value", [
      attempt,
      claim,
    ]),
    true,
  );
  assert.equal(
    await value("select public.drive_claim_refresh($1,$2) value", [
      attempt,
      second,
    ]),
    false,
  );
  assert.equal(
    await value(
      "select public.drive_store_refresh($1,$2,'newcipher',now()+interval '1 hour') value",
      [attempt, second],
    ),
    false,
  );
  assert.equal(
    await value(
      "select public.drive_store_refresh($1,$2,'newcipher',now()+interval '1 hour') value",
      [attempt, claim],
    ),
    true,
  );
  assert.equal(
    await value("select public.drive_claim_refresh($1,$2) value", [
      attempt,
      second,
    ]),
    true,
  );
  await db.query("select public.drive_disconnect($1,$2,$3)", [
    admin,
    org,
    attempt,
  ]);
  assert.equal(
    (await owner("select count(*)::int n from private.google_tokens"))[0].n,
    0,
  );
  assert.equal(
    await value(
      "select public.drive_store_refresh($1,$2,'newcipher',now()+interval '1 hour') value",
      [attempt, second],
    ),
    false,
  );
  await denied(
    "select public.drive_read_context($1,$2,$3)",
    [admin, org, id],
    /DRIVE_DISCONNECTED/,
  );
});
test("Connection attempts are rate limited without partial inserts", async () => {
  for (let i = 0; i < 5; i++) {
    await begin(admin, "sales", crypto.randomUUID(), String(i).repeat(64));
  }
  await denied("select public.drive_begin($1,$2,$3,'sales',$4,$5,$6)", [
    admin,
    sid,
    org,
    attempt,
    "a".repeat(64),
    "x".repeat(30),
  ], /RATE_LIMITED/);
  assert.equal(
    (await owner("select count(*)::int n from private.drive_attempts"))[0].n,
    5,
  );
});
test("Disconnect remains available after exhausting read limits or losing the token row", async () => {
  await connected();
  for (let i = 0; i < 20; i++) {
    await value("select public.drive_connection_context($1,$2,$3) value", [
      admin,
      org,
      attempt,
    ]);
  }
  await denied("select public.drive_connection_context($1,$2,$3)", [
    admin,
    org,
    attempt,
  ], /RATE_LIMITED/);
  await owner("delete from private.google_tokens where connection_id=$1", [
    attempt,
  ]);
  const result = await value("select public.drive_disconnect($1,$2,$3) value", [
    admin,
    org,
    attempt,
  ]);
  assert.equal(result.cipher, null);
  assert.equal(
    (await owner(
      "select revoked_at is not null revoked from public.connections where id=$1",
      [attempt],
    ))[0].revoked,
    true,
  );
});
