import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  AppError,
  ERR,
  addDaysISO,
  diffDaysISO,
  getMembership,
  logAudit,
  notify,
  requireMember,
  sum,
  todayInTz,
} from "./lib/helpers";

// ---------------------------------------------------------------------------
// Loyalty
// ---------------------------------------------------------------------------

export const loyaltyOverview = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId);
    if (!member) return { accounts: [], totals: { points: 0, clients: 0 }, settings: null };
    const org = await ctx.db.get(args.orgId);
    const accounts = await ctx.db
      .query("loyaltyAccounts")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const clients = await ctx.db
      .query("clients")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const transactions = await ctx.db
      .query("loyaltyTransactions")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    return {
      settings: org?.loyaltySettings ?? null,
      accounts: accounts
        .map((a) => ({
          ...a,
          clientName: clients.find((c) => c._id === a.clientId)?.name ?? "—",
          earned: sum(
            transactions
              .filter((t) => t.clientId === a.clientId && t.points > 0)
              .map((t) => t.points),
          ),
          redeemed: Math.abs(
            sum(
              transactions
                .filter((t) => t.clientId === a.clientId && t.points < 0)
                .map((t) => t.points),
            ),
          ),
        }))
        .sort((a, b) => b.points - a.points),
      transactions: transactions.sort((a, b) => b.createdAt - a.createdAt).slice(0, 200),
      totals: {
        points: sum(accounts.map((a) => a.points)),
        clients: accounts.length,
      },
    };
  },
});

export const adjustLoyaltyPoints = mutation({
  args: {
    orgId: v.id("organizations"),
    clientId: v.id("clients"),
    points: v.number(),
    reason: v.string(),
    refType: v.optional(v.string()),
    refId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "clients.edit");
    if (!args.reason.trim()) {
      throw new AppError("VALIDATION", "Informe o motivo do ajuste de pontos.");
    }
    if (args.points === 0) {
      throw new AppError("VALIDATION", "Informe uma quantidade de pontos diferente de zero.");
    }
    const account = await ctx.db
      .query("loyaltyAccounts")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .first();
    const org = await ctx.db.get(args.orgId);
    const balanceBefore = account?.points ?? 0;
    const balanceAfter = balanceBefore + args.points;
    if (balanceAfter < 0) {
      throw new AppError(
        "VALIDATION",
        `Saldo insuficiente. A cliente possui ${balanceBefore} pontos.`,
      );
    }
    const tiers = org?.loyaltySettings?.tiers ?? [{ name: "Bronze", minPoints: 0 }];
    const tier =
      [...tiers].sort((a, b) => b.minPoints - a.minPoints).find((t) => balanceAfter >= t.minPoints)
        ?.name ?? tiers[0].name;

    if (account) {
      await ctx.db.patch(account._id, { points: balanceAfter, tier, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("loyaltyAccounts", {
        orgId: args.orgId,
        clientId: args.clientId,
        points: balanceAfter,
        tier,
        updatedAt: Date.now(),
      });
    }
    await ctx.db.insert("loyaltyTransactions", {
      orgId: args.orgId,
      clientId: args.clientId,
      points: args.points,
      reason: args.reason,
      refType: args.refType,
      refId: args.refId,
      date: todayInTz(),
      balanceAfter,
      isDemo: false,
      createdAt: Date.now(),
    });
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "ajustar_pontos",
      entity: "loyaltyTransactions",
      details: `${args.points} pontos · ${args.reason}`,
    });
    return balanceAfter;
  },
});

