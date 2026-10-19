import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  AppError,
  ERR,
  assertFeature,
  currentMonth,
  getMembership,
  logAudit,
  notify,
  requireMember,
  sum,
  toHHMM,
  todayInTz,
} from "./lib/helpers";
import { assertBookable, computeSlots, requiredMinutes } from "./lib/scheduling";
import { createAppointmentRef } from "./lib/booking";

const appointmentStatusArg = v.union(
  v.literal("requested"),
  v.literal("awaiting_confirmation"),
  v.literal("confirmed"),
  v.literal("checked_in"),
  v.literal("in_progress"),
  v.literal("completed"),
  v.literal("cancelled"),
  v.literal("no_show"),
);

const TERMINAL = ["cancelled", "no_show"];

async function loadOrg(ctx: any, orgId: Id<"organizations">) {
  const org = await ctx.db.get(orgId);
  if (!org) throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
  return org;
}

/** Free slots for a date and one or more services. */
export const availability = query({
  args: {
    orgId: v.id("organizations"),
    date: v.string(),
    serviceIds: v.array(v.id("services")),
    staffId: v.optional(v.id("staff")),
    enforceLeadTime: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId);
    if (!member) return { slots: [], closed: false, weekday: 0 };
    const org = await loadOrg(ctx, args.orgId);
    const services: Doc<"services">[] = [];
    for (const id of args.serviceIds) {
      const s = await ctx.db.get(id);
      if (s && s.orgId === args.orgId && s.active) services.push(s);
    }
    if (!services.length) return { slots: [], closed: false, weekday: 0 };

    const staffRows = (
      await ctx.db
        .query("staff")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .collect()
    ).filter(
      (s) =>
        s.active &&
        (!args.staffId || s._id === args.staffId) &&
        services.every(
          (svc) => !svc.eligibleStaff.length || svc.eligibleStaff.includes(s._id),
        ),
    );

    const slots = await computeSlots(ctx, {
      org,
      staff: staffRows,
      services,
      date: args.date,
      enforceLeadTime: args.enforceLeadTime,
    });

    return {
      slots,
      closed: false,
      weekday: new Date(`${args.date}T12:00:00Z`).getUTCDay(),
      duration: requiredMinutes(services).duration,
      buffer: requiredMinutes(services).buffer,
    };
  },
});

export const listAppointments = query({
  args: {
    orgId: v.id("organizations"),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
    staffId: v.optional(v.id("staff")),
    clientId: v.optional(v.id("clients")),
    status: v.optional(v.string()),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId);
    if (!member)
      return { rows: [], counts: {}, total: 0, revenue: 0 };

    let rows: Doc<"appointments">[];
    if (args.clientId) {
      rows = await ctx.db
        .query("appointments")
        .withIndex("by_client", (q) => q.eq("clientId", args.clientId!))
        .collect();
    } else {
      const from = args.from ?? "0000-01-01";
      const to = args.to ?? "9999-12-31";
      const all = await ctx.db
        .query("appointments")
        .withIndex("by_org_date", (q) => q.eq("orgId", args.orgId))
        .collect();
      rows = all.filter((a) => a.date >= from && a.date <= to);
    }

    if (args.staffId) rows = rows.filter((a) => a.staffId === args.staffId);
    if (args.status) rows = rows.filter((a) => a.status === args.status);

    const clients = await ctx.db
      .query("clients")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const clientMap = new Map(clients.map((c) => [c._id as string, c]));
    const staff = await ctx.db
      .query("staff")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const staffMap = new Map(staff.map((s) => [s._id as string, s]));

    if (args.search) {
      const q = args.search.trim().toLowerCase();
      rows = rows.filter((a) => {
        const c = clientMap.get(a.clientId as string);
        return (
          (c?.name ?? "").toLowerCase().includes(q) ||
          (c?.phone ?? "").replace(/\D/g, "").includes(q.replace(/\D/g, ""))
        );
      });
    }

    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
    const revenue = sum(
      rows
        .filter((r) => r.status === "completed")
        .map((r) => r.totalPrice - r.discount),
    );

    const enriched = rows
      .sort(
        (a, b) =>
          (a.date < b.date ? 1 : a.date > b.date ? -1 : 0) ||
          b.startMinutes - a.startMinutes,
      )
      .slice(0, args.limit ?? 500)
      .map((a) => ({
        ...a,
        clientName: clientMap.get(a.clientId as string)?.name ?? "Cliente removida",
        clientPhone: clientMap.get(a.clientId as string)?.phone ?? "",
        staffName: staffMap.get(a.staffId as string)?.name ?? "Profissional removida",
        staffColor: staffMap.get(a.staffId as string)?.color ?? "#94a3b8",
        startLabel: toHHMM(a.startMinutes),
        endLabel: toHHMM(a.endMinutes),
      }));

    return { rows: enriched, counts, total: rows.length, revenue };
  },
});

