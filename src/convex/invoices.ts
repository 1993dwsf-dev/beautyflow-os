import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  AppError,
  ERR,
  assertFeature,
  getMembership,
  logAudit,
  nextSequence,
  notify,
  requireMember,
  sum,
  todayInTz,
} from "./lib/helpers";
import { createAppointmentRef } from "./lib/booking";

export const lineItemArg = v.object({
  kind: v.union(
    v.literal("service"),
    v.literal("product"),
    v.literal("labor"),
    v.literal("package"),
  ),
  refId: v.optional(v.string()),
  name: v.string(),
  quantity: v.number(),
  unitPrice: v.number(),
  total: v.number(),
});

async function paidForInvoice(ctx: any, invoiceId: Id<"invoices">) {
  const allocations = await ctx.db
    .query("paymentAllocations")
    .withIndex("by_invoice", (q: any) => q.eq("invoiceId", invoiceId))
    .collect();
  return sum(allocations.map((a: any) => a.amount));
}

export async function decorateInvoice(ctx: any, inv: Doc<"invoices">) {
  const paid = await paidForInvoice(ctx, inv._id);
  const outstanding = Math.max(0, inv.total - paid);
  return {
    ...inv,
    paid,
    outstanding,
    dueDays: inv.dueDate ? inv.dueDate : null,
  };
}

export const listInvoices = query({
  args: {
    orgId: v.id("organizations"),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
    status: v.optional(v.string()),
    clientId: v.optional(v.id("clients")),
  },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId);
    if (!member) return { rows: [], totals: { issued: 0, paid: 0, outstanding: 0 } };
    let rows: Doc<"invoices">[];
    if (args.clientId) {
      rows = await ctx.db
        .query("invoices")
        .withIndex("by_client", (q) => q.eq("clientId", args.clientId!))
        .collect();
    } else {
      rows = await ctx.db
        .query("invoices")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .collect();
    }
    if (args.from) rows = rows.filter((r) => r.issueDate >= args.from!);
    if (args.to) rows = rows.filter((r) => r.issueDate <= args.to!);
    if (args.status) rows = rows.filter((r) => r.status === args.status);

    const clients = await ctx.db
      .query("clients")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const clientMap = new Map(clients.map((c) => [c._id as string, c]));

    const decorated = [];
    for (const inv of rows.sort((a, b) => (a.issueDate < b.issueDate ? 1 : -1))) {
      const d = await decorateInvoice(ctx, inv);
      decorated.push({
        ...d,
        clientName: clientMap.get(inv.clientId as string)?.name ?? "—",
        clientPhone: clientMap.get(inv.clientId as string)?.phone ?? "",
      });
    }

    const today = todayInTz();
    const issued = sum(
      decorated
        .filter((d) => d.status !== "cancelled" && d.status !== "draft")
        .map((d) => d.total),
    );
    return {
      rows: decorated,
      totals: {
        issued,
        paid: sum(
          decorated.filter((d) => d.status !== "cancelled").map((d) => d.paid),
        ),
        outstanding: sum(
          decorated
            .filter((d) => d.status !== "cancelled" && d.status !== "paid")
            .map((d) => d.outstanding),
        ),
        overdue: decorated.filter(
          (d) => d.outstanding > 0 && d.dueDate && d.dueDate < today,
        ).length,
      },
    };
  },
});

export const invoiceDetail = query({
  args: { orgId: v.id("organizations"), invoiceId: v.id("invoices") },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId);
    if (!member) return null;
    const inv = await ctx.db.get(args.invoiceId);
    if (!inv || inv.orgId !== args.orgId) return null;
    const client = await ctx.db.get(inv.clientId);
    const org = await ctx.db.get(args.orgId);
    const allocations = await ctx.db
      .query("paymentAllocations")
      .withIndex("by_invoice", (q) => q.eq("invoiceId", args.invoiceId))
      .collect();
    const payments = [];
    for (const a of allocations) {
      const p = await ctx.db.get(a.paymentId);
      if (p) payments.push({ ...p, allocated: a.amount, allocationKind: a.kind });
    }
    const commissionRows = await ctx.db
      .query("commissions")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect()
      .then((rows) => rows.filter((r) => r.invoiceId === args.invoiceId));
    return {
      invoice: await decorateInvoice(ctx, inv),
      client,
      org,
      payments,
      commissions: commissionRows,
    };
  },
});

