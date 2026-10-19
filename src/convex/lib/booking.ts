import type { Id } from "../_generated/dataModel";
import { AppError, assertFeature, logAudit, notify, sum } from "./helpers";
import { assertBookable, depositForService } from "./scheduling";

export type BookingItem = {
  kind: "service" | "product" | "labor" | "package";
  refId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Single source of truth for booking an appointment. Used by internal
 * scheduling, quote conversion and the public booking page so the conflict
 * rules can never diverge between flows.
 */
export async function createAppointmentRef(
  ctx: any,
  args: {
    orgId: Id<"organizations">;
    clientId: Id<"clients">;
    staffId: Id<"staff">;
    serviceIds: Id<"services">[];
    date: string;
    start: string;
    discount?: number;
    notes?: string;
    source?: string;
    enforceLeadTime?: boolean;
    rescheduledFrom?: string;
    userId?: Id<"users">;
    memberName?: string;
    quoteId?: Id<"quotes">;
    notifyClient?: boolean;
  },
): Promise<Id<"appointments">> {
  const org = await ctx.db.get(args.orgId);
  if (!org) throw new AppError("NOT_FOUND", "Organização não encontrada.");
  await assertFeature(ctx, args.orgId, "scheduling");

  const client = await ctx.db.get(args.clientId);
  if (!client || client.orgId !== args.orgId) {
    throw new AppError("VALIDATION", "Cliente não encontrada.");
  }
  const staff = await ctx.db.get(args.staffId);
  if (!staff || staff.orgId !== args.orgId) {
    throw new AppError("VALIDATION", "Profissional não encontrada.");
  }
  if (!args.serviceIds.length) {
    throw new AppError("VALIDATION", "Selecione pelo menos um serviço.");
  }

  const services = [];
  const items: BookingItem[] = [];
  let depositRequired = 0;
  for (const id of args.serviceIds) {
    const s = await ctx.db.get(id);
    if (!s || s.orgId !== args.orgId) {
      throw new AppError("VALIDATION", "Serviço inválido selecionado.");
    }
    services.push(s);
    items.push({
      kind: "service",
      refId: s._id as string,
      name: s.name,
      quantity: 1,
      unitPrice: s.price,
      total: s.price,
    });
    depositRequired += depositForService(s, org.defaultDepositPct ?? 0);
  }

  const startMinutes = toMinutes(args.start);
  const check = await assertBookable(ctx, {
    org,
    staff,
    services,
    date: args.date,
    startMinutes,
  });

  const subtotal = sum(items.map((i) => i.total));
  const discount = args.discount ?? 0;
  if (discount > subtotal) {
    throw new AppError(
      "VALIDATION",
      "O desconto não pode ser maior que o valor total dos serviços.",
    );
  }

  const source = args.source ?? "interno";
  let status: "confirmed" | "awaiting_confirmation" | "requested" = "confirmed";
  if (source === "online") {
    status = org.requireApprovalOnline ? "awaiting_confirmation" : "confirmed";
  }
  if (source === "orcamento") status = "confirmed";

  const id = await ctx.db.insert("appointments", {
    orgId: args.orgId,
    clientId: args.clientId,
    staffId: args.staffId,
    date: args.date,
    startMinutes,
    endMinutes: check.endMinutes,
    durationMin: check.duration,
    bufferMin: check.buffer,
    items,
    totalPrice: subtotal,
    discount,
    depositRequired: Math.min(depositRequired, subtotal),
    status,
    paymentStatus: depositRequired > 0 ? "deposit_pending" : "none",
    source,
    notes: args.notes,
    quoteId: args.quoteId,
    rescheduledFrom: args.rescheduledFrom,
    createdBy: args.userId,
    createdAt: Date.now(),
    isDemo: false,
  });

  await ctx.db.insert("appointmentStatusHistory", {
    orgId: args.orgId,
    appointmentId: id,
    from: "novo",
    to: status,
    at: Date.now(),
    by: args.userId,
  });

  await logAudit(ctx, {
    orgId: args.orgId,
    userId: args.userId,
    userName: args.memberName ?? "Sistema",
    action: "criar",
    entity: "appointments",
    entityId: id,
    details: `${client.name} · ${args.date} ${args.start}`,
  });

  if (args.notifyClient !== false) {
    await notify(ctx, {
      orgId: args.orgId,
      title: "Novo agendamento criado",
      body: `${client.name} · ${args.date} às ${args.start} com ${staff.name}`,
      type: "agenda",
      link: "/app/agenda",
    });
  }

  return id;
}
