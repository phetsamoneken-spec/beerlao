import { createClient } from "@supabase/supabase-js";
export function publicConfiguration(env: Record<string, unknown>) {
  if (env.VITE_PHASE2_ENABLED !== "true") {
    return {
      error: "Cloud workspace is disabled pending review.",
      client: null,
    };
  }
  const url = String(env.VITE_SUPABASE_URL || ""),
    key = String(env.VITE_SUPABASE_PUBLISHABLE_KEY || "");
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" &&
      !(parsed.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(parsed.hostname))
    ) throw new Error();
  } catch {
    return {
      error: "Configure a valid Supabase URL and public publishable key.",
      client: null,
    };
  }
  let safe = key.startsWith("sb_publishable_");
  if (!safe && key.split(".").length === 3) {
    try {
      safe = JSON.parse(
        atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      ).role === "anon";
    } catch {}
  }
  if (!safe) {
    return {
      error: "Configure a valid Supabase URL and public publishable key.",
      client: null,
    };
  }
  return {
    error: null,
    client: createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: "pkce",
      },
    }),
  };
}
export const cloud = publicConfiguration(import.meta.env);
