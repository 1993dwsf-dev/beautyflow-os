import { validateOrgReferences } from "./lib/tenant";
import { v } from "convex/values";
import { mutation, query, action, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  AppError,
  ERR,
  getMembership,
  logAudit,
  requireMember,
  todayInTz,
} from "./lib/helpers";

// ---------------------------------------------------------------------------
// Treatment records
// ---------------------------------------------------------------------------

export const listTreatmentRecords = query({
  args: {
    orgId: v.id("organizations"),
    clientId: v.optional(v.id("clients")),
    serviceId: v.optional(v.id("services")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId, "health.view");
    if (!member) return [];
    let rows;
    if (args.clientId) {
      rows = await ctx.db
        .query("treatmentRecords")
        .withIndex("by_client", (q) => q.eq("clientId", args.clientId!))
        .filter(q => q.eq(q.field("orgId"), args.orgId))
        .collect();
    } else {
      rows = await ctx.db
        .query("treatmentRecords")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .collect();
    }
    if (args.serviceId) rows = rows.filter((r) => r.serviceId === args.serviceId);
    const clients = await ctx.db
      .query("clients")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const staff = await ctx.db
      .query("staff")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    return rows
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, args.limit ?? 200)
      .map((r) => ({
        ...r,
        clientName: clients.find((c) => c._id === r.clientId)?.name ?? "—",
        staffName: staff.find((s) => s._id === r.staffId)?.name ?? "—",
        canViewSensitive:
          member.role === "owner" ||
          member.role === "admin" ||
          member.role === "professional" ||
          member.extraPermissions.includes("health.view"),
      }));
  },
});

export const createTreatmentRecord = mutation({
  args: {
    orgId: v.id("organizations"),
    clientId: v.id("clients"),
    appointmentId: v.optional(v.id("appointments")),
    serviceId: v.optional(v.id("services")),
    serviceName: v.string(),
    staffId: v.optional(v.id("staff")),
    date: v.optional(v.string()),
    productsUsed: v.array(
      v.object({
        productId: v.optional(v.id("products")),
        name: v.string(),
        quantity: v.number(),
      }),
    ),
    notes: v.optional(v.string()),
    formula: v.optional(v.string()),
    preferences: v.optional(v.string()),
    reactions: v.optional(v.string()),
    aftercare: v.optional(v.string()),
    nextVisitIntervalDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "appointments.edit");
    await validateOrgReferences(ctx, args.orgId, args);
    const client = await ctx.db.get(args.clientId);
    if (!client || client.orgId !== args.orgId) {
      throw new AppError("VALIDATION", "Cliente não encontrada.");
    }
    const today = args.date ?? todayInTz();
    const nextVisitDate = args.nextVisitIntervalDays
      ? addDays(today, args.nextVisitIntervalDays)
      : undefined;
    const id = await ctx.db.insert("treatmentRecords", {
      orgId: args.orgId,
      clientId: args.clientId,
      appointmentId: args.appointmentId,
      serviceId: args.serviceId,
      serviceName: args.serviceName,
      staffId: args.staffId,
      date: today,
      productsUsed: args.productsUsed,
      notes: args.notes,
      formula: args.formula,
      preferences: args.preferences,
      reactions: args.reactions,
      aftercare: args.aftercare,
      nextVisitIntervalDays: args.nextVisitIntervalDays,
      nextVisitDate,
      sensitive: true,
      isDemo: false,
      createdAt: Date.now(),
      createdBy: userId,
    });
    if (nextVisitDate) {
      await ctx.db.insert("followUpTasks", {
        orgId: args.orgId,
        clientId: args.clientId,
        type: "retorno",
        dueDate: nextVisitDate,
        status: "pendente",
        notes: `Retorno sugerido em ${args.nextVisitIntervalDays} dias`,
        assignedTo: args.staffId,
        createdAt: Date.now(),
      });
    }
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "criar_ficha",
      entity: "treatmentRecords",
      entityId: id,
      details: `${client.name} · ${args.serviceName}`,
    });
    return id;
  },
});

