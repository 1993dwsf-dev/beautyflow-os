import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  DEFAULT_FEATURE_FLAGS,
  hasPermission,
  type FeatureKey,
  type OrgRole,
  type Permission,
} from "./permissions";

export type Ctx = QueryCtx | MutationCtx;

/**
 * Business-level error surfaced to the UI. Messages are already written in
 * pt-BR. It extends ConvexError so the message reaches the browser instead of
 * being replaced by a generic server error.
 */
export class AppError extends ConvexError<{ code: string; message: string }> {
  code: string;
  constructor(code: string, message: string) {
    super({ code, message });
    this.code = code;
    this.name = "AppError";
  }
}

export const ERR = {
  NOT_AUTHENTICATED: "Você precisa entrar na sua conta para continuar.",
  NO_ORG: "Nenhum espaço de trabalho selecionado.",
  NOT_MEMBER: "Você não possui permissão para acessar este registro.",
  PERMISSION: "Você não possui permissão para executar esta ação.",
  NOT_FOUND: "Registro não encontrado.",
  FEATURE: "Este módulo não está habilitado nesta organização.",
} as const;

export function todayInTz(tz = "America/Sao_Paulo"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function currentMonth(): string {
  return todayInTz().slice(0, 7);
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function diffDaysISO(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const da = Date.UTC(ay, am - 1, ad);
  const db = Date.UTC(by, bm - 1, bd);
  return Math.round((da - db) / 86_400_000);
}

/** "HH:MM" -> minutes from midnight */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export async function getUserId(ctx: Ctx): Promise<Id<"users"> | null> {
  return await getAuthUserId(ctx);
}

export async function getMembership(
  ctx: Ctx,
  orgId: Id<"organizations">,
  permission?: Permission,
): Promise<Doc<"organizationMembers"> | null> {
  const userId = await getUserId(ctx);
  if (!userId) return null;
  const member = await ctx.db
    .query("organizationMembers")
    .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", userId))
    .first();
  if (!member || !member.active) return null;
  if (permission && ((permission === "users.manage" && member.role !== "owner") || !hasPermission(member.role as OrgRole, permission, member.extraPermissions))) return null;
  return member;
}

/**
 * Authorize the current user against an organization and (optionally) a
 * permission. Throws AppError with a pt-BR message when it fails, so the
 * frontend can show a real error instead of failing silently.
 */
export async function requireMember(
  ctx: Ctx,
  orgId: Id<"organizations">,
  permission?: Permission,
): Promise<{ userId: Id<"users">; member: Doc<"organizationMembers"> }> {
  const userId = await getUserId(ctx);
  if (!userId) throw new AppError("UNAUTHENTICATED", ERR.NOT_AUTHENTICATED);
  const member = await getMembership(ctx, orgId);
  if (!member) throw new AppError("FORBIDDEN", ERR.NOT_MEMBER);
  if (
    permission &&
    ((permission === "users.manage" && member.role !== "owner") || !hasPermission(member.role as OrgRole, permission, member.extraPermissions))
  ) {
    throw new AppError("FORBIDDEN", ERR.PERMISSION);
  }
  return { userId, member };
}

export async function assertFeature(
  ctx: Ctx,
  orgId: Id<"organizations">,
  key: FeatureKey,
) {
  const flag = await ctx.db
    .query("featureFlags")
    .withIndex("by_org", (q) => q.eq("orgId", orgId).eq("key", key))
    .first();
  const enabled = flag ? flag.enabled : DEFAULT_FEATURE_FLAGS[key];
  if (!enabled) throw new AppError("FEATURE_DISABLED", ERR.FEATURE);
  return enabled;
}

/**
 * Load any document and make sure it belongs to the given organization.
 * Prevents insecure direct object references across tenants.
 */
export async function loadOrgDoc<T extends { orgId: Id<"organizations"> }>(
  ctx: Ctx,
  id: any,
  orgId: Id<"organizations">,
): Promise<T> {
  const doc = (await ctx.db.get(id)) as T | null;
  if (!doc || doc.orgId !== orgId) {
    throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
  }
  return doc;
}

export async function logAudit(
  ctx: MutationCtx,
  args: {
    orgId: Id<"organizations">;
    userId?: Id<"users">;
    userName: string;
    action: string;
    entity: string;
    entityId?: string;
    details?: string;
  },
) {
  await ctx.db.insert("auditLogs", {
    orgId: args.orgId,
    userId: args.userId,
    userName: args.userName,
    action: args.action,
    entity: args.entity,
    entityId: args.entityId,
    details: args.details,
    at: Date.now(),
  });
}

export async function notify(
  ctx: MutationCtx,
  args: {
    orgId: Id<"organizations">;
    title: string;
    body: string;
    type: string;
    link?: string;
  },
) {
  await ctx.db.insert("notifications", {
    orgId: args.orgId,
    title: args.title,
    body: args.body,
    type: args.type,
    read: false,
    link: args.link,
    at: Date.now(),
  });
}

/** Sequential document numbering, e.g. FAT-2026-0001. */
export async function nextSequence(
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  table: "invoices" | "quotes",
  prefix: string,
): Promise<string> {
  const year = todayInTz().slice(0, 4);
  const rows = await ctx.db
    .query(table)
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  const count = rows.filter((d) => d.number.startsWith(`${prefix}-${year}`))
    .length;
  return `${prefix}-${year}-${String(count + 1).padStart(4, "0")}`;
}

/** Round to 2 decimals without floating point drift on centavos. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Safe percentage that never divides by zero. */
export function pct(part: number, total: number): number {
  if (!total) return 0;
  return round2((part / total) * 100);
}

export function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

export { hasPermission };
export type { FeatureKey, OrgRole, Permission };
