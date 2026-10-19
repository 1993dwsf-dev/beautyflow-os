import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
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

export const listSuppliers = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId);
    if (!member) return [];
    return await ctx.db
      .query("suppliers")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
  },
});

export const saveSupplier = mutation({
  args: {
    orgId: v.id("organizations"),
    supplierId: v.optional(v.id("suppliers")),
    name: v.string(),
    contact: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    document: v.optional(v.string()),
    notes: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { member } = await requireMember(ctx, args.orgId, "inventory.edit");
    if (!args.name.trim()) throw new AppError("VALIDATION", "Informe o nome do fornecedor.");
    const payload = {
      orgId: args.orgId,
      name: args.name.trim(),
      contact: args.contact,
      phone: args.phone,
      email: args.email,
      document: args.document,
      notes: args.notes,
      active: args.active ?? true,
    };
    if (args.supplierId) {
      const existing = await ctx.db.get(args.supplierId);
      if (!existing || existing.orgId !== args.orgId) {
        throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
      }
      await ctx.db.patch(args.supplierId, payload);
      return { ok: true, by: member.name };
    }
    return await ctx.db.insert("suppliers", payload);
  },
});

export const deleteSupplier = mutation({
  args: { orgId: v.id("organizations"), supplierId: v.id("suppliers") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.orgId, "inventory.edit");
    const supplier = await ctx.db.get(args.supplierId);
    if (!supplier || supplier.orgId !== args.orgId) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    await ctx.db.delete(args.supplierId);
    return true;
  },
});

export const listProductCategories = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId);
    if (!member) return [];
    return await ctx.db
      .query("productCategories")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
  },
});

export const createProductCategory = mutation({
  args: { orgId: v.id("organizations"), name: v.string() },
  handler: async (ctx, args) => {
    const { member } = await requireMember(ctx, args.orgId, "inventory.edit");
    if (!args.name.trim()) throw new AppError("VALIDATION", "Informe o nome da categoria.");
    const id = await ctx.db.insert("productCategories", {
      orgId: args.orgId,
      name: args.name.trim(),
      active: true,
    });
    return { id, by: member.name };
  },
});