export const redeemReward = mutation({
  args: {
    orgId: v.id("organizations"),
    clientId: v.id("clients"),
    rewardName: v.string(),
    pointsCost: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "clients.edit");
    const account = await ctx.db
      .query("loyaltyAccounts")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .first();
    const balance = account?.points ?? 0;
    if (balance < args.pointsCost) {
      throw new AppError(
        "VALIDATION",
        `Saldo insuficiente para resgatar ${args.rewardName}. Disponível: ${balance} pontos.`,
      );
    }
    const balanceAfter = balance - args.pointsCost;
    await ctx.db.patch(account!._id, { points: balanceAfter, updatedAt: Date.now() });
    await ctx.db.insert("loyaltyTransactions", {
      orgId: args.orgId,
      clientId: args.clientId,
      points: -args.pointsCost,
      reason: `Resgate: ${args.rewardName}`,
      refType: "reward",
      date: todayInTz(),
      balanceAfter,
      isDemo: false,
      createdAt: Date.now(),
    });
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "resgatar_recompensa",
      entity: "loyaltyTransactions",
      details: `${args.rewardName} · ${args.pointsCost} pontos`,
    });
    return balanceAfter;
  },
});

// ---------------------------------------------------------------------------
// Gift cards
// ---------------------------------------------------------------------------

export const listGiftCards = query({
  args: { orgId: v.id("organizations"), status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId);
    if (!member) return { rows: [], totals: { sold: 0, outstanding: 0, redeemed: 0 } };
    const rows = await ctx.db
      .query("giftCards")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const transactions = await ctx.db
      .query("giftCardTransactions")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const clients = await ctx.db
      .query("clients")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const filtered = args.status ? rows.filter((r) => r.status === args.status) : rows;
    return {
      rows: filtered
        .map((c) => ({
          ...c,
          clientName: clients.find((x) => x._id === c.clientId)?.name,
          redeemed: c.initialValue - c.balance,
        }))
        .sort((a, b) => (a.purchaseDate < b.purchaseDate ? 1 : -1)),
      transactions: transactions.sort((a, b) => b.createdAt - a.createdAt).slice(0, 200),
      totals: {
        sold: sum(rows.map((r) => r.initialValue)),
        outstanding: sum(rows.filter((r) => r.status === "ativo").map((r) => r.balance)),
        redeemed: sum(rows.map((r) => r.initialValue - r.balance)),
      },
    };
  },
});

/**
 * Selling a gift card records the cash inflow once, at sale time
 * (política de reconhecimento: receita reconhecida na venda).
 * Redemptions recorded later use the `gift_card` payment method, which is
 * excluded from revenue totals to avoid double counting.
 */
export const sellGiftCard = mutation({
  args: {
    orgId: v.id("organizations"),
    code: v.optional(v.string()),
    purchaserName: v.string(),
    recipientName: v.optional(v.string()),
    clientId: v.optional(v.id("clients")),
    value: v.number(),
    expirationDate: v.optional(v.string()),
    method: v.optional(
      v.union(
        v.literal("pix"),
        v.literal("cash"),
        v.literal("credit_card"),
        v.literal("debit_card"),
        v.literal("transfer"),
        v.literal("gift_card"),
        v.literal("other"),
      ),
    ),
    accountId: v.optional(v.id("financialAccounts")),
    notes: v.optional(v.string()),
    registerPayment: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "payments.edit");
    if (args.value <= 0) {
      throw new AppError("VALIDATION", "O valor do cartão-presente deve ser maior que zero.");
    }
    const code =
      args.code?.trim() ||
      `BF-${Math.random().toString(36).slice(2, 6).toUpperCase()}${Date.now()
        .toString()
        .slice(-4)}`;
    const existing = await ctx.db
      .query("giftCards")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId).eq("code", code))
      .first();
    if (existing) {
      throw new AppError("CONFLICT", "Já existe um cartão-presente com este código.");
    }
    const today = todayInTz();
    const id = await ctx.db.insert("giftCards", {
      orgId: args.orgId,
      code,
      purchaseDate: today,
      purchaserName: args.purchaserName,
      recipientName: args.recipientName,
      clientId: args.clientId,
      initialValue: args.value,
      balance: args.value,
      expirationDate: args.expirationDate,
      status: "ativo",
      notes: args.notes,
      isDemo: false,
      createdAt: Date.now(),
    });
    await ctx.db.insert("giftCardTransactions", {
      orgId: args.orgId,
      giftCardId: id,
      type: "emissao",
      amount: args.value,
      date: today,
      notes: `Venda para ${args.purchaserName}`,
      createdAt: Date.now(),
    });
    if (args.registerPayment && args.clientId) {
      await ctx.db.insert("payments", {
        orgId: args.orgId,
        clientId: args.clientId,
        amount: args.value,
        method: args.method ?? "pix",
        kind: "pagamento",
        date: today,
        accountId: args.accountId,
        notes: `Venda de cartão-presente ${code}`,
        reference: code,
        isDemo: false,
        createdAt: Date.now(),
        createdBy: userId,
      });
    }
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "vender_cartao_presente",
      entity: "giftCards",
      entityId: id,
      details: `${code} · ${(args.value / 100).toFixed(2)}`,
    });
    return { id, code };
  },
});