export const updateTreatmentRecord = mutation({
  args: {
    orgId: v.id("organizations"),
    recordId: v.id("treatmentRecords"),
    patch: v.object({
      notes: v.optional(v.string()),
      formula: v.optional(v.string()),
      preferences: v.optional(v.string()),
      reactions: v.optional(v.string()),
      aftercare: v.optional(v.string()),
      nextVisitIntervalDays: v.optional(v.number()),
      nextVisitDate: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "appointments.edit");
    await validateOrgReferences(ctx, args.orgId, args);
    const record = await ctx.db.get(args.recordId);
    if (!record || record.orgId !== args.orgId) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    await ctx.db.patch(args.recordId, args.patch);
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "atualizar_ficha",
      entity: "treatmentRecords",
      entityId: args.recordId,
    });
    return true;
  },
});

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Consultation forms
// ---------------------------------------------------------------------------

export const listForms = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId, "clients.view");
    if (!member) return [];
    return await ctx.db
      .query("consultationForms")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
  },
});

export const saveForm = mutation({
  args: {
    orgId: v.id("organizations"),
    formId: v.optional(v.id("consultationForms")),
    name: v.string(),
    purpose: v.string(),
    sensitive: v.boolean(),
    fields: v.array(
      v.object({
        key: v.string(),
        label: v.string(),
        type: v.string(),
        options: v.array(v.string()),
        required: v.boolean(),
      }),
    ),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "settings.edit");
    await validateOrgReferences(ctx, args.orgId, args);
    if (!args.name.trim()) throw new AppError("VALIDATION", "Informe o nome do formulário.");
    if (!args.fields.length) {
      throw new AppError("VALIDATION", "Adicione pelo menos um campo ao formulário.");
    }
    if (args.formId) {
      const existing = await ctx.db.get(args.formId);
      if (!existing || existing.orgId !== args.orgId) {
        throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
      }
      await ctx.db.patch(args.formId, {
        name: args.name,
        purpose: args.purpose,
        sensitive: args.sensitive,
        fields: args.fields,
        version: existing.version + 1,
        active: args.active ?? existing.active,
      });
      return args.formId;
    }
    const id = await ctx.db.insert("consultationForms", {
      orgId: args.orgId,
      name: args.name.trim(),
      purpose: args.purpose,
      version: 1,
      sensitive: args.sensitive,
      fields: args.fields,
      active: args.active ?? true,
      createdAt: Date.now(),
    });
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "criar_formulario",
      entity: "consultationForms",
      entityId: id,
      details: args.name,
    });
    return id;
  },
});

export const listResponses = query({
  args: {
    orgId: v.id("organizations"),
    clientId: v.optional(v.id("clients")),
    canViewSensitive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId, "health.view");
    if (!member) return [];
    const allowed =
      member.role === "owner" ||
      member.role === "admin" ||
      member.role === "professional" ||
      member.extraPermissions.includes("health.view");
    let rows;
    if (args.clientId) {
      rows = await ctx.db
        .query("consultationResponses")
        .withIndex("by_client", (q) => q.eq("clientId", args.clientId!))
        .filter(q => q.eq(q.field("orgId"), args.orgId))
        .collect();
    } else {
      rows = await ctx.db
        .query("consultationResponses")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .collect();
    }
    const clients = await ctx.db
      .query("clients")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const staff = await ctx.db
      .query("staff")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    return rows
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((r) => ({
        ...r,
        clientName: clients.find((c) => c._id === r.clientId)?.name ?? "—",
        staffName: staff.find((s) => s._id === r.staffId)?.name ?? "—",
        // Sensitive health answers are only returned to authorized roles.
        answers: allowed ? r.answers : [],
        hidden: !allowed,
      }));
  },
});

