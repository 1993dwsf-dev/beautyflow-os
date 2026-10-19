import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  AppError,
  ERR,
  addDaysISO,
  getUserId,
  logAudit,
  requireMember,
  sum,
  toMinutes,
  todayInTz,
} from "./lib/helpers";
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_PAYMENT_METHODS } from "./orgs";
import { DEFAULT_CATEGORIES } from "./services";
import { DEFAULT_FEATURE_FLAGS, FEATURE_FLAGS, type FeatureKey } from "./lib/permissions";

const DEMO_TAG = "[DEMONSTRAÇÃO]";

const STAFF_SEED = [
  { name: "Camila Duarte", role: "Cabeleireira", commissionPct: 40, color: "#0ea5a4", employmentType: "clt" },
  { name: "Larissa Prado", role: "Nail designer", commissionPct: 45, color: "#ec4899", employmentType: "autonoma" },
  { name: "Renata Alves", role: "Lash designer", commissionPct: 50, color: "#6366f1", employmentType: "autonoma" },
  { name: "Bruno Teixeira", role: "Barbeiro", commissionPct: 40, color: "#f97316", employmentType: "clt" },
];

const SERVICE_SEED = [
  { name: "Corte feminino", category: "Cabelo", price: 12000, duration: 60, cost: 800, labor: 2500 },
  { name: "Coloração completa", category: "Cabelo", price: 32000, duration: 150, cost: 6500, labor: 7000 },
  { name: "Escova modeladora", category: "Cabelo", price: 8000, duration: 45, cost: 600, labor: 1500 },
  { name: "Hidratação profunda", category: "Cabelo", price: 15000, duration: 60, cost: 2200, labor: 2500 },
  { name: "Alongamento de unhas", category: "Unhas", price: 20000, duration: 120, cost: 3000, labor: 4000 },
  { name: "Manutenção de unhas", category: "Unhas", price: 14000, duration: 90, cost: 1800, labor: 3000 },
  { name: "Extensão de cílios volume russo", category: "Cílios", price: 25000, duration: 120, cost: 3500, labor: 5000 },
  { name: "Design de sobrancelhas", category: "Sobrancelhas", price: 7000, duration: 30, cost: 400, labor: 1200 },
  { name: "Limpeza de pele profunda", category: "Cuidados com a pele", price: 22000, duration: 75, cost: 3200, labor: 4000 },
  { name: "Massagem relaxante 60min", category: "Massagem", price: 18000, duration: 60, cost: 900, labor: 3500 },
  { name: "Maquiagem social", category: "Maquiagem", price: 25000, duration: 75, cost: 2500, labor: 4500 },
  { name: "Corte masculino", category: "Barbearia", price: 6000, duration: 30, cost: 300, labor: 1200 },
];

const CLIENT_SEED = [
  ["Ana Beatriz Moreira", "11987650001", "1990-03-14"],
  ["Juliana Ramos", "11987650002", "1985-07-22"],
  ["Patrícia Nogueira", "11987650003", "1993-11-02"],
  ["Fernanda Lima", "11987650004", "1988-01-19"],
  ["Camila Ribeiro", "11987650005", "1996-05-30"],
  ["Mariana Costa", "11987650006", "1991-09-08"],
  ["Rafaela Souza", "11987650007", "1987-12-11"],
  ["Beatriz Araújo", "11987650008", "1999-04-25"],
  ["Carla Menezes", "11987650009", "1982-08-17"],
  ["Débora Pinheiro", "11987650010", "1994-02-06"],
  ["Eduarda Farias", "11987650011", "1997-06-21"],
  ["Gabriela Antunes", "11987650012", "1990-10-30"],
  ["Helena Barros", "11987650013", "1986-03-04"],
  ["Isabela Rocha", "11987650014", "2000-07-13"],
  ["Joana Freitas", "11987650015", "1989-11-27"],
  ["Larissa Campos", "11987650016", "1992-01-09"],
  ["Marcela Dias", "11987650017", "1984-05-15"],
  ["Natália Vieira", "11987650018", "1995-09-23"],
  ["Olívia Martins", "11987650019", "1998-12-08"],
  ["Paula Gonçalves", "11987650020", "1983-04-18"],
];