export const cancelGiftCard = mutation({
  args: { orgId: v.id("organizations"), giftCardId: v.id("giftCards"), reason: v.string() },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "payments.refund");
    const card = await ctx.db.get(args.giftCardId);
    if (!card || card.orgId !== args.orgId) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    await ctx.db.patch(args.giftCardId, {
      status: "cancelado",
      notes: `${card.notes ?? ""}\nCancelado: ${args.reason}`.trim(),
    });
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "cancelar_cartao_presente",
      entity: "giftCards",
      entityId: args.giftCardId,
      details: args.reason,
    });
    return true;
  },
});

// ---------------------------------------------------------------------------
// Marketing campaigns
// ---------------------------------------------------------------------------

export const listCampaigns = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId);
    if (!member) return [];
    return await ctx.db
      .query("marketingCampaigns")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect()
      .then((rows) => rows.sort((a, b) => (a.startDate < b.startDate ? 1 : -1)));
  },
});

export const saveCampaign = mutation({
  args: {
    orgId: v.id("organizations"),
    campaignId: v.optional(v.id("marketingCampaigns")),
    name: v.string(),
    type: v.string(),
    audience: v.string(),
    channel: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    offer: v.optional(v.string()),
    budget: v.number(),
    status: v.string(),
    goal: v.optional(v.string()),
    results: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "marketing.manage");
    if (!args.name.trim()) throw new AppError("VALIDATION", "Informe o nome da campanha.");
    if (args.endDate < args.startDate) {
      throw new AppError("VALIDATION", "A data final não pode ser anterior à data inicial.");
    }
    const payload = {
      orgId: args.orgId,
      name: args.name.trim(),
      type: args.type,
      audience: args.audience,
      channel: args.channel,
      startDate: args.startDate,
      endDate: args.endDate,
      offer: args.offer,
      budget: args.budget,
      status: args.status,
      goal: args.goal,
      results: args.results,
      notes: args.notes,
      isDemo: false,
    };
    if (args.campaignId) {
      const existing = await ctx.db.get(args.campaignId);
      if (!existing || existing.orgId !== args.orgId) {
        throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
      }
      await ctx.db.patch(args.campaignId, payload);
      return args.campaignId;
    }
    const id = await ctx.db.insert("marketingCampaigns", {
      ...payload,
      createdAt: Date.now(),
    });
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "criar_campanha",
      entity: "marketingCampaigns",
      entityId: id,
      details: args.name,
    });
    return id;
  },
});

export const deleteCampaign = mutation({
  args: { orgId: v.id("organizations"), campaignId: v.id("marketingCampaigns") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.orgId, "marketing.manage");
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign || campaign.orgId !== args.orgId) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    await ctx.db.delete(args.campaignId);
    return true;
  },
});

// ---------------------------------------------------------------------------
// Follow-up tasks
// ---------------------------------------------------------------------------

