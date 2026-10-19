import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  AppError,
  ERR,
  assertFeature,
  getMembership,
  logAudit,
  notify,
  requireMember,
  sum,
  todayInTz,
} from "./lib/helpers";

const methodArg = v.union(
  v.literal("pix"),
  v.literal("cash"),
  v.literal("credit_card"),
  v.literal("debit_card"),
  v.literal("transfer"),
  v.literal("gift_card"),
  v.literal("other"),
);

async function paidForInvoice(ctx: any, invoiceId: Id<"invoices">) {
  const rows = await ctx.db
    .query("paymentAllocations")
    .withIndex("by_invoice", (q: any) => q.eq("invoiceId", invoiceId))
    .collect();
  return sum(rows.map((r: any) => r.amount));
}

async function syncInvoiceStatus(ctx: any, invoiceId: Id<"invoices">) {
  const inv = await ctx.db.get(invoiceId);
  if (!inv) return null;
  const paid = await paidForInvoice(ctx, invoiceId);
  const outstanding = Math.max(0, inv.total - paid);
  let status: Doc<"invoices">["status"] = inv.status;
  if (inv.status !== "cancelled") {
    if (paid <= 0) status = inv.status === "draft" ? "draft" : "issued";
    else if (outstanding <= 0) status = "paid";
    else status = "partial";
  }
  const locked = paid > 0 && outstanding <= 0;
  if (status !== inv.status || locked !== inv.locked) {
    await ctx.db.patch(invoiceId, { status, locked });
  }
  if (inv.appointmentId) {
    const apt = await ctx.db.get(inv.appointmentId);
    if (apt) {
      await ctx.db.patch(inv.appointmentId, {
        paymentStatus:
          paid <= 0
            ? apt.depositRequired > 0
              ? "deposit_pending"
              : "none"
            : outstanding <= 0
              ? "paid"
              : "partial",
      });
    }
  }
  return { paid, outstanding, status };
}

export const listPayments = query({
  args: {
    orgId: v.id("organizations"),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
    method: v.optional(v.string()),
    kind: v.optional(v.string()),
    clientId: v.optional(v.id("clients")),
  },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId);
    if (!member) return { rows: [], totals: {} };
    let rows: Doc<"payments">[];
    if (args.clientId) {
      rows = await ctx.db
        .query("payments")
        .withIndex("by_client", (q) => q.eq("clientId", args.clientId!))
        .collect();
    } else {
      rows = await ctx.db
        .query("payments")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .collect();
    }
    if (args.from) rows = rows.filter((r) => r.date >= args.from!);
    if (args.to) rows = rows.filter((r) => r.date <= args.to!);
    if (args.method) rows = rows.filter((r) => r.method === args.method);
    if (args.kind) rows = rows.filter((r) => r.kind === args.kind);

    const clients = await ctx.db
      .query("clients")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const clientMap = new Map(clients.map((c) => [c._id as string, c]));
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    const totals: Record<string, number> = {};
    for (const r of rows) {
      const key = r.method;
      totals[key] = (totals[key] ?? 0) + (r.kind === "reembolso" ? -r.amount : r.amount);
    }

    return {
      rows: rows
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .map((p) => ({
          ...p,
          clientName: clientMap.get(p.clientId as string)?.name ?? "—",
          invoiceNumber:
            invoices.find((i) => i._id === p.invoiceId)?.number ?? undefined,
        })),
      totals,
      received: sum(
        rows.filter((r) => r.kind !== "reembolso").map((r) => r.amount),
      ),
      refunded: sum(rows.filter((r) => r.kind === "reembolso").map((r) => r.amount)),
    };
  },
});