/** Creates an invoice (draft or issued) from an appointment and its items. */
export const createInvoiceFromAppointment = mutation({
  args: { orgId: v.id("organizations"), appointmentId: v.id("appointments") },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "invoices.edit");
    await assertFeature(ctx, args.orgId, "finance");
    const apt = await ctx.db.get(args.appointmentId);
    if (!apt || apt.orgId !== args.orgId) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    const existing = (
      await ctx.db
        .query("invoices")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .collect()
    ).find((i) => i.appointmentId === args.appointmentId && i.status !== "cancelled");
    if (existing) {
      throw new AppError(
        "CONFLICT",
        `Este atendimento já possui a fatura ${existing.number}. Abra a fatura para registrar o pagamento.`,
      );
    }

    const org = await ctx.db.get(args.orgId);
    const subtotal = sum(apt.items.map((i) => i.total));
    const tax = org?.taxPct
      ? Math.round((((subtotal - apt.discount) * org.taxPct) / 100))
      : 0;
    const total = subtotal - apt.discount + tax;
    const number = await nextSequence(ctx, args.orgId, "invoices", "FAT");
    const today = todayInTz(org?.timezone);

    const invoiceId = await ctx.db.insert("invoices", {
      orgId: args.orgId,
      number,
      clientId: apt.clientId,
      appointmentId: args.appointmentId,
      items: apt.items,
      subtotal,
      discount: apt.discount,
      tax,
      total,
      depositApplied: 0,
      status: "issued",
      issueDate: today,
      dueDate: today,
      notes: `Gerada a partir do atendimento de ${apt.date}`,
      locked: false,
      isDemo: false,
      createdAt: Date.now(),
      createdBy: userId,
    });

    // Apply any deposit already received for this appointment — exactly once.
    const appointmentPayments = await ctx.db
      .query("payments")
      .withIndex("by_appointment", (q) => q.eq("appointmentId", args.appointmentId))
      .collect();
    let depositApplied = 0;
    for (const p of appointmentPayments) {
      if (p.invoiceId || p.kind === "reembolso") continue;
      if (p.kind !== "sinal") continue;
      await ctx.db.patch(p._id, { invoiceId });
      await ctx.db.insert("paymentAllocations", {
        orgId: args.orgId,
        paymentId: p._id,
        invoiceId,
        appointmentId: args.appointmentId,
        amount: p.amount,
        kind: "sinal",
        createdAt: Date.now(),
      });
      depositApplied += p.amount;
    }

    const paid = await paidForInvoice(ctx, invoiceId);
    const status = paid >= total ? "paid" : paid > 0 ? "partial" : "issued";
    await ctx.db.patch(invoiceId, { depositApplied, status });

    if (apt.paymentStatus !== "paid") {
      await ctx.db.patch(args.appointmentId, {
        paymentStatus: paid >= total ? "paid" : paid > 0 ? "partial" : apt.paymentStatus,
      });
    }

    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "emitir_fatura",
      entity: "invoices",
      entityId: invoiceId,
      details: `${number} · total ${(total / 100).toFixed(2)} · sinal aplicado ${(depositApplied / 100).toFixed(2)}`,
    });

    return invoiceId;
  },
});

export const createInvoice = mutation({
  args: {
    orgId: v.id("organizations"),
    clientId: v.id("clients"),
    items: v.array(lineItemArg),
    discount: v.number(),
    notes: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    issue: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "invoices.edit");
    if (!args.items.length) {
      throw new AppError("VALIDATION", "Adicione pelo menos um item à fatura.");
    }
    const org = await ctx.db.get(args.orgId);
    const subtotal = sum(args.items.map((i) => i.total));
    if (args.discount > subtotal) {
      throw new AppError("VALIDATION", "O desconto não pode superar o subtotal.");
    }
    const tax = org?.taxPct
      ? Math.round((((subtotal - args.discount) * org.taxPct) / 100))
      : 0;
    const number = await nextSequence(ctx, args.orgId, "invoices", "FAT");
    const id = await ctx.db.insert("invoices", {
      orgId: args.orgId,
      number,
      clientId: args.clientId,
      items: args.items,
      subtotal,
      discount: args.discount,
      tax,
      total: subtotal - args.discount + tax,
      depositApplied: 0,
      status: args.issue === false ? "draft" : "issued",
      issueDate: todayInTz(org?.timezone),
      dueDate: args.dueDate,
      notes: args.notes,
      locked: false,
      isDemo: false,
      createdAt: Date.now(),
      createdBy: userId,
    });
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "criar_fatura",
      entity: "invoices",
      entityId: id,
      details: number,
    });
    return id;
  },
});