export const listFollowUps = query({
  args: { orgId: v.id("organizations"), status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId);
    if (!member) return [];
    const rows = await ctx.db
      .query("followUpTasks")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const clients = await ctx.db
      .query("clients")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const today = todayInTz();
    return rows
      .filter((r) => !args.status || r.status === args.status)
      .map((r) => ({
        ...r,
        clientName: clients.find((c) => c._id === r.clientId)?.name ?? "—",
        clientPhone: clients.find((c) => c._id === r.clientId)?.phone ?? "",
        overdue: r.dueDate < today && r.status === "pendente",
      }))
      .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
  },
});

export const createFollowUp = mutation({
  args: {
    orgId: v.id("organizations"),
    clientId: v.id("clients"),
    type: v.string(),
    dueDate: v.string(),
    notes: v.optional(v.string()),
    assignedTo: v.optional(v.id("staff")),
  },
  handler: async (ctx, args) => {
    const { member } = await requireMember(ctx, args.orgId, "clients.edit");
    const id = await ctx.db.insert("followUpTasks", {
      orgId: args.orgId,
      clientId: args.clientId,
      type: args.type,
      dueDate: args.dueDate,
      status: "pendente",
      notes: args.notes,
      assignedTo: args.assignedTo,
      createdAt: Date.now(),
    });
    return { id, by: member.name };
  },
});

export const completeFollowUp = mutation({
  args: {
    orgId: v.id("organizations"),
    taskId: v.id("followUpTasks"),
    status: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "clients.edit");
    const task = await ctx.db.get(args.taskId);
    if (!task || task.orgId !== args.orgId) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    await ctx.db.patch(args.taskId, {
      status: args.status ?? "concluida",
      notes: args.notes ?? task.notes,
    });
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "concluir_tarefa",
      entity: "followUpTasks",
      entityId: args.taskId,
      details: args.status ?? "concluida",
    });
    return true;
  },
});

// ---------------------------------------------------------------------------
// Retention dashboard
// ---------------------------------------------------------------------------