export const submitConsultationResponse = mutation({
  args: {
    orgId: v.id("organizations"),
    clientId: v.id("clients"),
    formId: v.id("consultationForms"),
    appointmentId: v.optional(v.id("appointments")),
    staffId: v.optional(v.id("staff")),
    answers: v.array(
      v.object({ key: v.string(), label: v.string(), value: v.string() }),
    ),
    acknowledgedBy: v.string(),
    date: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "consent.edit");
    await validateOrgReferences(ctx, args.orgId, args);
    const form = await ctx.db.get(args.formId);
    if (!form || form.orgId !== args.orgId) {
      throw new AppError("VALIDATION", "Formulário não encontrado.");
    }
    for (const field of form.fields) {
      if (!field.required) continue;
      const answer = args.answers.find((a) => a.key === field.key);
      if (!answer || !answer.value.trim()) {
        throw new AppError(
          "VALIDATION",
          `Não é possível concluir o registro porque existem informações obrigatórias pendentes: ${field.label}.`,
        );
      }
    }
    if (!args.acknowledgedBy.trim()) {
      throw new AppError(
        "VALIDATION",
        "Registre quem confirmou as informações do formulário.",
      );
    }
    const id = await ctx.db.insert("consultationResponses", {
      orgId: args.orgId,
      clientId: args.clientId,
      formId: args.formId,
      formName: form.name,
      formVersion: form.version,
      appointmentId: args.appointmentId,
      answers: args.answers,
      date: args.date ?? todayInTz(),
      staffId: args.staffId,
      acknowledgedBy: args.acknowledgedBy,
      createdAt: Date.now(),
    });
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "preencher_formulario",
      entity: "consultationResponses",
      entityId: id,
      details: form.name,
    });
    return id;
  },
});

// ---------------------------------------------------------------------------
// Consents
// ---------------------------------------------------------------------------

export const listConsents = query({
  args: { orgId: v.id("organizations"), clientId: v.optional(v.id("clients")) },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId, "consent.view");
    if (!member) return [];
    const rows = await ctx.db
      .query("consentRecords")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const clients = await ctx.db
      .query("clients")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    return rows
      .filter((r) => !args.clientId || r.clientId === args.clientId)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((r) => ({
        ...r,
        clientName: clients.find((c) => c._id === r.clientId)?.name ?? "—",
      }));
  },
});

export const recordConsent = mutation({
  args: {
    orgId: v.id("organizations"),
    clientId: v.id("clients"),
    type: v.string(),
    granted: v.boolean(),
    appointmentId: v.optional(v.id("appointments")),
    staffId: v.optional(v.id("staff")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "consent.edit");
    await validateOrgReferences(ctx, args.orgId, args);
    const client = await ctx.db.get(args.clientId);
    if (!client || client.orgId !== args.orgId) {
      throw new AppError("VALIDATION", "Cliente não encontrada.");
    }
    const id = await ctx.db.insert("consentRecords", {
      orgId: args.orgId,
      clientId: args.clientId,
      appointmentId: args.appointmentId,
      type: args.type,
      granted: args.granted,
      date: todayInTz(),
      staffId: args.staffId,
      notes: args.notes,
      createdAt: Date.now(),
    });
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "registrar_consentimento",
      entity: "consentRecords",
      entityId: id,
      details: `${args.type} = ${args.granted ? "autorizado" : "não autorizado"}`,
    });
    return id;
  },
});

// ---------------------------------------------------------------------------
// Photos (secure gallery)
// ---------------------------------------------------------------------------

