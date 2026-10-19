import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import {
  AppError,
  ERR,
  getMembership,
  logAudit,
  notify,
  requireMember,
  sum,
  todayInTz,
} from "./lib/helpers";

const BASIS_LABELS: Record<string, string> = {
  gross: "Valor bruto do serviço",
  net_discount: "Valor do serviço com desconto aplicado",
  collected: "Receita efetivamente recebida",
};

export const listCommissionRules = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId);
    if (!member) return [];
    const rules = await ctx.db
      .query("commissionRules")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const staff = await ctx.db
      .query("staff")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const services = await ctx.db
      .query("services")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    return rules.map((r) => ({
      ...r,
      basisLabel: BASIS_LABELS[r.basis] ?? r.basis,
      staffName: staff.find((s) => s._id === r.staffId)?.name,
      serviceName: services.find((s) => s._id === r.serviceId)?.name,
    }));
  },
});

export const saveCommissionRule = mutation({
  args: {
    orgId: v.id("organizations"),
    ruleId: v.optional(v.id("commissionRules")),
    name: v.string(),
    scope: v.string(),
    serviceId: v.optional(v.id("services")),
    staffId: v.optional(v.id("staff")),
    type: v.string(),
    basis: v.string(),
    value: v.number(),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "commissions.pay");
    if (!args.name.trim()) throw new AppError("VALIDATION", "Informe o nome da regra.");
    if (args.value < 0) throw new AppError("VALIDATION", "O valor da regra não pode ser negativo.");
    if (args.scope === "service" && !args.serviceId) {
      throw new AppError("VALIDATION", "Selecione o serviço desta regra.");
    }
    if (args.scope === "staff" && !args.staffId) {
      throw new AppError("VALIDATION", "Selecione a profissional desta regra.");
    }
    const payload = {
      orgId: args.orgId,
      name: args.name.trim(),
      scope: args.scope,
      serviceId: args.serviceId,
      staffId: args.staffId,
      type: args.type,
      basis: args.basis,
      value: args.value,
      active: args.active ?? true,
      createdAt: Date.now(),
    };
    if (args.ruleId) {
      const existing = await ctx.db.get(args.ruleId);
      if (!existing || existing.orgId !== args.orgId) {
        throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
      }
      await ctx.db.patch(args.ruleId, payload);
      return args.ruleId;
    }
    const id = await ctx.db.insert("commissionRules", payload);
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "criar_regra_comissao",
      entity: "commissionRules",
      entityId: id,
      details: `${args.name} · ${args.type === "percent" ? `${args.value}%` : "valor fixo"}`,
    });
    return id;
  },
});

export const deleteCommissionRule = mutation({
  args: { orgId: v.id("organizations"), ruleId: v.id("commissionRules") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.orgId, "commissions.pay");
    const rule = await ctx.db.get(args.ruleId);
    if (!rule || rule.orgId !== args.orgId) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    await ctx.db.delete(args.ruleId);
    return true;
  },
});

export const listCommissions = query({
  args: {
    orgId: v.id("organizations"),
    staffId: v.optional(v.id("staff")),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId);
    if (!member) return { rows: [], summary: [], gross: 0 };
    let rows = await ctx.db
      .query("commissions")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    if (args.staffId) rows = rows.filter((r) => r.staffId === args.staffId);
    if (args.from) rows = rows.filter((r) => r.date >= args.from!);
    if (args.to) rows = rows.filter((r) => r.date <= args.to!);
    if (args.status) rows = rows.filter((r) => r.status === args.status);

    const staff = await ctx.db
      .query("staff")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const staffMap = new Map(staff.map((s) => [s._id as string, s]));

    const summaryMap = new Map<
      string,
      { staffId: string; name: string; estimated: number; earned: number; paid: number; items: number }
    >();
    for (const r of rows) {
      const key = r.staffId as string;
      const entry =
        summaryMap.get(key) ??
        {
          staffId: key,
          name: staffMap.get(key)?.name ?? "—",
          estimated: 0,
          earned: 0,
          paid: 0,
          items: 0,
        };
      if (r.status === "estimada") entry.estimated += r.amount;
      if (r.status === "ganha") entry.earned += r.amount;
      if (r.status === "paga") {
        entry.earned += r.amount;
        entry.paid += r.amount;
      }
      entry.items += 1;
      summaryMap.set(key, entry);
    }

    return {
      rows: rows
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .map((c) => ({
          ...c,
          staffName: staffMap.get(c.staffId as string)?.name ?? "—",
          staffColor: staffMap.get(c.staffId as string)?.color ?? "#94a3b8",
        })),
      summary: Array.from(summaryMap.values()).sort((a, b) => b.earned - a.earned),
      gross: sum(rows.map((c) => c.baseAmount)),
    };
  },
});