export const updateInvoice = mutation({
  args: {
    orgId: v.id("organizations"),
    invoiceId: v.id("invoices"),
    items: v.optional(v.array(lineItemArg)),
    discount: v.optional(v.number()),
    notes: v.optional(v.string()),
    dueDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "invoices.edit");
    const inv = await ctx.db.get(args.invoiceId);
    if (!inv || inv.orgId !== args.orgId) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    if (inv.locked || inv.status === "paid" || inv.status === "refunded") {
      throw new AppError(
        "LOCKED",
        "Faturas pagas são bloqueadas. Registre um ajuste, estorno ou cancelamento documentado.",
      );
    }
    const org = await ctx.db.get(args.orgId);
    const items = args.items ?? inv.items;
    const subtotal = sum(items.map((i) => i.total));
    const discount = args.discount ?? inv.discount;
    if (discount > subtotal) {
      throw new AppError("VALIDATION", "O desconto não pode superar o subtotal.");
    }
    const tax = org?.taxPct
      ? Math.round((((subtotal - discount) * org.taxPct) / 100))
      : 0;
    await ctx.db.patch(args.invoiceId, {
      items,
      subtotal,
      discount,
      tax,
      total: subtotal - discount + tax,
      notes: args.notes ?? inv.notes,
      dueDate: args.dueDate ?? inv.dueDate,
    });
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "atualizar_fatura",
      entity: "invoices",
      entityId: args.invoiceId,
      details: inv.number,
    });
    return true;
  },
});

/** Authorised adjustment on an already issued invoice (audit trail kept). */
export const addInvoiceAdjustment = mutation({
  args: {
    orgId: v.id("organizations"),
    invoiceId: v.id("invoices"),
    amount: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "invoices.edit");
    const inv = await ctx.db.get(args.invoiceId);
    if (!inv || inv.orgId !== args.orgId) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    if (!args.reason.trim()) {
      throw new AppError("VALIDATION", "Descreva o motivo do ajuste para manter a auditoria.");
    }
    const items = [
      ...inv.items,
      {
        kind: "labor" as const,
        name: `Ajuste: ${args.reason}`,
        quantity: 1,
        unitPrice: args.amount,
        total: args.amount,
      },
    ];
    const subtotal = sum(items.map((i) => i.total));
    const tax = inv.tax ? 0 : 0;
    const total = subtotal - inv.discount + tax;
    await ctx.db.patch(args.invoiceId, {
      items,
      subtotal,
      total,
      notes: `${inv.notes ?? ""}\nAjuste autorizado por ${member.name}: ${args.reason}`.trim(),
    });
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "ajuste_fatura",
      entity: "invoices",
      entityId: args.invoiceId,
      details: `${args.reason} · ${(args.amount / 100).toFixed(2)}`,
    });
    return true;
  },
});

export const cancelInvoice = mutation({
  args: {
    orgId: v.id("organizations"),
    invoiceId: v.id("invoices"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "invoices.edit");
    const inv = await ctx.db.get(args.invoiceId);
    if (!inv || inv.orgId !== args.orgId) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    const paid = await paidForInvoice(ctx, args.invoiceId);
    if (paid > 0) {
      throw new AppError(
        "VALIDATION",
        "Esta fatura possui pagamentos. Registre o estorno antes de cancelar.",
      );
    }
    if (!args.reason.trim()) {
      throw new AppError("VALIDATION", "Informe o motivo do cancelamento.");
    }
    await ctx.db.patch(args.invoiceId, {
      status: "cancelled",
      notes: `${inv.notes ?? ""}\nCancelada: ${args.reason}`.trim(),
    });
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "cancelar_fatura",
      entity: "invoices",
      entityId: args.invoiceId,
      details: args.reason,
    });
    return true;
  },
});

export const markInvoiceOverdue = mutation({
  args: { orgId: v.id("organizations"), invoiceId: v.id("invoices") },
  handler: async (ctx, args) => {
    const inv = await ctx.db.get(args.invoiceId);
    if (!inv || inv.orgId !== args.orgId) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    await ctx.db.patch(args.invoiceId, { status: "overdue" });
    return true;
  },
});

/** Sends a receipt reminder notification (no external message is sent). */
export const remindInvoice = mutation({
  args: { orgId: v.id("organizations"), invoiceId: v.id("invoices") },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "invoices.view");
    const inv = await ctx.db.get(args.invoiceId);
    if (!inv || inv.orgId !== args.orgId) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    const client = await ctx.db.get(inv.clientId);
    const paid = await paidForInvoice(ctx, args.invoiceId);
    await notify(ctx, {
      orgId: args.orgId,
      title: "Cobrança pendente",
      body: `${client?.name ?? "Cliente"} · fatura ${inv.number} com saldo de ${((inv.total - paid) / 100).toFixed(2)}. Contate a cliente para combinar o pagamento.`,
      type: "financeiro",
      link: "/app/faturas",
    });
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "lembrete_fatura",
      entity: "invoices",
      entityId: args.invoiceId,
    });
    return true;
  },
});

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

