import { v } from "convex/values";
import { query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  addDaysISO,
  diffDaysISO,
  getMembership,
  pct,
  sum,
  todayInTz,
} from "./lib/helpers";

/** Payments made with a gift card are excluded from revenue: the cash was
 *  recognised when the card was sold. */
const REVENUE_EXCLUDED_METHODS = ["gift_card"];

function monthKey(iso: string) {
  return iso.slice(0, 7);
}

function lastMonths(today: string, count: number) {
  const [y, m] = today.split("-").map(Number);
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

async function loadOrgData(ctx: QueryCtx, orgId: Id<"organizations">) {
  const org = await ctx.db.get(orgId);
  const appointments = await ctx.db
    .query("appointments")
    .withIndex("by_org_date", (q) => q.eq("orgId", orgId))
    .collect();
  const payments = await ctx.db
    .query("payments")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  const invoices = await ctx.db
    .query("invoices")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  const expenses = await ctx.db
    .query("expenses")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  const clients = await ctx.db
    .query("clients")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  const staff = await ctx.db
    .query("staff")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  const services = await ctx.db
    .query("services")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  const products = await ctx.db
    .query("products")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  const movements = await ctx.db
    .query("inventoryMovements")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  const commissions = await ctx.db
    .query("commissions")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  const records = await ctx.db
    .query("treatmentRecords")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  const allocations = await ctx.db
    .query("paymentAllocations")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  return {
    org,
    appointments,
    payments,
    invoices,
    expenses,
    clients,
    staff,
    services,
    products,
    movements,
    commissions,
    records,
    allocations,
  };
}

function collectedIn(payments: Doc<"payments">[], from: string, to: string) {
  return sum(
    payments
      .filter(
        (p) =>
          p.date >= from &&
          p.date <= to &&
          !REVENUE_EXCLUDED_METHODS.includes(p.method),
      )
      .map((p) => (p.kind === "reembolso" ? -p.amount : p.amount)),
  );
}

export const dashboard = query({
  args: { orgId: v.id("organizations"), from: v.string(), to: v.string() },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId);
    if (!member) return null;
    const data = await loadOrgData(ctx, args.orgId);
    const org = data.org;
    const today = todayInTz(org?.timezone);

    const inRange = (d: string) => d >= args.from && d <= args.to;
    const rangeAppointments = data.appointments.filter((a) => inRange(a.date));
    const completed = rangeAppointments.filter((a) => a.status === "completed");
    const todayAppointments = data.appointments.filter(
      (a) => a.date === today && a.status !== "cancelled",
    );
    const monthStart = `${today.slice(0, 7)}-01`;

    const collected = collectedIn(data.payments, args.from, args.to);
    const invoiced = sum(
      data.invoices
        .filter((i) => inRange(i.issueDate) && i.status !== "cancelled")
        .map((i) => i.total),
    );
    const bookedRevenue = sum(
      rangeAppointments
        .filter((a) => a.status !== "cancelled" && a.status !== "no_show")
        .map((a) => a.totalPrice - a.discount),
    );
    const paidPerInvoice = new Map<string, number>();
    for (const a of data.allocations) {
      paidPerInvoice.set(a.invoiceId as string, (paidPerInvoice.get(a.invoiceId as string) ?? 0) + a.amount);
    }
    const receivable = sum(
      data.invoices
        .filter((i) => i.status !== "cancelled" && i.status !== "draft")
        .map((i) => Math.max(0, i.total - (paidPerInvoice.get(i._id as string) ?? 0))),
    );

    const expensesIncurred = sum(
      data.expenses.filter((e) => inRange(e.date)).map((e) => e.amount),
    );
    const expensesPaid = sum(
      data.expenses
        .filter((e) => e.status === "pago" && inRange(e.paymentDate ?? e.date))
        .map((e) => e.amount),
    );

    const commissionsEarned = sum(
      data.commissions
        .filter((c) => inRange(c.date) && c.status !== "estimada")
        .map((c) => c.amount),
    );
    const commissionsPaid = sum(
      data.commissions
        .filter((c) => inRange(c.date) && c.status === "paga")
        .map((c) => c.amount),
    );

    const materialCost = sum(
      data.movements
        .filter((m) => inRange(m.date) && m.type === "consumo")
        .map((m) => Math.abs(m.quantity) * m.unitCost),
    );

    // ---- charts -----------------------------------------------------------
    const months = lastMonths(today, 6);
    const revenueVsExpenses = months.map((m) => {
      const lastDay = new Date(
        Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0),
      )
        .toISOString()
        .slice(0, 10);
      return {
        month: m,
        receita: collectedIn(data.payments, `${m}-01`, lastDay),
        faturado: sum(
          data.invoices
            .filter((i) => monthKey(i.issueDate) === m && i.status !== "cancelled")
            .map((i) => i.total),
        ),
        despesas: sum(
          data.expenses.filter((e) => monthKey(e.date) === m).map((e) => e.amount),
        ),
        despesasPagas: sum(
          data.expenses
            .filter((e) => e.status === "pago" && monthKey(e.paymentDate ?? e.date) === m)
            .map((e) => e.amount),
        ),
      };
    });

    const statusCounts: Record<string, number> = {};
    for (const a of rangeAppointments) {
      statusCounts[a.status] = (statusCounts[a.status] ?? 0) + 1;
    }
    const appointmentsByStatus = Object.entries(statusCounts).map(([status, value]) => ({
      status,
      value,
    }));

    const serviceRevenue = new Map<string, number>();
    for (const a of completed) {
      for (const item of a.items) {
        const source = data.services.find((s) => s._id === item.refId);
        const label = source?.name ?? item.name;
        serviceRevenue.set(label, (serviceRevenue.get(label) ?? 0) + item.total);
      }
    }
    const revenueByService = Array.from(serviceRevenue.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    const staffRevenue = new Map<string, number>();
    for (const a of completed) {
      const name = data.staff.find((s) => s._id === a.staffId)?.name ?? "—";
      staffRevenue.set(name, (staffRevenue.get(name) ?? 0) + (a.totalPrice - a.discount));
    }
    const revenueByStaff = Array.from(staffRevenue.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const methodTotals: Record<string, number> = {};
    for (const p of data.payments.filter((p) => inRange(p.date))) {
      const delta = p.kind === "reembolso" ? -p.amount : p.amount;
      methodTotals[p.method] = (methodTotals[p.method] ?? 0) + delta;
    }
    const revenueByMethod = Object.entries(methodTotals).map(([method, value]) => ({
      method,
      value,
    }));

    const firstVisitByClient = new Map<string, string>();
    for (const a of data.appointments) {
      const key = a.clientId as string;
      const current = firstVisitByClient.get(key);
      if (!current || a.date < current) firstVisitByClient.set(key, a.date);
    }
    let newClients = 0;
    let returning = 0;
    for (const a of completed) {
      const first = firstVisitByClient.get(a.clientId as string);
      if (first === a.date) newClients += 1;
      else returning += 1;
    }

    const cancelled = rangeAppointments.filter((a) => a.status === "cancelled").length;
    const noShows = rangeAppointments.filter((a) => a.status === "no_show").length;

    const consumption = data.movements
      .filter((m) => m.type === "consumo" && inRange(m.date))
      .reduce<Record<string, number>>((acc, m) => {
        const name = data.products.find((p) => p._id === m.productId)?.name ?? "—";
        acc[name] = (acc[name] ?? 0) + Math.abs(m.quantity);
        return acc;
      }, {});
    const stockConsumption = Object.entries(consumption)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    const pendingReturn = data.records.filter(
      (r) =>
        r.nextVisitDate &&
        r.nextVisitDate <= addDaysISO(today, 7) &&
        !data.appointments.some(
          (a) =>
            a.clientId === r.clientId &&
            a.date >= today &&
            a.status !== "cancelled" &&
            a.status !== "no_show",
        ),
    ).length;

    const retentionBuckets = [
      { label: "Com retorno agendado", value: 0 },
      { label: "Retorno pendente", value: 0 },
      { label: "Inativas", value: 0 },
    ];
    for (const c of data.clients.filter((c) => c.active)) {
      const mine = data.appointments.filter((a) => a.clientId === c._id);
      const hasFuture = mine.some(
        (a) => a.date >= today && a.status !== "cancelled" && a.status !== "no_show",
      );
      const last = mine
        .filter((a) => a.status === "completed")
        .map((a) => a.date)
        .sort()
        .pop();
      if (hasFuture) retentionBuckets[0].value += 1;
      else if (!last) continue;
      else if (diffDaysISO(today, last) > 120) retentionBuckets[2].value += 1;
      else retentionBuckets[1].value += 1;
    }

    const lowStock = data.products
      .filter((p) => p.active && p.quantity <= p.minStock)
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, 8);

    const topServices = revenueByService.slice(0, 5);

    const upcoming = data.appointments
      .filter(
        (a) =>
          a.date >= today &&
          a.status !== "cancelled" &&
          a.status !== "no_show" &&
          a.status !== "completed",
      )
      .sort((a, b) =>
        a.date === b.date ? a.startMinutes - b.startMinutes : a.date < b.date ? -1 : 1,
      )
      .slice(0, 8)
      .map((a) => ({
        _id: a._id,
        date: a.date,
        startMinutes: a.startMinutes,
        clientName: data.clients.find((c) => c._id === a.clientId)?.name ?? "—",
        staffName: data.staff.find((s) => s._id === a.staffId)?.name ?? "—",
        status: a.status,
        total: a.totalPrice - a.discount,
      }));

    return {
      kpis: {
        todayAppointments: todayAppointments.length,
        todayCompleted: todayAppointments.filter((a) => a.status === "completed").length,
        upcoming: data.appointments.filter(
          (a) =>
            (a.date > today || (a.date === today && a.status === "confirmed")) &&
            !["cancelled", "no_show", "completed"].includes(a.status),
        ).length,
        completed: completed.length,
        cancelled,
        noShows,
        revenueToday: collectedIn(data.payments, today, today),
        revenueMonth: collectedIn(data.payments, monthStart, today),
        revenueRange: collected,
        bookedRevenue,
        invoiced,
        receivable,
        expensesMonth: sum(
          data.expenses
            .filter((e) => monthKey(e.date) === monthKey(today))
            .map((e) => e.amount),
        ),
        expensesRange: expensesIncurred,
        expensesPaid,
        commissionsEarned,
        commissionsPaid,
        materialCost,
        operatingProfit: collected - expensesPaid - commissionsPaid - materialCost,
        newClients: data.clients.filter((c) => inRange(c.createdAt ? new Date(c.createdAt).toISOString().slice(0, 10) : "")).length,
        clientsPendingReturn: pendingReturn,
        pendingPayments: receivable,
        noShowRate: pct(noShows, rangeAppointments.length),
        cancellationRate: pct(cancelled, rangeAppointments.length),
        averageTicket: completed.length
          ? Math.round(sum(completed.map((a) => a.totalPrice - a.discount)) / completed.length)
          : 0,
        activeClients: data.clients.filter((c) => c.active).length,
        ticketTrend: months.map((m) => {
          const lastDay = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0))
            .toISOString()
            .slice(0, 10);
          const monthCompleted = data.appointments.filter(
            (a) => monthKey(a.date) === m && a.status === "completed",
          );
          return {
            month: m,
            receita: collectedIn(data.payments, `${m}-01`, lastDay),
            despesas: sum(data.expenses.filter((e) => monthKey(e.date) === m).map((e) => e.amount)),
            atendimentos: monthCompleted.length,
          };
        }),
      },
      todayAgenda: todayAppointments
        .sort((a, b) => a.startMinutes - b.startMinutes)
        .map((a) => ({
          _id: a._id,
          startMinutes: a.startMinutes,
          endMinutes: a.endMinutes,
          status: a.status,
          clientName: data.clients.find((c) => c._id === a.clientId)?.name ?? "—",
          staffName: data.staff.find((s) => s._id === a.staffId)?.name ?? "—",
          staffColor: data.staff.find((s) => s._id === a.staffId)?.color ?? "#94a3b8",
          services: a.items.map((i) => i.name).join(", "),
          total: a.totalPrice - a.discount,
          paymentStatus: a.paymentStatus,
        })),
      upcoming,
      charts: {
        revenueVsExpenses,
        appointmentsByStatus,
        revenueByService,
        revenueByStaff,
        revenueByMethod,
        stockConsumption,
        newVsReturning: [
          { name: "Novas clientes", value: newClients },
          { name: "Clientes recorrentes", value: returning },
        ],
        retentionBuckets,
      },
      topServices,
      lowStock,
      period: { from: args.from, to: args.to },
    };
  },
});

