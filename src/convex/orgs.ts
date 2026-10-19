import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  AppError,
  ERR,
  assertFeature,
  getMembership,
  getUserId,
  logAudit,
  requireMember,
  todayInTz,
} from "./lib/helpers";
import {
  DEFAULT_FEATURE_FLAGS,
  FEATURE_FLAGS,
  permissionsFor,
  type FeatureKey,
  type OrgRole,
} from "./lib/permissions";

export const PAYMENT_METHOD_KEYS = [
  "pix",
  "cash",
  "credit_card",
  "debit_card",
  "transfer",
  "gift_card",
  "other",
] as const;

/** Payment methods stored before the canonical keys were introduced. */
const LEGACY_PAYMENT_METHODS: Record<string, string> = {
  dinheiro: "cash",
  cartao_credito: "credit_card",
  cartao_debito: "debit_card",
  transferencia: "transfer",
  cartao_presente: "gift_card",
  outro: "other",
  boleto: "other",
};

/**
 * Keeps `organizations.paymentMethods` aligned with the payment method enum
 * accepted by `payments.createPayment`. Storing legacy labels such as
 * "dinheiro" made the payment form submit a value the mutation rejects.
 */
export function normalizePaymentMethods(methods: string[] | undefined): string[] {
  const normalized = (methods ?? [])
    .map((method) => LEGACY_PAYMENT_METHODS[method] ?? method)
    .filter((method): method is string =>
      (PAYMENT_METHOD_KEYS as readonly string[]).includes(method),
    );
  return Array.from(new Set(normalized));
}

export const DEFAULT_PAYMENT_METHODS = [
  "pix",
  "cash",
  "credit_card",
  "debit_card",
  "transfer",
];

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Produtos e insumos",
  "Equipamentos",
  "Aluguel",
  "Energia elétrica",
  "Água",
  "Internet",
  "Marketing",
  "Publicidade",
  "Custos com equipe",
  "Treinamento",
  "Software",
  "Limpeza",
  "Manutenção",
  "Seguros",
  "Administrativo",
  "Impostos e taxas",
  "Outras despesas",
];

const DEFAULT_OPEN_HOURS = [
  { weekday: 0, closed: true, open: "09:00", close: "18:00" },
  { weekday: 1, closed: false, open: "09:00", close: "19:00" },
  { weekday: 2, closed: false, open: "09:00", close: "19:00" },
  { weekday: 3, closed: false, open: "09:00", close: "19:00" },
  { weekday: 4, closed: false, open: "09:00", close: "20:00" },
  { weekday: 5, closed: false, open: "09:00", close: "20:00" },
  { weekday: 6, closed: false, open: "08:00", close: "17:00" },
];

const PLANS = [
  {
    slug: "essencial",
    name: "Essencial",
    priceMonthly: 9900,
    features: ["agenda", "crm", "catalog", "finance"],
    limits: { users: 3, appointmentsPerMonth: 300, locations: 1 },
    active: true,
  },
  {
    slug: "profissional",
    name: "Profissional",
    priceMonthly: 19900,
    features: ["agenda", "crm", "catalog", "finance", "inventory", "commissions", "loyalty"],
    limits: { users: 10, appointmentsPerMonth: 1500, locations: 1 },
    active: true,
  },
  {
    slug: "estudio",
    name: "Estúdio",
    priceMonthly: 34900,
    features: [
      "agenda",
      "crm",
      "catalog",
      "finance",
      "inventory",
      "commissions",
      "loyalty",
      "marketing",
      "analytics",
      "publicBooking",
    ],
    limits: { users: 30, appointmentsPerMonth: 6000, locations: 3 },
    active: true,
  },
];

/** All organizations the signed-in user belongs to. */
export const myOrganizations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) return [];
    const memberships = await ctx.db
      .query("organizationMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const out = [];
    for (const m of memberships) {
      if (!m.active) continue;
      const org = await ctx.db.get(m.orgId);
      if (!org) continue;
      out.push({
        _id: org._id,
        name: org.name,
        role: m.role as OrgRole,
        isDemo: org.isDemo,
        onboardingComplete: org.onboardingComplete,
        logoUrl: org.logoUrl,
        brandAccent: org.brandAccent,
      });
    }
    return out;
  },
});