export const listQuotes = query({
  args: {
    orgId: v.id("organizations"),
    status: v.optional(v.string()),
    clientId: v.optional(v.id("clients")),
  },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId);
    if (!member) return [];
    let rows: Doc<"quotes">[];
    if (args.clientId) {
      rows = await ctx.db
        .query("quotes")
        .withIndex("by_client", (q) => q.eq("clientId", args.clientId!))
        .collect();
    } else {
      rows = await ctx.db
        .query("quotes")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .collect();
    }
    if (args.status) rows = rows.filter((r) => r.status === args.status);
    const clients = await ctx.db
      .query("clients")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const today = todayInTz();
    return rows
      .map((q) => ({
        ...q,
        clientName: clients.find((c) => c._id === q.clientId)?.name ?? "—",
        expired: q.validUntil < today && !["aprovado", "convertido", "recusado"].includes(q.status),
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const saveQuote = mutation({
  args: {
    orgId: v.id("organizations"),
    quoteId: v.optional(v.id("quotes")),
    clientId: v.id("clients"),
    items: v.array(lineItemArg),
    discount: v.number(),
    validUntil: v.string(),
    staffId: v.optional(v.id("staff")),
    notes: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "appointments.edit");
    if (!args.items.length) {
      throw new AppError("VALIDATION", "Adicione pelo menos um item ao orçamento.");
    }
    const subtotal = sum(args.items.map((i) => i.total));
    if (args.discount > subtotal) {
      throw new AppError("VALIDATION", "O desconto não pode superar o subtotal.");
    }
    const payload = {
      items: args.items,
      subtotal,
      discount: args.discount,
      total: subtotal - args.discount,
      validUntil: args.validUntil,
      staffId: args.staffId,
      notes: args.notes,
    };
    if (args.quoteId) {
      const existing = await ctx.db.get(args.quoteId);
      if (!existing || existing.orgId !== args.orgId) {
        throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
      }
      if (existing.status === "convertido") {
        throw new AppError(
          "LOCKED",
          "Orçamentos já convertidos preservam o histórico e não podem ser alterados.",
        );
      }
      await ctx.db.patch(args.quoteId, { ...payload, status: args.status ?? existing.status });
      return args.quoteId;
    }
    const number = await nextSequence(ctx, args.orgId, "quotes", "ORC");
    const id = await ctx.db.insert("quotes", {
      orgId: args.orgId,
      number,
      clientId: args.clientId,
      ...payload,
      status: args.status ?? "rascunho",
      createdAt: Date.now(),
      createdBy: userId,
    });
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "criar_orcamento",
      entity: "quotes",
      entityId: id,
      details: number,
    });
    return id;
  },
});

export const setQuoteStatus = mutation({
  args: {
    orgId: v.id("organizations"),
    quoteId: v.id("quotes"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "appointments.edit");
    const quote = await ctx.db.get(args.quoteId);
    if (!quote || quote.orgId !== args.orgId) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    await ctx.db.patch(args.quoteId, { status: args.status });
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "status_orcamento",
      entity: "quotes",
      entityId: args.quoteId,
      details: `${quote.status} → ${args.status}`,
    });
    return true;
  },
});

/** Quote → Appointment conversion, keeping the approved line items. */
export const convertQuoteToAppointment = mutation({
  args: {
    orgId: v.id("organizations"),
    quoteId: v.id("quotes"),
    staffId: v.id("staff"),
    date: v.string(),
    start: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "appointments.edit");
    const quote = await ctx.db.get(args.quoteId);
    if (!quote || quote.orgId !== args.orgId) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    if (!["aprovado", "aguardando", "enviado"].includes(quote.status)) {
      throw new AppError(
        "VALIDATION",
        "Somente orçamentos aprovados ou em análise podem ser convertidos em agendamento.",
      );
    }
    const serviceIds = quote.items
      .filter((i) => i.kind === "service" && i.refId)
      .map((i) => i.refId as Id<"services">);
    if (!serviceIds.length) {
      throw new AppError(
        "VALIDATION",
        "O orçamento não possui serviços que possam ser agendados.",
      );
    }
    const id = await createAppointmentRef(ctx, {
      orgId: args.orgId,
      clientId: quote.clientId,
      staffId: args.staffId,
      serviceIds,
      date: args.date,
      start: args.start,
      discount: quote.discount,
      notes: `Convertido do orçamento ${quote.number}`,
      source: "orcamento",
      userId,
      memberName: member.name,
    });
    await ctx.db.patch(args.quoteId, { status: "convertido" });
    return id;
  },
});