export const reportBundle = query({
  args: { orgId: v.id("organizations"), from: v.string(), to: v.string() },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId);
    if (!member) return null;
    const data = await loadOrgData(ctx, args.orgId);
    const inRange = (d: string) => d >= args.from && d <= args.to;

    const appointments = data.appointments.filter((a) => inRange(a.date));
    const completed = appointments.filter((a) => a.status === "completed");

    // operational
    const statusCounts: Record<string, number> = {};
    const hourBuckets: Record<string, number> = {};
    for (const a of appointments) {
      statusCounts[a.status] = (statusCounts[a.status] ?? 0) + 1;
      const hour = `${String(Math.floor(a.startMinutes / 60)).padStart(2, "0")}:00`;
      hourBuckets[hour] = (hourBuckets[hour] ?? 0) + 1;
    }
    // Names are free text ("Jéssica", "Hidratação"), so they must never be used
    // as object keys: Convex only accepts ASCII field names in documents and
    // return values. Both groupings are returned as explicit lists.
    const byStaff = data.staff.map((s) => {
      const mine = appointments.filter((a) => a.staffId === s._id);
      return {
        name: s.name,
        total: mine.length,
        completed: mine.filter((a) => a.status === "completed").length,
        cancelled: mine.filter((a) => a.status === "cancelled").length,
        noShow: mine.filter((a) => a.status === "no_show").length,
        revenue: sum(
          mine.filter((a) => a.status === "completed").map((a) => a.totalPrice - a.discount),
        ),
      };
    });
    const serviceTotals = new Map<string, { count: number; revenue: number; minutes: number }>();
    for (const a of completed) {
      for (const item of a.items) {
        const svc = data.services.find((s) => s._id === item.refId);
        const name = svc?.name ?? item.name;
        const current = serviceTotals.get(name) ?? { count: 0, revenue: 0, minutes: 0 };
        current.count += 1;
        current.revenue += item.total;
        current.minutes += svc?.durationMin ?? a.durationMin;
        serviceTotals.set(name, current);
      }
    }
    const byService = Array.from(serviceTotals, ([name, value]) => ({ name, ...value })).sort(
      (a, b) => b.revenue - a.revenue,
    );

    const avgDuration =
      completed.length ? Math.round(sum(completed.map((a) => a.durationMin)) / completed.length) : 0;

    // financial
    const paidPerInvoice = new Map<string, number>();
    for (const a of data.allocations) {
      paidPerInvoice.set(a.invoiceId as string, (paidPerInvoice.get(a.invoiceId as string) ?? 0) + a.amount);
    }
    const categoryTotals = new Map<string, number>();
    for (const e of data.expenses.filter((e) => inRange(e.date))) {
      categoryTotals.set(e.category, (categoryTotals.get(e.category) ?? 0) + e.amount);
    }
    const expensesByCategory = Array.from(categoryTotals, ([category, value]) => ({
      category,
      value,
    })).sort((a, b) => b.value - a.value);
    const methodTotals: Record<string, number> = {};
    for (const p of data.payments.filter((p) => inRange(p.date))) {
      const delta = p.kind === "reembolso" ? -p.amount : p.amount;
      methodTotals[p.method] = (methodTotals[p.method] ?? 0) + delta;
    }
    const collected = collectedIn(data.payments, args.from, args.to);
    const expensesPaid = sum(
      data.expenses
        .filter((e) => e.status === "pago" && inRange(e.paymentDate ?? e.date))
        .map((e) => e.amount),
    );
    const commissionsEarned = sum(
      data.commissions.filter((c) => inRange(c.date) && c.status !== "estimada").map((c) => c.amount),
    );
    const commissionsPaid = sum(
      data.commissions.filter((c) => inRange(c.date) && c.status === "paga").map((c) => c.amount),
    );
    const materialCost = sum(
      data.movements
        .filter((m) => m.type === "consumo" && inRange(m.date))
        .map((m) => Math.abs(m.quantity) * m.unitCost),
    );

    // clients
    const clientSpend = new Map<string, number>();
    const clientVisits = new Map<string, number>();
    const clientLast = new Map<string, string>();
    for (const p of data.payments) {
      if (p.kind === "reembolso") continue;
      clientSpend.set(p.clientId as string, (clientSpend.get(p.clientId as string) ?? 0) + p.amount);
    }
    for (const a of completed) {
      clientVisits.set(a.clientId as string, (clientVisits.get(a.clientId as string) ?? 0) + 1);
      const current = clientLast.get(a.clientId as string);
      if (!current || a.date > current) clientLast.set(a.clientId as string, a.date);
    }
    const today = todayInTz();
    const mostValuable = data.clients
      .map((c) => ({
        name: c.name,
        phone: c.phone,
        spend: clientSpend.get(c._id as string) ?? 0,
        visits: clientVisits.get(c._id as string) ?? 0,
        lastVisit: clientLast.get(c._id as string) ?? "—",
      }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 15);
    const inactive = data.clients
      .filter((c) => {
        const last = clientLast.get(c._id as string);
        return !!last && diffDaysISO(today, last) >= 120;
      })
      .map((c) => ({
        name: c.name,
        phone: c.phone,
        lastVisit: clientLast.get(c._id as string) ?? "—",
        daysSince: diffDaysISO(today, clientLast.get(c._id as string) ?? today),
      }))
      .sort((a, b) => b.daysSince - a.daysSince)
      .slice(0, 20);

    // inventory
    const inventoryValue = sum(data.products.map((p) => p.quantity * p.cost));
    const retailValue = sum(data.products.map((p) => p.quantity * p.price));
    const productTotals = new Map<string, { quantity: number; revenue: number }>();
    for (const m of data.movements.filter((m) => m.type === "venda" && inRange(m.date))) {
      const name = data.products.find((p) => p._id === m.productId)?.name ?? "—";
      const current = productTotals.get(name) ?? { quantity: 0, revenue: 0 };
      current.quantity += Math.abs(m.quantity);
      current.revenue += Math.abs(m.quantity) * m.unitCost;
      productTotals.set(name, current);
    }

    return {
      operational: {
        totals: statusCounts,
        hours: Object.entries(hourBuckets)
          .map(([hour, value]) => ({ hour, value }))
          .sort((a, b) => a.hour.localeCompare(b.hour)),
        byStaff,
        byService,
        avgDuration,
        cancellationRate: pct(
          appointments.filter((a) => a.status === "cancelled").length,
          appointments.length,
        ),
        noShowRate: pct(
          appointments.filter((a) => a.status === "no_show").length,
          appointments.length,
        ),
        completed: completed.length,
      },
      financial: {
        booked: sum(
          appointments
            .filter((a) => a.status !== "cancelled" && a.status !== "no_show")
            .map((a) => a.totalPrice - a.discount),
        ),
        invoiced: sum(
          data.invoices
            .filter((i) => inRange(i.issueDate) && i.status !== "cancelled")
            .map((i) => i.total),
        ),
        collected,
        deposits: sum(
          data.payments.filter((p) => inRange(p.date) && p.kind === "sinal").map((p) => p.amount),
        ),
        refunds: sum(
          data.payments.filter((p) => inRange(p.date) && p.kind === "reembolso").map((p) => p.amount),
        ),
        receivable: sum(
          data.invoices
            .filter((i) => i.status !== "cancelled" && i.status !== "draft")
            .map((i) => Math.max(0, i.total - (paidPerInvoice.get(i._id as string) ?? 0))),
        ),
        expensesIncurred: sum(
          data.expenses.filter((e) => inRange(e.date)).map((e) => e.amount),
        ),
        expensesPaid,
        expensesByCategory,
        methods: methodTotals,
        commissionsEarned,
        commissionsPaid,
        materialCost,
        net: collected - expensesPaid - commissionsPaid - materialCost,
      },
      clients: {
        total: data.clients.length,
        active: data.clients.filter((c) => c.active).length,
        newInPeriod: data.clients.filter((c) =>
          inRange(new Date(c.createdAt).toISOString().slice(0, 10)),
        ).length,
        mostValuable,
        inactive,
        lifetimeValue:
          data.clients.length > 0
            ? Math.round(sum(Array.from(clientSpend.values())) / data.clients.length)
            : 0,
      },
      inventory: {
        inventoryValue,
        retailValue,
        items: data.products.length,
        lowStock: data.products
          .filter((p) => p.quantity <= p.minStock)
          .map((p) => ({ name: p.name, quantity: p.quantity, minStock: p.minStock })),
        productSales: Array.from(productTotals, ([name, v]) => ({ name, ...v })),
        consumption: materialCost,
      },
    };
  },
});

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: "PIX",
  cash: "Dinheiro",
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  transfer: "Transferência",
  gift_card: "Cartão-presente",
  other: "Outro",
};