export const createPayment = mutation({
  args: {
    orgId: v.id("organizations"),
    clientId: v.id("clients"),
    invoiceId: v.optional(v.id("invoices")),
    appointmentId: v.optional(v.id("appointments")),
    amount: v.number(),
    method: methodArg,
    kind: v.optional(v.string()),
    date: v.optional(v.string()),
    reference: v.optional(v.string()),
    accountId: v.optional(v.id("financialAccounts")),
    giftCardId: v.optional(v.id("giftCards")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "payments.edit");
    await assertFeature(ctx, args.orgId, "finance");
    if (args.amount <= 0) {
      throw new AppError("VALIDATION", "O valor do pagamento deve ser maior que zero.");
    }
    const org = await ctx.db.get(args.orgId);
    const date = args.date ?? todayInTz(org?.timezone);
    const kind = args.kind ?? "pagamento";

    // duplicate-submission guard
    const recent = (
      await ctx.db
        .query("payments")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .collect()
    ).filter(
      (p) =>
        p.clientId === args.clientId &&
        p.amount === args.amount &&
        p.date === date &&
        p.kind === kind &&
        (args.invoiceId ? p.invoiceId === args.invoiceId : !p.invoiceId) &&
        Date.now() - p.createdAt < 60_000,
    );
    if (recent.length) {
      throw new AppError(
        "DUPLICATE",
        "Este pagamento já foi registrado há instantes. Verifique o histórico antes de tentar novamente.",
      );
    }

    let amount = args.amount;

    // gift card redemption
    if (args.method === "gift_card") {
      if (!args.giftCardId) {
        throw new AppError("VALIDATION", "Selecione o cartão-presente utilizado.");
      }
      const card = await ctx.db.get(args.giftCardId);
      if (!card || card.orgId !== args.orgId) {
        throw new AppError("VALIDATION", "Cartão-presente não encontrado.");
      }
      if (card.status !== "ativo") {
        throw new AppError("VALIDATION", `Este cartão-presente está ${card.status}.`);
      }
      if (card.expirationDate && card.expirationDate < date) {
        throw new AppError("VALIDATION", "Este cartão-presente está expirado.");
      }
      if (card.balance < amount) {
        throw new AppError(
          "INSUFFICIENT",
          `Saldo insuficiente no cartão-presente (disponível ${(card.balance / 100).toFixed(2)}). Use outro método para completar o valor.`,
        );
      }
      const balance = card.balance - amount;
      await ctx.db.patch(card._id, {
        balance,
        status: balance === 0 ? "esgotado" : "ativo",
      });
      await ctx.db.insert("giftCardTransactions", {
        orgId: args.orgId,
        giftCardId: card._id,
        type: "resgate",
        amount: -amount,
        date,
        invoiceId: args.invoiceId,
        appointmentId: args.appointmentId,
        notes: args.notes,
        createdAt: Date.now(),
      });
    }

    const paymentId = await ctx.db.insert("payments", {
      orgId: args.orgId,
      clientId: args.clientId,
      invoiceId: args.invoiceId,
      appointmentId: args.appointmentId,
      amount,
      method: args.method,
      kind,
      date,
      reference: args.reference,
      accountId: args.accountId,
      giftCardId: args.giftCardId,
      notes: args.notes,
      isDemo: false,
      createdAt: Date.now(),
      createdBy: userId,
    });

    if (args.invoiceId) {
      await ctx.db.insert("paymentAllocations", {
        orgId: args.orgId,
        paymentId,
        invoiceId: args.invoiceId,
        appointmentId: args.appointmentId,
        amount,
        kind,
        createdAt: Date.now(),
      });
      await syncInvoiceStatus(ctx, args.invoiceId);
    } else if (args.appointmentId) {
      const apt = await ctx.db.get(args.appointmentId);
      if (apt) {
        const depositPaid = sum(
          (
            await ctx.db
              .query("payments")
              .withIndex("by_appointment", (q) =>
                q.eq("appointmentId", args.appointmentId!),
              )
              .collect()
          )
            .filter((p) => p.kind === "sinal" && p.invoiceId === undefined)
            .map((p) => p.amount),
        );
        await ctx.db.patch(args.appointmentId, {
          paymentStatus:
            kind === "sinal"
              ? depositPaid >= apt.depositRequired
                ? "deposit_paid"
                : "partial"
              : apt.paymentStatus,
        });
      }
    }

    // Mark "estimated" commissions on the invoice as earned when money arrives.
    if (args.invoiceId) {
      const commissions = (
        await ctx.db
          .query("commissions")
          .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
          .collect()
      ).filter((c) => c.invoiceId === args.invoiceId && c.status === "estimada");
      for (const c of commissions) {
        await ctx.db.patch(c._id, { status: "ganha" });
      }
    }

    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: kind === "sinal" ? "registrar_sinal" : "registrar_pagamento",
      entity: "payments",
      entityId: paymentId,
      details: `${args.method} · ${(amount / 100).toFixed(2)}`,
    });

    return paymentId;
  },
});

