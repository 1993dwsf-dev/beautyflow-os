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
} from "./lib/helpers";

export const DEFAULT_CATEGORIES = [
  { name: "Cabelo", color: "#8b5cf6" },
  { name: "Unhas", color: "#ec4899" },
  { name: "Cílios", color: "#0ea5a4" },
  { name: "Sobrancelhas", color: "#f97316" },
  { name: "Cuidados com a pele", color: "#22c55e" },
  { name: "Tratamentos faciais", color: "#06b6d4" },
  { name: "Massagem", color: "#6366f1" },
  { name: "Maquiagem", color: "#e11d48" },
  { name: "Depilação", color: "#eab308" },
  { name: "Barbearia", color: "#475569" },
  { name: "Outros", color: "#94a3b8" },
];

export const listCategories = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId, "services.view");
    if (!member) return [];
    return await ctx.db
      .query("serviceCategories")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
  },
});

export const createCategory = mutation({
  args: { orgId: v.id("organizations"), name: v.string(), color: v.string() },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.orgId, "services.edit");
    await validateOrgReferences(ctx, args.orgId, args);
    if (!args.name.trim()) throw new AppError("VALIDATION", "Informe o nome da categoria.");
    return await ctx.db.insert("serviceCategories", {
      orgId: args.orgId,
      name: args.name.trim(),
      color: args.color,
      active: true,
    });
  },
});

export const listServices = query({
  args: { orgId: v.id("organizations"), includeInactive: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId, "services.view");
    if (!member) return { rows: [], categories: [] };
    const categories = await ctx.db
      .query("serviceCategories")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const catMap = new Map(categories.map((c) => [c._id as string, c]));
    const staff = await ctx.db
      .query("staff")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const staffMap = new Map(staff.map((s) => [s._id as string, s]));

    const rows = await ctx.db
      .query("services")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    const enriched = rows
      .filter((r) => args.includeInactive || r.active)
      .map((s) => ({
        ...s,
        categoryName: s.categoryId
          ? (catMap.get(s.categoryId as string)?.name ?? "Sem categoria")
          : "Sem categoria",
        categoryColor: s.categoryId
          ? (catMap.get(s.categoryId as string)?.color ?? "#94a3b8")
          : "#94a3b8",
        staffNames: s.eligibleStaff
          .map((id) => staffMap.get(id as string)?.name)
          .filter(Boolean) as string[],
        marginPerService:
          s.price - s.materialCost - s.laborCost > 0
            ? Math.round(((s.price - s.materialCost - s.laborCost) / (s.price || 1)) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    return { rows: enriched, categories };
  },
});

export const serviceOptions = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId, "services.view");
    if (!member) return [];
    const rows = await ctx.db
      .query("services")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    return rows
      .filter((r) => r.active)
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  },
});

export const createService = mutation({
  args: {
    orgId: v.id("organizations"),
    name: v.string(),
    categoryId: v.optional(v.id("serviceCategories")),
    description: v.optional(v.string()),
    price: v.number(),
    durationMin: v.number(),
    bufferMin: v.number(),
    materialCost: v.number(),
    laborCost: v.number(),
    depositType: v.string(),
    depositValue: v.number(),
    commissionPct: v.optional(v.number()),
    warrantyNotes: v.optional(v.string()),
    requiredResource: v.optional(v.string()),
    eligibleStaff: v.array(v.id("staff")),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "services.edit");
    await validateOrgReferences(ctx, args.orgId, args);
    if (!args.name.trim()) throw new AppError("VALIDATION", "Informe o nome do serviço.");
    if (args.price < 0) throw new AppError("VALIDATION", "O preço não pode ser negativo.");
    if (args.durationMin <= 0) {
      throw new AppError("VALIDATION", "A duração deve ser maior que zero.");
    }
    const id = await ctx.db.insert("services", {
      orgId: args.orgId,
      name: args.name.trim(),
      categoryId: args.categoryId,
      description: args.description,
      price: args.price,
      durationMin: args.durationMin,
      bufferMin: args.bufferMin,
      materialCost: args.materialCost,
      laborCost: args.laborCost,
      depositType: args.depositType,
      depositValue: args.depositValue,
      commissionPct: args.commissionPct,
      warrantyNotes: args.warrantyNotes,
      requiredResource: args.requiredResource,
      eligibleStaff: args.eligibleStaff,
      active: true,
      isDemo: false,
      createdAt: Date.now(),
    });
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "criar",
      entity: "services",
      entityId: id,
      details: args.name,
    });
    return id;
  },
});

export const updateService = mutation({
  args: {
    orgId: v.id("organizations"),
    serviceId: v.id("services"),
    patch: v.object({
      name: v.optional(v.string()),
      categoryId: v.optional(v.id("serviceCategories")),
      description: v.optional(v.string()),
      price: v.optional(v.number()),
      durationMin: v.optional(v.number()),
      bufferMin: v.optional(v.number()),
      materialCost: v.optional(v.number()),
      laborCost: v.optional(v.number()),
      depositType: v.optional(v.string()),
      depositValue: v.optional(v.number()),
      commissionPct: v.optional(v.number()),
      warrantyNotes: v.optional(v.string()),
      requiredResource: v.optional(v.string()),
      eligibleStaff: v.optional(v.array(v.id("staff"))),
      active: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "services.edit");
    await validateOrgReferences(ctx, args.orgId, args);
    const service = await ctx.db.get(args.serviceId);
    if (!service || service.orgId !== args.orgId) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    await ctx.db.patch(args.serviceId, args.patch);
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "atualizar",
      entity: "services",
      entityId: args.serviceId,
      details: `${service.name}: ${Object.keys(args.patch).join(", ")}`,
    });
    return true;
  },
});