const EXPENSE_SEED = [
  ["Aluguel", "Aluguel do espaço", 450000, true],
  ["Produtos e insumos", "Compra de coloração e oxidantes", 128000, false],
  ["Energia elétrica", "Conta de energia", 42000, true],
  ["Internet", "Internet fibra 500MB", 12990, true],
  ["Marketing", "Impulsionamento Instagram", 30000, false],
  ["Limpeza", "Materiais de limpeza", 18500, false],
  ["Treinamento", "Curso de lash extension", 60000, false],
  ["Software", "Assinatura BeautyFlow OS", 19900, true],
];

const PRODUCT_SEED = [
  ["Coloração 7.1 Louro Acinzentado", "ColorPro", "COL-71", 2800, 8900, "profissional", 12, 4, 8],
  ["Oxidante 20 vol", "ColorPro", "OXI-20", 1500, 3900, "profissional", 6, 4, 10],
  ["Esmalte gel base coat", "NailArt", "GEL-BASE", 3200, 7900, "profissional", 8, 3, 6],
  ["Cola para cílios 0.5s", "LashPro", "LASH-05", 4500, 0, "profissional", 3, 2, 6],
  ["Shampoo profissional 1L", "HairCare", "SHA-1L", 3800, 9900, "varejo", 10, 3, 6],
  ["Máscara de hidratação 500g", "HairCare", "MASK-500", 4200, 12900, "varejo", 9, 3, 6],
  ["Acetona 500ml", "NailArt", "ACE-500", 1200, 0, "profissional", 14, 4, 8],
  ["Sérum vitamina C 30ml", "DermaFlow", "SER-VITC", 5600, 16900, "varejo", 7, 2, 4],
  ["Máscara facial de argila", "DermaFlow", "CLAY-01", 2400, 6900, "varejo", 5, 2, 4],
  ["Pomada modeladora", "BarberStrong", "POM-01", 1800, 4900, "varejo", 15, 4, 8],
];

const SERVICE_TO_PRODUCT: [string, string, number][] = [
  ["Coloração completa", "Coloração 7.1 Louro Acinzentado", 2],
  ["Coloração completa", "Oxidante 20 vol", 2],
  ["Alongamento de unhas", "Esmalte gel base coat", 1],
  ["Manutenção de unhas", "Esmalte gel base coat", 1],
  ["Extensão de cílios volume russo", "Cola para cílios 0.5s", 1],
  ["Corte feminino", "Shampoo profissional 1L", 1],
  ["Hidratação profunda", "Máscara de hidratação 500g", 1],
];

