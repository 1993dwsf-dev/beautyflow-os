import { validateOrgReferences } from "./lib/tenant";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  AppError,
  hasPermission,
  ERR,
  addDaysISO,
  diffDaysISO,
  getMembership,
  logAudit,
  requireMember,
  sum,
  todayInTz,
} from "./lib/helpers";

const addressArg = v.optional(
  v.object({
    cep: v.optional(v.string()),
    logradouro: v.optional(v.string()),
    numero: v.optional(v.string()),
    complemento: v.optional(v.string()),
    bairro: v.optional(v.string()),
    cidade: v.optional(v.string()),
    estado: v.optional(v.string()),
  }),
);

export type ClientMetrics = {
  visits: number;
  completed: number;
  cancelled: number;
  noShows: number;
  totalSpent: number;
  outstanding: number;
  lastVisit?: string;
  nextAppointment?: string;
  nextReturn?: string;
  daysSinceLastVisit?: number;
  retentionStatus: "em_dia" | "retorno_pendente" | "atrasado" | "inativo" | "sem_historico";
  lifetimeValue: number;
};

/** Aggregates real recorded transactions for a set of clients. */
async function clientMetrics(
  ctx: any,
  orgId: Id<"organizations">,
  clientIds: Id<"clients">[],
): Promise<Map<string, ClientMetrics>> {
  const map = new Map<string, ClientMetrics>();
  const today = todayInTz();
  const wanted = new Set(clientIds.map((c) => c as string));

  const appointments = await ctx.db
    .query("appointments")
    .withIndex("by_org_date", (q: any) => q.eq("orgId", orgId))
    .collect();

  for (const c of clientIds) {
    map.set(c as string, {
      visits: 0,
      completed: 0,
      cancelled: 0,
      noShows: 0,
      totalSpent: 0,
      outstanding: 0,
      lifetimeValue: 0,
      retentionStatus: "sem_historico",
    });
  }

  for (const a of appointments) {
    if (!wanted.has(a.clientId as string)) continue;
    const m = map.get(a.clientId as string)!;
    if (a.status === "completed") {
      m.completed += 1;
      m.visits += 1;
      if (!m.lastVisit || a.date > m.lastVisit) m.lastVisit = a.date;
    } else if (a.status === "cancelled") {
      m.cancelled += 1;
    } else if (a.status === "no_show") {
      m.noShows += 1;
    }
    if (a.status !== "cancelled" && a.date >= today) {
      if (!m.nextAppointment || a.date < m.nextAppointment) {
        m.nextAppointment = a.date;
      }
    }
  }

  const payments = await ctx.db
    .query("payments")
    .withIndex("by_org", (q: any) => q.eq("orgId", orgId))
    .collect();
  for (const p of payments) {
    if (!wanted.has(p.clientId as string)) continue;
    const m = map.get(p.clientId as string)!;
    if (p.kind === "reembolso") {
      m.totalSpent -= p.amount;
    } else {
      m.totalSpent += p.amount;
    }
  }

  const invoices = await ctx.db
    .query("invoices")
    .withIndex("by_org", (q: any) => q.eq("orgId", orgId))
    .collect();
  const allocations = await ctx.db
    .query("paymentAllocations")
    .withIndex("by_org", (q: any) => q.eq("orgId", orgId))
    .collect();
  for (const inv of invoices) {
    if (!wanted.has(inv.clientId as string)) continue;
    if (inv.status === "cancelled") continue;
    const paid = sum(
      allocations
        .filter((al: any) => al.invoiceId === inv._id)
        .map((al: any) => al.amount),
    );
    const m = map.get(inv.clientId as string)!;
    m.outstanding += Math.max(0, inv.total - paid);
  }

  const records = await ctx.db
    .query("treatmentRecords")
    .withIndex("by_org", (q: any) => q.eq("orgId", orgId))
    .collect();
  for (const r of records) {
    if (!wanted.has(r.clientId as string)) continue;
    const m = map.get(r.clientId as string)!;
    if (r.nextVisitDate && (!m.nextReturn || r.nextVisitDate > m.nextReturn)) {
      m.nextReturn = r.nextVisitDate;
    }
  }

  for (const [, m] of map) {
    m.lifetimeValue = Math.max(0, m.totalSpent);
    if (m.lastVisit) m.daysSinceLastVisit = diffDaysISO(today, m.lastVisit);
    if (!m.lastVisit) {
      m.retentionStatus = "sem_historico";
    } else if (m.nextAppointment) {
      m.retentionStatus = "em_dia";
    } else if (m.nextReturn) {
      m.retentionStatus = m.nextReturn < today ? "atrasado" : "retorno_pendente";
    } else if ((m.daysSinceLastVisit ?? 0) > 120) {
      m.retentionStatus = "inativo";
    } else {
      m.retentionStatus = "retorno_pendente";
    }
  }

  return map;
}

