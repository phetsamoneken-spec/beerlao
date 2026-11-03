# AGENT HQ preservation checklist — before redesign

- [x] Inspected source, dependencies, model, persistence, agent builder, tasks and approval flow.
- [x] Source and last standalone build preserved at `/workspace/orbit-before-agent-hq.zip` before changes.
- [x] Existing agent IDs: `mali`, `kham`, `noy`. Names and roles remain editable; do not rename stored records to AI 1/2/3.
- [x] Existing storage: `orbit-office-v1` contains agents, tasks and messages; `orbit-language` contains locale. Keep both keys and schemas.
- [x] Source references, templates, instructions, permissions and outputs reside in each Agent record. No reset or replacement is needed for the scene.
- [x] Google Drive / Sheets / Supabase connections are currently unimplemented previews. No connected backend, auth, database or OAuth tokens were found in this project.
- [x] Proposed schema and API docs exist; they are not deployed databases or services.
- [x] Existing workflow is an explicitly labeled local simulation with input gates, drafts, human review and plain-text export. Keep it labeled as a simulation.
- [x] Validate pre-existing records survive scene load, CEO navigation, delegation and reload.
- [x] Verify added employees receive workstations without changing existing IDs.
- [x] Verify approval/export gates and Lao font still work.

CEO state is separate additive metadata. Never place a CEO record into the employee array or rewrite saved employee configurations. The browser belonging to the user cannot be inspected from this environment; preservation tests use seeded nonproduction records. Keep the same browser origin or export/import a backup when moving between origins/files.

## Chibi visual update preservation

The prior pixel-office source package was copied to `/workspace/agent-hq-before-chibi.zip`. Its renderer is also retained as `src/PixelOffice.tsx`. No agent IDs, tasks, templates, source references, permissions, messages, CEO routes or storage keys were replaced by this visual change. New chibi avatar choices extend the existing enum; existing values remain supported without migration.
