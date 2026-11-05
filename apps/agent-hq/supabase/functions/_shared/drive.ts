import { z } from "zod";
import { ApiError } from "./contracts.ts";
import { driveFileId, DriveRequest } from "./drive-contracts.ts";
const uuid = z.string().uuid();
type Env = Record<string, string | undefined>;
export type DriveActor = { id: string; sessionId: string };
export interface DriveGateway {
  authenticate(token: string): Promise<DriveActor>;
  rpc(name: string, args: Record<string, unknown>): Promise<any>;
}
const SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const SCOPES = ["openid", "email", SCOPE];
const MAX_FILE = 1024 * 1024;
const MIMES = [
  "text/plain",
  "text/csv",
  "application/vnd.google-apps.document",
];
const encoder = new TextEncoder();
function base64(bytes: Uint8Array) {
  return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""));
}
function unbase64(text: string) {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}
function random() {
  return base64(crypto.getRandomValues(new Uint8Array(32))).replace(/\+/g, "-")
    .replace(/\//g, "_").replace(/=+$/, "");
}
export async function digest(text: string | Uint8Array) {
  const bytes = typeof text === "string" ? encoder.encode(text) : text;
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", bytes as BufferSource),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
async function encryptionKey(env: Env) {
  let bytes: Uint8Array;
  try {
    bytes = unbase64(env.GOOGLE_TOKEN_ENCRYPTION_KEY || "");
  } catch {
    throw new ApiError(503, "DRIVE_NOT_CONFIGURED");
  }
  if (bytes.length !== 32) throw new ApiError(503, "DRIVE_NOT_CONFIGURED");
  return crypto.subtle.importKey(
    "raw",
    bytes as BufferSource,
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
}
export async function seal(env: Env, value: unknown, context: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(context) },
    await encryptionKey(env),
    encoder.encode(JSON.stringify(value)),
  );
  return "1." + base64(iv) + "." + base64(new Uint8Array(ciphertext));
}
export async function unseal(
  env: Env,
  text: string,
  context: string,
): Promise<any> {
  try {
    const [version, nonce, cipher, extra] = text.split(".");
    if (version !== "1" || extra || !nonce || !cipher) throw Error();
    const iv = unbase64(nonce);
    if (iv.length !== 12) throw Error();
    const raw = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv as BufferSource,
        additionalData: encoder.encode(context),
      },
      await encryptionKey(env),
      unbase64(cipher) as BufferSource,
    );
    return JSON.parse(new TextDecoder().decode(raw));
  } catch {
    throw new ApiError(503, "DRIVE_TOKEN_INVALID");
  }
}
function config(env: Env) {
  const callback = `${env.SUPABASE_URL}/functions/v1/drive-api/callback`;
  if (
    !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET ||
    env.GOOGLE_REDIRECT_URI !== callback || !env.DRIVE_APP_URL
  ) throw new ApiError(503, "DRIVE_NOT_CONFIGURED");
  const url = new URL(env.DRIVE_APP_URL);
  if (
    url.protocol !== "https:" || url.username || url.password || url.search ||
    url.hash || !(env.ALLOWED_ORIGINS || "").split(",").includes(url.origin)
  ) throw new ApiError(503, "DRIVE_NOT_CONFIGURED");
  return { callback, app: url.href };
}
async function bounded(response: Response, max: number) {
  if (Number(response.headers.get("content-length") || 0) > max) {
    throw new ApiError(413, "DRIVE_FILE_TOO_LARGE");
  }
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > max) throw new ApiError(413, "DRIVE_FILE_TOO_LARGE");
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  }
  const bytes = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.length;
  }
  return bytes;
}
async function jsonResponse(response: Response) {
  try {
    return JSON.parse(new TextDecoder().decode(await bounded(response, 65536)));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, "DRIVE_UNAVAILABLE");
  }
}
async function request(
  fetcher: typeof fetch,
  url: string,
  init: RequestInit = {},
) {
  try {
    return await fetcher(url, {
      ...init,
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new ApiError(502, "DRIVE_UNAVAILABLE");
  }
}
const Token = z.object({
  access_token: z.string().min(1).max(10000),
  refresh_token: z.string().min(1).max(10000).optional(),
  expires_in: z.number().int().min(60).max(86400),
  token_type: z.literal("Bearer"),
  scope: z.string().max(4000).optional(),
});
async function exchange(
  env: Env,
  fetcher: typeof fetch,
  params: Record<string, string>,
  refresh = false,
) {
  const response = await request(
    fetcher,
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      body: new URLSearchParams({
        ...params,
        client_id: env.GOOGLE_CLIENT_ID!,
        client_secret: env.GOOGLE_CLIENT_SECRET!,
      }),
    },
  );
  if (!response.ok) {
    throw new ApiError(
      response.status === 400 && refresh ? 401 : 502,
      refresh && response.status === 400
        ? "DRIVE_RECONNECT_REQUIRED"
        : "OAUTH_FAILED",
    );
  }
  const parsed = Token.safeParse(await jsonResponse(response));
  if (!parsed.success) throw new ApiError(502, "OAUTH_FAILED");
  return parsed.data;
}
export function driveDatabaseError(error: { message?: string }): never {
  const code = error.message || "";
  const known: Record<string, number> = {
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    RATE_LIMITED: 429,
    INVALID_INPUT: 422,
    DRIVE_DISCONNECTED: 409,
    OAUTH_STATE_INVALID: 400,
  };
  throw new ApiError(
    known[code] || 500,
    known[code] ? code : "DRIVE_DATABASE_ERROR",
  );
}
export function createDriveHandler(
  env: Env,
  gateway: DriveGateway,
  fetcher: typeof fetch = fetch,
) {
  async function access(context: any) {
    const aad = `${context.organization_id}:${context.id}:tokens`;
    const opened = Token.safeParse(await unseal(env, context.cipher, aad));
    if (!opened.success) throw new ApiError(503, "DRIVE_TOKEN_INVALID");
    const token = opened.data;
    if (new Date(context.expires_at).getTime() > Date.now() + 60000) {
      return token.access_token;
    }
    if (!token.refresh_token) {
      throw new ApiError(401, "DRIVE_RECONNECT_REQUIRED");
    }
    const claim = crypto.randomUUID();
    if (
      !await gateway.rpc("drive_claim_refresh", {
        connection: context.id,
        claim,
      })
    ) throw new ApiError(409, "DRIVE_BUSY_RETRY");
    try {
      const fresh = await exchange(env, fetcher, {
        grant_type: "refresh_token",
        refresh_token: token.refresh_token,
      }, true);
      if (
        fresh.scope &&
        (!fresh.scope.split(" ").includes(SCOPE) ||
          fresh.scope.split(" ").some((s) =>
            ![...SCOPES, "https://www.googleapis.com/auth/userinfo.email"]
              .includes(s)
          ))
      ) {
        throw new ApiError(403, "DRIVE_SCOPE_MISMATCH");
      }
      const updated = {
        ...token,
        ...fresh,
        refresh_token: fresh.refresh_token || token.refresh_token,
      };
      const saved = await gateway.rpc("drive_store_refresh", {
        connection: context.id,
        claim,
        cipher: await seal(env, updated, aad),
        expiry: new Date(Date.now() + fresh.expires_in * 1000).toISOString(),
      });
      if (!saved) throw new ApiError(409, "DRIVE_DISCONNECTED");
      return fresh.access_token;
    } finally {
      await gateway.rpc("drive_release_refresh", {
        connection: context.id,
        claim,
      }).catch(() => {});
    }
  }
  async function googleFile(token: string, fileId: string) {
    const url = new URL(`https://www.googleapis.com/drive/v3/files/${fileId}`);
    url.searchParams.set(
      "fields",
      "id,name,mimeType,size,modifiedTime,version,trashed,capabilities(canDownload)",
    );
    const response = await request(fetcher, url.href, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new ApiError(
        response.status === 404 ? 404 : 502,
        response.status === 404 ? "DRIVE_FILE_NOT_FOUND" : "DRIVE_UNAVAILABLE",
      );
    }
    const file = await jsonResponse(response);
    if (
      file.id !== fileId || typeof file.name !== "string" ||
      file.name.length > 500 || file.trashed ||
      !MIMES.includes(file.mimeType) || file.capabilities?.canDownload !== true
    ) throw new ApiError(422, "DRIVE_FILE_UNSUPPORTED");
    if (
      file.size && (!/^\d+$/.test(file.size) || Number(file.size) > MAX_FILE)
    ) throw new ApiError(413, "DRIVE_FILE_TOO_LARGE");
    return file;
  }
  async function callback(req: Request) {
    const query = new URL(req.url).searchParams;
    if (
      req.url.length > 4096 || query.getAll("state").length !== 1 ||
      !/^[A-Za-z0-9_-]{43}$/.test(query.get("state") || "")
    ) throw new ApiError(400, "OAUTH_STATE_INVALID");
    const attempt = await gateway.rpc("drive_claim_callback", {
      state_digest: await digest(query.get("state")!),
    });
    try {
      if (
        query.has("error") || query.getAll("code").length !== 1 ||
        !query.get("code") || query.get("code")!.length > 2048
      ) throw new ApiError(400, "OAUTH_FAILED");
      const settings = config(env);
      const { verifier } = await unseal(
        env,
        attempt.verifier_cipher,
        `${attempt.organization_id}:${attempt.id}:verifier`,
      );
      const token = await exchange(env, fetcher, {
        grant_type: "authorization_code",
        code: query.get("code")!,
        code_verifier: verifier,
        redirect_uri: settings.callback,
      });
      const scopes = token.scope?.split(" ") || [];
      if (
        !scopes.includes(SCOPE) ||
        scopes.some((s) =>
          ![...SCOPES, "https://www.googleapis.com/auth/userinfo.email"]
            .includes(s)
        )
      ) throw new ApiError(403, "DRIVE_SCOPE_MISMATCH");
      if (!token.refresh_token) {
        throw new ApiError(400, "DRIVE_RECONNECT_REQUIRED");
      }
      const response = await request(
        fetcher,
        "https://www.googleapis.com/oauth2/v3/userinfo",
        { headers: { Authorization: `Bearer ${token.access_token}` } },
      );
      if (!response.ok) throw new ApiError(502, "OAUTH_FAILED");
      const profile = z.object({
        sub: z.string().min(1).max(255),
        email: z.email().max(320),
        email_verified: z.literal(true),
      }).safeParse(await jsonResponse(response));
      if (!profile.success) throw new ApiError(403, "OAUTH_FAILED");
      await gateway.rpc("drive_complete_callback", {
        attempt: attempt.id,
        cipher: await seal(
          env,
          token,
          `${attempt.organization_id}:${attempt.id}:tokens`,
        ),
        label: profile.data.email,
        subject: profile.data.sub,
        granted: scopes,
        expiry: new Date(Date.now() + token.expires_in * 1000).toISOString(),
        failure: null,
      });
      return new Response(
        '<!doctype html><html lang="lo"><meta charset="utf-8"><title>AGENT HQ · Google Drive</title><h1>Google account ready</h1><p>ກັບໄປໜ້າ AGENT HQ ເພື່ອກວດ ແລະຢືນຢັນບັນຊີ Google.</p><p>Return to your original AGENT HQ tab, check the account and confirm the connection.</p></html>',
        {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
            "Content-Security-Policy":
              "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
            "Referrer-Policy": "no-referrer",
            "X-Content-Type-Options": "nosniff",
          },
        },
      );
    } catch (error) {
      await gateway.rpc("drive_complete_callback", {
        attempt: attempt.id,
        cipher: null,
        label: null,
        subject: null,
        granted: null,
        expiry: null,
        failure: "OAUTH_FAILED",
      }).catch(() => {});
      throw error;
    }
  }
  return async (req: Request): Promise<Response> => {
    const origin = req.headers.get("origin");
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim())
      .filter(Boolean);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Vary": "Origin",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    };
    if (origin && allowed.includes(origin)) {
      Object.assign(headers, {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers":
          "authorization, apikey, content-type, x-client-info",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      });
    }
    try {
      if (new URL(req.url).pathname.endsWith("/drive-api/callback")) {
        if (req.method !== "GET") throw new ApiError(405, "METHOD_NOT_ALLOWED");
        return await callback(req);
      }
      if (origin && !allowed.includes(origin)) {
        throw new ApiError(403, "ORIGIN_NOT_ALLOWED");
      }
      if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers });
      }
      if (req.method !== "POST") throw new ApiError(405, "METHOD_NOT_ALLOWED");
      const match = req.headers.get("authorization")?.match(
        /^Bearer\s+(\S+)$/i,
      );
      if (!match) throw new ApiError(401, "UNAUTHENTICATED");
      const actor = await gateway.authenticate(match[1]);
      if (
        !uuid.safeParse(actor.id).success ||
        !uuid.safeParse(actor.sessionId).success
      ) throw new ApiError(401, "UNAUTHENTICATED");
      if (
        !req.headers.get("content-type")?.toLowerCase().startsWith(
          "application/json",
        )
      ) throw new ApiError(415, "JSON_REQUIRED");
      let body: unknown;
      try {
        body = JSON.parse(
          new TextDecoder().decode(await bounded(new Response(req.body), 8192)),
        );
      } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError(400, "INVALID_REQUEST");
      }
      const parsed = DriveRequest.safeParse(body);
      if (!parsed.success) throw new ApiError(400, "INVALID_REQUEST");
      const b = parsed.data;
      let data: unknown;
      const common = { actor: actor.id, org: b.organizationId };
      if (b.action === "start") {
        const settings = config(env);
        const attempt = crypto.randomUUID();
        const state = random();
        const verifier = random();
        const challenge = base64(
          new Uint8Array(
            await crypto.subtle.digest("SHA-256", encoder.encode(verifier)),
          ),
        ).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        await gateway.rpc("drive_begin", {
          ...common,
          sid: actor.sessionId,
          dept: b.department,
          attempt,
          state_digest: await digest(state),
          verifier: await seal(
            env,
            { verifier },
            `${b.organizationId}:${attempt}:verifier`,
          ),
        });
        const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        url.search = new URLSearchParams({
          client_id: env.GOOGLE_CLIENT_ID!,
          redirect_uri: settings.callback,
          response_type: "code",
          scope: SCOPES.join(" "),
          state,
          code_challenge: challenge,
          code_challenge_method: "S256",
          access_type: "offline",
          prompt: "consent select_account",
          include_granted_scopes: "false",
        }).toString();
        data = { attemptId: attempt, authorizationUrl: url.href };
      } else if (b.action === "status" || b.action === "confirm") {
        data = await gateway.rpc(
          b.action === "status" ? "drive_status" : "drive_activate",
          { ...common, sid: actor.sessionId, attempt: b.attemptId },
        );
      } else if (b.action === "approveFile") {
        const fileId = driveFileId(b.fileReference);
        const context = await gateway.rpc("drive_connection_context", {
          ...common,
          connection: b.connectionId,
        });
        const file = await googleFile(await access(context), fileId);
        const sourceId = await gateway.rpc("drive_add_source", {
          ...common,
          connection: b.connectionId,
          agent: b.agentId,
          file_id: fileId,
          file_name: file.name,
          file_mime: file.mimeType,
        });
        data = { sourceId, name: file.name, mimeType: file.mimeType };
      } else if (b.action === "read") {
        const context = await gateway.rpc("drive_read_context", {
          ...common,
          source: b.sourceId,
        });
        const fileId = driveFileId(context.file_id);
        const token = await access(context);
        const file = await googleFile(token, fileId);
        if (file.mimeType !== context.mime_type) {
          throw new ApiError(409, "DRIVE_FILE_CHANGED");
        }
        const url = `https://www.googleapis.com/drive/v3/files/${fileId}` +
          (file.mimeType === "application/vnd.google-apps.document"
            ? "/export?mimeType=text%2Fplain"
            : "?alt=media");
        const response = await request(fetcher, url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new ApiError(502, "DRIVE_UNAVAILABLE");
        const bytes = await bounded(response, MAX_FILE);
        const after = await googleFile(token, fileId);
        if (
          after.version !== file.version ||
          after.modifiedTime !== file.modifiedTime ||
          after.mimeType !== file.mimeType
        ) {
          throw new ApiError(409, "DRIVE_FILE_CHANGED");
        }
        let text: string;
        try {
          text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        } catch {
          throw new ApiError(422, "DRIVE_FILE_UNSUPPORTED");
        }
        const hash = await digest(bytes);
        await gateway.rpc("drive_finish_read", {
          ...common,
          source: b.sourceId,
          checksum: hash,
          byte_count: bytes.length,
        });
        data = {
          text,
          provenance: {
            sourceId: b.sourceId,
            fileId,
            name: file.name,
            modifiedTime: file.modifiedTime || null,
            version: file.version || null,
            sha256: hash,
            bytes: bytes.length,
            readAt: new Date().toISOString(),
            parser: "utf8-text-v1",
          },
        };
      } else {
        const context = await gateway.rpc("drive_disconnect", {
          ...common,
          connection: b.connectionId,
        });
        let revocationPending = true;
        try {
          const token = await unseal(
            env,
            context.cipher,
            `${b.organizationId}:${b.connectionId}:tokens`,
          );
          revocationPending =
            !(await request(fetcher, "https://oauth2.googleapis.com/revoke", {
              method: "POST",
              body: new URLSearchParams({
                token: token.refresh_token || token.access_token,
              }),
            })).ok;
        } catch {
          /* Local revocation is authoritative; provider failure never restores access. */
        }
        data = { disconnected: true, revocationPending };
      }
      return new Response(JSON.stringify({ data }), { headers });
    } catch (error) {
      const known = error instanceof ApiError
        ? error
        : new ApiError(500, "DRIVE_OPERATION_FAILED");
      return new Response(JSON.stringify({ error: known.message }), {
        status: known.status,
        headers,
      });
    }
  };
}
