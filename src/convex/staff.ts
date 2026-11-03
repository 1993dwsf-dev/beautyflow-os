import { validateOrgReferences } from "./lib/tenant";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  AppError,
  ERR,
  getMembership,
  logAudit,
  requireMember,
  sum,
  toMinutes,
  todayInTz,
} from "./lib/helpers";

const COLORS = [
  "#0ea5a4",
  "#6366f1",
  "#f97316",
  "#ec4899",
  "#22c55e",
  "#8b5cf6",
  "#0891b2",
  "#eab308",
];

export const listStaff = query({
  args: { orgId: v.id("organizations"), includeInactive: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId, "staff.view");
    if (!member) return [];
    const rows = await ctx.db
      .query("staff")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const services = await ctx.db
      .query("services")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const serviceMap = new Map(services.map((s) => [s._id as string, s.name]));
    const today = todayInTz();

    const out = [];
    for (const s of rows) {
      if (!args.includeInactive && !s.active) continue;
      const appointments = (
        await ctx.db
          .query("appointments")
          .withIndex("by_org_staff_date", (q) =>
            q.eq("orgId", args.orgId).eq("staffId", s._id).eq("date", today),
          )
          .collect()
      ).filter((a) => a.status !== "cancelled");
      const availability = await ctx.db
        .query("staffAvailability")
        .withIndex("by_staff", (q) => q.eq("staffId", s._id))
        .collect();
      out.push({
        ...s,
        serviceNames: s.serviceIds.map((id) => serviceMap.get(id as string) ?? "—"),
        todayAppointments: appointments.length,
        todayMinutes: sum(appointments.map((a) => a.durationMin)),
        availabilityCount: availability.filter((a) => a.active).length,
      });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  },
});

export const staffOptions = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId, "staff.view");
    if (!member) return [];
    const rows = await ctx.db
      .query("staff")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    return rows
      .filter((s) => s.active)
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      .map((s) => ({
        _id: s._id,
        name: s.name,
        color: s.color,
        workingDays: s.workingDays,
        workStart: s.workStart,
        workEnd: s.workEnd,
        breakStart: s.breakStart,
        breakEnd: s.breakEnd,
        daysOff: s.daysOff,
        serviceIds: s.serviceIds,
        commissionPct: s.commissionPct,
      }));
  },
});

export const createStaff = mutation({
  args: {
    orgId: v.id("organizations"),
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    role: v.string(),
    employmentType: v.string(),
    startDate: v.optional(v.string()),
    workingDays: v.array(v.number()),
    workStart: v.string(),
    workEnd: v.string(),
    breakStart: v.optional(v.string()),
    breakEnd: v.optional(v.string()),
    serviceIds: v.array(v.id("services")),
    commissionPct: v.number(),
    hourlyRate: v.optional(v.number()),
    fixedSalary: v.optional(v.number()),
    notes: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "staff.edit");
    await validateOrgReferences(ctx, args.orgId, args);
    if (!args.name.trim()) throw new AppError("VALIDATION", "Informe o nome da profissional.");
    if (toMinutes(args.workEnd) <= toMinutes(args.workStart)) {
      throw new AppError(
        "VALIDATION",
        "O horário final precisa ser depois do horário inicial.",
      );
    }
    const count = (
      await ctx.db
        .query("staff")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .collect()
    ).length;

    const id = await ctx.db.insert("staff", {
      orgId: args.orgId,
      name: args.name.trim(),
      phone: args.phone,
      email: args.email,
      role: args.role,
      employmentType: args.employmentType,
      startDate: args.startDate,
      active: true,
      workingDays: args.workingDays,
      workStart: args.workStart,
      workEnd: args.workEnd,
      breakStart: args.breakStart,
      breakEnd: args.breakEnd,
      daysOff: [],
      serviceIds: args.serviceIds,
      commissionPct: args.commissionPct,
      hourlyRate: args.hourlyRate,
      fixedSalary: args.fixedSalary,
      color: args.color ?? COLORS[count % COLORS.length],
      notes: args.notes,
      isDemo: false,
      createdAt: Date.now(),
    });

    for (const weekday of args.workingDays) {
      await ctx.db.insert("staffAvailability", {
        orgId: args.orgId,
        staffId: id,
        weekday,
        start: args.workStart,
        end: args.workEnd,
        breakStart: args.breakStart,
        breakEnd: args.breakEnd,
        active: true,
      });
    }

    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "criar",
      entity: "staff",
      entityId: id,
      details: args.name,
    });
    return id;
  },
});

