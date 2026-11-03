import type { Doc, Id } from "../_generated/dataModel";
import { AppError, sum, toMinutes, todayInTz } from "./helpers";

export const SLOT_STEP = 15;

export type Busy = { start: number; end: number; label?: string };

export type Slot = {
  startMinutes: number;
  endMinutes: number;
  staffId: Id<"staff">;
  staffName: string;
  staffColor: string;
};

export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function weekdayLabel(weekday: number): string {
  return ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][
    weekday
  ];
}

export function requiredMinutes(
  services: Pick<Doc<"services">, "durationMin" | "bufferMin">[],
): { duration: number; buffer: number; block: number } {
  const duration = sum(services.map((s) => s.durationMin));
  const buffer = services.length
    ? Math.max(...services.map((s) => s.bufferMin))
    : 0;
  return { duration, buffer, block: duration + buffer };
}

export function overlaps(a: Busy, b: Busy): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Given the shared context, produce every bookable slot for a date.
 * Returns slots per professional so the UI can render columns.
 */
export async function computeSlots(
  ctx: any,
  args: {
    org: Doc<"organizations">;
    staff: Doc<"staff">[];
    services: Doc<"services">[];
    date: string;
    enforceLeadTime?: boolean;
    stepMinutes?: number;
  },
): Promise<Slot[]> {
  const { org, services } = args;
  const weekday = weekdayOf(args.date);
  const helper = org.openHours.find((h) => h.weekday === weekday);
  if (!helper || helper.closed) return [];

  const businessOpen = toMinutes(helper.open);
  const businessClose = toMinutes(helper.close);

  if (!services.length) return [];
  const { block } = requiredMinutes(services);

  const step = args.stepMinutes ?? SLOT_STEP;
  const leadMs =
    (args.enforceLeadTime ? (org.onlineBookingLeadHours ?? 24) : 0) * 3_600_000;
  const now = Date.now();

  const slots: Slot[] = [];

  for (const pro of args.staff) {
    if (pro.daysOff.includes(args.date)) continue;
    if (!pro.workingDays.includes(weekday)) continue;

    const availability = await ctx.db
      .query("staffAvailability")
      .withIndex("by_staff", (q: any) => q.eq("staffId", pro._id))
      .collect()
      .then((rows: any[]) => rows.find((r) => r.weekday === weekday && r.active));
    if (!availability) continue;

    const windowStart = Math.max(businessOpen, toMinutes(availability.start));
    const windowEnd = Math.min(businessClose, toMinutes(availability.end));
    if (windowEnd - windowStart < block) continue;

    const busy: Busy[] = [];
    if (availability.breakStart && availability.breakEnd) {
      busy.push({
        start: toMinutes(availability.breakStart),
        end: toMinutes(availability.breakEnd),
      });
    }

    const existing = await ctx.db
      .query("appointments")
      .withIndex("by_org_staff_date", (q: any) =>
        q.eq("orgId", org._id).eq("staffId", pro._id).eq("date", args.date),
      )
      .collect();
    for (const a of existing) {
      if (a.status === "cancelled" || a.status === "no_show") continue;
      if (a.status === "completed") continue;
      busy.push({ start: a.startMinutes, end: a.endMinutes + a.bufferMin });
    }

    const blocks = await ctx.db
      .query("staffBlocks")
      .withIndex("by_staff_date", (q: any) =>
        q.eq("staffId", pro._id).eq("date", args.date),
      )
      .collect();
    for (const b of blocks) {
      busy.push({ start: b.startMinutes, end: b.endMinutes });
    }

    for (let start = windowStart; start + block <= windowEnd; start += step) {
      const candidate: Busy = { start, end: start + block };
      if (busy.some((b) => overlaps(candidate, b))) continue;
      if (args.enforceLeadTime) {
        const [y, m, d] = args.date.split("-").map(Number);
        const slotTime = Date.UTC(y, m - 1, d) + start * 60_000;
        const tzOffset = 3 * 3_600_000; // America/Sao_Paulo (UTC-3)
        if (slotTime + tzOffset - now < leadMs) continue;
      }
      slots.push({
        startMinutes: start,
        endMinutes: start + block,
        staffId: pro._id,
        staffName: pro.name,
        staffColor: pro.color,
      });
    }
  }

  return slots.sort(
    (a, b) => a.startMinutes - b.startMinutes || a.staffName.localeCompare(b.staffName),
  );
}

/**
 * Hard validation executed inside the booking mutation. Because Convex
 * mutations run transactionally with optimistic concurrency control, two
 * simultaneous online bookings cannot both reserve the same slot.
 */