/** Creates the sample studio plus its full reference configuration. */
export const createDemoWorkspace = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new AppError("UNAUTHENTICATED", "Você precisa entrar na sua conta para continuar.");
    const user = await ctx.db.get(userId);
    const today = todayInTz();

    const orgId = await ctx.db.insert("organizations", {
      name: `Studio Lumière ${DEMO_TAG}`,
      ownerName: user?.name ?? "Demonstração",
      email: user?.email,
      phone: "(11) 4002-8922",
      whatsapp: "(11) 99876-5432",
      address: {
        cep: "01310-100",
        logradouro: "Avenida Paulista",
        numero: "1500",
        complemento: "Sala 82",
        bairro: "Bela Vista",
        cidade: "São Paulo",
        estado: "SP",
      },
      businessType: "Salão de beleza e estúdio de estética",
      currency: "BRL",
      timezone: "America/Sao_Paulo",
      weekStart: 1,
      openHours: [
        { weekday: 0, closed: true, open: "09:00", close: "18:00" },
        { weekday: 1, closed: false, open: "09:00", close: "19:00" },
        { weekday: 2, closed: false, open: "09:00", close: "19:00" },
        { weekday: 3, closed: false, open: "09:00", close: "20:00" },
        { weekday: 4, closed: false, open: "09:00", close: "20:00" },
        { weekday: 5, closed: false, open: "09:00", close: "20:00" },
        { weekday: 6, closed: false, open: "08:00", close: "17:00" },
      ],
      cancellationPolicy:
        "Cancelamentos com menos de 24 horas de antecedência podem gerar cobrança de 30% do serviço.",
      cancellationHours: 24,
      depositPolicy: "Sinal de 30% para serviços acima de R$ 250,00.",
      defaultDepositPct: 30,
      bufferMinutes: 10,
      minNoticeHours: 2,
      onlineBookingLeadHours: 24,
      commissionBaseDefault: "net_discount",
      taxPct: 0,
      brandAccent: "#0ea5a4",
      brandTheme: "claro",
      paymentMethods: DEFAULT_PAYMENT_METHODS,
      expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
      publicBookingSlug: "studio-lumiere-demo",
      publicBookingEnabled: true,
      requireApprovalOnline: false,
      loyaltySettings: {
        enabled: true,
        pointsPerReal: 1,
        pointsPerVisit: 10,
        referralPoints: 100,
        birthdayPoints: 50,
        tiers: [
          { name: "Bronze", minPoints: 0 },
          { name: "Prata", minPoints: 500 },
          { name: "Ouro", minPoints: 1500 },
        ],
        rewards: [
          { name: "R$ 20 de desconto", pointsCost: 200, type: "desconto", value: 2000 },
          { name: "Escova gratuita", pointsCost: 500, type: "servico", value: 0 },
          { name: "Hidratação com 50% off", pointsCost: 800, type: "desconto", value: 7500 },
        ],
      },
      onboardingComplete: true,
      isDemo: true,
      createdAt: Date.now(),
      createdBy: userId,
    });

    await ctx.db.insert("organizationMembers", {
      orgId,
      userId,
      name: user?.name ?? "Você",
      email: user?.email,
      role: "owner",
      extraPermissions: [],
      active: true,
      createdAt: Date.now(),
    });

    for (const flag of FEATURE_FLAGS) {
      await ctx.db.insert("featureFlags", {
        orgId,
        key: flag.key,
        enabled: DEFAULT_FEATURE_FLAGS[flag.key as FeatureKey],
      });
    }

    const accountId = await ctx.db.insert("financialAccounts", {
      orgId,
      name: "Caixa principal",
      type: "caixa",
      openingBalance: 500000,
      active: true,
    });
    await ctx.db.insert("financialAccounts", {
      orgId,
      name: "Conta bancária — Banco Azul",
      type: "banco",
      openingBalance: 2500000,
      active: true,
    });

    // categories
    const categoryIds = new Map<string, Id<"serviceCategories">>();
    for (const c of DEFAULT_CATEGORIES) {
      const id = await ctx.db.insert("serviceCategories", {
        orgId,
        name: c.name,
        color: c.color,
        active: true,
      });
      categoryIds.set(c.name, id);
    }

    // staff
    const staffIds: Id<"staff">[] = [];
    for (const s of STAFF_SEED) {
      const id = await ctx.db.insert("staff", {
        orgId,
        name: s.name,
        phone: "(11) 9" + Math.floor(10000000 + Math.random() * 89999999),
        email: `${s.name.split(" ")[0].toLowerCase()}@studiolumiere.demo`,
        role: s.role,
        employmentType: s.employmentType,
        startDate: "2023-02-01",
        active: true,
        workingDays: [1, 2, 3, 4, 5, 6],
        workStart: "09:00",
        workEnd: "19:00",
        breakStart: "13:00",
        breakEnd: "14:00",
        daysOff: [],
        serviceIds: [],
        commissionPct: s.commissionPct,
        fixedSalary: s.employmentType === "clt" ? 250000 : undefined,
        color: s.color,
        isDemo: true,
        createdAt: Date.now(),
      });
      staffIds.push(id);
      for (const weekday of [1, 2, 3, 4, 5, 6]) {
        await ctx.db.insert("staffAvailability", {
          orgId,
          staffId: id,
          weekday,
          start: "09:00",
          end: "19:00",
          breakStart: "13:00",
          breakEnd: "14:00",
          active: true,
        });
      }
    }

    // services
    const serviceIds: Id<"services">[] = [];
    const serviceByName = new Map<string, Id<"services">>();
    for (const s of SERVICE_SEED) {
      const eligible =
        s.category === "Unhas"
          ? [staffIds[1]]
          : s.category === "Cílios" || s.category === "Sobrancelhas"
            ? [staffIds[2]]
            : s.category === "Barbearia"
              ? [staffIds[3]]
              : s.category === "Massagem" || s.category === "Cuidados com a pele"
                ? [staffIds[2], staffIds[0]]
                : [staffIds[0]];
      const id = await ctx.db.insert("services", {
        orgId,
        name: s.name,
        categoryId: categoryIds.get(s.category),
        description: `${s.name} com produtos profissionais e finalização inclusa.`,
        price: s.price,
        durationMin: s.duration,
        bufferMin: 10,
        materialCost: s.cost,
        laborCost: s.labor,
        depositType: s.price >= 25000 ? "percent" : "none",
        depositValue: 30,
        commissionPct: undefined,
        requiredResource: s.category === "Massagem" ? "Sala de massagem" : undefined,
        eligibleStaff: eligible,
        active: true,
        isDemo: true,
        createdAt: Date.now(),
      });
      serviceIds.push(id);
      serviceByName.set(s.name, id);
    }
    // make sure every professional has services assigned
    for (const [index, id] of staffIds.entries()) {
      const assigned = SERVICE_SEED.filter((_, i) => i % 4 === index).map(
        (s) => serviceByName.get(s.name)!,
      );
      await ctx.db.patch(id, { serviceIds: assigned.length ? assigned : serviceIds.slice(0, 3) });
    }

    // packages
    await ctx.db.insert("servicePackages", {
      orgId,
      name: `Pacote Cuidado Completo ${DEMO_TAG}`,
      description: "Corte, hidratação e escova com validade de 90 dias.",
      items: [
        { serviceId: serviceByName.get("Corte feminino")!, name: "Corte feminino", price: 12000, quantity: 1 },
        { serviceId: serviceByName.get("Hidratação profunda")!, name: "Hidratação profunda", price: 15000, quantity: 1 },
        { serviceId: serviceByName.get("Escova modeladora")!, name: "Escova modeladora", price: 8000, quantity: 2 },
      ],
      individualValue: 43000,
      packagePrice: 34900,
      validityDays: 90,
      restrictions: "Não acumulativo com outras promoções.",
      active: true,
      createdAt: Date.now(),
    });

    // clients
    const clientIds: Id<"clients">[] = [];
    for (const [name, phone, birthday] of CLIENT_SEED) {
      const id = await ctx.db.insert("clients", {
        orgId,
        name,
        phone,
        whatsapp: phone,
        email: `${name.split(" ")[0].toLowerCase()}.${name.split(" ")[1]?.toLowerCase() ?? "cliente"}@exemplo.com`,
        birthday,
        address: {
          cep: "01310-100",
          logradouro: "Rua das Flores",
          numero: String(100 + Math.floor(Math.random() * 800)),
          bairro: "Bela Vista",
          cidade: "São Paulo",
          estado: "SP",
        },
        preferredContact: "whatsapp",
        referralSource: ["Instagram", "Indicação", "Google", "Passou na porta"][
          Math.floor(Math.random() * 4)
        ],
        tags: [
          ["VIP", "Coloração"],
          ["Cílios"],
          ["Unhas", "Fidelidade"],
          ["Barbearia"],
          ["Pele"],
        ][Math.floor(Math.random() * 5)],
        status: "ativo",
        preferences: "Prefere produtos sem sulfato. Chá de camomila no atendimento.",
        isDemo: true,
        active: true,
        createdAt: Date.now() - Math.floor(Math.random() * 400) * 86_400_000,
        createdBy: userId,
      });
      clientIds.push(id);
      await ctx.db.insert("loyaltyAccounts", {
        orgId,
        clientId: id,
        points: 0,
        tier: "Bronze",
        updatedAt: Date.now(),
      });
    }

    // products + suppliers
    const supplierId = await ctx.db.insert("suppliers", {
      orgId,
      name: `Distribuidora Bela ${DEMO_TAG}`,
      contact: "Marcos Andrade",
      phone: "(11) 3322-1100",
      email: "vendas@beladistribuidora.com.br",
      active: true,
    });
    const productIds = new Map<string, Id<"products">>();
    for (const [name, brand, sku, cost, price, type, qty, minStock, reorder] of PRODUCT_SEED) {
      const id = await ctx.db.insert("products", {
        orgId,
        name: name as string,
        brand: brand as string,
        sku: sku as string,
        supplierId,
        cost: cost as number,
        price: price as number,
        quantity: qty as number,
        minStock: minStock as number,
        reorderQty: reorder as number,
        type: type as string,
        expirationDate: addDaysISO(today, 200),
        location: "Armário A",
        active: true,
        isDemo: true,
        createdAt: Date.now(),
      });
      productIds.set(name as string, id);
      await ctx.db.insert("inventoryMovements", {
        orgId,
        productId: id,
        type: "entrada",
        quantity: qty as number,
        balanceAfter: qty as number,
        unitCost: cost as number,
        reason: "Estoque inicial de demonstração",
        supplierId,
        date: addDaysISO(today, -30),
        isDemo: true,
        createdAt: Date.now(),
        createdBy: userId,
      });
    }
    for (const [serviceName, productName, quantity] of SERVICE_TO_PRODUCT) {
      await ctx.db.insert("serviceConsumptionRules", {
        orgId,
        serviceId: serviceByName.get(serviceName)!,
        productId: productIds.get(productName)!,
        quantity,
      });
    }

    // expenses (last 3 months)
    for (let m = 0; m < 3; m++) {
      const month = addDaysISO(today, -m * 30).slice(0, 7);
      for (const [category, description, amount, recurring] of EXPENSE_SEED) {
        await ctx.db.insert("expenses", {
          orgId,
          category: category as string,
          description: `${description as string} ${DEMO_TAG}`,
          supplierId,
          amount: amount as number,
          date: `${month}-05`,
          status: m === 0 && Math.random() > 0.6 ? "pendente" : "pago",
          paymentDate: m === 0 && Math.random() > 0.6 ? undefined : `${month}-06`,
          method: "pix",
          accountId,
          recurring: recurring as boolean,
          isDemo: true,
          createdAt: Date.now(),
        });
      }
    }

    // commission rules
    await ctx.db.insert("commissionRules", {
      orgId,
      name: "Regra padrão — valor com desconto",
      scope: "global",
      type: "percent",
      basis: "net_discount",
      value: 40,
      active: true,
      createdAt: Date.now(),
    });
    await ctx.db.insert("commissionRules", {
      orgId,
      name: "Comissão de produtos (10%)",
      scope: "product",
      type: "percent",
      basis: "net_discount",
      value: 10,
      active: true,
      createdAt: Date.now(),
    });

    // gift cards
    await ctx.db.insert("giftCards", {
      orgId,
      code: "BF-DEMO-0001",
      purchaseDate: addDaysISO(today, -40),
      purchaserName: "Ana Beatriz Moreira",
      recipientName: "Juliana Ramos",
      clientId: clientIds[1],
      initialValue: 20000,
      balance: 12000,
      status: "ativo",
      expirationDate: addDaysISO(today, 300),
      notes: `Cartão-presente de demonstração ${DEMO_TAG}`,
      isDemo: true,
      createdAt: Date.now(),
    });
    await ctx.db.insert("giftCards", {
      orgId,
      code: "BF-DEMO-0002",
      purchaseDate: addDaysISO(today, -70),
      purchaserName: "Cliente esgotada",
      clientId: clientIds[3],
      initialValue: 15000,
      balance: 0,
      status: "esgotado",
      isDemo: true,
      createdAt: Date.now(),
    });

    // campaigns
    await ctx.db.insert("marketingCampaigns", {
      orgId,
      name: `Semana da beleza ${DEMO_TAG}`,
      type: "desconto",
      audience: "Clientes com mais de 60 dias sem visita",
      channel: "WhatsApp",
      startDate: addDaysISO(today, -10),
      endDate: addDaysISO(today, 10),
      offer: "20% em hidratação",
      budget: 80000,
      status: "ativa",
      goal: "20 agendamentos",
      results: "11 agendamentos até agora (registro manual)",
      notes: "Mensagens enviadas manualmente pelo WhatsApp Business.",
      isDemo: true,
      createdAt: Date.now(),
    });
    await ctx.db.insert("marketingCampaigns", {
      orgId,
      name: `Aniversariantes do mês ${DEMO_TAG}`,
      type: "aniversario",
      audience: "Aniversariantes do mês",
      channel: "Instagram",
      startDate: `${today.slice(0, 7)}-01`,
      endDate: `${today.slice(0, 7)}-28`,
      offer: "Escova grátis no mês do aniversário",
      budget: 0,
      status: "planejada",
      goal: "Aumentar retorno de clientes",
      notes: "Sem integração automática de envio.",
      isDemo: true,
      createdAt: Date.now(),
    });

    // consultation form + aftercare templates
    await ctx.db.insert("consultationForms", {
      orgId,
      name: `Ficha de anamnese — coloração ${DEMO_TAG}`,
      purpose: "Registrar informações relevantes antes de procedimentos químicos.",
      version: 1,
      sensitive: true,
      fields: [
        { key: "tipo_pele", label: "Tipo de pele/couro cabeludo", type: "select", options: ["Normal", "Oleosa", "Seca", "Sensível"], required: true },
        { key: "alergias", label: "Alergias ou sensibilidades conhecidas", type: "textarea", options: [], required: true },
        { key: "contraindicacoes", label: "Contraindicações relatadas", type: "textarea", options: [], required: false },
        { key: "teste_patch", label: "Teste de mecha/patch realizado", type: "boolean", options: [], required: false },
        { key: "tratamentos_anteriores", label: "Tratamentos anteriores", type: "textarea", options: [], required: false },
      ],
      active: true,
      createdAt: Date.now(),
    });
    for (const [serviceName, text] of [
      ["Coloração completa", "Não lavar o cabelo nas primeiras 48 horas. Use produtos sem sulfato e evite piscina por 7 dias."],
      ["Extensão de cílios volume russo", "Evite molhar os cílios por 24 horas. Não use rímel à prova d'água. Faça a manutenção a cada 3 semanas."],
      ["Alongamento de unhas", "Evite impactos e use luvas em tarefas domésticas. Manutenção recomendada a cada 21 dias."],
    ] as [string, string][]) {
      await ctx.db.insert("aftercareTemplates", {
        orgId,
        serviceId: serviceByName.get(serviceName),
        name: `Cuidados pós ${serviceName}`,
        text,
        active: true,
      });
    }

    await ctx.db.insert("subscriptions", {
      orgId,
      planSlug: "estudio",
      status: "trial",
      trialEndsAt: Date.now() + 14 * 86_400_000,
      startedAt: Date.now(),
    });

    await ctx.db.insert("notifications", {
      orgId,
      title: "Espaço de demonstração criado",
      body: "Todos os registros abaixo estão marcados como demonstração e podem ser removidos a qualquer momento em Configurações › Demonstração.",
      type: "sistema",
      read: false,
      link: "/app/configuracoes",
      at: Date.now(),
    });

    await logAudit(ctx, {
      orgId,
      userId,
      userName: user?.name ?? "Sistema",
      action: "criar_demo",
      entity: "organizations",
      entityId: orgId,
      details: "Espaço de demonstração criado",
    });

    return { orgId, clientIds, staffIds, serviceIds, accountId, userId };
  },
});