export const updateStaff = mutation({
  args: {
    orgId: v.id("organizations"),
    staffId: v.id("staff"),
    patch: v.object({
      name: v.optional(v.string()),
      phone: v.optional(v.string()),
      email: v.optional(v.string()),
      role: v.optional(v.string()),
      employmentType: v.optional(v.string()),
      startDate: v.optional(v.string()),
      workingDays: v.optional(v.array(v.number())),
      workStart: v.optional(v.string()),
      workEnd: v.optional(v.string()),
      breakStart: v.optional(v.string()),
      breakEnd: v.optional(v.string()),
      daysOff: v.optional(v.array(v.string())),
      serviceIds: v.optional(v.array(v.id("services"))),
      commissionPct: v.optional(v.number()),
      hourlyRate: v.optional(v.number()),
      fixedSalary: v.optional(v.number()),
      color: v.optional(v.string()),
      notes: v.optional(v.string()),
      active: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "staff.edit");
    await validateOrgReferences(ctx, args.orgId, args);
    const staff = await ctx.db.get(args.staffId);
    if (!staff || staff.orgId !== args.orgId) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    await ctx.db.patch(args.staffId, args.patch);
    if (args.patch.workingDays) {
      const existing = await ctx.db
        .query("staffAvailability")
        .withIndex("by_staff", (q) => q.eq("staffId", args.staffId))
        .collect();
      for (const row of existing) await ctx.db.delete(row._id);
      for (const weekday of args.patch.workingDays) {
        await ctx.db.insert("staffAvailability", {
          orgId: args.orgId,
          staffId: args.staffId,
          weekday,
          start: args.patch.workStart ?? staff.workStart,
          end: args.patch.workEnd ?? staff.workEnd,
          breakStart: args.patch.breakStart ?? staff.breakStart,
          breakEnd: args.patch.breakEnd ?? staff.breakEnd,
          active: true,
        });
      }
    }
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "atualizar",
      entity: "staff",
      entityId: args.staffId,
      details: staff.name,
    });
    return true;
  },
});

/** Weekly availability grid for one professional. */
export const staffAvailability = query({
  args: { orgId: v.id("organizations"), staffId: v.id("staff") },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId, "staff.view");
    if (!member) return [];
    const rows = await ctx.db
      .query("staffAvailability")
      .withIndex("by_staff", (q) => q.eq("staffId", args.staffId))
      .collect();
    return rows.sort((a, b) => a.weekday - b.weekday);
  },
});

export const setAvailabilityDay = mutation({
  args: {
    orgId: v.id("organizations"),
    staffId: v.id("staff"),
    weekday: v.number(),
    active: v.boolean(),
    start: v.string(),
    end: v.string(),
    breakStart: v.optional(v.string()),
    breakEnd: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { member } = await requireMember(ctx, args.orgId, "staff.edit");
    await validateOrgReferences(ctx, args.orgId, args);
    const staff = await ctx.db.get(args.staffId);
    if (!staff || staff.orgId !== args.orgId) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    if (toMinutes(args.end) <= toMinutes(args.start)) {
      throw new AppError("VALIDATION", "O horário final precisa ser depois do inicial.");
    }
    const existing = await ctx.db
      .query("staffAvailability")
      .withIndex("by_staff", (q) => q.eq("staffId", args.staffId))
      .collect()
      .then((rows) => rows.find((r) => r.weekday === args.weekday));
    const payload = {
      orgId: args.orgId,
      staffId: args.staffId,
      weekday: args.weekday,
      start: args.start,
      end: args.end,
      breakStart: args.breakStart,
      breakEnd: args.breakEnd,
      active: args.active,
    };
    if (existing) await ctx.db.patch(existing._id, payload);
    else await ctx.db.insert("staffAvailability", payload);
    return { ok: true, by: member.name };
  },
});

