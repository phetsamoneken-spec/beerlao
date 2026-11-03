import { createClient } from "@supabase/supabase-js";
import { createHandler, type Gateway } from "../_shared/handler.ts";
import {
  type AgentRow,
  ApiError,
  databaseError,
} from "../_shared/contracts.ts";
const env = Deno.env.toObject();
// Secrets stay in the Edge runtime; no request values select provider URLs or keys.
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const userClient = (token: string) => {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new ApiError(503, "BACKEND_NOT_CONFIGURED");
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    ...options,
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
};
const gateway: Gateway = {
  async authenticate(token) {
    const { data, error } = await userClient(token).auth.getUser(token);
    if (error || !data.user) throw new ApiError(401, "UNAUTHENTICATED");
    return { id: data.user.id, verified: !!data.user.email_confirmed_at };
  },
  async rpc(token, name, args) {
    const { data, error } = await userClient(token).rpc(name, args);
    if (error) databaseError(error);
    return data;
  },
  async agents(token, org) {
    const { data, error } = await userClient(token).from("agents").select("*")
      .eq("organization_id", org).eq("active", true).limit(100);
    if (error) databaseError(error);
    return data as AgentRow[];
  },
  async task(token, org, id) {
    const { data, error } = await userClient(token).from("tasks").select("id")
      .eq("organization_id", org).eq("id", id).maybeSingle();
    if (error) databaseError(error);
    return data;
  },
  async finish(run, model, content, provenance, failure) {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new ApiError(503, "BACKEND_NOT_CONFIGURED");
    }
    const service = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      options,
    );
    const { data, error } = await service.rpc("finish_ai_run", {
      run,
      model_name: model,
      result_content: content,
      provenance_data: provenance,
      failure_code: failure,
    });
    if (error) databaseError(error);
    return data;
  },
};
Deno.serve(createHandler(env, gateway));
