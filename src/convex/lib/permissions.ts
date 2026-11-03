/**
 * Permission model for BeautyFlow OS.
 *
 * This module is intentionally dependency-free so that both the Convex
 * backend (authorization enforcement) and the React frontend (progressive
 * disclosure of UI) can import the exact same source of truth.
 */

export const ORG_ROLES = [
  "owner",
  "admin",
  "receptionist",
  "professional",
  "finance",
  "viewer",
] as const;

export type OrgRole = (typeof ORG_ROLES)[number];

export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Proprietária(o)",
  admin: "Administrador(a)",
  receptionist: "Recepção",
  professional: "Profissional",
  finance: "Financeiro",
  viewer: "Consulta (somente leitura)",
};

export const PERMISSIONS = [
  "clients.view",
  "clients.edit",
  "health.view",
  "appointments.view",
  "appointments.edit",
  "appointments.delete",
  "services.view",
  "services.edit",
  "staff.view",
  "staff.edit",
  "invoices.view",
  "invoices.edit",
  "payments.view",
  "payments.edit",
  "payments.refund",
  "expenses.view",
  "expenses.edit",
  "inventory.view",
  "inventory.edit",
  "commissions.view",
  "commissions.pay",
  "reports.financial",
  "reports.operational",
  "photos.view",
  "photos.share",
  "consent.view",
  "consent.edit",
  "marketing.manage",
  "settings.edit",
  "users.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL: Permission[] = [...PERMISSIONS];

const READ_ONLY: Permission[] = [
  "clients.view",
  "appointments.view",
  "services.view",
  "staff.view",
  "invoices.view",
  "payments.view",
  "expenses.view",
  "inventory.view",
  "commissions.view",
  "reports.operational",
  "photos.view",
];

export const ROLE_PERMISSIONS: Record<OrgRole, Permission[]> = {
  owner: ALL,
  admin: ALL.filter((p) => p !== "users.manage"),
  receptionist: [
    "clients.view",
    "clients.edit",
    "appointments.view",
    "appointments.edit",
    "appointments.delete",
    "services.view",
    "staff.view",
    "invoices.view",
    "invoices.edit",
    "payments.view",
    "payments.edit",
    "inventory.view",
    "consent.view",
    "consent.edit",
    "reports.operational",
  ],
  professional: [
    "clients.view",
    "appointments.view",
    "appointments.edit",
    "services.view",
    "staff.view",
    "inventory.view",
    "inventory.edit",
    "health.view",
    "consent.view",
    "consent.edit",
    "photos.view",
    "commissions.view",
  ],
  finance: [
    "clients.view",
    "appointments.view",
    "services.view",
    "staff.view",
    "invoices.view",
    "invoices.edit",
    "payments.view",
    "payments.edit",
    "payments.refund",
    "expenses.view",
    "expenses.edit",
    "inventory.view",
    "inventory.edit",
    "commissions.view",
    "commissions.pay",
    "reports.financial",
    "reports.operational",
  ],
  viewer: READ_ONLY,
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  "clients.view": "Ver clientes",
  "clients.edit": "Criar e editar clientes",
  "health.view": "Ver informações sensíveis de saúde",
  "appointments.view": "Ver agendamentos",
  "appointments.edit": "Criar e editar agendamentos",
  "appointments.delete": "Cancelar e excluir agendamentos",
  "services.view": "Ver serviços",
  "services.edit": "Editar catálogo de serviços",
  "staff.view": "Ver equipe",
  "staff.edit": "Editar equipe e escalas",
  "invoices.view": "Ver faturas",
  "invoices.edit": "Emitir e editar faturas",
  "payments.view": "Ver pagamentos",
  "payments.edit": "Registrar pagamentos",
  "payments.refund": "Registrar reembolsos",
  "expenses.view": "Ver despesas",
  "expenses.edit": "Lançar despesas",
  "inventory.view": "Ver estoque",
  "inventory.edit": "Movimentar estoque",
  "commissions.view": "Ver comissões",
  "commissions.pay": "Pagar comissões",
  "reports.financial": "Relatórios financeiros",
  "reports.operational": "Relatórios operacionais",
  "photos.view": "Ver fotos de clientes",
  "photos.share": "Exportar fotos aprovadas",
  "consent.view": "Ver consentimentos",
  "consent.edit": "Registrar consentimentos",
  "marketing.manage": "Gerenciar campanhas",
  "settings.edit": "Editar configurações",
  "users.manage": "Gerenciar usuários e permissões",
};

export function permissionsFor(
  role: OrgRole,
  extra: string[] = [],
): Permission[] {
  const base = ROLE_PERMISSIONS[role] ?? [];
  const extras = extra.filter((p): p is Permission =>
    (PERMISSIONS as readonly string[]).includes(p),
  );
  return Array.from(new Set([...base, ...extras]));
}

export function hasPermission(
  role: OrgRole,
  permission: Permission,
  extra: string[] = [],
): boolean {
  return permissionsFor(role, extra).includes(permission);
}

/**
 * Feature flags. A module that is not implemented or enabled must not appear as
 * a fully functional feature anywhere in the product.
 */
export const FEATURE_FLAGS = [
  { key: "scheduling", label: "Agenda e agendamentos", core: true },
  { key: "crm", label: "CRM de clientes", core: true },
  { key: "catalog", label: "Catálogo de serviços", core: true },
  { key: "finance", label: "Financeiro", core: true },
  { key: "inventory", label: "Estoque", core: false },
  { key: "commissions", label: "Comissões da equipe", core: false },
  { key: "memberships", label: "Pacotes e assinaturas", core: false },
  { key: "giftcards", label: "Cartões-presente", core: false },
  { key: "loyalty", label: "Programa de fidelidade", core: false },
  { key: "marketing", label: "Planejador de marketing", core: false },
  { key: "analytics", label: "Análises avançadas", core: false },
  { key: "publicBooking", label: "Agendamento online público", core: false },
  { key: "photos", label: "Galeria antes e depois", core: false },
  { key: "forms", label: "Formulários e consentimentos", core: false },
  { key: "multiLocation", label: "Múltiplas unidades (em breve)", core: false },
  { key: "whatsapp", label: "Integração WhatsApp (requer configuração)", core: false },
  { key: "email", label: "Integração de e-mail (requer configuração)", core: false },
  { key: "gateway", label: "Gateway de pagamento externo (requer configuração)", core: false },
] as const;

export type FeatureKey = (typeof FEATURE_FLAGS)[number]["key"];

export const DEFAULT_FEATURE_FLAGS: Record<FeatureKey, boolean> = {
  scheduling: true,
  crm: true,
  catalog: true,
  finance: true,
  inventory: true,
  commissions: true,
  memberships: true,
  giftcards: true,
  loyalty: true,
  marketing: true,
  analytics: true,
  publicBooking: true,
  photos: true,
  forms: true,
  multiLocation: false,
  whatsapp: false,
  email: false,
  gateway: false,
};
