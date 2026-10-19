import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  AppError,
  ERR,
  getMembership,
  logAudit,
  notify,
  requireMember,
  toHHMM,
  toMinutes,
} from "./lib/helpers";

export const listWaitlist = query({
  args: {
    orgId: v.id("organizations"),
    status: v.optional(v.string()),
    staffId: v.optional(v.id("staff")),
  },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId);
    if (!member) return [];
    const rows = await ctx.db
      .query("waitlistEntries")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const clients = await ctx.db
      .query("clients")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const services = await ctx.db
      .query("services")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const staff = await ctx.db
      .query("staff")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    return rows
      .filter((r) => (!args.status || r.status === args.status) && (!args.staffId || r.staffId === args.staffId))
      .map((r) => ({
        ...r,
        clientName: clients.find((c) => c._id === r.clientId)?.name ?? "—",
        clientPhone: clients.find((c) => c._id === r.clientId)?.phone ?? "",
        serviceName: services.find((s) => s._id === r.serviceId)?.name ?? "Qualquer serviço",
        staffName: staff.find((s) => s._id === r.staffId)?.name ?? "Sem preferência",
      }))
      .sort((a, b) => {
        const rank = { alta: 0, media: 1, baixa: 2 } as Record<string, number>;
        return (rank[a.priority] ?? 3) - (rank[b.priority] ?? 3) || a.createdAt - b.createdAt;
      });
  },
});

export const createWaitlistEntry = mutation({
  args: {
    orgId: v.id("organizations"),
    clientId: v.id("clients"),
    serviceId: v.optional(v.id("services")),
    staffId: v.optional(v.id("staff")),
    preferredDates: v.array(v.string()),
    timeFrom: v.string(),
    timeTo: v.string(),
    priority: v.string(),
    contact: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "appointments.edit");
    if (toMinutes(args.timeTo) <= toMinutes(args.timeFrom)) {
      throw new AppError("VALIDATION", "O horário final da preferência deve ser depois do inicial.");
    }
    const client = await ctx.db.get(args.clientId);
    if (!client || client.orgId !== args.orgId) {
      throw new AppError("VALIDATION", "Cliente não encontrada.");
    }
    const id = await ctx.db.insert("waitlistEntries", {
      orgId: args.orgId,
      clientId: args.clientId,
      serviceId: args.serviceId,
      staffId: args.staffId,
      preferredDates: args.preferredDates,
      timeFrom: args.timeFrom,
      timeTo: args.timeTo,
      priority: args.priority,
      contact: args.contact ?? client.phone,
      status: "aguardando",
      notes: args.notes,
      createdAt: Date.now(),
    });
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "criar",
      entity: "waitlistEntries",
      entityId: id,
      details: client.name,
    });
    return id;
  },
});

export const updateWaitlistStatus = mutation({
  args: {
    orgId: v.id("organizations"),
    entryId: v.id("waitlistEntries"),
    status: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "appointments.edit");
    const entry = await ctx.db.get(args.entryId);
    if (!entry || entry.orgId !== args.orgId) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    if (args.status === "agendado") {
      throw new AppError(
        "VALIDATION",
        "Confirme o agendamento na agenda e depois marque a lista de espera como atendida.",
      );
    }
    await ctx.db.patch(args.entryId, {
      status: args.status,
      notes: args.notes ?? entry.notes,
    });
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "status",
      entity: "waitlistEntries",
      entityId: args.entryId,
      details: args.status,
    });
    return true;
  },
});

export const deleteWaitlistEntry = mutation({
  args: { orgId: v.id("organizations"), entryId: v.id("waitlistEntries") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.orgId, "appointments.edit");
    const entry = await ctx.db.get(args.entryId);
    if (!entry || entry.orgId !== args.orgId) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    await ctx.db.delete(args.entryId);
    return true;
  },
});

/**
 * Finds waitlist entries compatible with a freed slot so staff can contact the
 * client. The system never auto-confirms a waitlisted booking.
 */
export const matchesForSlot = mutation({
  args: {
    orgId: v.id("organizations"),
    date: v.string(),
    start: v.string(),
    staffId: v.optional(v.id("staff")),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "appointments.edit");
    const rows = await ctx.db
      .query("waitlistEntries")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const start = toMinutes(args.start);
    const matches = rows.filter(
      (r) =>
        r.status === "aguardando" &&
        (r.preferredDates.length === 0 || r.preferredDates.includes(args.date)) &&
        start >= toMinutes(r.timeFrom) &&
        start <= toMinutes(r.timeTo) &&
        (!r.staffId || !args.staffId || r.staffId === args.staffId),
    );
    const clients = await ctx.db
      .query("clients")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    if (matches.length) {
      await notify(ctx, {
        orgId: args.orgId,
        title: "Horário liberado na lista de espera",
        body: `${matches.length} cliente(s) aguardam um horário em ${args.date} às ${toHHMM(start)}. Entre em contato para confirmar.`,
        type: "lista_espera",
        link: "/app/lista-espera",
      });
    }
    return {
      matches: matches.map((m) => ({
        ...m,
        clientName: clients.find((c) => c._id === m.clientId)?.name ?? "—",
        clientPhone: clients.find((c) => c._id === m.clientId)?.phone ?? "",
      })),
      by: member.name,
      userId,
    };
  },
});
