import { z } from "zod";
const short = z.string().trim().min(1).max(100);
export const AgentConfig = z.object({
  id: z.string().max(100),
  name: short,
  title: z.string().trim().min(1).max(160),
  department: short,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  avatar: z.enum([
    "robot",
    "orb",
    "capsule",
    "chibi-mint",
    "chibi-violet",
    "chibi-amber",
  ]),
  active: z.boolean(),
  description: z.string().max(2000),
  prompt: z.string().trim().min(1).max(12000),
  responsibilities: z.string().max(6000),
  allowedTasks: z.string().max(4000),
  restrictedTasks: z.string().max(4000),
  workflow: z.string().max(6000),
  requirements: z.string().max(6000),
  language: z.enum(["Lao", "Thai", "English"]),
  folder: z.string().max(1000),
  files: z.string().max(4000),
  spreadsheet: z.string().max(1000),
  tabs: z.string().max(1000),
  ranges: z.string().max(1000),
  templates: z.string().max(4000),
  additionalSources: z.string().max(4000),
  formats: z.array(z.string().max(80)).max(10),
  permissions: z.array(
    z.enum([
      "Read data",
      "Generate drafts",
      "Export documents",
      "Save approved documents",
      "Request human approval",
    ]),
  ).max(5),
  access: z.string().max(2000),
  fields: z.string().max(2000),
}).strict();
export const Kind = z.enum([
  "ceo",
  "budget",
  "baf",
  "sales",
  "marketing",
  "custom",
]);
const org = z.string().uuid();
const inputs = z.record(z.string().max(200), z.json());
export const RequestBody = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("createOrganization"),
    name: z.string().trim().min(1).max(160),
    department: short,
  }).strict(),
  z.object({
    action: z.literal("setMembership"),
    organizationId: org,
    userId: z.string().uuid(),
    role: z.enum(["admin", "manager", "member"]),
    department: short,
    active: z.boolean(),
  }).strict(),
  z.object({
    action: z.literal("saveAgent"),
    organizationId: org,
    agentId: z.string().uuid().nullable(),
    expectedRevision: z.number().int().positive().nullable(),
    kind: Kind,
    configuration: AgentConfig,
  }).strict(),
  z.object({
    action: z.literal("createTask"),
    organizationId: org,
    agentId: z.string().uuid(),
    title: z.string().trim().min(1).max(240),
    inputs,
  }).strict(),
  z.object({
    action: z.literal("updateInputs"),
    organizationId: org,
    taskId: z.string().uuid(),
    inputs,
  }).strict(),
  z.object({
    action: z.literal("route"),
    organizationId: org,
    text: z.string().trim().min(1).max(8000),
  }).strict(),
  z.object({
    action: z.literal("execute"),
    organizationId: org,
    taskId: z.string().uuid(),
    requestKey: z.string().uuid(),
  }).strict(),
  z.object({
    action: z.literal("submitReview"),
    organizationId: org,
    taskId: z.string().uuid(),
  }).strict(),
  z.object({
    action: z.literal("review"),
    organizationId: org,
    taskId: z.string().uuid(),
    draftId: z.string().uuid(),
    contentHash: z.string().regex(/^[0-9a-f]{64}$/),
    decision: z.enum(["approved", "rejected"]),
    reason: z.string().max(2000),
  }).strict(),
  z.object({
    action: z.literal("export"),
    organizationId: org,
    taskId: z.string().uuid(),
    contentHash: z.string().regex(/^[0-9a-f]{64}$/),
  }).strict(),
]);
export type AgentRow = {
  id: string;
  organization_id: string;
  department: string;
  kind: z.infer<typeof Kind>;
  active: boolean;
  revision: number;
  configuration: z.infer<typeof AgentConfig>;
};
export type Prepared = {
  created: boolean;
  missing?: string[];
  run: { id: string; status: string };
  task?: {
    id: string;
    agent_revision: number;
    title: string;
    inputs: Record<string, unknown>;
  };
  kind?: string;
  configuration?: unknown;
};
export class ApiError extends Error {
  status: number;
  details?: Record<string, unknown>;
  constructor(status: number, code: string, details?: Record<string, unknown>) {
    super(code);
    this.status = status;
    this.details = details;
  }
}
export function databaseError(
  error: { message?: string; code?: string },
): never {
  const known: Record<string, number> = {
    UNAUTHENTICATED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INVALID_INPUT: 400,
    STALE_REVISION: 409,
    DEPARTMENT_IMMUTABLE: 409,
    LAST_ADMIN: 409,
    RATE_LIMITED: 429,
    INVALID_TRANSITION: 409,
    STALE_REVIEW: 409,
    APPROVAL_REQUIRED: 409,
  };
  const code = error.message || "";
  throw new ApiError(known[code] || 500, known[code] ? code : "DATABASE_ERROR");
}