/** Everything an authenticated shell needs for one organization. */
export const orgContext = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const member = await getMembership(ctx, orgId);
    if (!member) return null;
    const org = await ctx.db.get(orgId);
    if (!org) return null;

    const flags = await ctx.db
      .query("featureFlags")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const flagsMap: Record<string, boolean> = { ...DEFAULT_FEATURE_FLAGS };
    for (const f of flags) flagsMap[f.key] = f.enabled;

    const staffCount = (
      await ctx.db
        .query("staff")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
    ).filter((s) => s.active).length;

    const unread = (
      await ctx.db
        .query("notifications")
        .withIndex("by_org", (q) => q.eq("orgId", orgId).eq("read", false))
        .collect()
    ).length;

    return {
      org,
      member,
      flags: flagsMap,
      permissions: permissionsFor(
        member.role as OrgRole,
        member.extraPermissions,
      ),
      staffCount,
      unreadNotifications: unread,
      today: todayInTz(org.timezone),
    };
  },
});

export const createOrganization = mutation({
  args: {
    name: v.string(),
    businessType: v.optional(v.string()),
    ownerName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    whatsapp: v.optional(v.string()),
    document: v.optional(v.string()),
    legalName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new AppError("UNAUTHENTICATED", ERR.NOT_AUTHENTICATED);
    const user = await ctx.db.get(userId);
    const name = args.name.trim();
    if (!name) throw new AppError("VALIDATION", "Informe o nome do negócio.");

    const slugBase =
      name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 32) || "estudio";
    let slug = slugBase;
    let n = 1;
    while (
      await ctx.db
        .query("organizations")
        .withIndex("by_slug", (q) => q.eq("publicBookingSlug", slug))
        .first()
    ) {
      n += 1;
      slug = `${slugBase}-${n}`;
    }

    const orgId = await ctx.db.insert("organizations", {
      name,
      legalName: args.legalName,
      document: args.document,
      ownerName: args.ownerName ?? user?.name ?? undefined,
      email: args.email ?? user?.email ?? undefined,
      phone: args.phone,
      whatsapp: args.whatsapp,
      address: {},
      businessType: args.businessType ?? "Salão de beleza",
      currency: "BRL",
      timezone: "America/Sao_Paulo",
      weekStart: 1,
      openHours: DEFAULT_OPEN_HOURS,
      cancellationPolicy:
        "Cancelamentos com menos de 24 horas de antecedência podem gerar cobrança de sinal.",
      cancellationHours: 24,
      depositPolicy: "Sinal de 30% para serviços longos ou acima de R$ 200,00.",
      defaultDepositPct: 30,
      bufferMinutes: 10,
      minNoticeHours: 2,
      onlineBookingLeadHours: 24,
      commissionBaseDefault: "net_discount",
      taxPct: 0,
      brandAccent: "#0ea5a4",
      brandTheme: "claro",
      paymentMethods: DEFAULT_PAYMENT_METHODS,
      expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
      publicBookingSlug: slug,
      publicBookingEnabled: false,
      requireApprovalOnline: false,
      loyaltySettings: {
        enabled: true,
        pointsPerReal: 1,
        pointsPerVisit: 10,
        referralPoints: 100,
        birthdayPoints: 50,
        tiers: [
          { name: "Bronze", minPoints: 0 },
          { name: "Prata", minPoints: 500 },
          { name: "Ouro", minPoints: 1500 },
        ],
        rewards: [
          { name: "R$ 20 de desconto", pointsCost: 200, type: "desconto", value: 2000 },
          { name: "Escova gratuita", pointsCost: 500, type: "servico", value: 0 },
        ],
      },
      onboardingComplete: false,
      isDemo: false,
      createdAt: Date.now(),
      createdBy: userId,
    });

    await ctx.db.insert("organizationMembers", {
      orgId,
      userId,
      name: user?.name ?? args.ownerName ?? "Proprietária(o)",
      email: user?.email,
      role: "owner",
      extraPermissions: [],
      active: true,
      createdAt: Date.now(),
    });

    for (const flag of FEATURE_FLAGS) {
      await ctx.db.insert("featureFlags", {
        orgId,
        key: flag.key,
        enabled: DEFAULT_FEATURE_FLAGS[flag.key as FeatureKey],
      });
    }

    await ctx.db.insert("financialAccounts", {
      orgId,
      name: "Caixa principal",
      type: "caixa",
      openingBalance: 0,
      active: true,
    });

    await ctx.db.insert("subscriptions", {
      orgId,
      planSlug: "profissional",
      status: "trial",
      trialEndsAt: Date.now() + 14 * 86_400_000,
      startedAt: Date.now(),
    });

    // global plan catalog (idempotent)
    for (const plan of PLANS) {
      const existing = await ctx.db
        .query("plans")
        .withIndex("by_slug", (q) => q.eq("slug", plan.slug))
        .first();
      if (!existing) await ctx.db.insert("plans", plan);
    }

    await logAudit(ctx, {
      orgId,
      userId,
      userName: user?.name ?? "Sistema",
      action: "criar",
      entity: "organizations",
      entityId: orgId,
      details: `Organização ${name} criada`,
    });

    return orgId;
  },
});

