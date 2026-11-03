import {
  AgentConfig,
  type AgentRow,
  ApiError,
  type Prepared,
  RequestBody,
} from "./contracts.ts";
import { type Env, generateDraft, routeInstruction } from "./ai.ts";
export interface Gateway {
  authenticate(token: string): Promise<{ id: string; verified: boolean }>;
  rpc(
    token: string,
    name: string,
    args: Record<string, unknown>,
  ): Promise<unknown>;
  agents(token: string, org: string): Promise<AgentRow[]>;
  task(token: string, org: string, id: string): Promise<unknown | null>;
  finish(
    run: string,
    model: string,
    content: string | null,
    provenance: Record<string, unknown>,
    failure: string | null,
  ): Promise<string | null>;
}
async function readJson(request: Request) {
  if (
    !request.headers.get("content-type")?.toLowerCase().startsWith(
      "application/json",
    )
  ) throw new ApiError(415, "JSON_REQUIRED");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "INVALID_JSON");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 65536) {
      await reader.cancel();
      throw new ApiError(413, "REQUEST_TOO_LARGE");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ApiError(400, "INVALID_JSON");
  }
}
export function createHandler(
  env: Env,
  gateway: Gateway,
  fetcher: typeof fetch = fetch,
) {
  return async (request: Request): Promise<Response> => {
    const requestId = crypto.randomUUID();
    const origin = request.headers.get("origin");
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((x) => x.trim())
      .filter(Boolean);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Vary": "Origin",
      "X-Content-Type-Options": "nosniff",
    };
    if (origin && allowed.includes(origin)) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Access-Control-Allow-Headers"] =
        "authorization, apikey, content-type, x-client-info";
      headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    }
    const respond = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers });
    try {
      if (origin && !allowed.includes(origin)) {
        throw new ApiError(403, "ORIGIN_NOT_ALLOWED");
      }
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers });
      }
      if (request.method !== "POST") {
        throw new ApiError(405, "METHOD_NOT_ALLOWED");
      }
      const auth = request.headers.get("authorization");
      if (!auth?.match(/^Bearer\s+\S+$/i)) {
        throw new ApiError(401, "UNAUTHENTICATED");
      }
      const token = auth.replace(/^Bearer\s+/i, "");
      const user = await gateway.authenticate(token);
      if (!user.verified) throw new ApiError(403, "EMAIL_NOT_VERIFIED");
      const parsed = RequestBody.safeParse(await readJson(request));
      if (!parsed.success) throw new ApiError(400, "INVALID_REQUEST");
      const b = parsed.data;
      const rpc = (name: string, args: Record<string, unknown>) =>
        gateway.rpc(token, name, args);
      switch (b.action) {
        case "createOrganization":
          return respond({
            data: await rpc("create_organization", {
              org_name: b.name,
              dept: b.department,
            }),
          }, 201);
        case "setMembership":
          return respond({
            data: await rpc("set_membership", {
              org: b.organizationId,
              target_user: b.userId,
              new_role: b.role,
              dept: b.department,
              is_active: b.active,
            }),
          });
        case "saveAgent":
          return respond({
            data: await rpc("save_agent", {
              org: b.organizationId,
              agent: b.agentId,
              expected_revision: b.expectedRevision,
              agent_kind: b.kind,
              config: b.configuration,
            }),
          });
        case "createTask":
          return respond({
            data: await rpc("create_task", {
              org: b.organizationId,
              agent: b.agentId,
              task_title: b.title,
              task_inputs: b.inputs,
            }),
          }, 201);
        case "updateInputs":
          return respond({
            data: await rpc("update_task_inputs", {
              org: b.organizationId,
              tid: b.taskId,
              new_inputs: b.inputs,
            }),
          });
        case "submitReview":
          return respond({
            data: await rpc("submit_review", {
              org: b.organizationId,
              tid: b.taskId,
            }),
          });
        case "review":
          return respond({
            data: await rpc("review_draft", {
              org: b.organizationId,
              tid: b.taskId,
              draft: b.draftId,
              expected_hash: b.contentHash,
              decision_value: b.decision,
              reason_value: b.reason,
            }),
          });
        case "export":
          return respond({
            data: await rpc("export_approved", {
              org: b.organizationId,
              tid: b.taskId,
              expected_hash: b.contentHash,
            }),
          });
        case "route": {
          await rpc("route_limit", { org: b.organizationId });
          const agents = await gateway.agents(token, b.organizationId);
          return respond({
            data: await routeInstruction(env, b.text, agents, fetcher),
          });
        }
        case "execute": {
          if (!await gateway.task(token, b.organizationId, b.taskId)) {
            throw new ApiError(404, "NOT_FOUND");
          }
          if (
            !env.AI_API_KEY || !env.AI_MODEL || !env.SUPABASE_SERVICE_ROLE_KEY
          ) throw new ApiError(503, "AI_NOT_CONFIGURED");
          const prepared = await rpc("begin_ai_run", {
            org: b.organizationId,
            tid: b.taskId,
            key: b.requestKey,
          }) as Prepared;
          if (prepared.missing) {
            throw new ApiError(422, "NEEDS_INFORMATION", {
              missing: prepared.missing,
            });
          }
          if (!prepared.created) {
            return respond(
              { data: { run: prepared.run, replayed: true } },
              prepared.run.status === "running" ? 202 : 200,
            );
          }
          let output: { content: string; analysis: unknown };
          try {
            const config = AgentConfig.safeParse(prepared.configuration);
            if (!config.success) {
              throw new ApiError(422, "INVALID_AGENT_CONFIGURATION");
            }
            output = await generateDraft(
              env,
              config.data,
              prepared.kind!,
              prepared.task!.inputs,
              fetcher,
              prepared.task!.title,
            );
          } catch (error) {
            const failure = error instanceof ApiError
              ? error
              : new ApiError(502, "AI_UNAVAILABLE");
            try {
              await gateway.finish(prepared.run.id, env.AI_MODEL, null, {
                request_id: requestId,
              }, failure.message);
            } catch {
              throw new ApiError(503, "FINALIZATION_FAILED", {
                run_id: prepared.run.id,
              });
            }
            throw failure;
          }
          const draft = await gateway.finish(
            prepared.run.id,
            env.AI_MODEL,
            output.content,
            {
              request_id: requestId,
              agent_revision: prepared.task!.agent_revision,
              source: "authorized_task_inputs",
              computed_sales: output.analysis,
            },
            null,
          );
          if (!draft) throw new ApiError(403, "EXECUTION_REVOKED");
          return respond({
            data: {
              run_id: prepared.run.id,
              draft_id: draft,
              status: "Draft ready",
            },
          }, 201);
        }
      }
    } catch (error) {
      const failure = error instanceof ApiError
        ? error
        : new ApiError(500, "INTERNAL_ERROR");
      console.warn(
        JSON.stringify({
          request_id: requestId,
          error: failure.message,
          status: failure.status,
        }),
      );
      return respond({
        error: failure.message,
        request_id: requestId,
        ...failure.details,
      }, failure.status);
    }
  };
}