export const listBlocks = query({
  args: {
    orgId: v.id("organizations"),
    staffId: v.optional(v.id("staff")),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId, "staff.view");
    if (!member) return [];
    let rows;
    if (args.staffId) {
      rows = await ctx.db
        .query("staffBlocks")
        .withIndex("by_staff_date", (q) => q.eq("staffId", args.staffId!))
        .filter(q => q.eq(q.field("orgId"), args.orgId))
        .collect();
    } else {
      rows = await ctx.db
        .query("staffBlocks")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .collect();
    }
    return rows
      .filter((r) => (!args.from || r.date >= args.from) && (!args.to || r.date <= args.to))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  },
});

export const createBlock = mutation({
  args: {
    orgId: v.id("organizations"),
    staffId: v.id("staff"),
    date: v.string(),
    start: v.string(),
    end: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const { member } = await requireMember(ctx, args.orgId, "staff.edit");
    await validateOrgReferences(ctx, args.orgId, args);
    if (toMinutes(args.end) <= toMinutes(args.start)) {
      throw new AppError("VALIDATION", "O horário final do bloqueio precisa ser depois do inicial.");
    }
    const id = await ctx.db.insert("staffBlocks", {
      orgId: args.orgId,
      staffId: args.staffId,
      date: args.date,
      startMinutes: toMinutes(args.start),
      endMinutes: toMinutes(args.end),
      reason: args.reason || "Bloqueio",
    });
    await logAudit(ctx, {
      orgId: args.orgId,
      userName: member.name,
      action: "criar",
      entity: "staffBlocks",
      entityId: id,
      details: `${args.date} ${args.start}-${args.end}`,
    });
    return id;
  },
});

export const deleteBlock = mutation({
  args: { orgId: v.id("organizations"), blockId: v.id("staffBlocks") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.orgId, "staff.edit");
    await validateOrgReferences(ctx, args.orgId, args);
    const block = await ctx.db.get(args.blockId);
    if (!block || block.orgId !== args.orgId) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    await ctx.db.delete(args.blockId);
    return true;
  },
});

/** Team performance metrics computed from real transactions. */
export const staffPerformance = query({
  args: {
    orgId: v.id("organizations"),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId, "staff.view");
    if (!member) return [];
    const staff = await ctx.db
      .query("staff")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const appointments = await ctx.db
      .query("appointments")
      .withIndex("by_org_date", (q) => q.eq("orgId", args.orgId))
      .collect();
    const commissions = await ctx.db
      .query("commissions")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    const inRange = (d: string) =>
      (!args.from || d >= args.from) && (!args.to || d <= args.to);

    return staff
      .map((s) => {
        const mine = appointments.filter(
          (a) => a.staffId === s._id && inRange(a.date),
        );
        const completed = mine.filter((a) => a.status === "completed");
        const revenue = sum(completed.map((a) => a.totalPrice - a.discount));
        const clients = new Set(completed.map((a) => a.clientId as string));
        const repeat = new Set<string>();
        const seen = new Map<string, number>();
        for (const a of completed) {
          const key = a.clientId as string;
          seen.set(key, (seen.get(key) ?? 0) + 1);
        }
        for (const [k, v] of seen) if (v > 1) repeat.add(k);
        const commissionEarned = sum(
          commissions
            .filter(
              (c) => c.staffId === s._id && inRange(c.date) && c.status !== "estimada",
            )
            .map((c) => c.amount),
        );
        const commissionPaid = sum(
          commissions
            .filter((c) => c.staffId === s._id && inRange(c.date) && c.status === "paga")
            .map((c) => c.amount),
        );
        const cancelled = mine.filter((a) => a.status === "cancelled").length;
        const noShows = mine.filter((a) => a.status === "no_show").length;
        return {
          staff: s,
          completed: completed.length,
          total: mine.length,
          revenue,
          averageTicket: completed.length ? Math.round(revenue / completed.length) : 0,
          uniqueClients: clients.size,
          repeatRate: clients.size ? Math.round((repeat.size / clients.size) * 1000) / 10 : 0,
          commissionEarned,
          commissionPaid,
          cancelled,
          noShows,
          occupancyMinutes: sum(completed.map((a) => a.durationMin)),
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  },
});