export const updateOrganization = mutation({
  args: {
    orgId: v.id("organizations"),
    patch: v.object({
      name: v.optional(v.string()),
      legalName: v.optional(v.string()),
      document: v.optional(v.string()),
      ownerName: v.optional(v.string()),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      whatsapp: v.optional(v.string()),
      businessType: v.optional(v.string()),
      logoUrl: v.optional(v.string()),
      openHours: v.optional(
        v.array(
          v.object({
            weekday: v.number(),
            closed: v.boolean(),
            open: v.string(),
            close: v.string(),
          }),
        ),
      ),
      address: v.optional(
        v.object({
          cep: v.optional(v.string()),
          logradouro: v.optional(v.string()),
          numero: v.optional(v.string()),
          complemento: v.optional(v.string()),
          bairro: v.optional(v.string()),
          cidade: v.optional(v.string()),
          estado: v.optional(v.string()),
        }),
      ),
      cancellationPolicy: v.optional(v.string()),
      cancellationHours: v.optional(v.number()),
      depositPolicy: v.optional(v.string()),
      defaultDepositPct: v.optional(v.number()),
      bufferMinutes: v.optional(v.number()),
      minNoticeHours: v.optional(v.number()),
      onlineBookingLeadHours: v.optional(v.number()),
      taxPct: v.optional(v.number()),
      brandAccent: v.optional(v.string()),
      brandTheme: v.optional(v.string()),
      paymentMethods: v.optional(v.array(v.string())),
      expenseCategories: v.optional(v.array(v.string())),
      publicBookingEnabled: v.optional(v.boolean()),
      requireApprovalOnline: v.optional(v.boolean()),
      commissionBaseDefault: v.optional(
        v.union(
          v.literal("gross"),
          v.literal("net_discount"),
          v.literal("collected"),
        ),
      ),
      loyaltySettings: v.optional(
        v.object({
          enabled: v.boolean(),
          pointsPerReal: v.number(),
          pointsPerVisit: v.number(),
          referralPoints: v.number(),
          birthdayPoints: v.number(),
          tiers: v.array(v.object({ name: v.string(), minPoints: v.number() })),
          rewards: v.array(
            v.object({
              name: v.string(),
              pointsCost: v.number(),
              type: v.string(),
              value: v.number(),
            }),
          ),
        }),
      ),
      onboardingComplete: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, { orgId, patch }) => {
    const { userId, member } = await requireMember(ctx, orgId, "settings.edit");
    const next = { ...patch };
    if (patch.paymentMethods) {
      next.paymentMethods = normalizePaymentMethods(patch.paymentMethods);
    }
    await ctx.db.patch(orgId, next);
    await logAudit(ctx, {
      orgId,
      userId,
      userName: member.name,
      action: "atualizar",
      entity: "organizations",
      entityId: orgId,
      details: Object.keys(patch).join(", "),
    });
    return true;
  },
});

export const setFeatureFlag = mutation({
  args: {
    orgId: v.id("organizations"),
    key: v.string(),
    enabled: v.boolean(),
  },
  handler: async (ctx, { orgId, key, enabled }) => {
    const { member } = await requireMember(ctx, orgId, "settings.edit");
    const existing = await ctx.db
      .query("featureFlags")
      .withIndex("by_org", (q) => q.eq("orgId", orgId).eq("key", key))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { enabled });
    } else {
      await ctx.db.insert("featureFlags", { orgId, key, enabled });
    }
    await logAudit(ctx, {
      orgId,
      userName: member.name,
      action: "feature_flag",
      entity: "featureFlags",
      entityId: key,
      details: `${key} = ${enabled}`,
    });
    return true;
  },
});