export const appointmentDetail = query({
  args: { orgId: v.id("organizations"), appointmentId: v.id("appointments") },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId);
    if (!member) return null;
    const apt = await ctx.db.get(args.appointmentId);
    if (!apt || apt.orgId !== args.orgId) return null;
    const client = await ctx.db.get(apt.clientId);
    const staff = await ctx.db.get(apt.staffId);
    const allocations = await ctx.db
      .query("paymentAllocations")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect()
      .then((rows) => rows.filter((r) => r.appointmentId === args.appointmentId));
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_appointment", (q) => q.eq("appointmentId", args.appointmentId))
      .collect();
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect()
      .then((rows) => rows.filter((r) => r.appointmentId === args.appointmentId));
    const history = await ctx.db
      .query("appointmentStatusHistory")
      .withIndex("by_appointment", (q) => q.eq("appointmentId", args.appointmentId))
      .collect();
    const records = await ctx.db
      .query("treatmentRecords")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect()
      .then((rows) => rows.filter((r) => r.appointmentId === args.appointmentId));
    const commissions = await ctx.db
      .query("commissions")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect()
      .then((rows) => rows.filter((r) => r.appointmentId === args.appointmentId));

    return {
      appointment: { ...apt, startLabel: toHHMM(apt.startMinutes), endLabel: toHHMM(apt.endMinutes) },
      client,
      staff,
      allocations,
      payments,
      invoices,
      history: history.sort((a, b) => b.at - a.at),
      records,
      commissions,
      paid: sum(allocations.filter((a) => a.kind !== "reembolso").map((a) => a.amount)),
      depositPaid: sum(
        payments.filter((p) => p.kind === "sinal" && p.amount > 0).map((p) => p.amount),
      ),
    };
  },
});

export const createAppointment = mutation({
  args: {
    orgId: v.id("organizations"),
    clientId: v.id("clients"),
    staffId: v.id("staff"),
    serviceIds: v.array(v.id("services")),
    date: v.string(),
    start: v.string(),
    discount: v.optional(v.number()),
    notes: v.optional(v.string()),
    source: v.optional(v.string()),
    enforceLeadTime: v.optional(v.boolean()),
    rescheduledFrom: v.optional(v.id("appointments")),
    notifyClient: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "appointments.edit");
    return await createAppointmentRef(ctx, {
      orgId: args.orgId,
      clientId: args.clientId,
      staffId: args.staffId,
      serviceIds: args.serviceIds,
      date: args.date,
      start: args.start,
      discount: args.discount,
      notes: args.notes,
      source: args.source,
      enforceLeadTime: args.enforceLeadTime,
      rescheduledFrom: args.rescheduledFrom as string | undefined,
      userId,
      memberName: member.name,
      notifyClient: args.notifyClient,
    });
  },
});

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export const rescheduleAppointment = mutation({
  args: {
    orgId: v.id("organizations"),
    appointmentId: v.id("appointments"),
    date: v.string(),
    start: v.string(),
    staffId: v.optional(v.id("staff")),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "appointments.edit");
    const org = await loadOrg(ctx, args.orgId);
    const apt = await ctx.db.get(args.appointmentId);
    if (!apt || apt.orgId !== args.orgId) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    if (apt.status === "completed") {
      throw new AppError(
        "VALIDATION",
        "Atendimentos concluídos não podem ser remarcados. Crie um novo agendamento.",
      );
    }
    const staffId = args.staffId ?? apt.staffId;
    const staff = await ctx.db.get(staffId);
    if (!staff || staff.orgId !== args.orgId) {
      throw new AppError("VALIDATION", "Profissional não encontrada.");
    }
    const services: Doc<"services">[] = [];
    for (const item of apt.items) {
      if (item.kind !== "service" || !item.refId) continue;
      const s = await ctx.db.get(item.refId as Id<"services">);
      if (s) services.push(s);
    }
    const startMinutes = minutes(args.start);
    const check = await assertBookable(ctx, {
      org,
      staff,
      services: services.length
        ? services
        : [
            {
              durationMin: apt.durationMin,
              bufferMin: apt.bufferMin,
            } as Doc<"services">,
          ],
      date: args.date,
      startMinutes,
      ignoreAppointmentId: args.appointmentId,
      skipPastCheck: false,
    });

    await ctx.db.patch(args.appointmentId, {
      date: args.date,
      startMinutes,
      endMinutes: check.endMinutes,
      staffId,
      durationMin: check.duration,
      bufferMin: check.buffer,
      status: apt.status === "cancelled" || apt.status === "no_show" ? "confirmed" : apt.status,
    });

    await ctx.db.insert("appointmentStatusHistory", {
      orgId: args.orgId,
      appointmentId: args.appointmentId,
      from: apt.status,
      to: "remarcado",
      at: Date.now(),
      by: userId,
      note: `${apt.date} ${toHHMM(apt.startMinutes)} → ${args.date} ${args.start}`,
    });

    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "remarcar",
      entity: "appointments",
      entityId: args.appointmentId,
      details: `${apt.date} → ${args.date} ${args.start}`,
    });
    return true;
  },
});

