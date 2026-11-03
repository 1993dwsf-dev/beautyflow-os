import { beforeEach, describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import schema from "../src/convex/schema";
import { api } from "../src/convex/_generated/api";
import { escapeCsv } from "../src/lib/format";
import { hasPermission } from "../src/convex/lib/permissions";

const modules = import.meta.glob("../src/convex/**/*.ts");
const service = { name: "Corte", price: 5000, durationMin: 30, bufferMin: 0, materialCost: 0, laborCost: 0, depositType: "none", depositValue: 0, eligibleStaff: [] };

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const a = await ctx.db.insert("users", { email: "owner-a@example.test" });
    const b = await ctx.db.insert("users", { email: "owner-b@example.test" });
    const viewer = await ctx.db.insert("users", { email: "viewer@example.test" });
    const admin = await ctx.db.insert("users", { email: "admin@example.test" });
    const reception = await ctx.db.insert("users", { email: "reception@example.test" });
    return { a, b, viewer, admin, reception };
  });
  const a = t.withIdentity({ subject: ids.a });
  const b = t.withIdentity({ subject: ids.b });
  const viewer = t.withIdentity({ subject: ids.viewer });
  const admin = t.withIdentity({ subject: ids.admin });
  const reception = t.withIdentity({ subject: ids.reception });
  const orgA = await a.mutation(api.orgs.createOrganization, { name: "Salão A" });
  const orgB = await b.mutation(api.orgs.createOrganization, { name: "Salão B" });
  for (const [id, role] of [[ids.viewer, "viewer"], [ids.admin, "admin"], [ids.reception, "receptionist"]] as const) {
    await t.run(ctx => ctx.db.insert("organizationMembers", { orgId: orgA, userId: id, name: role, role, active: true, extraPermissions: [], createdAt: Date.now() }));
  }
  const clientA = await a.mutation(api.clients.createClient, { orgId: orgA, name: "Alice", phone: "69999999999", tags: [] });
  const clientB = await b.mutation(api.clients.createClient, { orgId: orgB, name: "Beatriz", phone: "69988888888", tags: [] });
  const serviceA = await a.mutation(api.services.createService, { orgId: orgA, ...service });
  const serviceB = await b.mutation(api.services.createService, { orgId: orgB, ...service });
  const staffA = await a.mutation(api.staff.createStaff, { orgId: orgA, name: "Profissional A", role: "Cabeleireira", employmentType: "autonomo", workingDays: [1,2,3,4,5,6], workStart: "09:00", workEnd: "18:00", serviceIds: [serviceA], commissionPct: 10 });
  const staffB = await b.mutation(api.staff.createStaff, { orgId: orgB, name: "Profissional B", role: "Cabeleireira", employmentType: "autonomo", workingDays: [1,2,3,4,5,6], workStart: "09:00", workEnd: "18:00", serviceIds: [serviceB], commissionPct: 10 });
  const invoiceA = await a.mutation(api.invoices.createInvoice, { orgId: orgA, clientId: clientA, items: [{ kind: "service", refId: serviceA, name: "Corte", quantity: 1, unitPrice: 5000, total: 5000 }], discount: 0, issue: true });
  const invoiceB = await b.mutation(api.invoices.createInvoice, { orgId: orgB, clientId: clientB, items: [{ kind: "service", refId: serviceB, name: "Corte", quantity: 1, unitPrice: 5000, total: 5000 }], discount: 0, issue: true });
  return { t, ids, a, b, viewer, admin, reception, orgA, orgB, clientA, clientB, serviceA, serviceB, staffA, staffB, invoiceA, invoiceB };
}
let f: Awaited<ReturnType<typeof setup>>;
beforeEach(async () => { f = await setup(); });