export const listMembers = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const member = await getMembership(ctx, orgId);
    if (!member) return [];
    const rows = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    return rows;
  },
});

/** Adds an existing BeautyFlow user (matched by e-mail) to the organization. */
export const addMemberByEmail = mutation({
  args: {
    orgId: v.id("organizations"),
    email: v.string(),
    name: v.string(),
    role: v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("receptionist"),
      v.literal("professional"),
      v.literal("finance"),
      v.literal("viewer"),
    ),
    extraPermissions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "users.manage");
    const email = args.email.trim().toLowerCase();
    if (!email.includes("@")) {
      throw new AppError("VALIDATION", "Informe um e-mail válido.");
    }
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
    if (!user) {
      throw new AppError(
        "VALIDATION",
        "Não encontramos uma conta com este e-mail. Peça para a pessoa criar a conta primeiro e tente novamente.",
      );
    }
    const existing = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_user", (q) =>
        q.eq("orgId", args.orgId).eq("userId", user._id),
      )
      .first();
    if (existing) {
      throw new AppError("CONFLICT", "Este usuário já faz parte da equipe.");
    }
    const id = await ctx.db.insert("organizationMembers", {
      orgId: args.orgId,
      userId: user._id,
      name: args.name || user.name || email,
      email,
      role: args.role,
      extraPermissions: args.extraPermissions,
      active: true,
      createdAt: Date.now(),
    });
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "adicionar_usuario",
      entity: "organizationMembers",
      entityId: id,
      details: `${email} como ${args.role}`,
    });
    return id;
  },
});

export const updateMember = mutation({
  args: {
    orgId: v.id("organizations"),
    memberId: v.id("organizationMembers"),
    role: v.optional(
      v.union(
        v.literal("owner"),
        v.literal("admin"),
        v.literal("receptionist"),
        v.literal("professional"),
        v.literal("finance"),
        v.literal("viewer"),
      ),
    ),
    extraPermissions: v.optional(v.array(v.string())),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, { orgId, memberId, ...patch }) => {
    const { userId, member } = await requireMember(ctx, orgId, "users.manage");
    const target = await ctx.db.get(memberId);
    if (!target || target.orgId !== orgId) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    if (target.role === "owner" && patch.role && patch.role !== "owner") {
      const owners = (
        await ctx.db
          .query("organizationMembers")
          .withIndex("by_org", (q) => q.eq("orgId", orgId))
          .collect()
      ).filter((m) => m.role === "owner" && m.active);
      if (owners.length <= 1) {
        throw new AppError(
          "VALIDATION",
          "A organização precisa de pelo menos uma pessoa com o papel de Proprietária(o).",
        );
      }
    }
    await ctx.db.patch(memberId, {
      role: patch.role ?? target.role,
      extraPermissions: patch.extraPermissions ?? target.extraPermissions,
      active: patch.active ?? target.active,
    });
    await logAudit(ctx, {
      orgId,
      userId,
      userName: member.name,
      action: "atualizar_usuario",
      entity: "organizationMembers",
      entityId: memberId,
      details: JSON.stringify(patch),
    });
    return true;
  },
});