/** Applies an existing deposit to an invoice exactly once. */
export const applyDepositToInvoice = mutation({
  args: {
    orgId: v.id("organizations"),
    invoiceId: v.id("invoices"),
    paymentId: v.id("payments"),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "payments.edit");
    const inv = await ctx.db.get(args.invoiceId);
    const payment = await ctx.db.get(args.paymentId);
    if (!inv || inv.orgId !== args.orgId) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    if (!payment || payment.orgId !== args.orgId) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    if (payment.invoiceId) {
      throw new AppError(
        "CONFLICT",
        "Este valor já foi aplicado a uma fatura. Verifique o histórico antes de tentar novamente.",
      );
    }
    await ctx.db.patch(args.paymentId, { invoiceId: args.invoiceId });
    await ctx.db.insert("paymentAllocations", {
      orgId: args.orgId,
      paymentId: args.paymentId,
      invoiceId: args.invoiceId,
      appointmentId: payment.appointmentId,
      amount: payment.amount,
      kind: "sinal",
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.invoiceId, {
      depositApplied: inv.depositApplied + payment.amount,
    });
    await syncInvoiceStatus(ctx, args.invoiceId);
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "aplicar_sinal",
      entity: "invoices",
      entityId: args.invoiceId,
      details: `${(payment.amount / 100).toFixed(2)} aplicado`,
    });
    return true;
  },
});

export const refundPayment = mutation({
  args: {
    orgId: v.id("organizations"),
    paymentId: v.id("payments"),
    amount: v.number(),
    reason: v.string(),
    method: v.optional(methodArg),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "payments.refund");
    const original = await ctx.db.get(args.paymentId);
    if (!original || original.orgId !== args.orgId) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    if (args.amount <= 0 || args.amount > original.amount) {
      throw new AppError(
        "VALIDATION",
        "O valor do estorno deve ser maior que zero e não pode superar o valor pago.",
      );
    }
    if (!args.reason.trim()) {
      throw new AppError("VALIDATION", "Descreva o motivo do estorno.");
    }
    const org = await ctx.db.get(args.orgId);
    const date = todayInTz(org?.timezone);
    const refundId = await ctx.db.insert("payments", {
      orgId: args.orgId,
      clientId: original.clientId,
      invoiceId: original.invoiceId,
      appointmentId: original.appointmentId,
      amount: args.amount,
      method: args.method ?? original.method,
      kind: "reembolso",
      date,
      reference: original.reference,
      notes: args.reason,
      isDemo: false,
      createdAt: Date.now(),
      createdBy: userId,
    });
    if (original.invoiceId) {
      await ctx.db.insert("paymentAllocations", {
        orgId: args.orgId,
        paymentId: refundId,
        invoiceId: original.invoiceId,
        appointmentId: original.appointmentId,
        amount: -args.amount,
        kind: "reembolso",
        createdAt: Date.now(),
      });
      const result = await syncInvoiceStatus(ctx, original.invoiceId);
      if (result && result.outstanding > 0) {
        await ctx.db.patch(original.invoiceId, { status: "refunded", locked: false });
      }
      await notify(ctx, {
        orgId: args.orgId,
        title: "Estorno registrado",
        body: `Estorno de ${(args.amount / 100).toFixed(2)} na fatura relacionada. Motivo: ${args.reason}`,
        type: "financeiro",
        link: "/app/faturas",
      });
    }
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "estorno",
      entity: "payments",
      entityId: refundId,
      details: `${(args.amount / 100).toFixed(2)} · ${args.reason}`,
    });
    return refundId;
  },
});

export const deletePayment = mutation({
  args: { orgId: v.id("organizations"), paymentId: v.id("payments") },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "payments.refund");
    const payment = await ctx.db.get(args.paymentId);
    if (!payment || payment.orgId !== args.orgId) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    const allocations = await ctx.db
      .query("paymentAllocations")
      .withIndex("by_payment", (q) => q.eq("paymentId", args.paymentId))
      .collect();
    for (const a of allocations) await ctx.db.delete(a._id);
    await ctx.db.delete(args.paymentId);
    if (payment.invoiceId) await syncInvoiceStatus(ctx, payment.invoiceId);
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "excluir_pagamento",
      entity: "payments",
      entityId: args.paymentId,
      details: `${(payment.amount / 100).toFixed(2)} removido`,
    });
    return true;
  },
});

// ---------------------------------------------------------------------------
// Financial accounts
// ---------------------------------------------------------------------------