/** Generates a few weeks of realistic appointment, invoice and payment history. */
export const seedDemoHistory = mutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "settings.edit");
    const org = await ctx.db.get(args.orgId);
    if (!org) throw new AppError("NOT_FOUND", ERR.NOT_FOUND);
    const today = todayInTz(org.timezone);

    const staff = await ctx.db
      .query("staff")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const services = await ctx.db
      .query("services")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const clients = await ctx.db
      .query("clients")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const products = await ctx.db
      .query("products")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const accounts = await ctx.db
      .query("financialAccounts")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    if (!staff.length || !services.length || !clients.length) {
      throw new AppError(
        "VALIDATION",
        "Crie primeiro o espaço de demonstração antes de gerar o histórico.",
      );
    }

    const random = (n: number) => Math.floor(Math.random() * n);
    let counters = 0;
    let sequences = 0;

    for (let dayOffset = -42; dayOffset <= 14; dayOffset++) {
      const date = addDaysISO(today, dayOffset);
      const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
      if (weekday === 0) continue;

      const appointmentsToday = 2 + random(4);
      for (let i = 0; i < appointmentsToday; i++) {
        const pro = staff[random(staff.length)];
        const client = clients[random(clients.length)];
        const service = services[random(services.length)];
        const startMinutes = toMinutes(["09:00", "10:30", "12:00", "14:30", "16:00", "17:30"][random(6)]);

        const past = dayOffset < 0;
        let status: Doc<"appointments">["status"] = past
          ? random(10) < 7
            ? "completed"
            : random(2) === 0
              ? "cancelled"
              : "no_show"
          : "confirmed";
        if (dayOffset === 0) status = random(2) === 0 ? "confirmed" : "checked_in";

        const price = service.price;
        const discount = random(6) === 0 ? Math.round(price * 0.1) : 0;
        const appointmentId = await ctx.db.insert("appointments", {
          orgId: args.orgId,
          clientId: client._id,
          staffId: pro._id,
          date,
          startMinutes,
          endMinutes: startMinutes + service.durationMin,
          durationMin: service.durationMin,
          bufferMin: 10,
          items: [
            {
              kind: "service",
              refId: service._id as string,
              name: service.name,
              quantity: 1,
              unitPrice: price,
              total: price,
            },
          ],
          totalPrice: price,
          discount,
          depositRequired: price >= 25000 ? Math.round(price * 0.3) : 0,
          status,
          paymentStatus:
            status === "completed" ? "paid" : price >= 25000 ? "deposit_paid" : "none",
          source: ["interno", "cliente", "online"][random(3)],
          completedAt: status === "completed" ? Date.now() - 86_400_000 : undefined,
          isDemo: true,
          createdBy: userId,
          createdAt: Date.now() - (50 - dayOffset) * 86_400_000,
        });
        counters += 1;

        await ctx.db.insert("appointmentStatusHistory", {
          orgId: args.orgId,
          appointmentId,
          from: "novo",
          to: status,
          at: Date.now(),
          by: userId,
        });

        if (status === "completed") {
          sequences += 1;
          const net = price - discount;
          const invoiceId = await ctx.db.insert("invoices", {
            orgId: args.orgId,
            number: `FAT-DEMO-${String(sequences).padStart(4, "0")}`,
            clientId: client._id,
            appointmentId,
            items: [
              {
                kind: "service",
                refId: service._id as string,
                name: service.name,
                quantity: 1,
                unitPrice: price,
                total: price,
              },
            ],
            subtotal: price,
            discount,
            tax: 0,
            total: net,
            depositApplied: 0,
            status: "paid",
            issueDate: date,
            dueDate: date,
            locked: true,
            isDemo: true,
            createdAt: Date.now(),
            createdBy: userId,
          });

          if (random(3) > 0) {
            const method = (["pix", "credit_card", "debit_card", "cash"] as const)[random(4)];
            const paymentId = await ctx.db.insert("payments", {
              orgId: args.orgId,
              clientId: client._id,
              invoiceId,
              appointmentId,
              amount: net,
              method,
              kind: "pagamento",
              date,
              accountId: accounts[random(accounts.length)]?._id,
              reference: `PAG-DEMO-${String(sequences).padStart(4, "0")}`,
              isDemo: true,
              createdAt: Date.now(),
              createdBy: userId,
            });
            await ctx.db.insert("paymentAllocations", {
              orgId: args.orgId,
              paymentId,
              invoiceId,
              appointmentId,
              amount: net,
              kind: "pagamento",
              createdAt: Date.now(),
            });
          } else {
            await ctx.db.patch(invoiceId, { status: "issued", locked: false });
          }

          // consumption
          const rules = (
            await ctx.db
              .query("serviceConsumptionRules")
              .withIndex("by_service", (q) => q.eq("serviceId", service._id))
              .collect()
          );
          for (const rule of rules) {
            const product = products.find((p) => p._id === rule.productId);
            if (!product) continue;
            const balanceAfter = product.quantity - rule.quantity;
            const movementId = await ctx.db.insert("inventoryMovements", {
              orgId: args.orgId,
              productId: product._id,
              type: "consumo",
              quantity: -rule.quantity,
              balanceAfter,
              unitCost: product.cost,
              reason: "Consumo em atendimento",
              appointmentId,
              staffId: pro._id,
              date,
              isDemo: true,
              createdAt: Date.now(),
              createdBy: userId,
            });
            await ctx.db.patch(product._id, { quantity: Math.max(0, balanceAfter) });
            await ctx.db.insert("serviceConsumptionRecords", {
              orgId: args.orgId,
              appointmentId,
              serviceId: service._id,
              productId: product._id,
              quantity: rule.quantity,
              unitCost: product.cost,
              movementId,
              date,
              createdAt: Date.now(),
            });
          }

          // commission
          await ctx.db.insert("commissions", {
            orgId: args.orgId,
            staffId: pro._id,
            appointmentId,
            invoiceId,
            kind: "servico",
            baseAmount: net,
            ruleLabel: `${pro.commissionPct}% sobre o valor com desconto`,
            amount: Math.round((net * pro.commissionPct) / 100),
            status: "ganha",
            date,
            isDemo: true,
            createdAt: Date.now(),
          });

          // treatment record with a rebooking cycle
          const interval = service.durationMin >= 120 ? 21 : 30;
          await ctx.db.insert("treatmentRecords", {
            orgId: args.orgId,
            clientId: client._id,
            appointmentId,
            serviceId: service._id,
            serviceName: service.name,
            staffId: pro._id,
            date,
            productsUsed: rules.map((r) => ({
              productId: r.productId,
              name: products.find((p) => p._id === r.productId)?.name ?? "Produto",
              quantity: r.quantity,
            })),
            notes: `${service.name} realizado com boa resposta. Cliente satisfeita com o resultado.`,
            formula: service.name.includes("Coloração") ? "7.1 + oxidante 20 vol" : undefined,
            preferences: "Produtos sem sulfato.",
            aftercare: "Manter hidratação semanal em casa.",
            nextVisitIntervalDays: interval,
            nextVisitDate: addDaysISO(date, interval),
            sensitive: true,
            isDemo: true,
            createdAt: Date.now(),
            createdBy: userId,
          });
        }
      }
    }

    // loyalty ledger from collected history
    const loyaltyTx = await ctx.db
      .query("payments")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    for (const c of clients) {
      const spent = sum(
        loyaltyTx
          .filter((p) => p.clientId === c._id && p.kind !== "reembolso")
          .map((p) => p.amount),
      );
      const points = Math.round(spent / 100);
      const account = await ctx.db
        .query("loyaltyAccounts")
        .withIndex("by_client", (q) => q.eq("clientId", c._id))
        .first();
      if (account) {
        await ctx.db.patch(account._id, {
          points,
          tier: points >= 1500 ? "Ouro" : points >= 500 ? "Prata" : "Bronze",
          updatedAt: Date.now(),
        });
      } else {
        await ctx.db.insert("loyaltyAccounts", {
          orgId: args.orgId,
          clientId: c._id,
          points,
          tier: points >= 1500 ? "Ouro" : points >= 500 ? "Prata" : "Bronze",
          updatedAt: Date.now(),
        });
      }
      if (points > 0) {
        await ctx.db.insert("loyaltyTransactions", {
          orgId: args.orgId,
          clientId: c._id,
          points,
          reason: "Histórico de atendimentos (demonstração)",
          date: today,
          balanceAfter: points,
          isDemo: true,
          createdAt: Date.now(),
        });
      }
    }

    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "gerar_historico_demo",
      entity: "appointments",
      details: `${counters} agendamentos gerados`,
    });

    return { appointments: counters };
  },
});