export const removeMember = mutation({
  args: { orgId: v.id("organizations"), memberId: v.id("organizationMembers") },
  handler: async (ctx, { orgId, memberId }) => {
    const { userId, member } = await requireMember(ctx, orgId, "users.manage");
    const target = await ctx.db.get(memberId);
    if (!target || target.orgId !== orgId) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    if (target._id === member._id) {
      throw new AppError(
        "VALIDATION",
        "Você não pode remover o seu próprio acesso.",
      );
    }
    await ctx.db.delete(memberId);
    await logAudit(ctx, {
      orgId,
      userId,
      userName: member.name,
      action: "remover_usuario",
      entity: "organizationMembers",
      entityId: memberId,
    });
    return true;
  },
});

export const listAuditLogs = query({
  args: { orgId: v.id("organizations"), limit: v.optional(v.number()) },
  handler: async (ctx, { orgId, limit }) => {
    const member = await getMembership(ctx, orgId);
    if (!member) return [];
    const rows = await ctx.db
      .query("auditLogs")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .take(limit ?? 100);
    return rows;
  },
});

export const listNotifications = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const member = await getMembership(ctx, orgId);
    if (!member) return [];
    return await ctx.db
      .query("notifications")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .take(50);
  },
});

export const markNotificationRead = mutation({
  args: { orgId: v.id("organizations"), id: v.id("notifications") },
  handler: async (ctx, { orgId, id }) => {
    await requireMember(ctx, orgId, "appointments.view");
    await ctx.db.patch(id, { read: true });
    return true;
  },
});

export const publicBookingOrg = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("publicBookingSlug", slug))
      .first();
    if (!org || !org.publicBookingEnabled) return null;
    const services = (
      await ctx.db
        .query("services")
        .withIndex("by_org", (q) => q.eq("orgId", org._id))
        .collect()
    ).filter((s) => s.active);
    const staff = (
      await ctx.db
        .query("staff")
        .withIndex("by_org", (q) => q.eq("orgId", org._id))
        .collect()
    ).filter((s) => s.active);
    return {
      org: {
        _id: org._id,
        name: org.name,
        logoUrl: org.logoUrl,
        brandAccent: org.brandAccent,
        phone: org.phone,
        whatsapp: org.whatsapp,
        address: org.address,
        openHours: org.openHours,
        depositPolicy: org.depositPolicy,
        cancellationPolicy: org.cancellationPolicy,
        publicBookingSlug: org.publicBookingSlug,
      },
      services: services.map((s) => ({
        _id: s._id,
        name: s.name,
        description: s.description,
        price: s.price,
        durationMin: s.durationMin,
        depositType: s.depositType,
        depositValue: s.depositValue,
      })),
      staff: staff.map((s) => ({
        _id: s._id,
        name: s.name,
        serviceIds: s.serviceIds,
      })),
    };
  },
});

export const subscriptionSummary = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const member = await getMembership(ctx, orgId);
    if (!member) return null;
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first();
    if (!sub) return null;
    const plan = await ctx.db
      .query("plans")
      .withIndex("by_slug", (q) => q.eq("slug", sub.planSlug))
      .first();
    const month = todayInTz().slice(0, 7);
    const usage = await ctx.db
      .query("usageRecords")
      .withIndex("by_org", (q) =>
        q.eq("orgId", orgId).eq("period", month),
      )
      .collect();
    return { subscription: sub, plan, usage, flags: await assertFeatureFlags(ctx, orgId) };
  },
});

async function assertFeatureFlags(ctx: any, orgId: Id<"organizations">) {
  const rows = await ctx.db
    .query("featureFlags")
    .withIndex("by_org", (q: any) => q.eq("orgId", orgId))
    .collect();
  const map: Record<string, boolean> = { ...DEFAULT_FEATURE_FLAGS };
  for (const r of rows) map[r.key] = r.enabled;
  return map;
}

export const featureFlagState = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const member = await getMembership(ctx, orgId);
    if (!member) return null;
    await assertFeature(ctx, orgId, "crm");
    return assertFeatureFlags(ctx, orgId);
  },
});