export const listAccounts = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId);
    if (!member) return [];
    const accounts = await ctx.db
      .query("financialAccounts")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    return accounts.map((a) => {
      const inflow = sum(
        payments
          .filter((p) => p.accountId === a._id && p.kind !== "reembolso")
          .map((p) => p.amount),
      );
      const outflow = sum(
        payments
          .filter((p) => p.accountId === a._id && p.kind === "reembolso")
          .map((p) => p.amount),
      );
      const paidExpenses = sum(
        expenses
          .filter((e) => e.accountId === a._id && e.status === "pago")
          .map((e) => e.amount),
      );
      return {
        ...a,
        balance: a.openingBalance + inflow - outflow - paidExpenses,
        inflow,
        outflow: outflow + paidExpenses,
      };
    });
  },
});

export const saveAccount = mutation({
  args: {
    orgId: v.id("organizations"),
    accountId: v.optional(v.id("financialAccounts")),
    name: v.string(),
    type: v.string(),
    openingBalance: v.number(),
  },
  handler: async (ctx, args) => {
    const { member } = await requireMember(ctx, args.orgId, "expenses.edit");
    const payload = {
      orgId: args.orgId,
      name: args.name,
      type: args.type,
      openingBalance: args.openingBalance,
      active: true,
    };
    if (args.accountId) {
      const existing = await ctx.db.get(args.accountId);
      if (!existing || existing.orgId !== args.orgId) {
        throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
      }
      await ctx.db.patch(args.accountId, payload);
      return { ok: true, by: member.name };
    }
    return await ctx.db.insert("financialAccounts", payload);
  },
});

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export const listExpenses = query({
  args: {
    orgId: v.id("organizations"),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
    category: v.optional(v.string()),
    status: v.optional(v.string()),
    supplierId: v.optional(v.id("suppliers")),
  },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId);
    if (!member) return { rows: [], totals: { paid: 0, pending: 0, byCategory: {} } };
    let rows = await ctx.db
      .query("expenses")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    if (args.from) rows = rows.filter((r) => r.date >= args.from!);
    if (args.to) rows = rows.filter((r) => r.date <= args.to!);
    if (args.category) rows = rows.filter((r) => r.category === args.category);
    if (args.status) rows = rows.filter((r) => r.status === args.status);
    if (args.supplierId) rows = rows.filter((r) => r.supplierId === args.supplierId);

    const suppliers = await ctx.db
      .query("suppliers")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    const byCategory: Record<string, number> = {};
    for (const r of rows) {
      byCategory[r.category] = (byCategory[r.category] ?? 0) + r.amount;
    }

    return {
      rows: rows
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .map((e) => ({
          ...e,
          supplierName: suppliers.find((s) => s._id === e.supplierId)?.name ?? "—",
        })),
      totals: {
        paid: sum(rows.filter((r) => r.status === "pago").map((r) => r.amount)),
        pending: sum(rows.filter((r) => r.status === "pendente").map((r) => r.amount)),
        byCategory,
        all: sum(rows.map((r) => r.amount)),
      },
    };
  },
});

export const saveExpense = mutation({
  args: {
    orgId: v.id("organizations"),
    expenseId: v.optional(v.id("expenses")),
    category: v.string(),
    description: v.string(),
    supplierId: v.optional(v.id("suppliers")),
    amount: v.number(),
    date: v.string(),
    dueDate: v.optional(v.string()),
    status: v.string(),
    method: v.optional(methodArg),
    accountId: v.optional(v.id("financialAccounts")),
    recurring: v.boolean(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "expenses.edit");
    if (args.amount <= 0) {
      throw new AppError("VALIDATION", "O valor da despesa deve ser maior que zero.");
    }
    if (!args.description.trim()) {
      throw new AppError("VALIDATION", "Descreva a despesa.");
    }
    const payload = {
      orgId: args.orgId,
      category: args.category,
      description: args.description.trim(),
      supplierId: args.supplierId,
      amount: args.amount,
      date: args.date,
      dueDate: args.dueDate,
      status: args.status,
      method: args.method,
      accountId: args.accountId,
      recurring: args.recurring,
      notes: args.notes,
      paymentDate: args.status === "pago" ? args.date : undefined,
      isDemo: false,
    };
    if (args.expenseId) {
      const existing = await ctx.db.get(args.expenseId);
      if (!existing || existing.orgId !== args.orgId) {
        throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
      }
      await ctx.db.patch(args.expenseId, payload);
      await logAudit(ctx, {
        orgId: args.orgId,
        userId,
        userName: member.name,
        action: "atualizar_despesa",
        entity: "expenses",
        entityId: args.expenseId,
      });
      return args.expenseId;
    }
    const id = await ctx.db.insert("expenses", {
      ...payload,
      createdAt: Date.now(),
    });
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "criar_despesa",
      entity: "expenses",
      entityId: id,
      details: `${args.category} · ${(args.amount / 100).toFixed(2)}`,
    });
    return id;
  },
});