/** Removes every demonstration record without touching real data. */
export const resetDemoData = mutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const { userId, member } = await requireMember(ctx, args.orgId, "settings.edit");
    const tables = [
      "appointments",
      "treatmentRecords",
      "clientPhotos",
      "invoices",
      "payments",
      "expenses",
      "products",
      "inventoryMovements",
      "commissions",
      "loyaltyTransactions",
      "giftCards",
      "marketingCampaigns",
      "clients",
      "services",
      "staff",
      "services",
    ] as const;
    let removed = 0;
    for (const table of tables) {
      const rows = await ctx.db
        .query(table as any)
        .withIndex("by_org" as any, (q: any) => q.eq("orgId", args.orgId))
        .collect();
      for (const row of rows as any[]) {
        if (!row.isDemo) continue;
        await ctx.db.delete(row._id);
        removed += 1;
      }
    }
    // derived tables without the isDemo flag
    for (const table of [
      "paymentAllocations",
      "appointmentStatusHistory",
      "serviceConsumptionRecords",
      "loyaltyAccounts",
      "commissionStatements",
      "followUpTasks",
    ] as const) {
      const rows = await ctx.db
        .query(table as any)
        .withIndex("by_org" as any, (q: any) => q.eq("orgId", args.orgId))
        .collect();
      for (const row of rows as any[]) {
        if (table === "appointmentStatusHistory") continue;
        if (table === "loyaltyAccounts") continue;
        await ctx.db.delete(row._id);
        removed += 1;
      }
    }
    await logAudit(ctx, {
      orgId: args.orgId,
      userId,
      userName: member.name,
      action: "resetar_demo",
      entity: "organizations",
      entityId: args.orgId,
      details: `${removed} registros de demonstração removidos`,
    });
    return removed;
  },
});

export const demoStatus = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.orgId);
    if (!org) return null;
    const counts = {
      appointments: (
        await ctx.db
          .query("appointments")
          .withIndex("by_org_date", (q) => q.eq("orgId", args.orgId))
          .collect()
      ).filter((a) => a.isDemo).length,
      clients: (
        await ctx.db
          .query("clients")
          .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
          .collect()
      ).filter((c) => c.isDemo).length,
      products: (
        await ctx.db
          .query("products")
          .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
          .collect()
      ).filter((p) => p.isDemo).length,
    };
    return { isDemo: org.isDemo, counts };
  },
});
