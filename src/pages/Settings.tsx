import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useApp } from "@/components/app-context";
import {
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  FormDialog,
  GlassCard,
  InfoBanner,
  LoadingBlock,
  PageHeader,
  SectionTitle,
  StatCard,
  StatusPill,
} from "@/components/glass";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  FEATURE_FLAGS,
  ORG_ROLE_LABELS,
  ORG_ROLES,
  PERMISSIONS,
  PERMISSION_LABELS,
  type OrgRole,
  type Permission,
} from "@/convex/lib/permissions";
import { errorMessage } from "@/lib/errors";
import { PAYMENT_METHOD, WEEKDAYS, formatDateTime, formatPhone } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  Building2,
  Clock,
  Copy,
  RefreshCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  Wand2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const BUSINESS_TYPES = [
  "Salão de beleza",
  "Studio de unhas",
  "Studio de cílios e sobrancelhas",
  "Espaço de estética",
  "Spa / massagem",
  "Barbearia",
  "Maquiagem",
  "Profissional autônoma",
  "Estúdio multidisciplinar",
];

const DEFAULT_HOURS = Array.from({ length: 7 }, (_, weekday) => ({
  weekday,
  closed: weekday === 0,
  open: "09:00",
  close: "19:00",
}));

export function Settings() {
  const { orgId, context, can, flag, selectOrg } = useApp();
  const org = context?.org;
  const update = useMutation(api.orgs.updateOrganization);
  const setFlag = useMutation(api.orgs.setFeatureFlag);
  const createDemo = useMutation(api.demo.createDemoWorkspace);
  const resetDemo = useMutation(api.demo.resetDemoData);
  const seedHistory = useMutation(api.demo.seedDemoHistory);
  const demoStatus = useQuery(api.demo.demoStatus, orgId ? { orgId } : "skip");
  const subscription = useQuery(api.orgs.subscriptionSummary, orgId ? { orgId } : "skip");

  const [form, setForm] = useState<any>(null);
  const [hours, setHours] = useState<any[]>(DEFAULT_HOURS);
  const [saving, setSaving] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  useEffect(() => {
    if (!org) return;
    setForm({
      name: org.name ?? "",
      legalName: org.legalName ?? "",
      document: org.document ?? "",
      ownerName: org.ownerName ?? "",
      email: org.email ?? "",
      phone: org.phone ?? "",
      whatsapp: org.whatsapp ?? "",
      businessType: org.businessType ?? BUSINESS_TYPES[0],
      cancellationPolicy: org.cancellationPolicy ?? "",
      cancellationHours: String(org.cancellationHours ?? 24),
      depositPolicy: org.depositPolicy ?? "",
      defaultDepositPct: String(org.defaultDepositPct ?? 0),
      bufferMinutes: String(org.bufferMinutes ?? 0),
      minNoticeHours: String(org.minNoticeHours ?? 2),
      onlineBookingLeadHours: String(org.onlineBookingLeadHours ?? 4),
      taxPct: String(org.taxPct ?? 0),
      brandAccent: org.brandAccent ?? "#0ea5a4",
      paymentMethods: (org.paymentMethods ?? []).join(", "),
      expenseCategories: (org.expenseCategories ?? []).join(", "),
      commissionBaseDefault: org.commissionBaseDefault ?? "gross",
      publicBookingEnabled: !!org.publicBookingEnabled,
      requireApprovalOnline: !!org.requireApprovalOnline,
      cep: org.address?.cep ?? "",
      logradouro: org.address?.logradouro ?? "",
      numero: org.address?.numero ?? "",
      complemento: org.address?.complemento ?? "",
      bairro: org.address?.bairro ?? "",
      cidade: org.address?.cidade ?? "",
      estado: org.address?.estado ?? "",
    });
    setHours(
      (org.openHours ?? DEFAULT_HOURS).length
        ? (org.openHours ?? DEFAULT_HOURS)
        : DEFAULT_HOURS,
    );
  }, [org]);

  if (!orgId || !org || !form) return <LoadingBlock rows={4} />;
  const activeOrgId = orgId;

  const editable = can("settings.edit");

  async function persist(patch: Record<string, unknown>) {
    setSaving(true);
    try {
      await update({ orgId: activeOrgId, patch: patch as any });
      toast.success("Configurações salvas.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Configurações"
        title="Organização e preferências"
        description="Dados do negócio, horários, políticas, pagamentos, marca, usuários e módulos habilitados. Toda alteração fica registrada na auditoria."
        actions={
          editable && (
            <Button
              disabled={saving}
              onClick={() =>
                persist({
                  name: form.name,
                  legalName: form.legalName || undefined,
                  document: form.document || undefined,
                  ownerName: form.ownerName || undefined,
                  email: form.email || undefined,
                  phone: form.phone || undefined,
                  whatsapp: form.whatsapp || undefined,
                  businessType: form.businessType,
                  address: {
                    cep: form.cep || undefined,
                    logradouro: form.logradouro || undefined,
                    numero: form.numero || undefined,
                    complemento: form.complemento || undefined,
                    bairro: form.bairro || undefined,
                    cidade: form.cidade || undefined,
                    estado: form.estado || undefined,
                  },
                })
              }
            >
              <Save className="mr-2 size-4" />
              Salvar dados
            </Button>
          )
        }
      />

      {org.isDemo && (
        <InfoBanner tone="warning">
          Este espaço é um ambiente de demonstração. Todos os registros são marcados como
          dados de demonstração e podem ser recriados a qualquer momento.
        </InfoBanner>
      )}

      <Tabs defaultValue="organizacao">
        <TabsList className="glass-soft flex-wrap">
          <TabsTrigger value="organizacao">Organização</TabsTrigger>
          <TabsTrigger value="horarios">Horários e regras</TabsTrigger>
          <TabsTrigger value="financeiro">Pagamentos e faturas</TabsTrigger>
          <TabsTrigger value="marca">Marca e aparência</TabsTrigger>
          <TabsTrigger value="usuarios">Usuários e permissões</TabsTrigger>
          <TabsTrigger value="modulos">Funcionalidades</TabsTrigger>
          <TabsTrigger value="demo">Demonstração</TabsTrigger>
        </TabsList>

        {/* ---------------------------------------------------------------- */}
        <TabsContent value="organizacao" className="mt-4 space-y-4">
          <GlassCard>
            <SectionTitle title="Identificação" description="Usada em faturas, recibos e documentos impressos." />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome fantasia *">
                <Input
                  value={form.name}
                  disabled={!editable}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </Field>
              <Field label="Razão social">
                <Input
                  value={form.legalName}
                  disabled={!editable}
                  onChange={(event) => setForm({ ...form, legalName: event.target.value })}
                />
              </Field>
              <Field label="CNPJ ou CPF">
                <Input
                  value={form.document}
                  disabled={!editable}
                  onChange={(event) => setForm({ ...form, document: event.target.value })}
                />
              </Field>
              <Field label="Responsável">
                <Input
                  value={form.ownerName}
                  disabled={!editable}
                  onChange={(event) => setForm({ ...form, ownerName: event.target.value })}
                />
              </Field>
              <Field label="E-mail">
                <Input
                  value={form.email}
                  disabled={!editable}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                />
              </Field>
              <Field label="Telefone">
                <Input
                  value={form.phone}
                  disabled={!editable}
                  onChange={(event) => setForm({ ...form, phone: formatPhone(event.target.value) })}
                />
              </Field>
              <Field label="WhatsApp">
                <Input
                  value={form.whatsapp}
                  disabled={!editable}
                  onChange={(event) => setForm({ ...form, whatsapp: formatPhone(event.target.value) })}
                />
              </Field>
              <Field label="Tipo de negócio">
                <Select
                  value={form.businessType}
                  onValueChange={(value) => setForm({ ...form, businessType: value })}
                  disabled={!editable}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUSINESS_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </GlassCard>

          <GlassCard>
            <SectionTitle title="Endereço" description="Campos no padrão brasileiro." />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="CEP">
                <Input
                  value={form.cep}
                  disabled={!editable}
                  onChange={(event) => setForm({ ...form, cep: event.target.value })}
                />
              </Field>
              <Field label="Logradouro" className="sm:col-span-2">
                <Input
                  value={form.logradouro}
                  disabled={!editable}
                  onChange={(event) => setForm({ ...form, logradouro: event.target.value })}
                />
              </Field>
              <Field label="Número">
                <Input
                  value={form.numero}
                  disabled={!editable}
                  onChange={(event) => setForm({ ...form, numero: event.target.value })}
                />
              </Field>
              <Field label="Complemento">
                <Input
                  value={form.complemento}
                  disabled={!editable}
                  onChange={(event) => setForm({ ...form, complemento: event.target.value })}
                />
              </Field>
              <Field label="Bairro">
                <Input
                  value={form.bairro}
                  disabled={!editable}
                  onChange={(event) => setForm({ ...form, bairro: event.target.value })}
                />
              </Field>
              <Field label="Cidade">
                <Input
                  value={form.cidade}
                  disabled={!editable}
                  onChange={(event) => setForm({ ...form, cidade: event.target.value })}
                />
              </Field>
              <Field label="Estado (UF)">
                <Input
                  value={form.estado}
                  disabled={!editable}
                  maxLength={2}
                  onChange={(event) => setForm({ ...form, estado: event.target.value.toUpperCase() })}
                />
              </Field>
            </div>
          </GlassCard>

          {editable && (
            <Button
              disabled={saving}
              onClick={() =>
                persist({
                  name: form.name,
                  legalName: form.legalName || undefined,
                  document: form.document || undefined,
                  ownerName: form.ownerName || undefined,
                  email: form.email || undefined,
                  phone: form.phone || undefined,
                  whatsapp: form.whatsapp || undefined,
                  businessType: form.businessType,
                  address: {
                    cep: form.cep || undefined,
                    logradouro: form.logradouro || undefined,
                    numero: form.numero || undefined,
                    complemento: form.complemento || undefined,
                    bairro: form.bairro || undefined,
                    cidade: form.cidade || undefined,
                    estado: form.estado || undefined,
                  },
                })
              }
            >
              <Save className="mr-2 size-4" />
              Salvar dados da organização
            </Button>
          )}
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        <TabsContent value="horarios" className="mt-4 space-y-4">
          <GlassCard>
            <SectionTitle
              title="Horário de funcionamento"
              description="O motor de agendamento usa estes horários para validar disponibilidade, junto com a escala de cada profissional."
            />
            <div className="space-y-2">
              {hours.map((entry, index) => (
                <div key={entry.weekday} className="glass-inset flex flex-wrap items-center gap-3 rounded-xl px-3 py-2">
                  <span className="w-24 text-sm font-medium">{WEEKDAYS[entry.weekday]}</span>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      disabled={!editable}
                      checked={!entry.closed}
                      onChange={(event) =>
                        setHours((prev) =>
                          prev.map((item, i) =>
                            i === index ? { ...item, closed: !event.target.checked } : item,
                          ),
                        )
                      }
                    />
                    Aberto
                  </label>
                  {!entry.closed && (
                    <>
                      <Input
                        type="time"
                        value={entry.open}
                        disabled={!editable}
                        onChange={(event) =>
                          setHours((prev) =>
                            prev.map((item, i) => (i === index ? { ...item, open: event.target.value } : item)),
                          )
                        }
                        className="w-32"
                      />
                      <span className="text-xs text-muted-foreground">até</span>
                      <Input
                        type="time"
                        value={entry.close}
                        disabled={!editable}
                        onChange={(event) =>
                          setHours((prev) =>
                            prev.map((item, i) => (i === index ? { ...item, close: event.target.value } : item)),
                          )
                        }
                        className="w-32"
                      />
                    </>
                  )}
                </div>
              ))}
            </div>
            {editable && (
              <Button
                className="mt-4"
                disabled={saving}
                onClick={() => persist({ openHours: hours })}
              >
                <Clock className="mr-2 size-4" />
                Salvar horários
              </Button>
            )}
          </GlassCard>

          <GlassCard>
            <SectionTitle
              title="Regras de agendamento e cancelamento"
              description="Aplicadas tanto na agenda interna quanto no agendamento online."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Antecedência mínima (horas)">
                <Input
                  type="number"
                  value={form.minNoticeHours}
                  disabled={!editable}
                  onChange={(event) => setForm({ ...form, minNoticeHours: event.target.value })}
                />
              </Field>
              <Field label="Antecedência mínima do site (horas)">
                <Input
                  type="number"
                  value={form.onlineBookingLeadHours}
                  disabled={!editable}
                  onChange={(event) => setForm({ ...form, onlineBookingLeadHours: event.target.value })}
                />
              </Field>
              <Field label="Intervalo entre atendimentos (min)">
                <Input
                  type="number"
                  value={form.bufferMinutes}
                  disabled={!editable}
                  onChange={(event) => setForm({ ...form, bufferMinutes: event.target.value })}
                />
              </Field>
              <Field label="Cancelamento gratuito até (horas antes)">
                <Input
                  type="number"
                  value={form.cancellationHours}
                  disabled={!editable}
                  onChange={(event) => setForm({ ...form, cancellationHours: event.target.value })}
                />
              </Field>
            </div>
            <Field label="Política de cancelamento (texto exibido ao cliente)">
              <Textarea
                rows={2}
                value={form.cancellationPolicy}
                disabled={!editable}
                onChange={(event) => setForm({ ...form, cancellationPolicy: event.target.value })}
              />
            </Field>
            {editable && (
              <Button
                className="mt-4"
                disabled={saving}
                onClick={() =>
                  persist({
                    minNoticeHours: Number(form.minNoticeHours) || 0,
                    onlineBookingLeadHours: Number(form.onlineBookingLeadHours) || 0,
                    bufferMinutes: Number(form.bufferMinutes) || 0,
                    cancellationHours: Number(form.cancellationHours) || 0,
                    cancellationPolicy: form.cancellationPolicy || undefined,
                  })
                }
              >
                <Save className="mr-2 size-4" />
                Salvar regras
              </Button>
            )}
          </GlassCard>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        <TabsContent value="financeiro" className="mt-4 space-y-4">
          <GlassCard>
            <SectionTitle
              title="Sinal e política de depósito"
              description="O sinal é registrado separadamente e aplicado à fatura final — nunca contado duas vezes."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Percentual padrão de sinal (%)">
                <Input
                  type="number"
                  value={form.defaultDepositPct}
                  disabled={!editable}
                  onChange={(event) => setForm({ ...form, defaultDepositPct: event.target.value })}
                />
              </Field>
              <Field label="Base padrão de comissão">
                <Select
                  value={form.commissionBaseDefault}
                  onValueChange={(value) => setForm({ ...form, commissionBaseDefault: value })}
                  disabled={!editable}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gross">Valor do serviço (antes do desconto)</SelectItem>
                    <SelectItem value="net_discount">Valor do serviço (após desconto)</SelectItem>
                    <SelectItem value="collected">Receita efetivamente recebida</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Taxa / imposto padrão (%)" hint="Usado apenas quando configurado nas faturas">
                <Input
                  type="number"
                  value={form.taxPct}
                  disabled={!editable}
                  onChange={(event) => setForm({ ...form, taxPct: event.target.value })}
                />
              </Field>
            </div>
            <Field label="Texto da política de sinal">
              <Textarea
                rows={2}
                value={form.depositPolicy}
                disabled={!editable}
                onChange={(event) => setForm({ ...form, depositPolicy: event.target.value })}
              />
            </Field>
          </GlassCard>

          <GlassCard>
            <SectionTitle title="Formas de pagamento aceitas" description="Separe por vírgula." />
            <Field label="Formas de pagamento">
              <Input
                value={form.paymentMethods}
                disabled={!editable}
                onChange={(event) => setForm({ ...form, paymentMethods: event.target.value })}
              />
            </Field>
            <div className="mt-2 flex flex-wrap gap-1">
              {Object.entries(PAYMENT_METHOD).map(([key, value]) => (
                <Badge key={key} variant="outline" className="text-[0.65rem]">
                  {value} <span className="ml-1 text-muted-foreground">{key}</span>
                </Badge>
              ))}
            </div>
            <Field label="Categorias de despesa" className="mt-4">
              <Input
                value={form.expenseCategories}
                disabled={!editable}
                onChange={(event) => setForm({ ...form, expenseCategories: event.target.value })}
              />
            </Field>
            {editable && (
              <Button
                className="mt-4"
                disabled={saving}
                onClick={() =>
                  persist({
                    defaultDepositPct: Number(form.defaultDepositPct) || 0,
                    commissionBaseDefault: form.commissionBaseDefault,
                    taxPct: Number(form.taxPct) || 0,
                    depositPolicy: form.depositPolicy || undefined,
                    paymentMethods: form.paymentMethods
                      .split(",")
                      .map((item: string) => item.trim())
                      .filter(Boolean),
                    expenseCategories: form.expenseCategories
                      .split(",")
                      .map((item: string) => item.trim())
                      .filter(Boolean),
                  })
                }
              >
                <Save className="mr-2 size-4" />
                Salvar preferências financeiras
              </Button>
            )}
          </GlassCard>

          {subscription?.plan && (
            <GlassCard>
              <SectionTitle title="Plano e uso" description="Base para limites e adicionais futuros." />
              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard label="Plano atual" value={subscription.plan.name ?? subscription.subscription.planSlug} />
                <StatCard
                  label="Situação"
                  value={subscription.subscription.status}
                  hint={subscription.subscription.trialEndsAt ? `Teste até ${subscription.subscription.trialEndsAt}` : undefined}
                />
                <StatCard
                  label="Registros de uso no mês"
                  value={(subscription.usage ?? []).length}
                  hint={(subscription.usage ?? [])
                    .map((u: any) => `${u.metric}: ${u.quantity}`)
                    .join(" · ")}
                />
              </div>
            </GlassCard>
          )}
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        <TabsContent value="marca" className="mt-4 space-y-4">
          <GlassCard>
            <SectionTitle
              title="Marca e aparência"
              description="A cor de destaque é aplicada ao painel e aos documentos impressos desta organização."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cor de destaque (hex)">
                <Input
                  value={form.brandAccent}
                  disabled={!editable}
                  onChange={(event) => setForm({ ...form, brandAccent: event.target.value })}
                />
              </Field>
              <Field label="Prévia">
                <div className="flex items-center gap-2">
                  <span
                    className="size-9 rounded-xl border border-white/70"
                    style={{ background: form.brandAccent }}
                  />
                  <span className="text-xs text-muted-foreground">{form.brandAccent}</span>
                </div>
              </Field>
            </div>
            <InfoBanner>
              O tema claro em vidro (glassmorphism) é o padrão do produto. Temas escuros não
              são aplicados sobre superfícies de vidro para preservar contraste e legibilidade.
            </InfoBanner>
            {editable && (
              <Button
                className="mt-4"
                disabled={saving}
                onClick={() => persist({ brandAccent: form.brandAccent, brandTheme: "light-glass" })}
              >
                <Sparkles className="mr-2 size-4" />
                Salvar marca
              </Button>
            )}
          </GlassCard>

          <GlassCard>
            <SectionTitle
              title="Agendamento online público"
              description="Ao habilitar, um link público passa a exibir serviços, preços e horários realmente disponíveis."
            />
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  disabled={!editable}
                  checked={form.publicBookingEnabled}
                  onChange={(event) => setForm({ ...form, publicBookingEnabled: event.target.checked })}
                />
                Habilitar agendamento online
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  disabled={!editable}
                  checked={form.requireApprovalOnline}
                  onChange={(event) => setForm({ ...form, requireApprovalOnline: event.target.checked })}
                />
                Exigir aprovação da equipe antes de confirmar
              </label>
            </div>
            {org.publicBookingSlug && (
              <div className="mt-3 flex items-center gap-2">
                <code className="glass-inset rounded-lg px-2 py-1 text-xs">
                  {typeof window !== "undefined" ? window.location.origin : ""}/agendar/
                  {org.publicBookingSlug}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        `${window.location.origin}/agendar/${org.publicBookingSlug}`,
                      );
                      toast.success("Link copiado.");
                    } catch {
                      toast.error("Não foi possível copiar o link.");
                    }
                  }}
                >
                  <Copy className="mr-1 size-3.5" />
                  Copiar
                </Button>
              </div>
            )}
            {editable && (
              <Button
                className="mt-4"
                disabled={saving}
                onClick={() =>
                  persist({
                    publicBookingEnabled: form.publicBookingEnabled,
                    requireApprovalOnline: form.requireApprovalOnline,
                  })
                }
              >
                <Building2 className="mr-2 size-4" />
                Salvar agendamento online
              </Button>
            )}
          </GlassCard>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        <TabsContent value="usuarios" className="mt-4">
          <MembersPanel orgId={orgId} />
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        <TabsContent value="modulos" className="mt-4 space-y-4">
          <GlassCard>
            <SectionTitle
              title="Funcionalidades habilitadas"
              description="O backend também valida cada funcionalidade. Módulos desativados ficam ocultos e bloqueados nas operações."
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURE_FLAGS.map((item) => (
                <div key={item.key} className="glass-inset rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-[0.7rem] text-muted-foreground">
                        {item.core ? "Módulo essencial" : "Módulo opcional"}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      disabled={!editable || !flag(item.key)}
                      checked={flag(item.key)}
                      onChange={async (event) => {
                        try {
                          await setFlag({
                            orgId,
                            key: item.key,
                            enabled: event.target.checked,
                          });
                          toast.success(
                            event.target.checked ? "Módulo habilitado." : "Módulo desativado.",
                          );
                        } catch (err) {
                          toast.error(errorMessage(err));
                        }
                      }}
                    />
                  </div>
                  <StatusPill
                    label={flag(item.key) ? "Ativo" : "Desativado"}
                    className={cn(
                      "mt-2",
                      flag(item.key)
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-slate-50 text-slate-600",
                    )}
                  />
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard>
            <SectionTitle
              title="Matriz de permissões por papel"
              description="As permissões são verificadas no backend em toda operação, não apenas na interface."
            />
            <div className="space-y-3">
              {ORG_ROLES.map((role) => (
                <div key={role} className="glass-inset rounded-xl p-3">
                  <p className="text-sm font-semibold">{ORG_ROLE_LABELS[role]}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {PERMISSIONS.filter((permission) =>
                      // presentation-only preview using the shared matrix
                      (
                        {
                          owner: PERMISSIONS,
                          admin: PERMISSIONS,
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
                          viewer: [
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
                          ],
                        } as Record<OrgRole, readonly Permission[]>
                      )[role].includes(permission),
                    ).map((permission) => (
                      <Badge key={permission} variant="outline" className="text-[0.6rem]">
                        {PERMISSION_LABELS[permission]}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        <TabsContent value="demo" className="mt-4 space-y-4">
          <GlassCard>
            <SectionTitle
              title="Ambiente de demonstração"
              description="Crie um estúdio de exemplo completo para explorar o produto, ou recrie os dados de demonstração deste espaço."
            />
            {org.isDemo && demoStatus && (
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <StatCard label="Clientes demo" value={demoStatus.counts.clients} />
                <StatCard label="Agendamentos demo" value={demoStatus.counts.appointments} />
                <StatCard label="Produtos demo" value={demoStatus.counts.products} />
                <StatCard
                  label="Total de registros demo"
                  value={(Object.values(demoStatus.counts) as number[]).reduce(
                    (acc, value) => acc + (typeof value === "number" ? value : 0),
                    0,
                  )}
                />
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="glass-soft"
                onClick={async () => {
                  try {
                    const created = await createDemo({});
                    toast.success("Workspace de demonstração criado.");
                    selectOrg(created.orgId);
                  } catch (err) {
                    toast.error(errorMessage(err));
                  }
                }}
              >
                <Wand2 className="mr-2 size-4" />
                Criar workspace de demonstração
              </Button>
              {org.isDemo && editable && (
                <>
                  <Button
                    variant="outline"
                    className="glass-soft"
                    onClick={async () => {
                      try {
                        const created = await seedHistory({ orgId: activeOrgId });
                        toast.success(`Histórico de demonstração gerado (${created} registros).`);
                      } catch (err) {
                        toast.error(errorMessage(err));
                      }
                    }}
                  >
                    <RefreshCcw className="mr-2 size-4" />
                    Gerar histórico de exemplo
                  </Button>
                  <Button variant="destructive" onClick={() => setResetOpen(true)}>
                    <Trash2 className="mr-2 size-4" />
                    Limpar dados de demonstração
                  </Button>
                </>
              )}
            </div>
            <InfoBanner>
              A limpeza remove apenas registros marcados como demonstração deste espaço.
              Organizações reais nunca são afetadas.
            </InfoBanner>
          </GlassCard>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Recriar dados de demonstração"
        description="Todos os registros de demonstração deste espaço serão removidos. Use “Gerar histórico de exemplo” para recriar."
        confirmLabel="Limpar demonstração"
        onConfirm={async () => {
          try {
            const removed = await resetDemo({ orgId: activeOrgId });
            toast.success(
              typeof removed === "number"
                ? `${removed} registro(s) de demonstração removidos.`
                : "Dados de demonstração removidos.",
            );
            setResetOpen(false);
          } catch (err) {
            toast.error(errorMessage(err));
          }
        }}
      />
    </div>
  );
}

function MembersPanel({ orgId }: { orgId: Id<"organizations"> }) {
  const { can, context } = useApp();
  const members = useQuery(api.orgs.listMembers, { orgId });
  const staff = useQuery(api.staff.staffOptions, { orgId });
  const addMember = useMutation(api.orgs.addMemberByEmail);
  const updateMember = useMutation(api.orgs.updateMember);
  const removeMember = useMutation(api.orgs.removeMember);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", role: "professional", extra: [] as string[] });
  const [error, setError] = useState<string | null>(null);
  const [removeId, setRemoveId] = useState<any | null>(null);

  if (members === undefined) return <LoadingBlock rows={3} />;
  const isDemoOrg = context?.org?.isDemo;

  return (
    <GlassCard>
      <SectionTitle
        title="Usuários e permissões"
        description="Convites por e-mail. O novo membro precisa entrar com o mesmo e-mail para acessar o espaço."
        action={
          can("users.manage") && (
            <Button onClick={() => setOpen(true)}>
              <UserPlus className="mr-2 size-4" />
              Adicionar usuário
            </Button>
          )
        }
      />
      <DataTable
        keyOf={(row: any) => row._id}
        rows={members}
        empty={<EmptyState title="Nenhum usuário" />}
        columns={[
          {
            key: "name",
            header: "Usuário",
            render: (row: any) => (
              <div>
                <p className="font-medium">{row.name}</p>
                <p className="text-xs text-muted-foreground">{row.email}</p>
              </div>
            ),
          },
          {
            key: "role",
            header: "Papel",
            render: (row: any) =>
              can("users.manage") ? (
                <Select
                  value={row.role}
                  onValueChange={async (value) => {
                    try {
                      await updateMember({ orgId, memberId: row._id, role: value as OrgRole });
                      toast.success("Papel atualizado.");
                    } catch (err) {
                      toast.error(errorMessage(err));
                    }
                  }}
                >
                  <SelectTrigger className="h-8 w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORG_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {ORG_ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                ORG_ROLE_LABELS[row.role as OrgRole]
              ),
          },
          {
            key: "extraPermissions",
            header: "Permissões extras",
            render: (row: any) => (
              <div className="flex flex-wrap gap-1">
                {(row.extraPermissions ?? []).length === 0 && (
                  <span className="text-xs text-muted-foreground">nenhuma</span>
                )}
                {(row.extraPermissions ?? []).map((permission: string) => (
                  <Badge key={permission} variant="outline" className="text-[0.6rem]">
                    {PERMISSION_LABELS[permission as Permission] ?? permission}
                  </Badge>
                ))}
              </div>
            ),
          },
          {
            key: "active",
            header: "Situação",
            render: (row: any) =>
              can("users.manage") ? (
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={row.active}
                    onChange={async (event) => {
                      try {
                        await updateMember({
                          orgId,
                          memberId: row._id,
                          active: event.target.checked,
                        });
                        toast.success("Situação atualizada.");
                      } catch (err) {
                        toast.error(errorMessage(err));
                      }
                    }}
                  />
                  {row.active ? "Ativo" : "Inativo"}
                </label>
              ) : (
                <Badge variant="outline">{row.active ? "Ativo" : "Inativo"}</Badge>
              ),
          },
          {
            key: "actions",
            header: "",
            align: "right",
            render: (row: any) =>
              can("users.manage") && row.role !== "owner" && (
                <Button variant="ghost" size="icon" className="text-rose-600" onClick={() => setRemoveId(row)}>
                  <Trash2 className="size-4" />
                </Button>
              ),
          },
        ]}
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="glass-inset rounded-xl p-3 text-xs">
          <p className="font-semibold">Equipe e usuários</p>
          <p className="mt-1 leading-5 text-muted-foreground">
            Profissionais cadastrados em <strong>Equipe</strong>: {(staff ?? []).length}. Permissões
            de acesso e regras de comissão são configurações independentes.
          </p>
        </div>
        <div className="glass-inset rounded-xl p-3 text-xs">
          <p className="font-semibold">Isolamento de dados</p>
          <p className="mt-1 leading-5 text-muted-foreground">
            Cada organização tem registros próprios. Operações cruzadas entre organizações são
            recusadas no backend.
          </p>
        </div>
      </div>

      {isDemoOrg && (
        <InfoBanner tone="warning">
          Espaços de demonstração compartilham a marca “dados de demonstração”. Use um espaço real
          para operar o negócio.
        </InfoBanner>
      )}

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        size="lg"
        title="Adicionar usuário"
        description="O acesso é liberado quando a pessoa entra com este e-mail."
        submitLabel="Adicionar"
        error={error}
        onSubmit={async () => {
          setError(null);
          try {
            await addMember({
              orgId,
              email: form.email,
              name: form.name,
              role: form.role as OrgRole,
              extraPermissions: form.extra,
            });
            toast.success("Usuário adicionado.");
            setOpen(false);
            setForm({ email: "", name: "", role: "professional", extra: [] });
          } catch (err) {
            setError(errorMessage(err));
          }
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome *">
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </Field>
          <Field label="E-mail *">
            <Input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </Field>
          <Field label="Papel *">
            <Select value={form.role} onValueChange={(value) => setForm({ ...form, role: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORG_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {ORG_ROLE_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field label="Permissões adicionais" hint="Além das permissões padrão do papel">
          <div className="scroll-thin max-h-52 space-y-1 overflow-y-auto rounded-xl border border-white/60 bg-white/45 p-2">
            {PERMISSIONS.map((permission) => (
              <label key={permission} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={form.extra.includes(permission)}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      extra: event.target.checked
                        ? [...prev.extra, permission]
                        : prev.extra.filter((item) => item !== permission),
                    }))
                  }
                />
                {PERMISSION_LABELS[permission]}
              </label>
            ))}
          </div>
        </Field>
      </FormDialog>

      <ConfirmDialog
        open={!!removeId}
        onOpenChange={() => setRemoveId(null)}
        title={`Remover ${removeId?.name ?? ""}`}
        description="O usuário perde o acesso a este espaço. Registros históricos permanecem."
        confirmLabel="Remover acesso"
        onConfirm={async () => {
          try {
            await removeMember({ orgId, memberId: removeId._id });
            toast.success("Acesso removido.");
            setRemoveId(null);
          } catch (err) {
            toast.error(errorMessage(err));
          }
        }}
      />
    </GlassCard>
  );
}

export function Audit() {
  const { orgId, can } = useApp();
  const [limit, setLimit] = useState("100");
  const logs = useQuery(
    api.orgs.listAuditLogs,
    orgId ? { orgId, limit: Number(limit) || 100 } : "skip",
  );
  const [demoOpen, setDemoOpen] = useState(false);
  const status = useQuery(api.demo.demoStatus, orgId ? { orgId } : "skip");

  if (!orgId) return <LoadingBlock rows={4} />;
  if (logs === undefined) return <LoadingBlock rows={4} />;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Configurações"
        title="Privacidade e auditoria"
        description="Trilha de auditoria das operações relevantes, incluindo alterações financeiras, exclusões, permissões e exportações."
        actions={
          <Button variant="outline" className="glass-soft" onClick={() => setDemoOpen(true)}>
            <ShieldCheck className="mr-2 size-4" />
            Direitos do titular (LGPD)
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Eventos registrados" value={logs.length} />
        <StatCard
          label="Últimos 7 dias"
          value={
            logs.filter((log: any) => log.createdAt >= Date.now() - 7 * 86_400_000).length
          }
          tone="info"
        />
        <StatCard
          label="Alterações financeiras"
          value={
            logs.filter((log: any) =>
              ["invoices", "payments", "expenses", "commissions", "giftCards"].includes(log.entity),
            ).length
          }
          tone="warning"
        />
        <StatCard
          label="Registros de demonstração"
          value={
            status
              ? (Object.values(status.counts) as number[]).reduce(
                  (acc, value) => acc + (typeof value === "number" ? value : 0),
                  0,
                )
              : 0
          }
        />
      </div>

      <GlassCard padded={false} className="p-3">
        <Field label="Quantidade de eventos">
          <Select value={limit} onValueChange={setLimit}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="250">250</SelectItem>
              <SelectItem value="500">500</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </GlassCard>

      <GlassCard>
        <DataTable
          keyOf={(row: any) => row._id}
          rows={logs}
          empty={<EmptyState title="Nenhum evento registrado" />}
          dense
          columns={[
            {
              key: "createdAt",
              header: "Data e hora",
              render: (row: any) => formatDateTime(row.createdAt),
            },
            { key: "userName", header: "Usuário" },
            { key: "action", header: "Ação" },
            { key: "entity", header: "Registro" },
            { key: "details", header: "Detalhes", render: (row: any) => row.details ?? "—" },
          ]}
        />
      </GlassCard>

      <GlassCard>
        <SectionTitle title="Como protegemos os dados" />
        <ul className="space-y-2 text-xs leading-5 text-muted-foreground">
          <li>• Permissões verificadas no backend em cada consulta e operação.</li>
          <li>• Registros de saúde e fotos com controle de acesso dedicado.</li>
          <li>• Consentimento de tratamento separado do consentimento de imagem.</li>
          <li>• Exportações restritas a quem possui a permissão correspondente.</li>
          <li>• Nenhum chave secreta ou credencial é exposta no navegador.</li>
          <li>
            • O sistema apoia a conformidade com a LGPD, mas não substitui a revisão jurídica da
            operação.
          </li>
        </ul>
      </GlassCard>

      <FormDialog
        open={demoOpen}
        onOpenChange={setDemoOpen}
        title="Direitos do titular"
        description="Fluxos disponíveis hoje para atender solicitações de acesso, correção e exclusão."
        submitLabel="Fechar"
        onSubmit={() => setDemoOpen(false)}
      >
        <ul className="space-y-2 text-xs leading-5 text-muted-foreground">
          <li>
            <strong>Acesso e portabilidade:</strong> exporte clientes, atendimentos, pagamentos e
            demais conjuntos em Relatórios → Exportações.
          </li>
          <li>
            <strong>Correção:</strong> edite os dados na ficha da cliente; alterações ficam
            auditadas.
          </li>
          <li>
            <strong>Exclusão:</strong> use “Excluir dados da cliente” na ficha, que remove histórico
            pessoal quando não houver obrigação legal de retenção.
          </li>
          <li>
            <strong>Informações sensíveis:</strong> acesso restrito por permissão
            (health.view) e registrado em auditoria.
          </li>
        </ul>
      </FormDialog>

      {!can("photos.share") && (
        <InfoBanner>
          Você pode consultar a trilha de auditoria, mas não possui permissão para exportar fotos
          aprovadas para divulgação.
        </InfoBanner>
      )}
    </div>
  );
}

