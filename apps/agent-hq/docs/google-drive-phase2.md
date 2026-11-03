# Google Drive OAuth — security design for review

**Not connected.** This PR makes no OAuth/token/Google requests. Entering a Drive URL/ID in an agent configuration is a reference only and does not authorize ingestion. A Drive home link does not identify an approved file or folder. Existing uploads remain in IndexedDB.

## Trust boundary

The browser authenticates with Supabase and sees connection labels/scopes/status only. Google client secrets, authorization codes, PKCE verifiers and access/refresh tokens stay in a server callback/token vault. The Google consent flow must request only approved scopes. Prefer `https://www.googleapis.com/auth/drive.file` for explicitly selected/app-created files. Supporting arbitrary existing folders may require broader `drive.readonly` and a separate Google verification/admin review; never silently upgrade scope. No Drive-wide write scope by default.

`connections` identifies organization/department, consenting account, granted scopes and revocation. `data_sources` allowlists exact file/folder/Sheet references, permitted ranges and their assigned agent. Composite tenant/department foreign keys prevent mixing sources/connections/agents. RLS exposes approved source references only within the caller's scope. These tables have no browser mutations in this PR. `private.google_tokens` is a ciphertext-only foundation; the OAuth implementation must extend it with connection FK, nonce, key version, token expiry and rotation metadata through another reviewed migration.

## Proposed endpoints (not implemented)

1. **POST `drive/connect`**: require confirmed user, active admin/authorized departmental manager, exact origin and request size/rate limit. Pin org, department, scopes and approved destination. Store a random single-use state hash, caller identity/session binding, expiry (5 minutes), PKCE S256 challenge/verifier and validated return location in a private table. Never derive role or return URL from the callback query. Return only the consent URL. Use fixed Google OAuth endpoints.
2. **GET server `drive/callback`**: validate state in constant time and atomically consume it, reject expired/replayed/unsolicited codes, recheck membership and original initiating user binding, and exchange code+verifier server-side. No browser callback handles codes/tokens. Verify consenting account and actual scopes; require explicit reconciliation if they differ. Set no token in redirect URL, HTML or frontend storage. Redirect to the pinned application path with an opaque result ID. A callback is allowed to persist a connection, not trigger document writes.
3. **POST `drive/read-approved`**: use caller JWT and current membership; resolve the approved source by UUID, not arbitrary URL supplied by the model. Check connection org/department, revocation, agent Read data permission and file/range allowlist. Do not recursively ingest folders by default; require an approved bounded file list. Fetch only fixed Google API URLs using server tokens. Check MIME/type/size (initial text/CSV only), deny executable/macro content and shortcuts that target unapproved files; limit parsing time/rows. Snapshot file ID, revision/checksum, timestamp, range and parser version into an immutable provenance record. User reviews data mapping before it can become task inputs.
4. **POST `drive/request-write`**: require current approved immutable draft and hash, exact destination allowlist and agent Save approved documents permission. Stage an immutable write intent containing org, department, draft/review IDs, bytes hash, target folder ID, filename, MIME, output format and requesting user. Show that exact action to the human reviewer; approval of draft content alone is insufficient for an unknown destination/action. Never take filenames, permissions or destination URLs directly from model instructions.
5. **POST `drive/approve-write` / worker execution**: require authorized manager/admin and explicit human approval of the exact write intent/hash/destination; recheck active membership, draft approval, token scopes and connection at execution. Atomic claim+idempotency key prevents duplicate writes. Create a new file in the allowed folder; never overwrite/delete/share existing documents in the first version. Save returned Google file ID/checksum and sanitized audit result. Uncertain provider timeouts remain indeterminate pending reconciliation; never automatically duplicate a write.
6. **POST `drive/disconnect`**: require authorized scope, mark connection revoked immediately, deny subsequent reads/writes and erase encrypted tokens; best-effort fixed-endpoint Google revocation, with sanitized audit event. Pending intents cannot execute after disconnect.

The browser authenticates intent APIs using its Supabase bearer session. Callback state is separately bound to a server-side initiating session/one-time connection transaction; no client-provided JWT in a redirect URL. A practical implementation needs a backend session-binding cookie or second authenticated handoff before connection activation. The choice and CSRF/SameSite behavior require a reviewed browser test; it is not resolved by merely adding `state`.

## Vault and logging

Use an audited AES-256-GCM library/KMS envelope encryption with a fresh nonce per write. Authenticate organization/connection UUID and key version as associated data. Keep the master key in backend secrets/KMS, separated from ciphertext storage and never prefixed `VITE_`. Restrict vault RPC access to narrow server paths; do not make a generic token-returning public RPC. Redact Authorization headers, codes, verifiers, tokens and source contents from logs. Rotate keys with overlapping decrypt versions, reencrypt and test revocation. Token refresh needs a per-connection lock and preserved refresh token when Google omits a replacement. Failed refresh disconnects/blocks access; it must not broaden scopes.

## Prompt injection and approvals

Google text is untrusted evidence. It cannot override authorization, select new data sources, grant tools, approve reports, request a token or make network calls. The model receives bounded extracted snapshots with explicit provenance; server code owns all tool decisions. Display outputs as text and require human review. Never automatically execute a tool/action embedded in prose/JSON from a source or model. External writes remain unavailable until this design, implementation and target credentials receive explicit approval.

## Required acceptance tests before enabling

- OAuth state/session/PKCE mismatch, expired state, replay, invalid redirect, denied consent and changed scopes.
- Forged org/department/source/connection/destination UUID; revoked member; private-token SELECT denied.
- Ciphertext tampering, associated-data swap, key rotation, concurrent refresh and token/log redaction.
- Unapproved file/range, shortcut, malicious text, oversized content, unsupported MIME and parser failure.
- Missing/stale human action approval, changed draft hash/destination, duplicate intent, revoked connection and uncertain-write reconciliation.
- Full Google sandbox account flow with reviewed consent screen, callback URI, minimal scopes and retention policy. No production documents involved.