export const authorizePhotoUpload = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.orgId, "photos.view");
    return (await requireMember(ctx, args.orgId, "consent.edit")).userId;
  },
});
export const registerPhotoUpload = internalMutation({
  args: { orgId: v.id("organizations"), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.orgId, "photos.view");
    const { userId } = await requireMember(ctx, args.orgId, "consent.edit");
    await ctx.db.insert("photoUploads", { ...args, uploadedBy: userId, createdAt: Date.now() });
  },
});
export const uploadPhotoFile = action({
  args: { orgId: v.id("organizations"), data: v.bytes(), contentType: v.string() },
  handler: async (ctx, args): Promise<Id<"_storage">> => {
    await ctx.runQuery(internal.crm.authorizePhotoUpload, { orgId: args.orgId });
    const bytes = new Uint8Array(args.data);
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const png = bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
    const webp = String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    if (!bytes.length || bytes.length > 4 * 1024 * 1024 || !((args.contentType === "image/jpeg" && jpeg) || (args.contentType === "image/png" && png) || (args.contentType === "image/webp" && webp))) throw new Error("Envie uma foto JPEG, PNG ou WebP de até 4 MB.");
    const storageId = await ctx.storage.store(new Blob([args.data], { type: args.contentType }));
    try { await ctx.runMutation(internal.crm.registerPhotoUpload, { orgId: args.orgId, storageId }); }
    catch (error) { await ctx.storage.delete(storageId); throw error; }
    return storageId;
  },
});

export const listPhotos = query({
  args: { orgId: v.id("organizations"), clientId: v.optional(v.id("clients")) },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId, "photos.view");
    if (!member) return [];
    const rows = await ctx.db
      .query("clientPhotos")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const clients = await ctx.db
      .query("clients")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const staff = await ctx.db
      .query("staff")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const out = [];
    for (const p of rows) {
      if (args.clientId && p.clientId !== args.clientId) continue;
      const url = p.storageId ? await ctx.storage.getUrl(p.storageId) : p.url;
      out.push({
        ...p,
        url,
        clientName: clients.find((c) => c._id === p.clientId)?.name ?? "—",
        staffName: staff.find((s) => s._id === p.staffId)?.name ?? "—",
      });
    }
    return out.sort((a, b) => (a.captureDate < b.captureDate ? 1 : -1));
  },
});

export const savePhoto = mutation({
  args: {
    orgId: v.id("organizations"),
    clientId: v.id("clients"),
    appointmentId: v.optional(v.id("appointments")),
    serviceId: v.optional(v.id("services")),
    treatmentRecordId: v.optional(v.id("treatmentRecords")),
    kind: v.string(),
    storageId: v.optional(v.id("_storage")),
    url: v.optional(v.string()),
    notes: v.optional(v.string()),
    captureDate: v.optional(v.string()),
    staffId: v.optional(v.id("staff")),
    consentInternal: v.boolean(),
    consentPublic: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "consent.edit");
    await requireMember(ctx, args.orgId, "photos.view");
    await validateOrgReferences(ctx, args.orgId, args);
    const client = await ctx.db.get(args.clientId);
    if (!client || client.orgId !== args.orgId) {
      throw new AppError("VALIDATION", "Cliente não encontrada.");
    }
    if (!args.storageId || args.url) throw new AppError("VALIDATION", "Envie um arquivo de foto pelo formulário.");
    const upload = await ctx.db.query("photoUploads").withIndex("by_storage", q => q.eq("storageId", args.storageId!)).first();
    if (!upload || upload.orgId !== args.orgId || upload.uploadedBy !== userId) throw new AppError("FORBIDDEN", ERR.PERMISSION);
    await ctx.db.delete(upload._id);
    if (args.consentPublic) {
      await requireMember(ctx, args.orgId, "photos.share");
      const granted = (
        await ctx.db
          .query("consentRecords")
          .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
          .filter(q => q.eq(q.field("orgId"), args.orgId))
        .collect()
      ).filter(c => c.orgId === args.orgId && c.type === "imagem_publica").sort((a, b) => b.createdAt - a.createdAt || b._creationTime - a._creationTime)[0]?.granted === true;
      if (!granted) {
        throw new AppError(
          "CONSENT",
          "Não há consentimento registrado para uso público de imagens desta cliente. Registre o consentimento antes de marcar como aprovada para divulgação.",
        );
      }
    }
    const id = await ctx.db.insert("clientPhotos", {
      orgId: args.orgId,
      clientId: args.clientId,
      appointmentId: args.appointmentId,
      serviceId: args.serviceId,
      treatmentRecordId: args.treatmentRecordId,
      kind: args.kind,
      storageId: args.storageId,
      url: args.url,
      notes: args.notes,
      captureDate: args.captureDate ?? todayInTz(),
      staffId: args.staffId,
      consentInternal: args.consentInternal,
      consentPublic: args.consentPublic,
      isDemo: false,
      createdAt: Date.now(),
    });
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "adicionar_foto",
      entity: "clientPhotos",
      entityId: id,
      details: `${args.kind} · ${client.name}`,
    });
    return id;
  },
});