export const listClients = query({
  args: {
    orgId: v.id("organizations"),
    search: v.optional(v.string()),
    status: v.optional(v.string()),
    tag: v.optional(v.string()),
    retention: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId, "clients.view");
    if (!member) return { rows: [], tags: [] as string[], total: 0 };
    let rows: Doc<"clients">[] = await ctx.db
      .query("clients")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    const tags = Array.from(new Set(rows.flatMap((r) => r.tags))).sort();

    const search = args.search?.trim().toLowerCase();
    if (search) {
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(search) ||
          (Boolean(search.replace(/\D/g, "")) && r.phone.replace(/\D/g, "").includes(search.replace(/\D/g, ""))) ||
          (r.email ?? "").toLowerCase().includes(search),
      );
    }
    if (args.status) rows = rows.filter((r) => r.status === args.status);
    if (args.tag) rows = rows.filter((r) => r.tags.includes(args.tag!));

    const metrics = await clientMetrics(
      ctx,
      args.orgId,
      rows.map((r) => r._id),
    );

    let withMetrics = rows.map((r) => ({
      ...r,
      metrics: metrics.get(r._id as string)!,
    }));

    if (args.retention) {
      withMetrics = withMetrics.filter(
        (r) => r.metrics.retentionStatus === args.retention,
      );
    }

    const total = withMetrics.length;
    withMetrics.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    if (args.limit) withMetrics = withMetrics.slice(0, args.limit);

    return { rows: withMetrics, tags, total };
  },
});

