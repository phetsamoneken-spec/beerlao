import { afterEach, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
const A = "11111111-1111-4111-8111-111111111111",
  B = "22222222-2222-4222-8222-222222222222";
const users = Array.from(
  { length: 7 },
  (_, i) => `00000000-0000-4000-8000-00000000000${i + 1}`,
);
let budget: string, marketing: string, foreign: string;
const config = (name: string, department = "sales") => ({
  id: "local-id",
  name,
  title: "Officer",
  department,
  color: "#aa91fa",
  avatar: "robot",
  active: true,
  description: "",
  prompt: "Use only supplied facts; request missing information.",
  responsibilities: "Draft reports",
  allowedTasks: "",
  restrictedTasks: "Never invent facts",
  workflow: "Draft then review",
  requirements: "",
  language: "Lao",
  folder: "",
  files: "",
  spreadsheet: "",
  tabs: "",
  ranges: "",
  templates: "",
  additionalSources: "",
  formats: ["PDF"],
  permissions: ["Generate drafts", "Export documents"],
  access: "",
  fields: "Shop name",
});
async function who(n: number) {
  await db.exec(
    `set role authenticated;select set_config('request.jwt.claim.sub','${
      users[n]
    }',false);`,
  );
}
async function one(sql: string, params: unknown[] = []) {
  return (await db.query<Record<string, any>>(sql, params)).rows[0];
}
async function denied(
  sql: string,
  params: unknown[] = [],
  pattern = /FORBIDDEN|permission denied/i,
) {
  await db.exec("savepoint denial");
  await assert.rejects(() => db.query(sql, params), pattern);
  await db.exec("rollback to savepoint denial;release savepoint denial;");
}
async function task(
  n = 2,
  agent = budget,
  org = A,
  inputs = { "Shop name": "Sample", "budget_amount": 100, "currency": "LAK" },
) {
  await who(n);
  return (await one("select * from public.create_task($1,$2,$3,$4::jsonb)", [
    org,
    agent,
    "Test task",
    JSON.stringify(inputs),
  ]))!;
}
async function begin(t: any, key = crypto.randomUUID()) {
  return (await one("select public.begin_ai_run($1,$2,$3) value", [
    A,
    t.id,
    key,
  ]))!.value;
}
async function finish(
  id: string,
  content: string | null = "Real provider fixture draft",
  failure: string | null = null,
) {
  await db.exec("reset role;set role service_role;");
  return (await one("select public.finish_ai_run($1,$2,$3,$4::jsonb,$5) id", [
    id,
    "test-model",
    content,
    '{"source":"test-fixture"}',
    failure,
  ]))!.id;
}
before(async () => {
  await db.exec(
    `create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,service_role;`,
  );
  for (
    const file of [
      "202611040001_phase2_schema.sql",
      "202611040002_phase2_operations.sql",
    ]
  ) {
    await db.exec(
      await readFile(
        new URL("../../supabase/migrations/" + file, import.meta.url),
        "utf8",
      ),
    );
  }
  for (const [i, id] of users.entries()) {
    await db.query("insert into auth.users values($1,$2)", [
      id,
      i === 6 ? null : new Date().toISOString(),
    ]);
  }
  await db.query(
    "insert into public.organizations(id,name) values($1,$2),($3,$4)",
    [A, "A", B, "B"],
  );
  for (
    const [i, role, dept, org] of [
      [0, "admin", "sales", A],
      [1, "manager", "sales", A],
      [2, "member", "sales", A],
      [3, "member", "marketing", A],
      [4, "admin", "sales", B],
      [5, "member", "sales", A],
      [6, "member", "sales", A],
    ] as const
  ) {
    await db.query(
      "insert into public.memberships(organization_id,user_id,role,department) values($1,$2,$3,$4)",
      [org, users[i], role, dept],
    );
  }
  await who(0);
  budget =
    (await one("select * from public.save_agent($1,null,null,$2,$3::jsonb)", [
      A,
      "budget",
      JSON.stringify(config("Budget")),
    ]))!.id;
  marketing =
    (await one("select * from public.save_agent($1,null,null,$2,$3::jsonb)", [
      A,
      "marketing",
      JSON.stringify(config("Marketing", "marketing")),
    ]))!.id;
  await who(4);
  foreign =
    (await one("select * from public.save_agent($1,null,null,$2,$3::jsonb)", [
      B,
      "sales",
      JSON.stringify(config("Other tenant")),
    ]))!.id;
  await db.exec("reset role;");
});
beforeEach(async () => {
  await db.exec("begin;");
});
afterEach(async () => {
  await db.exec("rollback;reset role;");
}); // The test worker owns this isolated in-memory PostgreSQL instance.

test("all twelve public tables enforce RLS; private tokens and direct writes are denied", async () => {
  const row = await one(
    "select count(*)::int n from pg_class where relnamespace='public'::regnamespace and relname=any($1) and relrowsecurity",
    [[
      "organizations",
      "memberships",
      "agents",
      "agent_revisions",
      "tasks",
      "ai_runs",
      "drafts",
      "reviews",
      "artifacts",
      "connections",
      "data_sources",
      "audit_events",
    ]],
  );
  assert.equal(row!.n, 12);
  await who(2);
  await denied("select * from private.google_tokens");
  await denied("update public.agents set active=false");
  await denied(
    "insert into public.memberships values($1,$2,'admin','sales',true,now())",
    [A, users[2]],
  );
});
test("tenant and department isolation applies to admin, manager and member reads", async () => {
  await who(0);
  assert.equal((await db.query("select * from public.agents")).rows.length, 2);
  await who(1);
  assert.equal((await db.query("select * from public.agents")).rows.length, 1);
  await who(3);
  assert.equal(
    (await db.query("select * from public.agents")).rows[0].id,
    marketing,
  );
  await who(4);
  assert.equal(
    (await db.query("select * from public.agents")).rows[0].id,
    foreign,
  );
  await who(6);
  assert.equal((await db.query("select * from public.agents")).rows.length, 0);
});
test("member sees only own tasks; managers see only their department", async () => {
  const own = await task(2);
  await task(5);
  await task(3, marketing, A, { "Shop name": "M" });
  await who(2);
  assert.deepEqual((await db.query("select id from public.tasks")).rows, [{
    id: own.id,
  }]);
  await who(1);
  assert.equal((await db.query("select * from public.tasks")).rows.length, 2);
  await who(4);
  assert.equal((await db.query("select * from public.tasks")).rows.length, 0);
});
test("cross-tenant agent/task references and self promotion fail", async () => {
  await who(2);
  await denied("select public.create_task($1,$2,$3,$4::jsonb)", [
    A,
    foreign,
    "Attack",
    "{}",
  ]);
  await denied("select public.set_membership($1,$2,$3,$4,true)", [
    A,
    users[2],
    "admin",
    "sales",
  ]);
  await db.exec("reset role;");
  await denied(
    "insert into public.tasks(organization_id,department,agent_id,agent_revision,requester_id,title,inputs) values($1,$2,$3,1,$4,$5,$6::jsonb)",
    [A, "sales", foreign, users[2], "Forged", "{}"],
    /foreign key/i,
  );
});
test("agent changes are versioned, stale revisions fail and last admin is retained", async () => {
  await who(0);
  const updated = await one(
    "select * from public.save_agent($1,$2,1,$3,$4::jsonb)",
    [
      A,
      budget,
      "budget",
      JSON.stringify({ ...config("Revised"), prompt: "New instructions" }),
    ],
  );
  assert.equal(updated!.revision, 2);
  await denied("select public.save_agent($1,$2,1,$3,$4::jsonb)", [
    A,
    budget,
    "budget",
    JSON.stringify(config("Stale")),
  ], /STALE_REVISION/);
  await denied("select public.set_membership($1,$2,$3,$4,false)", [
    A,
    users[0],
    "member",
    "sales",
  ], /LAST_ADMIN/);
  await db.exec("reset role;");
  await denied(
    "update public.agent_revisions set configuration='{}'",
    [],
    /IMMUTABLE_RECORD/,
  );
});
test("missing data does not start inference; execution keys are idempotent", async () => {
  const t = await task(2, budget, A, {});
  let result = await begin(t);
  assert.deepEqual(result.missing, ["Shop name"]);
  assert.equal((await db.query("select * from public.ai_runs")).rows.length, 0);
  await db.query("select public.update_task_inputs($1,$2,$3::jsonb)", [
    A,
    t.id,
    JSON.stringify({ "Shop name": "Shop" }),
  ]);
  const key = crypto.randomUUID();
  result = await begin(t, key);
  assert.equal(result.created, true);
  assert.equal((await begin(t, key)).created, false);
  await denied("select public.begin_ai_run($1,$2,$3)", [
    A,
    t.id,
    crypto.randomUUID(),
  ], /INVALID_TRANSITION/);
  await denied("select public.finish_ai_run($1,$2,$3,$4::jsonb,null)", [
    result.run.id,
    "fake",
    "Forged",
    "{}",
  ]);
});
test("provider errors persist Failed; revoked authorization never creates a draft", async () => {
  const t = await task();
  const r = await begin(t);
  await finish(r.run.id, null, "AI_UNAVAILABLE");
  await who(2);
  assert.equal(
    (await one("select status from public.tasks where id=$1", [t.id]))!.status,
    "Failed",
  );
  assert.equal((await db.query("select * from public.drafts")).rows.length, 0);
  const retry = await begin(t);
  await db.exec("reset role;");
  await db.query(
    "update public.memberships set active=false where organization_id=$1 and user_id=$2",
    [A, users[2]],
  );
  assert.equal(await finish(retry.run.id), null);
  await db.exec("reset role;");
  assert.equal(
    (await one("select error_code from public.ai_runs where id=$1", [
      retry.run.id,
    ]))!.error_code,
    "AUTHORIZATION_REVOKED",
  );
});
test("approval binds an immutable draft hash; member review and stale export fail", async () => {
  const t = await task();
  const run = await begin(t);
  const draftId = await finish(run.run.id);
  await who(2);
  const draft = await one("select * from public.drafts where id=$1", [draftId]);
  await denied("select public.export_approved($1,$2,$3)", [
    A,
    t.id,
    draft!.content_hash,
  ], /APPROVAL_REQUIRED/);
  await db.query("select public.submit_review($1,$2)", [A, t.id]);
  await denied("select public.review_draft($1,$2,$3,$4,$5,$6)", [
    A,
    t.id,
    draftId,
    draft!.content_hash,
    "approved",
    "",
  ]);
  await who(1);
  await denied("select public.review_draft($1,$2,$3,$4,$5,$6)", [
    A,
    t.id,
    draftId,
    "bad-hash",
    "approved",
    "",
  ], /STALE_REVIEW/);
  await db.query("select public.review_draft($1,$2,$3,$4,$5,$6)", [
    A,
    t.id,
    draftId,
    draft!.content_hash,
    "approved",
    "",
  ]);
  await who(2);
  const artifact = await one("select public.export_approved($1,$2,$3) value", [
    A,
    t.id,
    draft!.content_hash,
  ]);
  assert.equal(artifact!.value.content, "Real provider fixture draft");
  await denied("select public.update_task_inputs($1,$2,$3::jsonb)", [
    A,
    t.id,
    "{}",
  ], /INVALID_TRANSITION/);
});
test("editing inputs invalidates review; AI calls are rate limited atomically", async () => {
  const t = await task();
  const run = await begin(t);
  await finish(run.run.id);
  await who(2);
  await db.query("select public.submit_review($1,$2)", [A, t.id]);
  await db.query("select public.update_task_inputs($1,$2,$3::jsonb)", [
    A,
    t.id,
    '{"Shop name":"changed"}',
  ]);
  assert.equal(
    (await one("select current_draft_id from public.tasks where id=$1", [
      t.id,
    ]))!.current_draft_id,
    null,
  );
  await who(1);
  for (let i = 0; i < 10; i++) {
    await db.query("select public.route_limit($1)", [A]);
  }
  await denied("select public.route_limit($1)", [A], /RATE_LIMITED/);
});

test("expired runs require an explicit retry and late completions cannot publish a draft", async () => {
  const t = await task();
  const r = await begin(t);
  await db.exec("reset role;");
  await db.query(
    "update public.ai_runs set started_at=now()-interval '6 minutes' where id=$1",
    [r.run.id],
  );
  await who(2);
  const retry = await begin(t);
  assert.equal(retry.created, true);
  assert.notEqual(retry.run.id, r.run.id);
  await db.exec("reset role;set role service_role;");
  await denied("select public.finish_ai_run($1,$2,$3,$4::jsonb,null)", [
    r.run.id,
    "late-provider",
    "Stale result",
    "{}",
  ], /INVALID_TRANSITION/);
  await who(2);
  assert.equal((await db.query("select * from public.drafts")).rows.length, 0);
});

test("anonymous access and a null optimistic revision are rejected", async () => {
  await db.exec("set role anon;");
  await denied("select * from public.agents");
  await denied("select public.create_organization('Forged','sales')");
  await who(0);
  await denied("select public.save_agent($1,$2,null,$3,$4::jsonb)", [
    A,
    budget,
    "budget",
    JSON.stringify(config("Overwrite")),
  ], /STALE_REVISION/);
});

test("drafts, runs, reviews, artifacts, sources and audits inherit tenant/department isolation", async () => {
  const records: {
    org: string;
    dept: string;
    t: any;
    draft: string;
    connection: string;
  }[] = [];
  for (
    const [n, agent, org, dept] of [[2, budget, A, "sales"], [
      3,
      marketing,
      A,
      "marketing",
    ], [4, foreign, B, "sales"]] as const
  ) {
    const t = await task(n, agent, org, { "Shop name": "Approved sample" });
    const run = (await one("select public.begin_ai_run($1,$2,$3) value", [
      org,
      t.id,
      crypto.randomUUID(),
    ]))!.value;
    const draft = await finish(run.run.id);
    await db.exec("reset role;");
    const review = (await one(
      "insert into public.reviews(organization_id,draft_id,reviewer_id,content_hash,decision) select organization_id,id,$2,content_hash,'approved' from public.drafts where id=$1 returning id",
      [draft, users[org === A ? 0 : 4]],
    ))!;
    await db.query(
      "insert into public.artifacts(organization_id,task_id,draft_id,review_id,format,content_hash,created_by) select organization_id,task_id,id,$2,'txt',content_hash,$3 from public.drafts where id=$1",
      [draft, review.id, users[n]],
    );
    const connection = (await one(
      "insert into public.connections(organization_id,department,provider,account_label) values($1,$2,'google','test metadata only') returning id",
      [org, dept],
    ))!.id;
    await db.query(
      "insert into public.data_sources(organization_id,department,connection_id,agent_id,source_type,source_reference) values($1,$2,$3,$4,'drive_file','approved-test-reference')",
      [org, dept, connection, agent],
    );
    records.push({ org, dept, t, draft, connection });
  }
  for (const n of [1, 2, 3, 4]) {
    await who(n);
    const allowed = records[n === 3 ? 1 : n === 4 ? 2 : 0];
    for (
      const table of [
        "ai_runs",
        "drafts",
        "reviews",
        "artifacts",
        "data_sources",
      ]
    ) {
      const rows = (await db.query(`select * from public.${table}`)).rows;
      assert.equal(rows.length, 1, table);
      assert.equal(rows[0].organization_id, allowed.org, table);
    }
    const connections =
      (await db.query("select * from public.connections")).rows;
    assert.equal(connections.length, n === 2 || n === 3 ? 0 : 1);
    const audits = (await db.query("select * from public.audit_events")).rows;
    if (n === 2 || n === 3) assert.equal(audits.length, 0);
    else {for (const row of audits) {
        assert.equal(row.organization_id, allowed.org);
        assert.equal(row.department, allowed.dept);
      }}
  }
});
