import { z } from "zod";
import { ApiError } from "./contracts.ts";
const uuid = z.string().uuid();
const base = { organizationId: uuid };
export const DriveRequest = z.discriminatedUnion("action", [
  z.object({
    ...base,
    action: z.literal("start"),
    department: z.string().trim().min(1).max(100),
    consentReadOnly: z.literal(true),
  }).strict(),
  z.object({ ...base, action: z.literal("status"), attemptId: uuid }).strict(),
  z.object({ ...base, action: z.literal("confirm"), attemptId: uuid }).strict(),
  z.object({
    ...base,
    action: z.literal("approveFile"),
    connectionId: uuid,
    agentId: uuid,
    fileReference: z.string().trim().min(1).max(1000),
    confirmRead: z.literal(true),
  }).strict(),
  z.object({ ...base, action: z.literal("read"), sourceId: uuid }).strict(),
  z.object({ ...base, action: z.literal("disconnect"), connectionId: uuid })
    .strict(),
]);
export function driveFileId(reference: string) {
  if (/^[A-Za-z0-9_-]{10,200}$/.test(reference)) return reference;
  try {
    const url = new URL(reference);
    if (url.protocol !== "https:" || url.port || url.username || url.password) {
      throw Error();
    }
    let id: string | null = null;
    if (url.hostname === "drive.google.com") {
      id = url.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]+)/)?.[1] ||
        (url.pathname === "/open" ? url.searchParams.get("id") : null);
    }
    if (url.hostname === "docs.google.com") {
      id = url.pathname.match(/^\/document\/d\/([A-Za-z0-9_-]+)/)?.[1] || null;
    }
    if (id && /^[A-Za-z0-9_-]{10,200}$/.test(id)) return id;
  } catch {
    /* Return one stable validation error, never fetch the supplied URL. */
  }
  throw new ApiError(422, "DRIVE_FILE_REFERENCE_INVALID");
}