export const getClient = query({
  args: { orgId: v.id("organizations"), clientId: v.id("clients") },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId, "clients.view");
    if (!member) return null;
    const client = await ctx.db.get(args.clientId);
    if (!client || client.orgId !== args.orgId) return null;

    const metrics = await clientMetrics(ctx, args.orgId, [args.clientId]);

    const appointments = (
      await ctx.db
        .query("appointments")
        .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
        .filter(q => q.eq(q.field("orgId"), args.orgId))
        .collect()
    ).sort((a, b) => (a.date < b.date ? 1 : -1));

    const payments = (
      await ctx.db
        .query("payments")
        .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
        .filter(q => q.eq(q.field("orgId"), args.orgId))
        .collect()
    ).sort((a, b) => (a.date < b.date ? 1 : -1));

    const invoices = (
      await ctx.db
        .query("invoices")
        .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
        .filter(q => q.eq(q.field("orgId"), args.orgId))
        .collect()
    ).sort((a, b) => (a.issueDate < b.issueDate ? 1 : -1));

    const records = (
      await ctx.db
        .query("treatmentRecords")
        .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
        .filter(q => q.eq(q.field("orgId"), args.orgId))
        .collect()
    ).sort((a, b) => (a.date < b.date ? 1 : -1));

    const consent = await ctx.db
      .query("consentRecords")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .filter(q => q.eq(q.field("orgId"), args.orgId))
        .collect();

    const responses = await ctx.db
      .query("consultationResponses")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .filter(q => q.eq(q.field("orgId"), args.orgId))
        .collect();

    const photos = await ctx.db
      .query("clientPhotos")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .filter(q => q.eq(q.field("orgId"), args.orgId))
        .collect();

    const loyalty = await ctx.db
      .query("loyaltyAccounts")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .first();

    const loyaltyLedger = (
      await ctx.db
        .query("loyaltyTransactions")
        .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
        .filter(q => q.eq(q.field("orgId"), args.orgId))
        .collect()
    ).sort((a, b) => b.createdAt - a.createdAt);

    const serviceNames = Array.from(new Set(records.map((r) => r.serviceName)));

    return {
      client,
      metrics: metrics.get(args.clientId as string)!,
      appointments,
      payments: hasPermission(member.role, "payments.view", member.extraPermissions) ? payments : [],
      invoices: hasPermission(member.role, "invoices.view", member.extraPermissions) ? invoices : [],
      records: hasPermission(member.role, "health.view", member.extraPermissions) ? records : [],
      consent: hasPermission(member.role, "consent.view", member.extraPermissions) ? consent : [],
      responses: hasPermission(member.role, "health.view", member.extraPermissions) ? responses : [],
      photos: hasPermission(member.role, "photos.view", member.extraPermissions) ? photos : [],
      loyalty: loyalty ?? null,
      loyaltyLedger,
      servicesPurchased: serviceNames,
    };
  },
});

export const createClient = mutation({
  args: {
    orgId: v.id("organizations"),
    name: v.string(),
    socialName: v.optional(v.string()),
    phone: v.string(),
    whatsapp: v.optional(v.string()),
    email: v.optional(v.string()),
    document: v.optional(v.string()),
    birthday: v.optional(v.string()),
    address: addressArg,
    preferredContact: v.optional(v.string()),
    referralSource: v.optional(v.string()),
    tags: v.array(v.string()),
    status: v.optional(v.string()),
    preferences: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "clients.edit");
    await validateOrgReferences(ctx, args.orgId, args);
    if (!args.name.trim()) throw new AppError("VALIDATION", "Informe o nome da cliente.");
    if (!args.phone.trim()) throw new AppError("VALIDATION", "Informe o telefone da cliente.");

    const duplicate = await ctx.db
      .query("clients")
      .withIndex("by_org_phone", (q) =>
        q.eq("orgId", args.orgId).eq("phone", args.phone.trim()),
      )
      .first();
    if (duplicate) {
      throw new AppError(
        "CONFLICT",
        `Já existe uma cliente cadastrada com este telefone: ${duplicate.name}.`,
      );
    }

    const id = await ctx.db.insert("clients", {
      orgId: args.orgId,
      name: args.name.trim(),
      socialName: args.socialName,
      phone: args.phone.trim(),
      whatsapp: args.whatsapp,
      email: args.email,
      document: args.document,
      birthday: args.birthday,
      address: args.address,
      preferredContact: args.preferredContact ?? "whatsapp",
      referralSource: args.referralSource,
      tags: args.tags,
      status: args.status ?? "ativo",
      preferences: args.preferences,
      notes: args.notes,
      isDemo: false,
      active: true,
      createdAt: Date.now(),
      createdBy: userId,
    });

    await ctx.db.insert("loyaltyAccounts", {
      orgId: args.orgId,
      clientId: id,
      points: 0,
      tier: "Bronze",
      updatedAt: Date.now(),
    });

    if (args.referralSource) {
      const referrer = (
        await ctx.db
          .query("clients")
          .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
          .collect()
      ).find((c) => c.name === args.referralSource);
      if (referrer) {
        await ctx.db.insert("clientReferrals", {
          orgId: args.orgId,
          referrerClientId: referrer._id,
          referredClientId: id,
          rewardGiven: false,
          createdAt: Date.now(),
        });
      }
    }

    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "criar",
      entity: "clients",
      entityId: id,
      details: args.name,
    });
    return id;
  },
});

