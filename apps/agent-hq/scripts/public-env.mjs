export function assertPublicEnvironment(env) {
  for (const [name, value] of Object.entries(env)) {
    if (
      name.startsWith("VITE_") && value &&
      /(SERVICE.?ROLE|SECRET|ACCESS.?TOKEN|REFRESH.?TOKEN|AI_API_KEY|OPENAI_API_KEY|GOOGLE.*TOKEN)/i
        .test(
          name,
        )
    ) {
      throw new Error(
        "Server secrets must not be configured as VITE_ variables.",
      );
    }
  }
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
  if (key.startsWith("sb_secret_") || key.startsWith("sbp_")) {
    throw new Error(
      "A Supabase secret key or management token cannot be bundled.",
    );
  }
  if (key.split(".").length === 3) {
    try {
      const payload = JSON.parse(
        Buffer.from(key.split(".")[1], "base64url").toString(),
      );
      if (payload.role !== "anon") throw new Error("privileged");
    } catch {
      throw new Error("Only a publishable key or anon JWT may be bundled.");
    }
  }
}