describe("isolamento e permissões no backend", () => {
  it("rejeita gravação sem autenticação", async () => {
    await expect(f.t.mutation(api.clients.createClient, { orgId: f.orgA, name: "Intruso", phone: "1", tags: [] })).rejects.toThrow();
  });
  it("não expõe clientes de outro salão", async () => {
    expect((await f.a.query(api.clients.listClients, { orgId: f.orgB })).rows).toEqual([]);
    expect(await f.a.query(api.clients.getClient, { orgId: f.orgA, clientId: f.clientB })).toBeNull();
  });
  it("não expõe pagamentos filtrados por cliente de outro salão", async () => {
    await f.b.mutation(api.payments.createPayment, { orgId: f.orgB, clientId: f.clientB, invoiceId: f.invoiceB, amount: 1000, method: "pix" });
    expect((await f.a.query(api.payments.listPayments, { orgId: f.orgA, clientId: f.clientB })).rows).toEqual([]);
  });
  it("não expõe faturas filtradas por cliente de outro salão", async () => {
    expect(await f.a.query(api.invoices.listInvoices, { orgId: f.orgA, clientId: f.clientB })).toMatchObject({ rows: [] });
  });
  it("não expõe fichas e respostas consultadas pelo ID de outra cliente", async () => {
    await f.b.mutation(api.crm.createTreatmentRecord, { orgId: f.orgB, clientId: f.clientB, serviceName: "Corte", productsUsed: [], notes: "Saúde privada" });
    expect(await f.a.query(api.crm.listTreatmentRecords, { orgId: f.orgA, clientId: f.clientB })).toEqual([]);
    expect(await f.a.query(api.crm.listResponses, { orgId: f.orgA, clientId: f.clientB })).toEqual([]);
  });
  it("recepção não recebe fichas sensíveis nem pelo perfil da cliente", async () => {
    await f.a.mutation(api.crm.createTreatmentRecord, { orgId: f.orgA, clientId: f.clientA, serviceName: "Corte", productsUsed: [], reactions: "Informação privada" });
    expect(await f.reception.query(api.crm.listTreatmentRecords, { orgId: f.orgA })).toEqual([]);
    expect((await f.reception.query(api.clients.getClient, { orgId: f.orgA, clientId: f.clientA }))?.records).toEqual([]);
  });
  it("consulta não pode editar clientes nem fotos", async () => {
    await expect(f.viewer.mutation(api.clients.updateClient, { orgId: f.orgA, clientId: f.clientA, patch: { name: "Alterado" } })).rejects.toThrow();
    await expect(f.viewer.action(api.crm.uploadPhotoFile, { orgId: f.orgA, data: new ArrayBuffer(8), contentType: "image/png" })).rejects.toThrow();
  });
  it("não permite que consulta obtenha relatórios financeiros por API ou CSV", async () => {
    expect(await f.viewer.query(api.reports.reportBundle, { orgId: f.orgA, from: "2026-01-01", to: "2026-12-31" })).toBeNull();
    await expect(f.viewer.query(api.reports.exportDataset, { orgId: f.orgA, dataset: "pagamentos" })).rejects.toThrow();
  });
  it("permite CSV de clientes ao perfil de consulta", async () => {
    const result = await f.viewer.query(api.reports.exportDataset, { orgId: f.orgA, dataset: "clientes" });
    expect(result.rows).toHaveLength(1);
    expect(result.filename).toBe("clientes.csv");
  });
  it("admin não pode promover-se ou adicionar um proprietário", async () => {
    await expect(f.admin.mutation(api.orgs.addMemberByEmail, { orgId: f.orgA, email: f.ids.b, name: "Outro", role: "owner", extraPermissions: [] })).rejects.toThrow();
  });
  it("preserva o último proprietário ativo", async () => {
    const member = (await f.a.query(api.orgs.listMembers, { orgId: f.orgA })).find(m => m.userId === f.ids.a)!;
    await expect(f.a.mutation(api.orgs.updateMember, { orgId: f.orgA, memberId: member._id, active: false })).rejects.toThrow();
  });
  it("não libera acesso apenas porque alguém informou um e-mail sem verificação", async () => {
    await expect(f.a.mutation(api.orgs.addMemberByEmail, { orgId: f.orgA, email: "owner-b@example.test", name: "B", role: "professional", extraPermissions: [] })).rejects.toThrow();
    await f.a.mutation(api.orgs.addMemberByEmail, { orgId: f.orgA, email: f.ids.b, name: "B", role: "professional", extraPermissions: [] });
    expect((await f.b.query(api.orgs.myOrganizations, {})).some(o => o._id === f.orgA)).toBe(true);
  });
  it("notificação de outro salão não pode ser alterada", async () => {
    const id = await f.t.run(ctx => ctx.db.insert("notifications", { orgId: f.orgB, title: "Privada", body: "Privada", type: "agenda", read: false, at: Date.now() }));
    await expect(f.a.mutation(api.orgs.markNotificationRead, { orgId: f.orgA, id })).rejects.toThrow();
  });
  it("status da demonstração exige vínculo com o salão", async () => {
    expect(await f.t.query(api.demo.demoStatus, { orgId: f.orgA })).toBeNull();
    expect(await f.a.query(api.demo.demoStatus, { orgId: f.orgB })).toBeNull();
  });
  it("rejeita serviços de outra organização em cadastros e itens de fatura", async () => {
    await expect(f.a.mutation(api.staff.createStaff, { orgId: f.orgA, name: "Inválida", role: "Profissional", employmentType: "autonomo", workingDays: [1], workStart: "09:00", workEnd: "18:00", serviceIds: [f.serviceB], commissionPct: 10 })).rejects.toThrow();
    await expect(f.a.mutation(api.invoices.createInvoice, { orgId: f.orgA, clientId: f.clientA, items: [{ kind: "service", refId: f.serviceB, name: "Corte", quantity: 1, unitPrice: 5000, total: 5000 }], discount: 0, issue: true })).rejects.toThrow();
  });
  it("não permite anexar um arquivo de outro salão", async () => {
    const storageId = await f.t.run(async ctx => {
      const id = await ctx.storage.store(new Blob([new Uint8Array([137,80,78,71,13,10,26,10])], {type: "image/png"}));
      await ctx.db.insert("photoUploads", { orgId: f.orgB, storageId: id, uploadedBy: f.ids.b, createdAt: Date.now() });
      return id;
    });
    await expect(f.a.mutation(api.crm.savePhoto, { orgId: f.orgA, clientId: f.clientA, storageId, kind: "antes", consentInternal: true, consentPublic: false })).rejects.toThrow();
  });
  it("recusa HTML enviado como imagem", async () => {
    await expect(f.a.action(api.crm.uploadPhotoFile, { orgId: f.orgA, data: new TextEncoder().encode("<html>script</html>").buffer, contentType: "image/png" })).rejects.toThrow();
  });
});