export async function assertBookable(
  ctx: any,
  args: {
    org: Doc<"organizations">;
    staff: Doc<"staff">;
    services: Doc<"services">[];
    date: string;
    startMinutes: number;
    ignoreAppointmentId?: Id<"appointments">;
    skipPastCheck?: boolean;
    enforceLeadTime?: boolean;
  },
): Promise<{ endMinutes: number; duration: number; buffer: number }> {
  const { org, staff, services, date, startMinutes } = args;
  if (!services.length) {
    throw new AppError("VALIDATION", "Selecione pelo menos um serviço.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(startMinutes) || startMinutes < 0 || startMinutes >= 1440) throw new AppError("VALIDATION", "Data ou horário inválido.");
  if (!staff.active || services.some(s => !s.active)) throw new AppError("UNAVAILABLE", "Profissional ou serviço inativo.");
  if (services.some(s => s.eligibleStaff.length && !s.eligibleStaff.includes(staff._id))) throw new AppError("UNAVAILABLE", "Esta profissional não realiza o serviço selecionado.");
  const { duration, buffer, block } = requiredMinutes(services);
  if (args.enforceLeadTime) {
    const [y, m, d] = date.split("-").map(Number);
    const slot = Date.UTC(y, m - 1, d) + (startMinutes + 180) * 60000;
    if (slot - Date.now() < (org.onlineBookingLeadHours ?? 24) * 3600000) throw new AppError("LEAD_TIME", "Respeite a antecedência mínima para agendar online.");
  }

  const weekday = weekdayOf(date);
  const open = org.openHours.find((h) => h.weekday === weekday);
  if (!open || open.closed) {
    throw new AppError(
      "CLOSED",
      "O estabelecimento não abre neste dia. Selecione outra data.",
    );
  }
  if (!staff.workingDays.includes(weekday) || staff.daysOff.includes(date)) {
    throw new AppError(
      "UNAVAILABLE",
      `${staff.name} não atende neste dia. Selecione outra data ou profissional.`,
    );
  }

  const availability = await ctx.db
    .query("staffAvailability")
    .withIndex("by_staff", (q: any) => q.eq("staffId", staff._id))
    .collect()
    .then((rows: any[]) => rows.find((r) => r.weekday === weekday && r.active));

  const windowStart = Math.max(
    toMinutes(open.open),
    availability ? toMinutes(availability.start) : toMinutes(staff.workStart),
  );
  const windowEnd = Math.min(
    toMinutes(open.close),
    availability ? toMinutes(availability.end) : toMinutes(staff.workEnd),
  );

  if (startMinutes < windowStart || startMinutes + block > windowEnd) {
    throw new AppError(
      "OUT_OF_HOURS",
      "Este horário está fora do período de atendimento. Selecione outro horário.",
    );
  }

  if (availability?.breakStart && availability?.breakEnd) {
    const bStart = toMinutes(availability.breakStart);
    const bEnd = toMinutes(availability.breakEnd);
    if (startMinutes < bEnd && bStart < startMinutes + block) {
      throw new AppError(
        "BREAK",
        "Este horário coincide com o intervalo da profissional. Selecione outro horário.",
      );
    }
  }

  if (!args.skipPastCheck) {
    const today = todayInTz(org.timezone);
    if (date < today) {
      throw new AppError("PAST", "Não é possível agendar em uma data que já passou.");
    }
    if (date === today) {
      const nowSaoPaulo = new Date(Date.now() - 3 * 3_600_000);
      const nowMinutes = nowSaoPaulo.getUTCHours() * 60 + nowSaoPaulo.getUTCMinutes();
      if (startMinutes < nowMinutes) {
        throw new AppError(
          "PAST",
          "Este horário já passou. Selecione um horário mais tarde.",
        );
      }
    }
  }

  const existing = await ctx.db
    .query("appointments")
    .withIndex("by_org_staff_date", (q: any) =>
      q.eq("orgId", org._id).eq("staffId", staff._id).eq("date", date),
    )
    .collect();

  const candidate: Busy = { start: startMinutes, end: startMinutes + block };
  const conflict = existing.find(
    (a: any) =>
      a._id !== args.ignoreAppointmentId &&
      a.status !== "cancelled" &&
      a.status !== "no_show" &&
      a.status !== "completed" &&
      overlaps(candidate, { start: a.startMinutes, end: a.endMinutes + a.bufferMin }),
  );
  if (conflict) {
    throw new AppError(
      "CONFLICT",
      "Este horário não está mais disponível. Selecione outro horário.",
    );
  }

  const blocks = await ctx.db
    .query("staffBlocks")
    .withIndex("by_staff_date", (q: any) =>
      q.eq("staffId", staff._id).eq("date", date),
    )
    .collect();
  const blocked = blocks.find((b: any) =>
    overlaps(candidate, { start: b.startMinutes, end: b.endMinutes }),
  );
  if (blocked) {
    throw new AppError(
      "BLOCKED",
      `A profissional possui um bloqueio neste horário (${blocked.reason}). Selecione outro horário.`,
    );
  }

  return { endMinutes: startMinutes + duration, duration, buffer };
}

export function depositForService(service: Doc<"services">, orgPct: number): number {
  if (service.depositType === "fixed") return service.depositValue;
  if (service.depositType === "percent") {
    return Math.round((service.price * service.depositValue) / 100);
  }
  return 0;
}