export const payExpense = mutation({
  args: {
    orgId: v.id("organizations"),
    expenseId: v.id("expenses"),
    paymentDate: v.string(),
    method: v.optional(methodArg),
    accountId: v.optional(v.id("financialAccounts")),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "expenses.edit");
    const expense = await ctx.db.get(args.expenseId);
    if (!expense || expense.orgId !== args.orgId) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    if (expense.status === "pago") {
      throw new AppError("CONFLICT", "Esta despesa já está marcada como paga.");
    }
    await ctx.db.patch(args.expenseId, {
      status: "pago",
      paymentDate: args.paymentDate,
      method: args.method ?? expense.method,
      accountId: args.accountId ?? expense.accountId,
    });
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "pagar_despesa",
      entity: "expenses",
      entityId: args.expenseId,
      details: args.paymentDate,
    });
    return true;
  },
});

export const deleteExpense = mutation({
  args: { orgId: v.id("organizations"), expenseId: v.id("expenses") },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "expenses.edit");
    const expense = await ctx.db.get(args.expenseId);
    if (!expense || expense.orgId !== args.orgId) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    await ctx.db.delete(args.expenseId);
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "excluir_despesa",
      entity: "expenses",
      entityId: args.expenseId,
    });
    return true;
  },
});

/** Duplicates recurring expenses for a new period. */
export const generateRecurringExpenses = mutation({
  args: { orgId: v.id("organizations"), month: v.string() },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "expenses.edit");
    const rows = await ctx.db
      .query("expenses")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const recurring = new Map<string, Doc<"expenses">>();
    for (const r of rows) {
      if (!r.recurring) continue;
      if (r.date.slice(0, 7) === args.month) continue;
      recurring.set(r.description + r.amount, r);
    }
    let created = 0;
    for (const [, r] of recurring) {
      await ctx.db.insert("expenses", {
        orgId: args.orgId,
        category: r.category,
        description: r.description,
        supplierId: r.supplierId,
        amount: r.amount,
        date: `${args.month}-05`,
        status: "pendente",
        method: r.method,
        accountId: r.accountId,
        recurring: true,
        notes: `Despesa recorrente gerada automaticamente (${args.month})`,
        isDemo: false,
        createdAt: Date.now(),
      });
      created += 1;
    }
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "gerar_recorrentes",
      entity: "expenses",
      details: `${created} despesas em ${args.month}`,
    });
    return created;
  },
});

/** Cash flow: recorded inflows, refunds and paid/unpaid expenses by month. */
export const cashFlow = query({
  args: { orgId: v.id("organizations"), months: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId);
    if (!member) return [];
    const months = args.months ?? 6;
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const invs = await ctx.db
      .query("invoices")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    const start = new Date();
    start.setDate(1);
    const buckets: {
      month: string;
      inflow: number;
      refunds: number;
      expensesIncurred: number;
      expensesPaid: number;
      invoiced: number;
      net: number;
    }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(start.getFullYear(), start.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const inflow = sum(
        payments.filter((p) => p.date.startsWith(key) && p.kind !== "reembolso").map((p) => p.amount),
      );
      const refunds = sum(
        payments.filter((p) => p.date.startsWith(key) && p.kind === "reembolso").map((p) => p.amount),
      );
      const expensesIncurred = sum(
        expenses.filter((e) => e.date.startsWith(key)).map((e) => e.amount),
      );
      const expensesPaid = sum(
        expenses
          .filter((e) => e.status === "pago" && (e.paymentDate ?? e.date).startsWith(key))
          .map((e) => e.amount),
      );
      const invoiced = sum(
        invs
          .filter((i) => i.issueDate.startsWith(key) && i.status !== "cancelled")
          .map((i) => i.total),
      );
      buckets.push({
        month: key,
        inflow,
        refunds,
        expensesIncurred,
        expensesPaid,
        invoiced,
        net: inflow - refunds - expensesPaid,
      });
    }
    return buckets;
  },
});

export { syncInvoiceStatus };