export const listStatements = query({
  args: { orgId: v.id("organizations"), staffId: v.optional(v.id("staff")) },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId);
    if (!member) return [];
    let rows = await ctx.db
      .query("commissionStatements")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    if (args.staffId) rows = rows.filter((r) => r.staffId === args.staffId);
    const staff = await ctx.db
      .query("staff")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    return rows
      .map((s) => ({
        ...s,
        staffName: staff.find((x) => x._id === s.staffId)?.name ?? "—",
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Closes a period for one professional. Estimated commissions stay estimated;
 * earned commissions are locked into the statement.
 */
export const generateStatement = mutation({
  args: {
    orgId: v.id("organizations"),
    staffId: v.id("staff"),
    periodStart: v.string(),
    periodEnd: v.string(),
    includeEstimated: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "commissions.pay");
    const staff = await ctx.db.get(args.staffId);
    if (!staff || staff.orgId !== args.orgId) {
      throw new AppError("VALIDATION", "Profissional não encontrada.");
    }
    const rows = (
      await ctx.db
        .query("commissions")
        .withIndex("by_staff", (q) => q.eq("staffId", args.staffId))
        .collect()
    ).filter(
      (c) =>
        c.date >= args.periodStart &&
        c.date <= args.periodEnd &&
        !c.statementId &&
        (c.status === "ganha" || (args.includeEstimated && c.status === "estimada")),
    );
    if (!rows.length) {
      throw new AppError(
        "VALIDATION",
        "Nenhuma comissão disponível neste período para gerar o extrato.",
      );
    }
    const totalEarned = sum(rows.map((r) => r.amount));
    const statementId = await ctx.db.insert("commissionStatements", {
      orgId: args.orgId,
      staffId: args.staffId,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      totalEarned,
      totalPaid: 0,
      status: "aberto",
      notes: `${rows.length} lançamentos`,
      createdAt: Date.now(),
    });
    for (const r of rows) {
      await ctx.db.patch(r._id, {
        statementId,
        status: args.includeEstimated && r.status === "estimada" ? "ganha" : r.status,
      });
    }
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "gerar_extrato_comissao",
      entity: "commissionStatements",
      entityId: statementId,
      details: `${staff.name} · ${(totalEarned / 100).toFixed(2)}`,
    });
    return statementId;
  },
});

export const payStatement = mutation({
  args: {
    orgId: v.id("organizations"),
    statementId: v.id("commissionStatements"),
    paymentDate: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "commissions.pay");
    const statement = await ctx.db.get(args.statementId);
    if (!statement || statement.orgId !== args.orgId) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    if (statement.status === "pago") {
      throw new AppError("CONFLICT", "Este extrato já foi pago.");
    }
    const date = args.paymentDate ?? todayInTz();
    const rows = (
      await ctx.db
        .query("commissions")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .collect()
    ).filter((c) => c.statementId === args.statementId);
    for (const r of rows) {
      await ctx.db.patch(r._id, { status: "paga" });
    }
    await ctx.db.patch(args.statementId, {
      status: "pago",
      totalPaid: statement.totalEarned,
      paidDate: date,
      notes: args.notes ?? statement.notes,
    });
    await notify(ctx, {
      orgId: args.orgId,
      title: "Extrato de comissão pago",
      body: `Extrato de ${statement.periodStart} a ${statement.periodEnd} marcado como pago em ${date}.`,
      type: "comissoes",
      link: "/app/comissoes",
    });
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "pagar_extrato_comissao",
      entity: "commissionStatements",
      entityId: args.statementId,
      details: `${(statement.totalEarned / 100).toFixed(2)} em ${date}`,
    });
    return true;
  },
});

export const statementDetail = query({
  args: { orgId: v.id("organizations"), statementId: v.id("commissionStatements") },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId);
    if (!member) return null;
    const statement = await ctx.db.get(args.statementId);
    if (!statement || statement.orgId !== args.orgId) return null;
    const staff = await ctx.db.get(statement.staffId);
    const org = await ctx.db.get(args.orgId);
    const rows = (
      await ctx.db
        .query("commissions")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .collect()
    ).filter((c) => c.statementId === args.statementId);
    return { statement, staff, org, rows };
  },
});

/** Adds a tip / gratuity to a professional. */
export const addTip = mutation({
  args: {
    orgId: v.id("organizations"),
    staffId: v.id("staff"),
    appointmentId: v.optional(v.id("appointments")),
    amount: v.number(),
    date: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "commissions.pay");
    if (args.amount <= 0) throw new AppError("VALIDATION", "O valor da gorjeta deve ser maior que zero.");
    const id = await ctx.db.insert("commissions", {
      orgId: args.orgId,
      staffId: args.staffId,
      appointmentId: args.appointmentId,
      kind: "gorjeta",
      baseAmount: args.amount,
      ruleLabel: "Gorjeta 100% para a profissional",
      amount: args.amount,
      status: "ganha",
      date: args.date ?? todayInTz(),
      isDemo: false,
      createdAt: Date.now(),
    });
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "gorjeta",
      entity: "commissions",
      entityId: id,
      details: (args.amount / 100).toFixed(2),
    });
    return id;
  },
});

/** Estimates what a service would pay, without writing anything. */
export const simulateCommission = mutation({
  args: {
    orgId: v.id("organizations"),
    staffId: v.id("staff"),
    serviceId: v.id("services"),
    price: v.number(),
    discount: v.number(),
  },
  handler: async (ctx, args): Promise<{
    basisLabel: string;
    base: number;
    pct: number;
    amount: number;
    ruleLabel: string;
  }> => {
    await requireMember(ctx, args.orgId, "commissions.view");
    const org = await ctx.db.get(args.orgId);
    const staff = await ctx.db.get(args.staffId);
    const service = await ctx.db.get(args.serviceId);
    if (!org || !staff || !service) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    const basis = (org.commissionBaseDefault ?? "net_discount") as keyof typeof BASIS_LABELS;
    const base =
      basis === "gross" ? args.price : args.price - args.discount;
    const pct = service.commissionPct ?? staff.commissionPct;
    return {
      basisLabel: BASIS_LABELS[basis],
      base,
      pct,
      amount: Math.round((base * pct) / 100),
      ruleLabel: `${pct}% sobre ${BASIS_LABELS[basis].toLowerCase()}`,
    };
  },
});

export type CommissionDoc = Doc<"commissions">;