export const updatePhotoConsent = mutation({
  args: {
    orgId: v.id("organizations"),
    photoId: v.id("clientPhotos"),
    consentInternal: v.boolean(),
    consentPublic: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "photos.share");
    await validateOrgReferences(ctx, args.orgId, args);
    const photo = await ctx.db.get(args.photoId);
    if (!photo || photo.orgId !== args.orgId) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    if (args.consentPublic) {
      await requireMember(ctx, args.orgId, "photos.share");
      const granted = (
        await ctx.db
          .query("consentRecords")
          .withIndex("by_client", (q) => q.eq("clientId", photo.clientId))
          .filter(q => q.eq(q.field("orgId"), args.orgId))
        .collect()
      ).filter(c => c.orgId === args.orgId && c.type === "imagem_publica").sort((a, b) => b.createdAt - a.createdAt || b._creationTime - a._creationTime)[0]?.granted === true;
      if (!granted) {
        throw new AppError(
          "CONSENT",
          "A cliente não possui consentimento de uso público de imagem registrado.",
        );
      }
    }
    await ctx.db.patch(args.photoId, {
      consentInternal: args.consentInternal,
      consentPublic: args.consentPublic,
    });
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "atualizar_consentimento_foto",
      entity: "clientPhotos",
      entityId: args.photoId,
      details: `interno=${args.consentInternal} público=${args.consentPublic}`,
    });
    return true;
  },
});

export const deletePhoto = mutation({
  args: { orgId: v.id("organizations"), photoId: v.id("clientPhotos") },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "consent.edit");
    await requireMember(ctx, args.orgId, "photos.view");
    await validateOrgReferences(ctx, args.orgId, args);
    const photo = await ctx.db.get(args.photoId);
    if (!photo || photo.orgId !== args.orgId) {
      throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    }
    if (photo.storageId) await ctx.storage.delete(photo.storageId);
    await ctx.db.delete(args.photoId);
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "excluir_foto",
      entity: "clientPhotos",
      entityId: args.photoId,
    });
    return true;
  },
});

// ---------------------------------------------------------------------------
// Aftercare templates
// ---------------------------------------------------------------------------

export const listAftercareTemplates = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId, "clients.view");
    if (!member) return [];
    const rows = await ctx.db
      .query("aftercareTemplates")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const services = await ctx.db
      .query("services")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    return rows.map((r) => ({
      ...r,
      serviceName: services.find((s) => s._id === r.serviceId)?.name ?? "Todos os serviços",
    }));
  },
});

export const saveAftercareTemplate = mutation({
  args: {
    orgId: v.id("organizations"),
    templateId: v.optional(v.id("aftercareTemplates")),
    serviceId: v.optional(v.id("services")),
    name: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const { member } = await requireMember(ctx, args.orgId, "settings.edit");
    await validateOrgReferences(ctx, args.orgId, args);
    if (!args.name.trim() || !args.text.trim()) {
      throw new AppError("VALIDATION", "Informe o nome e o texto das recomendações.");
    }
    const payload = {
      orgId: args.orgId,
      serviceId: args.serviceId,
      name: args.name.trim(),
      text: args.text,
      active: true,
    };
    if (args.templateId) {
      const existing = await ctx.db.get(args.templateId);
      if (!existing || existing.orgId !== args.orgId) {
        throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
      }
      await ctx.db.patch(args.templateId, payload);
      return { ok: true, by: member.name };
    }
    return await ctx.db.insert("aftercareTemplates", payload);
  },
});

export type ClientId = Id<"clients">;
