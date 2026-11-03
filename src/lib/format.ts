/**
 * Centralised localisation layer for BeautyFlow OS.
 * Portuguese (Brasil) + BRL are the defaults; every screen must format money,
 * dates and phone numbers through these helpers instead of ad-hoc formatting.
 */

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const NUMBER = new Intl.NumberFormat("pt-BR");

/** centavos -> "R$ 1.234,56" */
export function money(cents: number | undefined | null): string {
  return BRL.format((cents ?? 0) / 100);
}

/** money without the symbol, e.g. "1.234,56" */
export function moneyPlain(cents: number | undefined | null): string {
  return NUMBER.format(((cents ?? 0) / 100).toFixed(2) as unknown as number);
}

/** "R$ 1.234,56" / "1234,56" / "1234.56" -> centavos */
export function parseMoney(input: string): number {
  if (!input) return 0;
  const cleaned = input
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}\b)/g, "")
    .replace(",", ".");
  const value = Number.parseFloat(cleaned);
  if (Number.isNaN(value)) return 0;
  return Math.round(value * 100);
}

export function centsToInput(cents: number | undefined): string {
  if (cents === undefined || cents === null) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function formatDateShort(iso: string | undefined): string {
  if (!iso) return "—";
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}`;
}

export function formatDateTime(ms: number | undefined): string {
  if (!ms) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));
}

/** minutes from midnight -> "HH:MM" (24h) */
export function formatTime(minutes: number | undefined): string {
  if (minutes === undefined || minutes === null) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function parseTime(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function durationLabel(minutes: number | undefined): string {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h${String(m).padStart(2, "0")}`;
  if (h) return `${h}h`;
  return `${m}min`;
}

export const WEEKDAYS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

export const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** "2026-10" -> "outubro de 2026" */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return `${MONTHS[m - 1]} de ${y}`;
}

export function monthLabelShort(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return `${MONTHS[m - 1].slice(0, 3)}/${String(y).slice(2)}`;
}

