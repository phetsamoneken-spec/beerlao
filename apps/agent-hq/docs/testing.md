# Testing checklist

## Phase 1 automated checks

Run `npm run build`, start Vite on 5173, then `python3 tests/smoke.py` with Python Playwright and `/usr/bin/chromium`. Tests use fictional inputs only. Build warnings about the Three.js chunk size are a performance limitation, not hidden failures.

- [ ] Render WebGL scene and visible employee cards without JavaScript errors.
- [ ] Create an agent, modify role/required fields/source references/permissions; verify reload persistence.
- [ ] Missing required task inputs block simulation; save inputs to continue.
- [ ] Exercise In progress → Draft ready → Awaiting approval → Rejected → retry.
- [ ] Explicit approval is required; export only after approval and with agent capability.
- [ ] Exported file is honest plain text, containing supplied inputs and demo label.
- [ ] Audit history and scripted chat persist.
- [ ] Mobile navigation works without horizontal overflow.
- [ ] No remote service requests occur.

## Manual Phase 1 checks

- [ ] Rotate/expand scene and click each avatar; corresponding employee workspace opens.
- [ ] Add employees, deactivate/reactivate; disabled employees cannot take new tasks.
- [ ] Remove an employee without tasks; refuse removal when task history exists.
- [ ] Editing inputs invalidates an existing unapproved draft/review.
- [ ] Approved/completed tasks cannot be edited through the UI.
- [ ] Enable/disable Generate drafts and Export documents; verify local behavior.
- [ ] Search employees/tasks, empty results, document library navigation.
- [ ] Keyboard interaction, dialog Escape/close, small screens and unavailable WebGL fallback.
- [ ] Connections explicitly describe their unimplemented status and never request tokens.
- [ ] Local storage exhaustion reports that persistence failed.

## Required before production (unimplemented / unrun)

- [ ] Cross-tenant, department and role isolation; direct API calls cannot bypass UI restrictions.
- [ ] JWT validation, role escalation prevention, membership mutation restrictions and RLS negative tests.
- [ ] Google OAuth state/PKCE, least-privilege scopes, token encryption, expiry/revocation and consent.
- [ ] Denied/unselected source IDs cannot be read; source column changes and empty sheets fail clearly.
- [ ] Budget and BAF templates: all fields mapped, no invented values, Lao/Thai DOCX/PDF rendering.
- [ ] Sales ranking: authorized fixtures, month/time-zone handling, duplicate shop IDs, missing/non-numeric amounts, totals and tie order.
- [ ] Prompt injection, template injection, oversized files, sandboxing and secret redaction.
- [ ] Review hashes and revisions reject stale approval; retries are idempotent and do not duplicate writes.
- [ ] Approved exports and Drive save require current permissions and explicit target/action approval.
- [ ] Worker crashes, provider outages, rate limits, transaction rollback and audit consistency.
- [ ] No public deployment until admin approval.