export const listPackages = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId, "services.view");
    if (!member) return [];
    return await ctx.db
      .query("servicePackages")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
  },
});

export const savePackage = mutation({
  args: {
    orgId: v.id("organizations"),
    packageId: v.optional(v.id("servicePackages")),
    name: v.string(),
    description: v.optional(v.string()),
    items: v.array(
      v.object({
        serviceId: v.id("services"),
        name: v.string(),
        price: v.number(),
        quantity: v.number(),
      }),
    ),
    packagePrice: v.number(),
    validityDays: v.number(),
    restrictions: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { member } = await requireMember(ctx, args.orgId, "services.edit");
    await validateOrgReferences(ctx, args.orgId, args);
    if (!args.name.trim()) throw new AppError("VALIDATION", "Informe o nome do pacote.");
    if (!args.items.length) {
      throw new AppError("VALIDATION", "Adicione pelo menos um serviço ao pacote.");
    }
    const individualValue = sum(
      args.items.map((i) => i.price * i.quantity),
    );
    if (args.packagePrice > individualValue) {
      throw new AppError(
        "VALIDATION",
        "O valor do pacote não pode ser maior que a soma dos serviços individuais.",
      );
    }
    const payload = {
      orgId: args.orgId,
      name: args.name.trim(),
      description: args.description,
      items: args.items,
      individualValue,
      packagePrice: args.packagePrice,
      validityDays: args.validityDays,
      restrictions: args.restrictions,
      active: args.active ?? true,
      createdAt: Date.now(),
    };
    if (args.packageId) {
      const existing = await ctx.db.get(args.packageId);
      if (!existing || existing.orgId !== args.orgId) {
        throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
      }
      await ctx.db.patch(args.packageId, payload);
      return args.packageId;
    }
    return await ctx.db.insert("servicePackages", payload);
  },
});

export const deletePackage = mutation({
  args: { orgId: v.id("organizations"), packageId: v.id("servicePackages") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.orgId, "services.edit");
    await validateOrgReferences(ctx, args.orgId, args);
    const pkg = await ctx.db.get(args.packageId);
    if (!pkg || pkg.orgId !== args.orgId) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    await ctx.db.delete(args.packageId);
    return true;
  },
});

// ---------------------------------------------------------------------------
// Service -> inventory consumption rules (estimated usage per service)
// ---------------------------------------------------------------------------

export const listConsumptionRules = query({
  args: { orgId: v.id("organizations"), serviceId: v.optional(v.id("services")) },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId, "services.view");
    if (!member) return [];
    const rows = await ctx.db
      .query("serviceConsumptionRules")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const products = await ctx.db
      .query("products")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const services = await ctx.db
      .query("services")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    return rows
      .filter((r) => !args.serviceId || r.serviceId === args.serviceId)
      .map((r) => ({
        ...r,
        productName: products.find((p) => p._id === r.productId)?.name ?? "Produto removido",
        unitCost: products.find((p) => p._id === r.productId)?.cost ?? 0,
        serviceName:
          services.find((s) => s._id === r.serviceId)?.name ?? "Serviço removido",
      }));
  },
});

export const saveConsumptionRule = mutation({
  args: {
    orgId: v.id("organizations"),
    serviceId: v.id("services"),
    productId: v.id("products"),
    quantity: v.number(),
  },
  handler: async (ctx, args) => {
    const { member } = await requireMember(ctx, args.orgId, "services.edit");
    await validateOrgReferences(ctx, args.orgId, args);
    if (args.quantity <= 0) {
      throw new AppError("VALIDATION", "A quantidade consumida deve ser maior que zero.");
    }
    const existing = (
      await ctx.db
        .query("serviceConsumptionRules")
        .withIndex("by_service", (q) => q.eq("serviceId", args.serviceId))
        .collect()
    ).find((r) => r.productId === args.productId);
    if (existing) {
      await ctx.db.patch(existing._id, { quantity: args.quantity });
    } else {
      await ctx.db.insert("serviceConsumptionRules", {
        orgId: args.orgId,
        serviceId: args.serviceId,
        productId: args.productId,
        quantity: args.quantity,
      });
    }
    return { ok: true, by: member.name };
  },
});

export const deleteConsumptionRule = mutation({
  args: { orgId: v.id("organizations"), ruleId: v.id("serviceConsumptionRules") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.orgId, "services.edit");
    await validateOrgReferences(ctx, args.orgId, args);
    const rule = await ctx.db.get(args.ruleId);
    if (!rule || rule.orgId !== args.orgId) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    await ctx.db.delete(args.ruleId);
    return true;
  },
});
