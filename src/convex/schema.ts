import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// ---------------------------------------------------------------------------
// Shared validators
// ---------------------------------------------------------------------------

// default user roles (kept from template so existing code keeps working)
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

/** Organization-scoped role used for BeautyFlow access control. */
export const ORG_ROLE = {
  OWNER: "owner",
  ADMIN: "admin",
  RECEPTIONIST: "receptionist",
  PROFESSIONAL: "professional",
  FINANCE: "finance",
  VIEWER: "viewer",
} as const;

export const orgRoleValidator = v.union(
  v.literal("owner"),
  v.literal("admin"),
  v.literal("receptionist"),
  v.literal("professional"),
  v.literal("finance"),
  v.literal("viewer"),
);
export type OrgRole = Infer<typeof orgRoleValidator>;

export const appointmentStatusValidator = v.union(
  v.literal("requested"),
  v.literal("awaiting_confirmation"),
  v.literal("confirmed"),
  v.literal("checked_in"),
  v.literal("in_progress"),
  v.literal("completed"),
  v.literal("cancelled"),
  v.literal("no_show"),
);
export type AppointmentStatus = Infer<typeof appointmentStatusValidator>;

export const paymentStatusValidator = v.union(
  v.literal("none"),
  v.literal("deposit_pending"),
  v.literal("deposit_paid"),
  v.literal("partial"),
  v.literal("paid"),
  v.literal("refunded"),
);

export const paymentMethodValidator = v.union(
  v.literal("pix"),
  v.literal("cash"),
  v.literal("credit_card"),
  v.literal("debit_card"),
  v.literal("transfer"),
  v.literal("gift_card"),
  v.literal("other"),
);

export const invoiceStatusValidator = v.union(
  v.literal("draft"),
  v.literal("issued"),
  v.literal("partial"),
  v.literal("paid"),
  v.literal("overdue"),
  v.literal("cancelled"),
  v.literal("refunded"),
);

export const addressValidator = v.object({
  cep: v.optional(v.string()),
  logradouro: v.optional(v.string()),
  numero: v.optional(v.string()),
  complemento: v.optional(v.string()),
  bairro: v.optional(v.string()),
  cidade: v.optional(v.string()),
  estado: v.optional(v.string()),
});

export const lineItemValidator = v.object({
  kind: v.union(
    v.literal("service"),
    v.literal("product"),
    v.literal("labor"),
    v.literal("package"),
  ),
  refId: v.optional(v.string()),
  name: v.string(),
  quantity: v.number(),
  unitPrice: v.number(), // centavos
  total: v.number(), // centavos
});

