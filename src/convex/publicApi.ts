import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { AppError, addDaysISO, todayInTz, toMinutes } from "./lib/helpers";
import { computeSlots } from "./lib/scheduling";
import { createAppointmentRef } from "./lib/booking";

async function loadPublicOrg(ctx: any, slug: string) {
  const org = await ctx.db
    .query("organizations")
    .withIndex("by_slug", (q: any) => q.eq("publicBookingSlug", slug))
    .first();
  if (!org || !org.publicBookingEnabled) {
    throw new AppError(
      "UNAVAILABLE",
      "O agendamento online não está disponível para este estabelecimento.",
    );
  }
  const flag = await ctx.db
    .query("featureFlags")
    .withIndex("by_org", (q: any) => q.eq("orgId", org._id).eq("key", "publicBooking"))
    .first();
  if (flag && !flag.enabled) {
    throw new AppError(
      "UNAVAILABLE",
      "O agendamento online está temporariamente desativado.",
    );
  }
  return org;
}

/** Public availability. Returns only bookable slots — never client data. */
export const publicAvailability = query({
  args: {
    slug: v.string(),
    date: v.string(),
    serviceIds: v.array(v.id("services")),
    staffId: v.optional(v.id("staff")),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("publicBookingSlug", args.slug))
      .first();
    if (!org || !org.publicBookingEnabled) return { slots: [], duration: 0 };
    await loadPublicOrg(ctx, args.slug);

    const services: Doc<"services">[] = [];
    for (const id of args.serviceIds) {
      const s = await ctx.db.get(id);
      if (s && s.orgId === org._id && s.active) services.push(s);
    }
    if (!services.length) return { slots: [], duration: 0 };

    const staff = (
      await ctx.db
        .query("staff")
        .withIndex("by_org", (q) => q.eq("orgId", org._id))
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
      staff,
      services,
      date: args.date,
      enforceLeadTime: true,
    });
    return {
      slots: slots.map((s) => ({
        startMinutes: s.startMinutes,
        endMinutes: s.endMinutes,
        staffId: s.staffId,
        staffName: s.staffName,
      })),
      duration: services.reduce((acc, s) => acc + s.durationMin, 0),
      depositPolicy: org.depositPolicy,
      cancellationPolicy: org.cancellationPolicy,
    };
  },
});

/**
 * Public booking. Re-validates availability inside the transaction so two
 * visitors can never reserve the same slot.
 */
export const createPublicBooking = mutation({
  args: {
    slug: v.string(),
    name: v.string(),
    phone: v.string(),
    email: v.optional(v.string()),
    serviceIds: v.array(v.id("services")),
    staffId: v.id("staff"),
    date: v.string(),
    start: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const org = await loadPublicOrg(ctx, args.slug);

    if (!args.name.trim() || args.name.trim().length < 3) {
      throw new AppError("VALIDATION", "Informe o seu nome completo.");
    }
    const digits = args.phone.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 11) {
      throw new AppError("VALIDATION", "Informe um telefone válido com DDD.");
    }
    if (!args.serviceIds.length || args.serviceIds.length > 10 || new Set(args.serviceIds).size !== args.serviceIds.length) {
      throw new AppError("VALIDATION", "Selecione pelo menos um serviço.");
    }

    const today = todayInTz(org.timezone);
    if (args.date < today) {
      throw new AppError("PAST", "Selecione uma data futura para o agendamento.");
    }

    let client = await ctx.db
      .query("clients")
      .withIndex("by_org_phone", (q) =>
        q.eq("orgId", org._id).eq("phone", args.phone.trim()),
      )
      .first();

    if (!client) {
      const clientId = await ctx.db.insert("clients", {
        orgId: org._id,
        name: args.name.trim(),
        phone: args.phone.trim(),
        whatsapp: args.phone.trim(),
        email: args.email,
        preferredContact: "whatsapp",
        referralSource: "Agendamento online",
        tags: ["Online"],
        status: "ativo",
        isDemo: false,
        active: true,
        createdAt: Date.now(),
      });
      await ctx.db.insert("loyaltyAccounts", {
        orgId: org._id,
        clientId,
        points: 0,
        tier: org.loyaltySettings?.tiers[0]?.name ?? "Bronze",
        updatedAt: Date.now(),
      });
      client = await ctx.db.get(clientId);
    }

    const duplicate = (
      await ctx.db
        .query("appointments")
        .withIndex("by_client", (q) => q.eq("clientId", client!._id))
        .collect()
    ).find(
      (a) =>
        a.date === args.date &&
        a.startMinutes === toMinutes(args.start) &&
        a.status !== "cancelled",
    );
    if (duplicate) {
      throw new AppError(
        "CONFLICT",
        "Já existe um agendamento para este telefone neste horário.",
      );
    }

    const appointmentId = await createAppointmentRef(ctx, {
      orgId: org._id,
      clientId: client!._id,
      staffId: args.staffId,
      serviceIds: args.serviceIds,
      date: args.date,
      start: args.start,
      notes: args.notes ? `Agendamento online: ${args.notes}` : "Agendamento online",
      source: "online",
      enforceLeadTime: true,
      memberName: `Cliente online (${args.name.trim()})`,
    });

    const appointment = await ctx.db.get(appointmentId);
    const staff = await ctx.db.get(args.staffId);
    const services: string[] = [];
    for (const id of args.serviceIds) {
      const s = await ctx.db.get(id);
      if (s) services.push(s.name);
    }

    await ctx.db.insert("notifications", {
      orgId: org._id,
      title: "Novo agendamento online",
      body: `${args.name.trim()} agendou ${services.join(", ")} para ${args.date} às ${args.start}.`,
      type: "agenda",
      read: false,
      link: "/app/agenda",
      at: Date.now(),
    });

    return {
      confirmationCode: (appointmentId as string).slice(-6).toUpperCase(),
      date: args.date,
      start: args.start,
      endMinutes: appointment?.endMinutes ?? 0,
      staffName: staff?.name ?? "",
      services,
      total: (appointment?.totalPrice ?? 0) - (appointment?.discount ?? 0),
      depositRequired: appointment?.depositRequired ?? 0,
      status: appointment?.status ?? "confirmed",
      businessName: org.name,
      businessPhone: org.whatsapp ?? org.phone ?? "",
      address: org.address,
      cancellationPolicy: org.cancellationPolicy,
      depositPolicy: org.depositPolicy,
      nextSuggestedDate: addDaysISO(args.date, 21),
    };
  },
});

export const publicStaffForServices = query({
  args: { slug: v.string(), serviceIds: v.array(v.id("services")) },
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("publicBookingSlug", args.slug))
      .first();
    if (!org || !org.publicBookingEnabled) return [];
    await loadPublicOrg(ctx, args.slug);
    const staff = await ctx.db
      .query("staff")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .collect();
    const services: Doc<"services">[] = [];
    for (const id of args.serviceIds) {
      const s = await ctx.db.get(id);
      if (!s || s.orgId !== org._id || !s.active) throw new AppError("VALIDATION", "Serviço indisponível.");
      services.push(s);
    }
    return staff
      .filter(
        (s) =>
          s.active &&
          services.every(
            (svc) => !svc.eligibleStaff.length || svc.eligibleStaff.includes(s._id),
          ),
      )
      .map((s) => ({ _id: s._id, name: s.name, role: s.role }));
  },
});

export type PublicOrgId = Id<"organizations">;