describe("integridade financeira", () => {
  it("rejeita fatura e cliente de outro salão", async () => {
    await expect(f.a.mutation(api.payments.createPayment, { orgId: f.orgA, clientId: f.clientA, invoiceId: f.invoiceB, amount: 1000, method: "pix" })).rejects.toThrow();
    await expect(f.a.mutation(api.payments.createPayment, { orgId: f.orgA, clientId: f.clientB, amount: 1000, method: "pix" })).rejects.toThrow();
    expect((await f.a.query(api.payments.listPayments, {orgId: f.orgA})).rows).toHaveLength(0);
  });
  it("bloqueia valor acima do saldo e reembolso pelo endpoint de recebimento", async () => {
    await expect(f.a.mutation(api.payments.createPayment, { orgId: f.orgA, clientId: f.clientA, invoiceId: f.invoiceA, amount: 6000, method: "pix" })).rejects.toThrow();
    await expect(f.a.mutation(api.payments.createPayment, { orgId: f.orgA, clientId: f.clientA, amount: 1000, method: "pix", kind: "reembolso" })).rejects.toThrow();
  });
  it("evita clique duplicado e mantém o saldo correto", async () => {
    const args = { orgId: f.orgA, clientId: f.clientA, invoiceId: f.invoiceA, amount: 1000, method: "pix" as const };
    await f.a.mutation(api.payments.createPayment, args);
    await expect(f.a.mutation(api.payments.createPayment, args)).rejects.toThrow();
    const inv = await f.a.query(api.invoices.invoiceDetail, { orgId: f.orgA, invoiceId: f.invoiceA });
    expect(inv?.invoice.paid).toBe(1000);
    expect(inv?.invoice.outstanding).toBe(4000);
  });
  it("não estorna mais do que foi recebido nem estorna outro estorno", async () => {
    const paymentId = await f.a.mutation(api.payments.createPayment, { orgId: f.orgA, clientId: f.clientA, invoiceId: f.invoiceA, amount: 1000, method: "pix" });
    const refundId = await f.a.mutation(api.payments.refundPayment, { orgId: f.orgA, paymentId, amount: 600, reason: "Teste" });
    await expect(f.a.mutation(api.payments.refundPayment, { orgId: f.orgA, paymentId, amount: 600, reason: "Duplicado" })).rejects.toThrow();
    await expect(f.a.mutation(api.payments.refundPayment, { orgId: f.orgA, paymentId: refundId, amount: 100, reason: "Indevido" })).rejects.toThrow();
    expect((await f.a.query(api.invoices.invoiceDetail, { orgId: f.orgA, invoiceId: f.invoiceA }))?.invoice.paid).toBe(400);
  });
});