/** Authorised dataset export. Rows are plain objects for CSV generation. */
export const exportDataset = query({
  args: {
    orgId: v.id("organizations"),
    dataset: v.string(),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const member = await getMembership(ctx, args.orgId);
    if (!member) return { columns: [], rows: [], filename: "export.csv" };
    const data = await loadOrgData(ctx, args.orgId);
    const inRange = (d: string) =>
      (!args.from || d >= args.from) && (!args.to || d <= args.to);

    switch (args.dataset) {
      case "clientes": {
        const rows = data.clients
          .filter((c) => c.active)
          .map((c) => ({
            nome: c.name,
            telefone: c.phone,
            whatsapp: c.whatsapp ?? "",
            email: c.email ?? "",
            aniversario: c.birthday ?? "",
            tags: c.tags.join(" | "),
            status: c.status,
            origem: c.referralSource ?? "",
            cadastro: new Date(c.createdAt).toISOString().slice(0, 10),
          }));
        return { columns: Object.keys(rows[0] ?? { nome: "" }), rows, filename: "clientes.csv" };
      }
      case "agendamentos": {
        const rows = data.appointments
          .filter((a) => inRange(a.date))
          .map((a) => ({
            data: a.date,
            inicio: `${String(Math.floor(a.startMinutes / 60)).padStart(2, "0")}:${String(a.startMinutes % 60).padStart(2, "0")}`,
            cliente: data.clients.find((c) => c._id === a.clientId)?.name ?? "",
            profissional: data.staff.find((s) => s._id === a.staffId)?.name ?? "",
            servicos: a.items.map((i) => i.name).join(" | "),
            status: a.status,
            valor: (a.totalPrice / 100).toFixed(2),
            desconto: (a.discount / 100).toFixed(2),
            total: ((a.totalPrice - a.discount) / 100).toFixed(2),
            pagamento: a.paymentStatus,
          }));
        return { columns: Object.keys(rows[0] ?? { data: "" }), rows, filename: "agendamentos.csv" };
      }
      case "servicos": {
        const rows = data.services.map((s) => ({
          nome: s.name,
          preco: (s.price / 100).toFixed(2),
          duracao: s.durationMin,
          custo_material: (s.materialCost / 100).toFixed(2),
          custo_mao_de_obra: (s.laborCost / 100).toFixed(2),
          ativo: s.active ? "sim" : "não",
        }));
        return { columns: Object.keys(rows[0] ?? { nome: "" }), rows, filename: "servicos.csv" };
      }
      case "equipe": {
        const rows = data.staff.map((s) => ({
          nome: s.name,
          funcao: s.role,
          vinculo: s.employmentType,
          telefone: s.phone ?? "",
          comissao_pct: s.commissionPct,
          ativo: s.active ? "sim" : "não",
        }));
        return { columns: Object.keys(rows[0] ?? { nome: "" }), rows, filename: "equipe.csv" };
      }
      case "produtos": {
        const rows = data.products.map((p) => ({
          nome: p.name,
          marca: p.brand ?? "",
          sku: p.sku,
          tipo: p.type,
          custo: (p.cost / 100).toFixed(2),
          preco: (p.price / 100).toFixed(2),
          quantidade: p.quantity,
          minimo: p.minStock,
        }));
        return { columns: Object.keys(rows[0] ?? { nome: "" }), rows, filename: "produtos.csv" };
      }
      case "movimentacoes": {
        const rows = data.movements
          .filter((m) => inRange(m.date))
          .map((m) => ({
            data: m.date,
            produto: data.products.find((p) => p._id === m.productId)?.name ?? "",
            tipo: m.type,
            quantidade: m.quantity,
            saldo: m.balanceAfter,
            custo_unitario: (m.unitCost / 100).toFixed(2),
            motivo: m.reason ?? "",
          }));
        return { columns: Object.keys(rows[0] ?? { data: "" }), rows, filename: "movimentacoes.csv" };
      }
      case "receitas": {
        const rows = data.invoices
          .filter((i) => inRange(i.issueDate) && i.status !== "cancelled")
          .map((i) => ({
            numero: i.number,
            data: i.issueDate,
            cliente: data.clients.find((c) => c._id === i.clientId)?.name ?? "",
            total: (i.total / 100).toFixed(2),
            status: i.status,
          }));
        return { columns: Object.keys(rows[0] ?? { numero: "" }), rows, filename: "receitas.csv" };
      }
      case "despesas": {
        const rows = data.expenses
          .filter((e) => inRange(e.date))
          .map((e) => ({
            data: e.date,
            categoria: e.category,
            descricao: e.description,
            valor: (e.amount / 100).toFixed(2),
            status: e.status,
            vencimento: e.dueDate ?? "",
            pagamento: e.paymentDate ?? "",
          }));
        return { columns: Object.keys(rows[0] ?? { data: "" }), rows, filename: "despesas.csv" };
      }
      case "pagamentos": {
        const rows = data.payments
          .filter((p) => inRange(p.date))
          .map((p) => ({
            data: p.date,
            cliente: data.clients.find((c) => c._id === p.clientId)?.name ?? "",
            tipo: p.kind,
            forma: PAYMENT_METHOD_LABELS[p.method] ?? p.method,
            valor: (p.amount / 100).toFixed(2),
            referencia: p.reference ?? "",
          }));
        return { columns: Object.keys(rows[0] ?? { data: "" }), rows, filename: "pagamentos.csv" };
      }
      case "comissoes": {
        const rows = data.commissions
          .filter((c) => inRange(c.date))
          .map((c) => ({
            data: c.date,
            profissional: data.staff.find((s) => s._id === c.staffId)?.name ?? "",
            tipo: c.kind,
            base: (c.baseAmount / 100).toFixed(2),
            regra: c.ruleLabel,
            comissao: (c.amount / 100).toFixed(2),
            status: c.status,
          }));
        return { columns: Object.keys(rows[0] ?? { data: "" }), rows, filename: "comissoes.csv" };
      }
      default:
        return { columns: [], rows: [], filename: "export.csv" };
    }
  },
});
