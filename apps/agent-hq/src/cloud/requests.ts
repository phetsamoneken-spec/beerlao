import {
  ApiError,
  databaseError,
  RequestBody,
} from "../../supabase/functions/_shared/contracts.ts";
type Result = {
  data: any;
  error: null | { message?: string; code?: string; context?: Response };
};
export interface CloudTransport {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<Result>;
  functions: {
    invoke(
      name: string,
      options: { body: Record<string, unknown> },
    ): PromiseLike<Result>;
  };
}
// These functions enforce authorization, validation, limits and audit in PostgreSQL.
// AI routing/execution intentionally has no browser RPC path.
export async function cloudRequest(
  client: CloudTransport,
  raw: Record<string, unknown>,
): Promise<any> {
  const parsed = RequestBody.safeParse(raw);
  if (!parsed.success) throw new ApiError(400, "INVALID_REQUEST");
  const b = parsed.data;
  let operation: { name: string; args: Record<string, unknown> } | null = null;
  switch (b.action) {
    case "createOrganization":
      operation = {
        name: "create_organization",
        args: { org_name: b.name, dept: b.department },
      };
      break;
    case "setMembership":
      operation = {
        name: "set_membership",
        args: {
          org: b.organizationId,
          target_user: b.userId,
          new_role: b.role,
          dept: b.department,
          is_active: b.active,
        },
      };
      break;
    case "saveAgent":
      operation = {
        name: "save_agent",
        args: {
          org: b.organizationId,
          agent: b.agentId,
          expected_revision: b.expectedRevision,
          agent_kind: b.kind,
          config: b.configuration,
        },
      };
      break;
    case "createTask":
      operation = {
        name: "create_task",
        args: {
          org: b.organizationId,
          agent: b.agentId,
          task_title: b.title,
          task_inputs: b.inputs,
        },
      };
      break;
    case "updateInputs":
      operation = {
        name: "update_task_inputs",
        args: { org: b.organizationId, tid: b.taskId, new_inputs: b.inputs },
      };
      break;
    case "submitReview":
      operation = {
        name: "submit_review",
        args: { org: b.organizationId, tid: b.taskId },
      };
      break;
    case "review":
      operation = {
        name: "review_draft",
        args: {
          org: b.organizationId,
          tid: b.taskId,
          draft: b.draftId,
          expected_hash: b.contentHash,
          decision_value: b.decision,
          reason_value: b.reason,
        },
      };
      break;
    case "export":
      operation = {
        name: "export_approved",
        args: {
          org: b.organizationId,
          tid: b.taskId,
          expected_hash: b.contentHash,
        },
      };
      break;
  }
  if (operation) {
    const { data, error } = await client.rpc(operation.name, operation.args);
    if (error) {
      if (["PGRST202", "PGRST205", "42P01"].includes(error.code || "")) {
        throw new ApiError(503, "SCHEMA_NOT_INITIALIZED");
      }
      databaseError(error);
    }
    return data;
  }
  const { data, error } = await client.functions.invoke("agent-api", {
    body: b,
  });
  if (error) {
    let code = "Cloud operation failed.";
    let missing: string[] = [];
    const context = error.context;
    try {
      const payload = await context?.json();
      if (context?.status === 404 && payload?.code === "NOT_FOUND") {
        code = "AI_BACKEND_NOT_DEPLOYED";
      } else if (context?.status === 401) code = "UNAUTHENTICATED";
      else if (
        typeof payload?.error === "string" &&
        /^[A-Z][A-Z0-9_]{1,80}$/.test(payload.error)
      ) code = payload.error;
      if (Array.isArray(payload?.missing)) {
        missing = payload.missing.filter((s: unknown) => typeof s === "string")
          .slice(0, 20);
      }
    } catch {}
    throw new ApiError(
      context?.status || 502,
      code + (missing.length ? ": " + missing.join(", ") : ""),
    );
  }
  if (
    !data || typeof data !== "object" ||
    !Object.prototype.hasOwnProperty.call(data, "data")
  ) throw new ApiError(502, "BACKEND_INVALID_RESPONSE");
  return data.data;
}