export function weekdayOf(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function todayISO(): string {
  const now = new Date(Date.now() - 3 * 3_600_000); // America/Sao_Paulo
  return now.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function startOfWeek(iso: string, weekStart = 1): string {
  const wd = weekdayOf(iso);
  const diff = (wd - weekStart + 7) % 7;
  return addDays(iso, -diff);
}

export function endOfMonth(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function diffDays(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round(
    (Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86_400_000,
  );
}

/** Brazilian phone mask: (11) 98765-4321 / (11) 3456-7890 */
export function formatPhone(value: string): string {
  const d = (value ?? "").replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10)
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function formatCep(value: string): string {
  const d = (value ?? "").replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function formatCpfCnpj(value: string): string {
  const d = (value ?? "").replace(/\D/g, "");
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function whatsappLink(phone: string, message?: string): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  const q = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${withCountry}${q}`;
}

export function initials(name: string | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function pctLabel(part: number, total: number): string {
  if (!total) return "0%";
  return `${Math.round((part / total) * 1000) / 10}%`;
}

// ---------------------------------------------------------------------------
// Domain labels (pt-BR)
// ---------------------------------------------------------------------------

export const APPOINTMENT_STATUS: Record<string, string> = {
  requested: "Solicitado",
  awaiting_confirmation: "Aguardando confirmação",
  confirmed: "Confirmado",
  checked_in: "Cliente na recepção",
  in_progress: "Em atendimento",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Falta",
};

export const APPOINTMENT_STATUS_COLOR: Record<string, string> = {
  requested: "bg-slate-100 text-slate-700 border-slate-200",
  awaiting_confirmation: "bg-amber-50 text-amber-700 border-amber-200",
  confirmed: "bg-teal-50 text-teal-700 border-teal-200",
  checked_in: "bg-sky-50 text-sky-700 border-sky-200",
  in_progress: "bg-indigo-50 text-indigo-700 border-indigo-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-rose-50 text-rose-700 border-rose-200",
  no_show: "bg-orange-50 text-orange-700 border-orange-200",
};

export const PAYMENT_STATUS: Record<string, string> = {
  none: "Sem pagamento",
  deposit_pending: "Sinal pendente",
  deposit_paid: "Sinal pago",
  partial: "Parcialmente pago",
  paid: "Pago",
  refunded: "Estornado",
};

export const PAYMENT_METHOD: Record<string, string> = {
  pix: "PIX",
  cash: "Dinheiro",
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  transfer: "Transferência bancária",
  gift_card: "Cartão-presente",
  other: "Outro",
};

const LEGACY_PAYMENT_METHODS: Record<string, string> = {
  dinheiro: "cash",
  cartao_credito: "credit_card",
  cartao_debito: "debit_card",
  transferencia: "transfer",
  cartao_presente: "gift_card",
  outro: "other",
  boleto: "other",
};

/**
 * Maps values saved by older organizations ("dinheiro", "cartao_credito") to
 * the canonical keys accepted by the payment mutation, dropping unknown ones.
 */
export function normalizePaymentMethods(methods: string[] | undefined): string[] {
  const mapped = (methods ?? [])
    .map((method) => LEGACY_PAYMENT_METHODS[method] ?? method)
    .filter((method) => Object.prototype.hasOwnProperty.call(PAYMENT_METHOD, method));
  return Array.from(new Set(mapped));
}

export const INVOICE_STATUS: Record<string, string> = {
  draft: "Rascunho",
  issued: "Emitida",
  partial: "Parcialmente paga",
  paid: "Paga",
  overdue: "Vencida",
  cancelled: "Cancelada",
  refunded: "Estornada",
};

export const QUOTE_STATUS: Record<string, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aguardando: "Aguardando aprovação",
  aprovado: "Aprovado",
  recusado: "Recusado",
  expirado: "Expirado",
  convertido: "Convertido em agendamento",
};

export const PAYMENT_KIND: Record<string, string> = {
  pagamento: "Pagamento",
  sinal: "Sinal / depósito",
  reembolso: "Reembolso",
  venda: "Venda",
  consumo: "Consumo interno",
};

export const COMMISSION_STATUS: Record<string, string> = {
  estimada: "Estimada",
  ganha: "Ganha",
  paga: "Paga",
};

export const MOVEMENT_TYPE: Record<string, string> = {
  entrada: "Entrada",
  saida: "Saída",
  ajuste: "Ajuste",
  venda: "Venda",
  consumo: "Consumo em serviço",
  perda: "Perda / quebra",
  devolucao: "Devolução",
};

export const RETENTION_STATUS: Record<string, string> = {
  em_dia: "Em dia",
  retorno_pendente: "Retorno pendente",
  atrasado: "Retorno atrasado",
  inativo: "Inativa",
  sem_historico: "Sem histórico",
};

export const WAITLIST_STATUS: Record<string, string> = {
  aguardando: "Aguardando",
  contatado: "Contatada",
  agendado: "Atendida",
  cancelado: "Cancelada",
  expirado: "Expirada",
};

export const PRIORITY: Record<string, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

export const CONSENT_TYPE: Record<string, string> = {
  tratamento: "Consentimento para tratamento",
  imagem_interna: "Uso interno de imagem",
  imagem_publica: "Uso público / divulgação",
  privacidade: "Ciência de privacidade (LGPD)",
};

export const FOLLOWUP_TYPE: Record<string, string> = {
  reagendamento: "Reagendamento",
  aniversario: "Aniversário",
  pos_atendimento: "Pós-atendimento",
  retorno: "Retorno",
  oferta: "Oferta",
};

export const CAMPAIGN_STATUS: Record<string, string> = {
  planejada: "Planejada",
  ativa: "Ativa",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export function label(map: Record<string, string>, key: string | undefined): string {
  if (!key) return "—";
  return map[key] ?? key;
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

export function escapeCsv(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (typeof value === "string" && /^[=+@-]/.test(text.trimStart())) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function downloadCsv(
  filename: string,
  columns: string[],
  rows: Record<string, unknown>[],
) {
  const escape = escapeCsv;
  const lines = [
    columns.map(escape).join(";"),
    ...rows.map((row) => columns.map((c) => escape(row[c])).join(";")),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const MESSAGE_TEMPLATES = [
  {
    name: "Reagendamento",
    text: "Oi {cliente}! Sentimos sua falta 💚 Está na hora de cuidar de você. Quer agendar seu {servico} para esta semana?",
  },
  {
    name: "Aniversário",
    text: "Parabéns, {cliente}! 🎉 Preparamos um mimo especial para o seu mês: agende seu atendimento e ganhe uma cortesia.",
  },
  {
    name: "Pós-atendimento",
    text: "Oi {cliente}, esperamos que esteja amando o resultado! Qualquer dúvida sobre os cuidados em casa, é só chamar.",
  },
  {
    name: "Lembrete de retorno",
    text: "{cliente}, sua manutenção de {servico} está chegando! Reservamos um horário especial para você. Confirmamos?",
  },
  {
    name: "Oferta",
    text: "{cliente}, temos uma condição especial esta semana em {servico}. Quer garantir seu horário?",
  },
];
