import { test } from "node:test";
import assert from "node:assert/strict";
import { assertPublicEnvironment } from "../../scripts/public-env.mjs";
test("build refuses server credentials in public Vite variables", () => {
  for (
    const name of [
      "VITE_SUPABASE_SERVICE_ROLE_KEY",
      "VITE_SUPABASE_ACCESS_TOKEN",
      "VITE_REFRESH_TOKEN",
      "VITE_AI_API_KEY",
      "VITE_OPENAI_API_KEY",
      "VITE_GOOGLE_ACCESS_TOKEN",
      "VITE_GOOGLE_CLIENT_SECRET",
    ]
  ) {
    assert.throws(
      () => assertPublicEnvironment({ [name]: "private" }),
      /Server secrets/,
    );
  }
  assert.throws(
    () =>
      assertPublicEnvironment({
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_private",
      }),
    /secret key/,
  );
  assert.throws(
    () =>
      assertPublicEnvironment({
        VITE_SUPABASE_PUBLISHABLE_KEY: "sbp_test_fixture",
      }),
    /management token/,
  );
  const jwt = (role: string) =>
    "test." + Buffer.from(JSON.stringify({ role })).toString("base64url") +
    ".test";
  assert.throws(
    () =>
      assertPublicEnvironment({
        VITE_SUPABASE_PUBLISHABLE_KEY: jwt("service_role"),
      }),
    /Only a publishable/,
  );
  assert.doesNotThrow(() =>
    assertPublicEnvironment({ VITE_SUPABASE_PUBLISHABLE_KEY: jwt("anon") })
  );
  assert.doesNotThrow(() =>
    assertPublicEnvironment({
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_public",
    })
  );
});
