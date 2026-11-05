import { createClient } from "@supabase/supabase-js";
import { ApiError } from "../_shared/contracts.ts";
import {
  createDriveHandler,
  driveDatabaseError,
  type DriveGateway,
} from "../_shared/drive.ts";
const env = Deno.env.toObject();
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const gateway: DriveGateway = {
  async authenticate(token) {
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
      throw new ApiError(503, "BACKEND_NOT_CONFIGURED");
    }
    const userClient = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_ANON_KEY,
      options,
    );
    const { data, error } = await userClient.auth.getUser(token);
    if (error || !data.user) throw new ApiError(401, "UNAUTHENTICATED");
    if (!data.user.email_confirmed_at) {
      throw new ApiError(403, "EMAIL_NOT_VERIFIED");
    }
    const claims = await userClient.auth.getClaims(token);
    if (
      claims.error || claims.data?.claims.sub !== data.user.id ||
      typeof claims.data.claims.session_id !== "string"
    ) throw new ApiError(401, "UNAUTHENTICATED");
    return { id: data.user.id, sessionId: claims.data.claims.session_id };
  },
  async rpc(name, args) {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new ApiError(503, "BACKEND_NOT_CONFIGURED");
    }
    const service = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      options,
    );
    const { data, error } = await service.rpc(name, args);
    if (error) driveDatabaseError(error);
    return data;
  },
};
Deno.serve(createDriveHandler(env, gateway));