export const setAppointmentStatus = mutation({
  args: {
    orgId: v.id("organizations"),
    appointmentId: v.id("appointments"),
    status: appointmentStatusArg,
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "appointments.edit");
    const apt = await ctx.db.get(args.appointmentId);
    if (!apt || apt.orgId !== args.orgId) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    if (apt.status === args.status) return true;

    if (args.status === "completed") {
      throw new AppError(
        "VALIDATION",
        "Use a ação “Concluir atendimento” para registrar produtos, comissão e retorno.",
      );
    }
    if (TERMINAL.includes(args.status) && !args.reason) {
      throw new AppError(
        "VALIDATION",
        "Informe o motivo do cancelamento ou da falta.",
      );
    }

    await ctx.db.patch(args.appointmentId, {
      status: args.status,
      cancellationReason: TERMINAL.includes(args.status) ? args.reason : apt.cancellationReason,
    });
    await ctx.db.insert("appointmentStatusHistory", {
      orgId: args.orgId,
      appointmentId: args.appointmentId,
      from: apt.status,
      to: args.status,
      at: Date.now(),
      by: userId,
      note: args.reason,
    });
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "status",
      entity: "appointments",
      entityId: args.appointmentId,
      details: `${apt.status} → ${args.status}`,
    });
    return true;
  },
});

export const deleteAppointment = mutation({
  args: { orgId: v.id("organizations"), appointmentId: v.id("appointments") },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "appointments.delete");
    const apt = await ctx.db.get(args.appointmentId);
    if (!apt || apt.orgId !== args.orgId) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    if (invoices.some((i) => i.appointmentId === args.appointmentId)) {
      throw new AppError(
        "VALIDATION",
        "Este atendimento possui fatura emitida. Cancele a fatura antes de excluir o agendamento.",
      );
    }
    await ctx.db.delete(args.appointmentId);
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "excluir",
      entity: "appointments",
      entityId: args.appointmentId,
      details: `${apt.date} ${toHHMM(apt.startMinutes)}`,
    });
    return true;
  },
});

/**
 * Completes an appointment and applies every connected business rule:
 * treatment record, inventory consumption, commissions, loyalty and rebooking.
 */