export const openHourValidator = v.object({
  weekday: v.number(), // 0 = domingo ... 6 = sábado
  closed: v.boolean(),
  open: v.string(), // "HH:MM"
  close: v.string(), // "HH:MM"
});

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // do not remove
      isAnonymous: v.optional(v.boolean()), // do not remove
      role: v.optional(roleValidator), // do not remove
    }).index("email", ["email"]),

    // -----------------------------------------------------------------------
    // Tenancy
    // -----------------------------------------------------------------------
    organizations: defineTable({
      name: v.string(),
      legalName: v.optional(v.string()),
      document: v.optional(v.string()), // CNPJ / CPF
      ownerName: v.optional(v.string()),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      whatsapp: v.optional(v.string()),
      address: v.optional(addressValidator),
      logoUrl: v.optional(v.string()),
      businessType: v.optional(v.string()),
      currency: v.string(), // "BRL"
      timezone: v.string(),
      weekStart: v.number(), // 0 = domingo
      openHours: v.array(openHourValidator),
      cancellationPolicy: v.optional(v.string()),
      cancellationHours: v.optional(v.number()),
      depositPolicy: v.optional(v.string()),
      defaultDepositPct: v.optional(v.number()),
      bufferMinutes: v.optional(v.number()),
      minNoticeHours: v.optional(v.number()),
      onlineBookingLeadHours: v.optional(v.number()),
      commissionBaseDefault: v.optional(
        v.union(
          v.literal("gross"),
          v.literal("net_discount"),
          v.literal("collected"),
        ),
      ),
      taxPct: v.optional(v.number()),
      brandAccent: v.optional(v.string()),
      brandTheme: v.optional(v.string()),
      paymentMethods: v.array(v.string()),
      expenseCategories: v.array(v.string()),
      publicBookingSlug: v.optional(v.string()),
      publicBookingEnabled: v.optional(v.boolean()),
      requireApprovalOnline: v.optional(v.boolean()),
      loyaltySettings: v.optional(
        v.object({
          enabled: v.boolean(),
          pointsPerReal: v.number(),
          pointsPerVisit: v.number(),
          referralPoints: v.number(),
          birthdayPoints: v.number(),
          tiers: v.array(
            v.object({ name: v.string(), minPoints: v.number() }),
          ),
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
      onboardingComplete: v.boolean(),
      isDemo: v.boolean(),
      createdAt: v.number(),
      createdBy: v.id("users"),
    })
      .index("by_slug", ["publicBookingSlug"])
      .index("by_demo", ["isDemo"]),

    organizationMembers: defineTable({
      orgId: v.id("organizations"),
      userId: v.id("users"),
      name: v.string(),
      email: v.optional(v.string()),
      role: orgRoleValidator,
      extraPermissions: v.array(v.string()),
      active: v.boolean(),
      createdAt: v.number(),
    })
      .index("by_org", ["orgId"])
      .index("by_user", ["userId"])
      .index("by_org_user", ["orgId", "userId"]),

    featureFlags: defineTable({
      orgId: v.id("organizations"),
      key: v.string(),
      enabled: v.boolean(),
    }).index("by_org", ["orgId", "key"]),

    auditLogs: defineTable({
      orgId: v.id("organizations"),
      userId: v.optional(v.id("users")),
      userName: v.string(),
      action: v.string(),
      entity: v.string(),
      entityId: v.optional(v.string()),
      details: v.optional(v.string()),
      at: v.number(),
    }).index("by_org", ["orgId", "at"]),

    notifications: defineTable({
      orgId: v.id("organizations"),
      title: v.string(),
      body: v.string(),
      type: v.string(),
      read: v.boolean(),
      link: v.optional(v.string()),
      at: v.number(),
    }).index("by_org", ["orgId", "read", "at"]),

    // -----------------------------------------------------------------------
    // CRM
    // -----------------------------------------------------------------------
    clients: defineTable({
      orgId: v.id("organizations"),
      name: v.string(),
      socialName: v.optional(v.string()),
      phone: v.string(),
      whatsapp: v.optional(v.string()),
      email: v.optional(v.string()),
      document: v.optional(v.string()),
      birthday: v.optional(v.string()), // "MM-DD" or "YYYY-MM-DD"
      address: v.optional(addressValidator),
      preferredContact: v.optional(v.string()),
      referralSource: v.optional(v.string()),
      tags: v.array(v.string()),
      status: v.string(), // ativo | inativo | vip | bloqueado
      preferences: v.optional(v.string()),
      notes: v.optional(v.string()),
      isDemo: v.boolean(),
      active: v.boolean(),
      createdAt: v.number(),
      createdBy: v.optional(v.id("users")),
    })
      .index("by_org", ["orgId"])
      .index("by_org_name", ["orgId", "name"])
      .index("by_org_phone", ["orgId", "phone"]),

    clientReferrals: defineTable({
      orgId: v.id("organizations"),
      referrerClientId: v.id("clients"),
      referredClientId: v.id("clients"),
      rewardGiven: v.boolean(),
      createdAt: v.number(),
    }).index("by_org", ["orgId"]),

    // -----------------------------------------------------------------------
    // Team
    // -----------------------------------------------------------------------
    staff: defineTable({
      orgId: v.id("organizations"),
      userId: v.optional(v.id("users")),
      name: v.string(),
      phone: v.optional(v.string()),
      email: v.optional(v.string()),
      role: v.string(),
      employmentType: v.string(), // clt | autonoma | socio
      startDate: v.optional(v.string()),
      active: v.boolean(),
      workingDays: v.array(v.number()),
      workStart: v.string(),
      workEnd: v.string(),
      breakStart: v.optional(v.string()),
      breakEnd: v.optional(v.string()),
      daysOff: v.array(v.string()),
      serviceIds: v.array(v.id("services")),
      commissionPct: v.number(),
      hourlyRate: v.optional(v.number()),
      fixedSalary: v.optional(v.number()),
      color: v.string(),
      notes: v.optional(v.string()),
      isDemo: v.boolean(),
      createdAt: v.number(),
    }).index("by_org", ["orgId"]),

    staffAvailability: defineTable({
      orgId: v.id("organizations"),
      staffId: v.id("staff"),
      weekday: v.number(),
      start: v.string(),
      end: v.string(),
      breakStart: v.optional(v.string()),
      breakEnd: v.optional(v.string()),
      active: v.boolean(),
    })
      .index("by_org", ["orgId"])
      .index("by_staff", ["staffId"]),

    staffBlocks: defineTable({
      orgId: v.id("organizations"),
      staffId: v.id("staff"),
      date: v.string(), // YYYY-MM-DD
      startMinutes: v.number(),
      endMinutes: v.number(),
      reason: v.string(),
    })
      .index("by_org", ["orgId"])
      .index("by_staff_date", ["staffId", "date"]),

    // -----------------------------------------------------------------------
    // Catalog
    // -----------------------------------------------------------------------
    serviceCategories: defineTable({
      orgId: v.id("organizations"),
      name: v.string(),
      color: v.string(),
      active: v.boolean(),
    }).index("by_org", ["orgId"]),

    services: defineTable({
      orgId: v.id("organizations"),
      name: v.string(),
      categoryId: v.optional(v.id("serviceCategories")),
      description: v.optional(v.string()),
      price: v.number(), // centavos
      durationMin: v.number(),
      bufferMin: v.number(),
      materialCost: v.number(),
      laborCost: v.number(),
      depositType: v.string(), // none | fixed | percent
      depositValue: v.number(),
      commissionPct: v.optional(v.number()),
      warrantyNotes: v.optional(v.string()),
      requiredResource: v.optional(v.string()),
      eligibleStaff: v.array(v.id("staff")),
      active: v.boolean(),
      isDemo: v.boolean(),
      createdAt: v.number(),
    }).index("by_org", ["orgId"]),

    servicePackages: defineTable({
      orgId: v.id("organizations"),
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
      individualValue: v.number(),
      packagePrice: v.number(),
      validityDays: v.number(),
      restrictions: v.optional(v.string()),
      active: v.boolean(),
      createdAt: v.number(),
    }).index("by_org", ["orgId"]),

    // -----------------------------------------------------------------------
    // Scheduling
    // -----------------------------------------------------------------------
    appointments: defineTable({
      orgId: v.id("organizations"),
      clientId: v.id("clients"),
      staffId: v.id("staff"),
      date: v.string(), // YYYY-MM-DD
      startMinutes: v.number(),
      endMinutes: v.number(),
      durationMin: v.number(),
      bufferMin: v.number(),
      items: v.array(lineItemValidator),
      totalPrice: v.number(),
      discount: v.number(),
      depositRequired: v.number(),
      status: appointmentStatusValidator,
      paymentStatus: paymentStatusValidator,
      source: v.string(), // interno | cliente | online | rebook
      notes: v.optional(v.string()),
      packageId: v.optional(v.id("servicePackages")),
      quoteId: v.optional(v.id("quotes")),
      rescheduledFrom: v.optional(v.string()),
      cancellationReason: v.optional(v.string()),
      createdBy: v.optional(v.id("users")),
      createdAt: v.number(),
      completedAt: v.optional(v.number()),
      isDemo: v.boolean(),
    })
      .index("by_org_date", ["orgId", "date"])
      .index("by_org_staff_date", ["orgId", "staffId", "date"])
      .index("by_client", ["clientId"])
      .index("by_org_status", ["orgId", "status"])
      .index("by_org_completed", ["orgId", "completedAt"]),

    appointmentStatusHistory: defineTable({
      orgId: v.id("organizations"),
      appointmentId: v.id("appointments"),
      from: v.string(),
      to: v.string(),
      at: v.number(),
      by: v.optional(v.id("users")),
      note: v.optional(v.string()),
    }).index("by_appointment", ["appointmentId"]),

    waitlistEntries: defineTable({
      orgId: v.id("organizations"),
      clientId: v.id("clients"),
      serviceId: v.optional(v.id("services")),
      staffId: v.optional(v.id("staff")),
      preferredDates: v.array(v.string()),
      timeFrom: v.string(),
      timeTo: v.string(),
      priority: v.string(), // baixa | media | alta
      contact: v.optional(v.string()),
      status: v.string(), // aguardando | contatado | agendado | cancelado | expirado
      notes: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_org", ["orgId", "status"]),

    // -----------------------------------------------------------------------
    // Clinical / treatment
    // -----------------------------------------------------------------------
    treatmentRecords: defineTable({
      orgId: v.id("organizations"),
      clientId: v.id("clients"),
      appointmentId: v.optional(v.id("appointments")),
      serviceId: v.optional(v.id("services")),
      serviceName: v.string(),
      staffId: v.optional(v.id("staff")),
      date: v.string(),
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
      nextVisitDate: v.optional(v.string()),
      sensitive: v.boolean(),
      isDemo: v.boolean(),
      createdAt: v.number(),
      createdBy: v.optional(v.id("users")),
    })
      .index("by_org", ["orgId"])
      .index("by_client", ["clientId", "date"]),

    consultationForms: defineTable({
      orgId: v.id("organizations"),
      name: v.string(),
      purpose: v.string(),
      version: v.number(),
      sensitive: v.boolean(),
      fields: v.array(
        v.object({
          key: v.string(),
          label: v.string(),
          type: v.string(), // text | textarea | select | boolean | number
          options: v.array(v.string()),
          required: v.boolean(),
        }),
      ),
      active: v.boolean(),
      createdAt: v.number(),
    }).index("by_org", ["orgId"]),

    consultationResponses: defineTable({
      orgId: v.id("organizations"),
      clientId: v.id("clients"),
      formId: v.id("consultationForms"),
      formName: v.string(),
      formVersion: v.number(),
      appointmentId: v.optional(v.id("appointments")),
      answers: v.array(v.object({ key: v.string(), label: v.string(), value: v.string() })),
      date: v.string(),
      staffId: v.optional(v.id("staff")),
      acknowledgedBy: v.string(),
      createdAt: v.number(),
    })
      .index("by_org", ["orgId"])
      .index("by_client", ["clientId", "date"]),

    consentRecords: defineTable({
      orgId: v.id("organizations"),
      clientId: v.id("clients"),
      appointmentId: v.optional(v.id("appointments")),
      type: v.string(), // tratamento | imagem_interna | imagem_publica | privacidade
      granted: v.boolean(),
      date: v.string(),
      staffId: v.optional(v.id("staff")),
      notes: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_org", ["orgId"])
      .index("by_client", ["clientId", "type"]),

    clientPhotos: defineTable({
      orgId: v.id("organizations"),
      clientId: v.id("clients"),
      appointmentId: v.optional(v.id("appointments")),
      serviceId: v.optional(v.id("services")),
      treatmentRecordId: v.optional(v.id("treatmentRecords")),
      kind: v.string(), // antes | depois
      storageId: v.optional(v.id("_storage")),
      url: v.optional(v.string()),
      notes: v.optional(v.string()),
      captureDate: v.string(),
      staffId: v.optional(v.id("staff")),
      consentInternal: v.boolean(),
      consentPublic: v.boolean(),
      isDemo: v.boolean(),
      createdAt: v.number(),
    })
      .index("by_org", ["orgId"])
      .index("by_client", ["clientId", "captureDate"]),

    aftercareTemplates: defineTable({
      orgId: v.id("organizations"),
      serviceId: v.optional(v.id("services")),
      name: v.string(),
      text: v.string(),
      active: v.boolean(),
    }).index("by_org", ["orgId"]),

    // -----------------------------------------------------------------------
    // Quotes / billing
    // -----------------------------------------------------------------------
    quotes: defineTable({
      orgId: v.id("organizations"),
      number: v.string(),
      clientId: v.id("clients"),
      items: v.array(lineItemValidator),
      subtotal: v.number(),
      discount: v.number(),
      total: v.number(),
      validUntil: v.string(),
      staffId: v.optional(v.id("staff")),
      notes: v.optional(v.string()),
      status: v.string(), // rascunho | enviado | aguardando | aprovado | recusado | expirado | convertido
      createdAt: v.number(),
      createdBy: v.optional(v.id("users")),
    })
      .index("by_org", ["orgId", "status"])
      .index("by_client", ["clientId"]),

    invoices: defineTable({
      orgId: v.id("organizations"),
      number: v.string(),
      clientId: v.id("clients"),
      appointmentId: v.optional(v.id("appointments")),
      quoteId: v.optional(v.id("quotes")),
      items: v.array(lineItemValidator),
      subtotal: v.number(),
      discount: v.number(),
      tax: v.number(),
      total: v.number(),
      depositApplied: v.number(),
      status: invoiceStatusValidator,
      issueDate: v.string(),
      dueDate: v.optional(v.string()),
      notes: v.optional(v.string()),
      locked: v.boolean(),
      isDemo: v.boolean(),
      createdAt: v.number(),
      createdBy: v.optional(v.id("users")),
    })
      .index("by_org", ["orgId", "issueDate"])
      .index("by_org_status", ["orgId", "status"])
      .index("by_client", ["clientId", "issueDate"]),

    payments: defineTable({
      orgId: v.id("organizations"),
      clientId: v.id("clients"),
      invoiceId: v.optional(v.id("invoices")),
      appointmentId: v.optional(v.id("appointments")),
      amount: v.number(),
      method: paymentMethodValidator,
      kind: v.string(), // pagamento | sinal | reembolso
      date: v.string(),
      reference: v.optional(v.string()),
      accountId: v.optional(v.id("financialAccounts")),
      giftCardId: v.optional(v.id("giftCards")),
      notes: v.optional(v.string()),
      isDemo: v.boolean(),
      createdAt: v.number(),
      createdBy: v.optional(v.id("users")),
    })
      .index("by_org", ["orgId", "date"])
      .index("by_invoice", ["invoiceId"])
      .index("by_client", ["clientId", "date"])
      .index("by_appointment", ["appointmentId"]),

    paymentAllocations: defineTable({
      orgId: v.id("organizations"),
      paymentId: v.id("payments"),
      invoiceId: v.id("invoices"),
      appointmentId: v.optional(v.id("appointments")),
      amount: v.number(),
      kind: v.string(), // sinal | pagamento
      createdAt: v.number(),
    })
      .index("by_org", ["orgId"])
      .index("by_invoice", ["invoiceId"])
      .index("by_payment", ["paymentId"]),

    financialAccounts: defineTable({
      orgId: v.id("organizations"),
      name: v.string(),
      type: v.string(), // caixa | banco | cartao | outro
      openingBalance: v.number(),
      active: v.boolean(),
    }).index("by_org", ["orgId"]),

    expenses: defineTable({
      orgId: v.id("organizations"),
      category: v.string(),
      description: v.string(),
      supplierId: v.optional(v.id("suppliers")),
      amount: v.number(),
      date: v.string(),
      dueDate: v.optional(v.string()),
      paymentDate: v.optional(v.string()),
      status: v.string(), // pendente | pago
      method: v.optional(paymentMethodValidator),
      accountId: v.optional(v.id("financialAccounts")),
      recurring: v.boolean(),
      attachmentUrl: v.optional(v.string()),
      notes: v.optional(v.string()),
      isDemo: v.boolean(),
      createdAt: v.number(),
    })
      .index("by_org", ["orgId", "date"])
      .index("by_org_status", ["orgId", "status"]),

    // -----------------------------------------------------------------------
    // Inventory
    // -----------------------------------------------------------------------
    suppliers: defineTable({
      orgId: v.id("organizations"),
      name: v.string(),
      contact: v.optional(v.string()),
      phone: v.optional(v.string()),
      email: v.optional(v.string()),
      document: v.optional(v.string()),
      notes: v.optional(v.string()),
      active: v.boolean(),
    }).index("by_org", ["orgId"]),

    productCategories: defineTable({
      orgId: v.id("organizations"),
      name: v.string(),
      active: v.boolean(),
    }).index("by_org", ["orgId"]),

    products: defineTable({
      orgId: v.id("organizations"),
      name: v.string(),
      brand: v.optional(v.string()),
      categoryId: v.optional(v.id("productCategories")),
      sku: v.string(),
      barcode: v.optional(v.string()),
      supplierId: v.optional(v.id("suppliers")),
      cost: v.number(),
      price: v.number(),
      quantity: v.number(),
      minStock: v.number(),
      reorderQty: v.number(),
      expirationDate: v.optional(v.string()),
      location: v.optional(v.string()),
      type: v.string(), // varejo | profissional
      active: v.boolean(),
      isDemo: v.boolean(),
      createdAt: v.number(),
    }).index("by_org", ["orgId"]),

    inventoryMovements: defineTable({
      orgId: v.id("organizations"),
      productId: v.id("products"),
      type: v.string(), // entrada | saida | ajuste | venda | consumo | perda | devolucao
      quantity: v.number(), // signed delta
      balanceAfter: v.number(),
      unitCost: v.number(),
      reason: v.optional(v.string()),
      appointmentId: v.optional(v.id("appointments")),
      staffId: v.optional(v.id("staff")),
      invoiceId: v.optional(v.id("invoices")),
      supplierId: v.optional(v.id("suppliers")),
      date: v.string(),
      notes: v.optional(v.string()),
      reversedBy: v.optional(v.id("inventoryMovements")),
      isDemo: v.boolean(),
      createdAt: v.number(),
      createdBy: v.optional(v.id("users")),
    })
      .index("by_org", ["orgId", "date"])
      .index("by_product", ["productId", "date"]),

    serviceConsumptionRules: defineTable({
      orgId: v.id("organizations"),
      serviceId: v.id("services"),
      productId: v.id("products"),
      quantity: v.number(),
    })
      .index("by_org", ["orgId"])
      .index("by_service", ["serviceId"]),

    serviceConsumptionRecords: defineTable({
      orgId: v.id("organizations"),
      appointmentId: v.id("appointments"),
      serviceId: v.id("services"),
      productId: v.id("products"),
      quantity: v.number(),
      unitCost: v.number(),
      movementId: v.id("inventoryMovements"),
      date: v.string(),
      createdAt: v.number(),
    })
      .index("by_org", ["orgId"])
      .index("by_appointment", ["appointmentId"]),

    // -----------------------------------------------------------------------
    // Commissions
    // -----------------------------------------------------------------------
    commissionRules: defineTable({
      orgId: v.id("organizations"),
      name: v.string(),
      scope: v.string(), // global | service | staff | product
      serviceId: v.optional(v.id("services")),
      staffId: v.optional(v.id("staff")),
      type: v.string(), // percent | fixed
      basis: v.string(), // gross | net_discount | collected
      value: v.number(),
      active: v.boolean(),
      createdAt: v.number(),
    }).index("by_org", ["orgId"]),

    commissions: defineTable({
      orgId: v.id("organizations"),
      staffId: v.id("staff"),
      appointmentId: v.optional(v.id("appointments")),
      invoiceId: v.optional(v.id("invoices")),
      kind: v.string(), // servico | produto | gorjeta
      baseAmount: v.number(),
      ruleLabel: v.string(),
      amount: v.number(),
      status: v.string(), // estimada | ganha | paga
      date: v.string(),
      statementId: v.optional(v.id("commissionStatements")),
      isDemo: v.boolean(),
      createdAt: v.number(),
    })
      .index("by_org", ["orgId", "date"])
      .index("by_staff", ["staffId", "date"])
      .index("by_org_status", ["orgId", "status"]),

    commissionStatements: defineTable({
      orgId: v.id("organizations"),
      staffId: v.id("staff"),
      periodStart: v.string(),
      periodEnd: v.string(),
      totalEarned: v.number(),
      totalPaid: v.number(),
      status: v.string(), // aberto | pago
      paidDate: v.optional(v.string()),
      notes: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_org", ["orgId"]),

    // -----------------------------------------------------------------------
    // Relationship / retention
    // -----------------------------------------------------------------------
    giftCards: defineTable({
      orgId: v.id("organizations"),
      code: v.string(),
      purchaseDate: v.string(),
      purchaserName: v.string(),
      recipientName: v.optional(v.string()),
      clientId: v.optional(v.id("clients")),
      initialValue: v.number(),
      balance: v.number(),
      expirationDate: v.optional(v.string()),
      status: v.string(), // ativo | esgotado | expirado | cancelado
      notes: v.optional(v.string()),
      isDemo: v.boolean(),
      createdAt: v.number(),
    }).index("by_org", ["orgId", "code"]),

    giftCardTransactions: defineTable({
      orgId: v.id("organizations"),
      giftCardId: v.id("giftCards"),
      type: v.string(), // emissao | resgate | estorno
      amount: v.number(),
      date: v.string(),
      invoiceId: v.optional(v.id("invoices")),
      appointmentId: v.optional(v.id("appointments")),
      notes: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_org", ["orgId"])
      .index("by_card", ["giftCardId", "date"]),

    loyaltyAccounts: defineTable({
      orgId: v.id("organizations"),
      clientId: v.id("clients"),
      points: v.number(),
      tier: v.string(),
      updatedAt: v.number(),
    })
      .index("by_org", ["orgId"])
      .index("by_client", ["clientId"]),

    loyaltyTransactions: defineTable({
      orgId: v.id("organizations"),
      clientId: v.id("clients"),
      points: v.number(), // signed
      reason: v.string(),
      refType: v.optional(v.string()),
      refId: v.optional(v.string()),
      date: v.string(),
      balanceAfter: v.number(),
      isDemo: v.boolean(),
      createdAt: v.number(),
    })
      .index("by_org", ["orgId", "date"])
      .index("by_client", ["clientId", "date"]),

    marketingCampaigns: defineTable({
      orgId: v.id("organizations"),
      name: v.string(),
      type: v.string(),
      audience: v.string(),
      channel: v.string(),
      startDate: v.string(),
      endDate: v.string(),
      offer: v.optional(v.string()),
      budget: v.number(),
      status: v.string(), // planejada | ativa | concluida | cancelada
      goal: v.optional(v.string()),
      results: v.optional(v.string()),
      notes: v.optional(v.string()),
      isDemo: v.boolean(),
      createdAt: v.number(),
    }).index("by_org", ["orgId", "status"]),

    followUpTasks: defineTable({
      orgId: v.id("organizations"),
      clientId: v.id("clients"),
      type: v.string(), // reagendamento | aniversario | pos_atendimento | retorno | oferta
      dueDate: v.string(),
      status: v.string(), // pendente | concluida | cancelada
      notes: v.optional(v.string()),
      assignedTo: v.optional(v.id("staff")),
      createdAt: v.number(),
    }).index("by_org", ["orgId", "status", "dueDate"]),

    // -----------------------------------------------------------------------
    // SaaS packaging
    // -----------------------------------------------------------------------
    plans: defineTable({
      slug: v.string(),
      name: v.string(),
      priceMonthly: v.number(),
      features: v.array(v.string()),
      limits: v.object({
        users: v.number(),
        appointmentsPerMonth: v.number(),
        locations: v.number(),
      }),
      active: v.boolean(),
    }).index("by_slug", ["slug"]),

    subscriptions: defineTable({
      orgId: v.id("organizations"),
      planSlug: v.string(),
      status: v.string(), // trial | ativa | suspensa | cancelada
      trialEndsAt: v.optional(v.number()),
      startedAt: v.number(),
      currentPeriodEnd: v.optional(v.number()),
    }).index("by_org", ["orgId"]),

    usageRecords: defineTable({
      orgId: v.id("organizations"),
      period: v.string(), // YYYY-MM
      metric: v.string(),
      value: v.number(),
    }).index("by_org", ["orgId", "period", "metric"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