export const retentionDashboard = query({
  args: {
    orgId: v.id("organizations"),
    inactiveDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId);
    if (!member)
      return {
        due: [],
        overdue: [],
        inactive: [],
        atRisk: [],
        highValue: [],
        summary: { due: 0, overdue: 0, inactive: 0, atRisk: 0 },
      };

    const today = todayInTz();
    const inactiveDays = args.inactiveDays ?? 120;

    const clients = (
      await ctx.db
        .query("clients")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .collect()
    ).filter((c) => c.active);

    const appointments = await ctx.db
      .query("appointments")
      .withIndex("by_org_date", (q) => q.eq("orgId", args.orgId))
      .collect();
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const records = await ctx.db
      .query("treatmentRecords")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    type Bucket = {
      clientId: Id<"clients">;
      name: string;
      phone: string;
      lastVisit?: string;
      nextReturn?: string;
      returnInDays?: number;
      daysSinceVisit: number;
      spend: number;
      visits: number;
      preferredStaffId?: Id<"staff">;
      lastService?: string;
    };

    const rows: Bucket[] = [];
    for (const c of clients) {
      const mine = appointments.filter((a) => a.clientId === c._id);
      const completed = mine
        .filter((a) => a.status === "completed")
        .sort((a, b) => (a.date < b.date ? 1 : -1));
      const future = mine
        .filter((a) => a.date >= today && a.status !== "cancelled" && a.status !== "no_show")
        .sort((a, b) => (a.date < b.date ? -1 : 1));
      const myRecords = records
        .filter((r) => r.clientId === c._id)
        .sort((a, b) => (a.date < b.date ? 1 : -1));
      const spend = sum(
        payments
          .filter((p) => p.clientId === c._id && p.kind !== "reembolso")
          .map((p) => p.amount),
      );
      const lastVisit = completed[0]?.date;
      const nextReturn = myRecords.find((r) => r.nextVisitDate)?.nextVisitDate;

      // A cancelled or missed appointment never resets the return cycle: the
      // cycle is always anchored on the last COMPLETED service.
      rows.push({
        clientId: c._id,
        name: c.name,
        phone: c.whatsapp || c.phone,
        lastVisit,
        nextReturn,
        daysSinceVisit: lastVisit ? diffDaysISO(today, lastVisit) : 9999,
        spend,
        visits: completed.length,
        preferredStaffId: completed[0]?.staffId,
        lastService: myRecords[0]?.serviceName ?? completed[0]?.items[0]?.name,
        returnInDays: nextReturn ? diffDaysISO(nextReturn, today) : undefined,
        ...(future.length ? { nextAppointment: future[0].date } : {}),
      } as Bucket & { nextAppointment?: string });
    }

    const withFuture = rows.filter((r) => (r as any).nextAppointment);

    const due = rows
      .filter((r) => !(r as any).nextAppointment && r.nextReturn && r.nextReturn >= today)
      .sort((a, b) => (a.returnInDays ?? 0) - (b.returnInDays ?? 0));
    const overdue = rows
      .filter((r) => !(r as any).nextAppointment && r.nextReturn && r.nextReturn < today)
      .sort((a, b) => (a.returnInDays ?? 0) - (b.returnInDays ?? 0));
    const inactive = rows
      .filter((r) => r.visits > 0 && r.daysSinceVisit >= inactiveDays && !(r as any).nextAppointment)
      .sort((a, b) => b.daysSinceVisit - a.daysSinceVisit);
    const atRisk = rows
      .filter(
        (r) =>
          r.visits >= 2 &&
          r.nextReturn &&
          r.nextReturn < addDaysISO(today, -15) &&
          !(r as any).nextAppointment,
      )
      .sort((a, b) => b.spend - a.spend);
    const highValue = [...rows].sort((a, b) => b.spend - a.spend).slice(0, 10);

    const pendingTasks = await ctx.db
      .query("followUpTasks")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId).eq("status", "pendente"))
      .collect();

    const birthdays = [];
    for (const c of clients) {
      if (!c.birthday) continue;
      const mmdd = c.birthday.slice(-5);
      const year = today.slice(0, 4);
      let candidate = `${year}-${mmdd}`;
      if (candidate < today) candidate = `${Number(year) + 1}-${mmdd}`;
      const days = diffDaysISO(candidate, today);
      if (days >= 0 && days <= 30) {
        birthdays.push({ clientId: c._id, name: c.name, phone: c.phone, date: candidate, days });
      }
    }
    birthdays.sort((a, b) => a.days - b.days);

    return {
      due,
      overdue,
      inactive,
      atRisk,
      highValue,
      birthdays,
      tasks: pendingTasks.sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1)),
      summary: {
        due: due.length,
        overdue: overdue.length,
        inactive: inactive.length,
        atRisk: atRisk.length,
        scheduled: withFuture.length,
        activeClients: clients.length,
        birthdays: birthdays.length,
      },
    };
  },
});

export const createRetentionTask = mutation({
  args: {
    orgId: v.id("organizations"),
    clientIds: v.array(v.id("clients")),
    type: v.string(),
    dueDate: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "clients.edit");
    let created = 0;
    for (const clientId of args.clientIds) {
      await ctx.db.insert("followUpTasks", {
        orgId: args.orgId,
        clientId,
        type: args.type,
        dueDate: args.dueDate,
        status: "pendente",
        notes: args.notes,
        createdAt: Date.now(),
      });
      created += 1;
    }
    await notify(ctx, {
      orgId: args.orgId,
      title: "Tarefas de relacionamento criadas",
      body: `${created} tarefa(s) de ${args.type} agendadas para ${args.dueDate}.`,
      type: "crm",
      link: "/app/reagendamentos",
    });
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "criar_tarefas",
      entity: "followUpTasks",
      details: `${created} tarefas`,
    });
    return created;
  },
});
