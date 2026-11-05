import { test } from "node:test";
import assert from "node:assert/strict";
import { cloudRequest, type CloudTransport } from "../../src/cloud/requests.ts";
import {
  createHandler,
  type Gateway,
} from "../../supabase/functions/_shared/handler.ts";
const org = "11111111-1111-4111-8111-111111111111",
  task = "22222222-2222-4222-8222-222222222222",
  agent = "33333333-3333-4333-8333-333333333333";
const configuration = {
  id: "local",
  name: "Analyst",
  title: "Sales officer",
  department: "sales",
  color: "#aa91fa",
  avatar: "robot",
  active: true,
  description: "",
  prompt: "Use supplied authorized inputs.",
  responsibilities: "",
  allowedTasks: "",
  restrictedTasks: "",
  workflow: "",
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
  permissions: ["Generate drafts"],
  access: "",
  fields: "Task details",
};
function transport() {
  const rpcCalls: unknown[] = [];
  const edgeCalls: unknown[] = [];
  const client: CloudTransport = {
    rpc: async (name, args) => {
      rpcCalls.push({ name, args });
      return { data: "persisted-result", error: null };
    },
    functions: {
      invoke: async (name, options) => {
        edgeCalls.push({ name, ...options });
        return { data: { data: { status: "server-result" } }, error: null };
      },
    },
  };
  return { client, rpcCalls, edgeCalls };
}
test("company mutations use the same audited RPC contracts as the Edge API, without requiring deployment", async () => {
  const bodies = [
    { action: "createOrganization", name: "Company", department: "sales" },
    {
      action: "setMembership",
      organizationId: org,
      userId: agent,
      role: "member",
      department: "sales",
      active: true,
    },
    {
      action: "saveAgent",
      organizationId: org,
      agentId: null,
      expectedRevision: null,
      kind: "sales",
      configuration,
    },
    {
      action: "createTask",
      organizationId: org,
      agentId: agent,
      title: "Report",
      inputs: { month: "2026-11" },
    },
    {
      action: "updateInputs",
      organizationId: org,
      taskId: task,
      inputs: { month: "2026-12" },
    },
    { action: "submitReview", organizationId: org, taskId: task },
    {
      action: "review",
      organizationId: org,
      taskId: task,
      draftId: agent,
      contentHash: "a".repeat(64),
      decision: "approved",
      reason: "",
    },
    {
      action: "export",
      organizationId: org,
      taskId: task,
      contentHash: "a".repeat(64),
    },
  ];
  for (const body of bodies) {
    const f = transport();
    assert.equal(await cloudRequest(f.client, body), "persisted-result");
    assert.equal(f.edgeCalls.length, 0);
    const serverCalls: unknown[] = [];
    const gateway: Gateway = {
      authenticate: async () => ({ id: "confirmed-user", verified: true }),
      rpc: async (_token, name, args) => {
        serverCalls.push({ name, args });
        return "persisted-result";
      },
      agents: async () => {
        throw Error("unexpected");
      },
      task: async () => {
        throw Error("unexpected");
      },
      finish: async () => {
        throw Error("unexpected");
      },
    };
    const response = await createHandler({}, gateway)(
      new Request("https://edge.example", {
        method: "POST",
        headers: {
          Authorization: "Bearer test-user",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }),
    );
    assert.ok(response.ok);
    assert.deepEqual(f.rpcCalls, serverCalls, body.action);
  }
});
test("CEO routing and AI execution always use the secured Edge Function, never browser begin/finalize RPCs", async () => {
  for (
    const body of [{
      action: "route",
      organizationId: org,
      text: "Prepare a sales report",
    }, {
      action: "execute",
      organizationId: org,
      taskId: task,
      requestKey: agent,
    }]
  ) {
    const f = transport();
    assert.deepEqual(await cloudRequest(f.client, body), {
      status: "server-result",
    });
    assert.equal(f.rpcCalls.length, 0);
    assert.deepEqual(f.edgeCalls, [{ name: "agent-api", body }]);
  }
});
test("missing schema is reported explicitly and never falls back to Edge or mock data", async () => {
  const f = transport();
  f.client.rpc = async () => ({
    data: null,
    error: { code: "PGRST202", message: "Function absent" },
  });
  await assert.rejects(
    () =>
      cloudRequest(f.client, {
        action: "createOrganization",
        name: "Company",
        department: "sales",
      }),
    /SCHEMA_NOT_INITIALIZED/,
  );
  assert.equal(f.edgeCalls.length, 0);
});
test("database permission/rate errors survive transport while database internals are redacted", async () => {
  const f = transport();
  for (
    const [message, expected] of [["FORBIDDEN", "FORBIDDEN"], [
      "RATE_LIMITED",
      "RATE_LIMITED",
    ], ["sensitive tenant query", "DATABASE_ERROR"]]
  ) {
    f.client.rpc = async () => ({ data: null, error: { message } });
    await assert.rejects(
      () =>
        cloudRequest(f.client, {
          action: "submitReview",
          organizationId: org,
          taskId: task,
        }),
      new RegExp(expected),
    );
  }
});
test("forged actor fields and invalid actions are rejected before either transport", async () => {
  const f = transport();
  for (
    const body of [{
      action: "createOrganization",
      name: "Company",
      department: "sales",
      role: "admin",
    }, { action: "finish_ai_run", content: "Forged" }]
  ) await assert.rejects(() => cloudRequest(f.client, body), /INVALID_REQUEST/);
  assert.equal(f.rpcCalls.length, 0);
  assert.equal(f.edgeCalls.length, 0);
});
test("undeployed AI and malformed responses remain failures, without fabricated results", async () => {
  const f = transport();
  const body = {
    action: "route",
    organizationId: org,
    text: "Plan a campaign",
  };
  f.client.functions.invoke = async () => ({
    data: null,
    error: {
      context: Response.json({
        code: "NOT_FOUND",
        message: "Requested function was not found",
      }, { status: 404 }),
    },
  });
  await assert.rejects(
    () => cloudRequest(f.client, body),
    /AI_BACKEND_NOT_DEPLOYED/,
  );
  f.client.functions.invoke = async () => ({
    data: { unexpected: "not a result" },
    error: null,
  });
  await assert.rejects(
    () => cloudRequest(f.client, body),
    /BACKEND_INVALID_RESPONSE/,
  );
  assert.equal(f.rpcCalls.length, 0);
});
