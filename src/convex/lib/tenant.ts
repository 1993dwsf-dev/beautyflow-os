import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id, TableNames } from "../_generated/dataModel";
import { AppError, ERR } from "./helpers";

const tables: Record<string, TableNames> = {
  clientId: "clients", staffId: "staff", assignedTo: "staff", serviceId: "services", serviceIds: "services", eligibleStaff: "staff",
  appointmentId: "appointments", invoiceId: "invoices", paymentId: "payments", accountId: "financialAccounts",
  giftCardId: "giftCards", productId: "products", supplierId: "suppliers",
  memberId: "organizationMembers", treatmentRecordId: "treatmentRecords", formId: "consultationForms", quoteId: "quotes",
};
export async function validateOrgReferences(ctx: QueryCtx | MutationCtx, orgId: Id<"organizations">, value: unknown): Promise<void> {
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined || entry === null || entry === "") continue;
    let table = tables[key];
    if (key === "categoryId") {
      const serviceId = typeof entry === "string" ? ctx.db.normalizeId("serviceCategories", entry) : null;
      table = serviceId ? "serviceCategories" : "productCategories";
    }
    if (key === "refId" && typeof record.kind === "string") {
      table = ({ service: "services", product: "products", package: "servicePackages" } as Record<string, TableNames>)[record.kind];
    }
    if (table) {
      for (const raw of Array.isArray(entry) ? entry : [entry]) {
        const id = typeof raw === "string" ? ctx.db.normalizeId(table, raw) : null;
        const doc = id ? await ctx.db.get(id) : null;
        if (!doc || !("orgId" in doc) || doc.orgId !== orgId) throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
      }
    } else if (typeof entry === "object") {
      await validateOrgReferences(ctx, orgId, entry);
    }
  }
}