export const listProducts = query({
  args: {
    orgId: v.id("organizations"),
    search: v.optional(v.string()),
    categoryId: v.optional(v.id("productCategories")),
    lowStockOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId);
    if (!member) return { rows: [], valuation: 0, lowStock: 0, categories: [] };
    const categories = await ctx.db
      .query("productCategories")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const catMap = new Map(categories.map((c) => [c._id as string, c.name]));
    const suppliers = await ctx.db
      .query("suppliers")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    let rows = await ctx.db
      .query("products")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    if (args.categoryId) rows = rows.filter((r) => r.categoryId === args.categoryId);
    if (args.lowStockOnly) rows = rows.filter((r) => r.quantity <= r.minStock);
    if (args.search) {
      const q = args.search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.brand ?? "").toLowerCase().includes(q) ||
          r.sku.toLowerCase().includes(q) ||
          (r.barcode ?? "").includes(q),
      );
    }

    const today = todayInTz();
    const enriched = rows
      .map((p) => ({
        ...p,
        categoryName: p.categoryId ? (catMap.get(p.categoryId as string) ?? "—") : "—",
        supplierName: suppliers.find((s) => s._id === p.supplierId)?.name ?? "—",
        stockValue: p.quantity * p.cost,
        lowStock: p.quantity <= p.minStock,
        expiringSoon:
          !!p.expirationDate &&
          p.expirationDate <= addDaysISO(today, 60) &&
          p.expirationDate >= today,
        marginPct:
          p.price > 0 ? Math.round(((p.price - p.cost) / p.price) * 1000) / 10 : 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    return {
      rows: enriched,
      valuation: sum(enriched.map((r) => r.stockValue)),
      lowStock: enriched.filter((r) => r.lowStock).length,
      categories,
      retailValue: sum(enriched.filter((r) => r.type === "varejo").map((r) => r.stockValue)),
    };
  },
});

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Internal stock code shown only in exports; the form no longer asks for it. */
function generateSku(name: string) {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 12);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base || "PROD"}-${suffix}`;
}

export const saveProduct = mutation({
  args: {
    orgId: v.id("organizations"),
    productId: v.optional(v.id("products")),
    name: v.string(),
    brand: v.optional(v.string()),
    categoryId: v.optional(v.id("productCategories")),
    /** Optional now that the form no longer asks for it; generated when absent. */
    sku: v.optional(v.string()),
    barcode: v.optional(v.string()),
    supplierId: v.optional(v.id("suppliers")),
    cost: v.number(),
    price: v.number(),
    minStock: v.number(),
    reorderQty: v.number(),
    expirationDate: v.optional(v.string()),
    location: v.optional(v.string()),
    type: v.string(),
    active: v.optional(v.boolean()),
    initialQuantity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "inventory.edit");
    await assertFeature(ctx, args.orgId, "inventory");
    if (!args.name.trim()) throw new AppError("VALIDATION", "Informe o nome do produto.");
    if (args.cost < 0 || args.price < 0) {
      throw new AppError("VALIDATION", "Os valores não podem ser negativos.");
    }

    const existing = args.productId ? await ctx.db.get(args.productId) : null;
    if (args.productId && (!existing || existing.orgId !== args.orgId)) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }

    const payload = {
      orgId: args.orgId,
      name: args.name.trim(),
      brand: args.brand,
      categoryId: args.categoryId,
      sku: args.sku?.trim() || existing?.sku || generateSku(args.name),
      barcode: args.barcode,
      supplierId: args.supplierId,
      cost: args.cost,
      price: args.price,
      minStock: args.minStock,
      reorderQty: args.reorderQty,
      expirationDate: args.expirationDate,
      location: args.location,
      type: args.type,
      active: args.active ?? true,
      isDemo: false,
    };

    if (args.productId) {
      await ctx.db.patch(args.productId, payload);
      await logAudit(ctx, {
        orgId: args.orgId,
        userId,
        userName: member.name,
        action: "atualizar_produto",
        entity: "products",
        entityId: args.productId,
        details: args.name,
      });
      return args.productId;
    }

    const id = await ctx.db.insert("products", {
      ...payload,
      quantity: 0,
      createdAt: Date.now(),
    });
    const initial = args.initialQuantity ?? 0;
    if (initial > 0) {
      await ctx.db.insert("inventoryMovements", {
        orgId: args.orgId,
        productId: id,
        type: "entrada",
        quantity: initial,
        balanceAfter: initial,
        unitCost: args.cost,
        reason: "Estoque inicial",
        supplierId: args.supplierId,
        date: todayInTz(),
        isDemo: false,
        createdAt: Date.now(),
        createdBy: userId,
      });
      await ctx.db.patch(id, { quantity: initial });
    }
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "criar_produto",
      entity: "products",
      entityId: id,
      details: args.name,
    });
    return id;
  },
});

/** Every stock change writes an immutable movement row. */
export const moveStock = mutation({
  args: {
    orgId: v.id("organizations"),
    productId: v.id("products"),
    type: v.union(
      v.literal("entrada"),
      v.literal("saida"),
      v.literal("ajuste"),
      v.literal("venda"),
      v.literal("consumo"),
      v.literal("perda"),
      v.literal("devolucao"),
    ),
    quantity: v.number(),
    reason: v.optional(v.string()),
    supplierId: v.optional(v.id("suppliers")),
    unitCost: v.optional(v.number()),
    appointmentId: v.optional(v.id("appointments")),
    staffId: v.optional(v.id("staff")),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "inventory.edit");
    await assertFeature(ctx, args.orgId, "inventory");
    const product = await ctx.db.get(args.productId);
    if (!product || product.orgId !== args.orgId) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    if (args.quantity <= 0) {
      throw new AppError("VALIDATION", "A quantidade deve ser maior que zero.");
    }

    const inbound = ["entrada", "devolucao", "ajuste"].includes(args.type);
    const delta =
      args.type === "ajuste"
        ? args.quantity - product.quantity
        : inbound
          ? args.quantity
          : -args.quantity;

    if (!inbound && product.quantity < args.quantity) {
      throw new AppError(
        "INSUFFICIENT",
        `Não foi possível atualizar o estoque. Verifique a quantidade disponível (${product.quantity} ${product.name}).`,
      );
    }

    const balanceAfter = product.quantity + delta;
    const movementId = await ctx.db.insert("inventoryMovements", {
      orgId: args.orgId,
      productId: args.productId,
      type: args.type,
      quantity: delta,
      balanceAfter,
      unitCost: args.unitCost ?? product.cost,
      reason: args.reason,
      supplierId: args.supplierId,
      appointmentId: args.appointmentId,
      staffId: args.staffId,
      date: todayInTz(),
      isDemo: false,
      createdAt: Date.now(),
      createdBy: userId,
    });
    await ctx.db.patch(args.productId, { quantity: balanceAfter });

    if (balanceAfter <= product.minStock) {
      await notify(ctx, {
        orgId: args.orgId,
        title: "Alerta de estoque",
        body: `${product.name} está com ${balanceAfter} unidade(s) (mínimo ${product.minStock}).`,
        type: "estoque",
        link: "/app/inventario",
      });
    }

    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: `movimento_${args.type}`,
      entity: "inventoryMovements",
      entityId: movementId,
      details: `${product.name} ${delta > 0 ? "+" : ""}${delta}`,
    });

    return { movementId, balanceAfter };
  },
});

/** Reverses a movement and records the correction (audit trail preserved). */
export const correctMovement = mutation({
  args: {
    orgId: v.id("organizations"),
    movementId: v.id("inventoryMovements"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "inventory.edit");
    const movement = await ctx.db.get(args.movementId);
    if (!movement || movement.orgId !== args.orgId) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    const product = await ctx.db.get(movement.productId);
    if (!product) throw new AppError("NOT_FOUND", "Produto não encontrado.");
    const delta = -movement.quantity;
    const balanceAfter = product.quantity + delta;
    if (balanceAfter < 0) {
      throw new AppError(
        "INSUFFICIENT",
        "Não foi possível reverter este movimento porque a quantidade disponível é insuficiente.",
      );
    }
    const id = await ctx.db.insert("inventoryMovements", {
      orgId: args.orgId,
      productId: movement.productId,
      type: "ajuste",
      quantity: delta,
      balanceAfter,
      unitCost: movement.unitCost,
      reason: `Correção: ${args.reason}`,
      reversedBy: movement._id,
      date: todayInTz(),
      isDemo: false,
      createdAt: Date.now(),
      createdBy: userId,
    });
    await ctx.db.patch(product._id, { quantity: balanceAfter });
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "corrigir_movimento",
      entity: "inventoryMovements",
      entityId: id,
      details: args.reason,
    });
    return true;
  },
});

export const listMovements = query({
  args: {
    orgId: v.id("organizations"),
    productId: v.optional(v.id("products")),
    type: v.optional(v.string()),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId);
    if (!member) return [];
    let rows;
    if (args.productId) {
      rows = await ctx.db
        .query("inventoryMovements")
        .withIndex("by_product", (q) => q.eq("productId", args.productId!))
        .collect();
    } else {
      rows = await ctx.db
        .query("inventoryMovements")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .collect();
    }
    if (args.type) rows = rows.filter((r) => r.type === args.type);
    if (args.from) rows = rows.filter((r) => r.date >= args.from!);
    if (args.to) rows = rows.filter((r) => r.date <= args.to!);
    const products = await ctx.db
      .query("products")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const suppliers = await ctx.db
      .query("suppliers")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    return rows
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 400)
      .map((m) => ({
        ...m,
        productName: products.find((p) => p._id === m.productId)?.name ?? "—",
        supplierName: suppliers.find((s) => s._id === m.supplierId)?.name ?? "—",
        totalCost: Math.abs(m.quantity) * m.unitCost,
      }));
  },
});

export const consumptionReport = query({
  args: {
    orgId: v.id("organizations"),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId);
    if (!member) return { rows: [], totalCost: 0 };
    let records = await ctx.db
      .query("serviceConsumptionRecords")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    if (args.from) records = records.filter((r) => r.date >= args.from!);
    if (args.to) records = records.filter((r) => r.date <= args.to!);
    const products = await ctx.db
      .query("products")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const services = await ctx.db
      .query("services")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    const grouped = new Map<
      string,
      { productId: string; productName: string; quantity: number; cost: number }
    >();
    for (const r of records) {
      const key = r.productId as string;
      const entry =
        grouped.get(key) ??
        {
          productId: key,
          productName: products.find((p) => p._id === r.productId)?.name ?? "—",
          quantity: 0,
          cost: 0,
        };
      entry.quantity += r.quantity;
      entry.cost += r.quantity * r.unitCost;
      grouped.set(key, entry);
    }

    const byService = new Map<
      string,
      { serviceName: string; cost: number; count: number }
    >();
    for (const r of records) {
      const key = r.serviceId as string;
      const name = services.find((s) => s._id === r.serviceId)?.name ?? "Serviço removido";
      const entry = byService.get(key) ?? { serviceName: name, cost: 0, count: 0 };
      entry.cost += r.quantity * r.unitCost;
      entry.count += 1;
      byService.set(key, entry);
    }

    return {
      rows: Array.from(grouped.values()).sort((a, b) => b.cost - a.cost),
      byService: Array.from(byService.values()).sort((a, b) => b.cost - a.cost),
      totalCost: sum(Array.from(grouped.values()).map((g) => g.cost)),
      records: records.length,
    };
  },
});

export const lowStockAlerts = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId);
    if (!member) return [];
    const rows = await ctx.db
      .query("products")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    return rows
      .filter((p) => p.active && p.quantity <= p.minStock)
      .sort((a, b) => a.quantity - b.quantity);
  },
});

export const inventoryValuation = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId);
    if (!member) return { cost: 0, retail: 0, items: 0 };
    const rows = await ctx.db
      .query("products")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    return {
      cost: sum(rows.map((p) => p.quantity * p.cost)),
      retail: sum(rows.map((p) => p.quantity * p.price)),
      items: rows.length,
    };
  },
});

export const productOptions = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId);
    if (!member) return [];
    return await ctx.db
      .query("products")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect()
      .then((rows) =>
        rows
          .filter((r) => r.active)
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      );
  },
});

export type ProductId = Id<"products">;