describe("fluxo de atendimento", () => {
  it("agenda, conclui uma vez, fatura e recebe sem duplicar a receita", async () => {
    const appointmentId = await f.a.mutation(api.appointments.createAppointment, { orgId: f.orgA, clientId: f.clientA, staffId: f.staffA, serviceIds: [f.serviceA], date: "2030-01-07", start: "10:00" });
    await expect(f.a.mutation(api.appointments.createAppointment, { orgId: f.orgA, clientId: f.clientA, staffId: f.staffA, serviceIds: [f.serviceA], date: "2030-01-07", start: "10:00" })).rejects.toThrow();
    await f.a.mutation(api.appointments.completeAppointment, { orgId: f.orgA, appointmentId, productsUsed: [] });
    await expect(f.a.mutation(api.appointments.completeAppointment, { orgId: f.orgA, appointmentId, productsUsed: [] })).rejects.toThrow();
    const invoiceId = await f.a.mutation(api.invoices.createInvoiceFromAppointment, { orgId: f.orgA, appointmentId });
    await expect(f.a.mutation(api.invoices.createInvoiceFromAppointment, { orgId: f.orgA, appointmentId })).rejects.toThrow();
    await f.a.mutation(api.payments.createPayment, { orgId: f.orgA, clientId: f.clientA, invoiceId, appointmentId, amount: 5000, method: "pix" });
    expect((await f.a.query(api.invoices.invoiceDetail, { orgId: f.orgA, invoiceId }))?.invoice.outstanding).toBe(0);
    expect((await f.a.query(api.payments.listPayments, { orgId: f.orgA })).rows).toHaveLength(1);
  });
  it("busca por nome não retorna todos os telefones", async () => {
    expect((await f.a.query(api.clients.listClients, { orgId: f.orgA, search: "Ninguém" })).rows).toEqual([]);
  });
});

describe("CSV e permissões inválidas", () => {
  it.each(["=SUM(1;2)", "+cmd", "@SUM(A1)", "-1+1", "  =1+1"])('neutraliza fórmula %s', value => {
    expect(escapeCsv(value)).toBe(`"'${value}"`);
  });
  it("preserva números e aspas", () => {
    expect(escapeCsv(-12)).toBe('"-12"');
    expect(escapeCsv('Corte "novo"')).toBe('"Corte ""novo"""');
    expect(hasPermission("invalido" as never, "clients.view")).toBe(false);
  });
});

describe("histórico e cálculo de sinais", () => {
  it("não reabre nem apaga atendimento concluído", async () => {
    const appointmentId = await f.a.mutation(api.appointments.createAppointment, { orgId: f.orgA, clientId: f.clientA, staffId: f.staffA, serviceIds: [f.serviceA], date: "2030-01-07", start: "11:00" });
    await f.a.mutation(api.appointments.completeAppointment, { orgId: f.orgA, appointmentId, productsUsed: [] });
    await expect(f.a.mutation(api.appointments.setAppointmentStatus, { orgId: f.orgA, appointmentId, status: "confirmed" })).rejects.toThrow();
    await expect(f.a.mutation(api.appointments.deleteAppointment, { orgId: f.orgA, appointmentId })).rejects.toThrow();
  });
  it("o sinal reduz o saldo uma única vez", async () => {
    const appointmentId = await f.a.mutation(api.appointments.createAppointment, { orgId: f.orgA, clientId: f.clientA, staffId: f.staffA, serviceIds: [f.serviceA], date: "2030-01-07", start: "11:00" });
    await f.a.mutation(api.payments.createPayment, { orgId: f.orgA, clientId: f.clientA, appointmentId, amount: 1000, kind: "sinal", method: "pix" });
    const invoiceId = await f.a.mutation(api.invoices.createInvoiceFromAppointment, { orgId: f.orgA, appointmentId });
    const inv = await f.a.query(api.invoices.invoiceDetail, { orgId: f.orgA, invoiceId });
    expect(inv?.invoice.outstanding).toBe(4000);
    // The other fixture invoice is still open for 5000.
    expect((await f.a.query(api.clients.getClient, { orgId: f.orgA, clientId: f.clientA }))?.metrics.outstanding).toBe(9000);
  });
  it("rejeita totais de itens forjados e descontos negativos", async () => {
    await expect(f.a.mutation(api.invoices.updateInvoice, { orgId: f.orgA, invoiceId: f.invoiceA, discount: -100 })).rejects.toThrow();
    await expect(f.a.mutation(api.invoices.createInvoice, { orgId: f.orgA, clientId: f.clientA, discount: 0, items: [{ kind: "service", refId: f.serviceA, name: "Corte", quantity: 1, unitPrice: 5000, total: -100 }] })).rejects.toThrow();
  });
});