export const updateClient = mutation({
  args: {
    orgId: v.id("organizations"),
    clientId: v.id("clients"),
    patch: v.object({
      name: v.optional(v.string()),
      socialName: v.optional(v.string()),
      phone: v.optional(v.string()),
      whatsapp: v.optional(v.string()),
      email: v.optional(v.string()),
      document: v.optional(v.string()),
      birthday: v.optional(v.string()),
      address: addressArg,
      preferredContact: v.optional(v.string()),
      referralSource: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
      status: v.optional(v.string()),
      preferences: v.optional(v.string()),
      notes: v.optional(v.string()),
      active: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "clients.edit");
    await validateOrgReferences(ctx, args.orgId, args);
    const client = await ctx.db.get(args.clientId);
    if (!client || client.orgId !== args.orgId) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    await ctx.db.patch(args.clientId, args.patch);
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "atualizar",
      entity: "clients",
      entityId: args.clientId,
      details: client.name,
    });
    return true;
  },
});

/** Anonymises and deactivates a client (LGPD deletion workflow). */
export const deleteClientData = mutation({
  args: { orgId: v.id("organizations"), clientId: v.id("clients") },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "settings.edit");
    await validateOrgReferences(ctx, args.orgId, args);
    const client = await ctx.db.get(args.clientId);
    if (!client || client.orgId !== args.orgId) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    const appointments = await ctx.db
      .query("appointments")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .filter(q => q.eq(q.field("orgId"), args.orgId))
        .collect();
    if (appointments.length) {
      throw new AppError(
        "VALIDATION",
        "Esta cliente possui histórico de atendimentos. Exclua apenas os dados pessoais e mantenha o histórico financeiro para conformidade.",
      );
    }
    await ctx.db.patch(args.clientId, {
      name: `Cliente removida #${String(args.clientId).slice(-4)}`,
      phone: "0000000000",
      whatsapp: undefined,
      email: undefined,
      document: undefined,
      birthday: undefined,
      address: {},
      notes: undefined,
      preferences: undefined,
      tags: [],
      active: false,
      status: "inativo",
    });
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "excluir_dados",
      entity: "clients",
      entityId: args.clientId,
      details: "Anonimização de dados pessoais (LGPD)",
    });
    return true;
  },
});

export const clientSuggestions = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId, "clients.view");
    if (!member) return [];
    const rows = await ctx.db
      .query("clients")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    return rows
      .filter((r) => r.active)
      .slice(0, 300)
      .map((r) => ({ _id: r._id, name: r.name, phone: r.phone }));
  },
});

/** Upcoming birthdays within the next N days (by day+month). */
export const upcomingBirthdays = query({
  args: { orgId: v.id("organizations"), days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId, "clients.view");
    if (!member) return [];
    const clients = await ctx.db
      .query("clients")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const today = todayInTz();
    const horizon = args.days ?? 30;
    const out: { client: Doc<"clients">; date: string; daysAway: number }[] = [];
    for (const c of clients) {
      if (!c.birthday) continue;
      const mmdd = c.birthday.slice(-5);
      const year = today.slice(0, 4);
      let candidate = `${year}-${mmdd}`;
      if (candidate < today) candidate = `${Number(year) + 1}-${mmdd}`;
      const daysAway = diffDaysISO(candidate, today);
      if (daysAway >= 0 && daysAway <= horizon) {
        out.push({ client: c, date: candidate, daysAway });
      }
    }
    return out.sort((a, b) => a.daysAway - b.daysAway);
  },
});

export const clientOptions = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId, "clients.view");
    if (!member) return [];
    return await ctx.db
      .query("clients")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect()
      .then((rows) =>
        rows
          .filter((r) => r.active)
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      );
  },
});