export const completeAppointment = mutation({
  args: {
    orgId: v.id("organizations"),
    appointmentId: v.id("appointments"),
    notes: v.optional(v.string()),
    formula: v.optional(v.string()),
    reactions: v.optional(v.string()),
    aftercare: v.optional(v.string()),
    nextVisitIntervalDays: v.optional(v.number()),
    productsUsed: v.array(
      v.object({
        productId: v.optional(v.id("products")),
        name: v.string(),
        quantity: v.number(),
      }),
    ),
    createTreatmentRecord: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "appointments.edit");
    const apt = await ctx.db.get(args.appointmentId);
    if (!apt || apt.orgId !== args.orgId) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    if (apt.status === "completed") {
      throw new AppError(
        "CONFLICT",
        "Este atendimento já foi concluído. Verifique o histórico antes de tentar novamente.",
      );
    }
    const org = await loadOrg(ctx, args.orgId);
    const today = todayInTz(org.timezone);
    const staff = await ctx.db.get(apt.staffId);

    // 1. status
    await ctx.db.patch(args.appointmentId, { status: "completed", completedAt: Date.now() });
    await ctx.db.insert("appointmentStatusHistory", {
      orgId: args.orgId,
      appointmentId: args.appointmentId,
      from: apt.status,
      to: "completed",
      at: Date.now(),
      by: userId,
    });

    const netTotal = apt.totalPrice - apt.discount;
    const ratio = apt.totalPrice > 0 ? netTotal / apt.totalPrice : 1;

    // 2. commissions (service + product lines)
    for (const item of apt.items) {
      if (item.kind !== "service" && item.kind !== "product") continue;
      const service = item.refId
        ? await ctx.db.get(item.refId as Id<"services">)
        : null;
      const basisLabel = org.commissionBaseDefault ?? "net_discount";
      let pct = staff?.commissionPct ?? 0;
      let ruleLabel = `${pct}% sobre o valor ${basisLabel === "gross" ? "bruto" : "com desconto"}`;
      if (service?.commissionPct !== undefined && service.commissionPct !== null) {
        pct = service.commissionPct;
        ruleLabel = `${pct}% específico do serviço ${service.name}`;
      }
      const base = basisLabel === "gross" ? item.total : Math.round(item.total * ratio);
      const amount = Math.round((base * pct) / 100);
      if (amount <= 0) continue;
      const isCollected = basisLabel === "collected";
      await ctx.db.insert("commissions", {
        orgId: args.orgId,
        staffId: apt.staffId,
        appointmentId: args.appointmentId,
        kind: item.kind === "product" ? "produto" : "servico",
        baseAmount: base,
        ruleLabel: isCollected
          ? `${pct}% sobre receita recebida (aguardando recebimento)`
          : ruleLabel,
        amount,
        status: isCollected ? "estimada" : "ganha",
        date: apt.date,
        isDemo: false,
        createdAt: Date.now(),
      });
    }

    // 3. inventory consumption from configured rules + reported usage
    const consumption: { productId: Id<"products">; quantity: number; name: string }[] =
      [...args.productsUsed]
        .filter((p) => p.productId)
        .map((p) => ({
          productId: p.productId as Id<"products">,
          quantity: p.quantity,
          name: p.name,
        }));

    for (const item of apt.items) {
      if (item.kind !== "service" || !item.refId) continue;
      const rules = await ctx.db
        .query("serviceConsumptionRules")
        .withIndex("by_service", (q) => q.eq("serviceId", item.refId as Id<"services">))
        .collect();
      for (const rule of rules) {
        if (consumption.some((c) => c.productId === rule.productId)) continue;
        const product = await ctx.db.get(rule.productId);
        consumption.push({
          productId: rule.productId,
          quantity: rule.quantity,
          name: product?.name ?? "Produto",
        });
      }
    }

    for (const use of consumption) {
      const product = await ctx.db.get(use.productId);
      if (!product || product.orgId !== args.orgId) continue;
      const delta = -Math.abs(use.quantity);
      const balanceAfter = product.quantity + delta;
      const movementId = await ctx.db.insert("inventoryMovements", {
        orgId: args.orgId,
        productId: use.productId,
        type: "consumo",
        quantity: delta,
        balanceAfter,
        unitCost: product.cost,
        reason: "Consumo em atendimento",
        appointmentId: args.appointmentId,
        staffId: apt.staffId,
        date: apt.date,
        isDemo: false,
        createdAt: Date.now(),
        createdBy: userId,
      });
      await ctx.db.patch(product._id, { quantity: balanceAfter });
      await ctx.db.insert("serviceConsumptionRecords", {
        orgId: args.orgId,
        appointmentId: args.appointmentId,
        serviceId: (apt.items[0]?.refId ?? "") as Id<"services">,
        productId: use.productId,
        quantity: Math.abs(use.quantity),
        unitCost: product.cost,
        movementId,
        date: apt.date,
        createdAt: Date.now(),
      });
      if (balanceAfter <= product.minStock) {
        await notify(ctx, {
          orgId: args.orgId,
          title: "Estoque baixo",
          body: `${product.name} está com ${balanceAfter} unidade(s) e o mínimo é ${product.minStock}.`,
          type: "estoque",
          link: "/app/inventario",
        });
      }
    }

    // 4. treatment record + rebooking cycle
    const nextVisitDate = args.nextVisitIntervalDays
      ? addDays(today, args.nextVisitIntervalDays)
      : undefined;
    if (args.createTreatmentRecord !== false) {
      await ctx.db.insert("treatmentRecords", {
        orgId: args.orgId,
        clientId: apt.clientId,
        appointmentId: args.appointmentId,
        serviceId: (apt.items[0]?.refId ?? undefined) as Id<"services"> | undefined,
        serviceName: apt.items.map((i) => i.name).join(", "),
        staffId: apt.staffId,
        date: today,
        productsUsed: args.productsUsed,
        notes: args.notes,
        formula: args.formula,
        reactions: args.reactions,
        aftercare: args.aftercare,
        nextVisitIntervalDays: args.nextVisitIntervalDays,
        nextVisitDate,
        sensitive: true,
        isDemo: false,
        createdAt: Date.now(),
        createdBy: userId,
      });
    }

    if (nextVisitDate) {
      await ctx.db.insert("followUpTasks", {
        orgId: args.orgId,
        clientId: apt.clientId,
        type: "retorno",
        dueDate: nextVisitDate,
        status: "pendente",
        notes: `Retorno recomendado após ${args.nextVisitIntervalDays} dias`,
        assignedTo: apt.staffId,
        createdAt: Date.now(),
      });
    }

    // 5. loyalty points (based on collected value only)
    const loyalty = org.loyaltySettings;
    if (loyalty?.enabled) {
      const account = await ctx.db
        .query("loyaltyAccounts")
        .withIndex("by_client", (q) => q.eq("clientId", apt.clientId))
        .first();
      const earned = Math.round((netTotal / 100) * loyalty.pointsPerReal) + loyalty.pointsPerVisit;
      const balanceBefore = account?.points ?? 0;
      const balanceAfter = balanceBefore + Math.max(0, earned);
      if (account) {
        const tier =
          [...loyalty.tiers].sort((a, b) => b.minPoints - a.minPoints).find((t) => balanceAfter >= t.minPoints)
            ?.name ?? account.tier;
        await ctx.db.patch(account._id, {
          points: balanceAfter,
          tier,
          updatedAt: Date.now(),
        });
      } else {
        await ctx.db.insert("loyaltyAccounts", {
          orgId: args.orgId,
          clientId: apt.clientId,
          points: balanceAfter,
          tier: loyalty.tiers[0]?.name ?? "Bronze",
          updatedAt: Date.now(),
        });
      }
      await ctx.db.insert("loyaltyTransactions", {
        orgId: args.orgId,
        clientId: apt.clientId,
        points: Math.max(0, earned),
        reason: "Atendimento concluído",
        refType: "appointments",
        refId: args.appointmentId,
        date: today,
        balanceAfter,
        isDemo: false,
        createdAt: Date.now(),
      });
    }

    // 6. usage metering
    await recordUsage(ctx, args.orgId, "appointments");

    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "concluir",
      entity: "appointments",
      entityId: args.appointmentId,
      details: `Receita líquida ${(netTotal / 100).toFixed(2)}`,
    });

    return { ok: true, nextVisitDate };
  },
});

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export async function recordUsage(
  ctx: any,
  orgId: Id<"organizations">,
  metric: string,
) {
  const period = currentMonth();
  const existing = await ctx.db
    .query("usageRecords")
    .withIndex("by_org", (q: any) =>
      q.eq("orgId", orgId).eq("period", period),
    )
    .collect()
    .then((rows: any[]) => rows.find((r) => r.metric === metric));
  if (existing) {
    await ctx.db.patch(existing._id, { value: existing.value + 1 });
  } else {
    await ctx.db.insert("usageRecords", { orgId, period, metric, value: 1 });
  }
}
