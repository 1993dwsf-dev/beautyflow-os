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
import { errorMessage } from "@/lib/errors";
import {
  APPOINTMENT_STATUS,
  CONSENT_TYPE,
  PAYMENT_METHOD,
  RETENTION_STATUS,
  formatDate,
  formatPhone,
  initials,
  label,
  money,
  whatsappLink,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  CalendarPlus,
  MessageCircle,
  Pencil,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

export default function Clients() {
  const { orgId, can } = useApp();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [tag, setTag] = useState("all");
  const [retention, setRetention] = useState("all");
  const [dialog, setDialog] = useState<{ open: boolean; client?: any }>({
    open: false,
  });
  const navigate = useNavigate();

  const data = useQuery(
    api.clients.listClients,
    orgId
      ? {
          orgId,
          search: search || undefined,
          status: status === "all" ? undefined : status,
          tag: tag === "all" ? undefined : tag,
          retention: retention === "all" ? undefined : retention,
        }
      : "skip",
  );
  const birthdays = useQuery(
    api.clients.upcomingBirthdays,
    orgId ? { orgId, days: 30 } : "skip",
  );

  if (!orgId) return <LoadingBlock rows={5} />;
  if (data === undefined) return <LoadingBlock rows={5} />;

  const rows: any[] = data.rows ?? [];
  const vip = rows.filter((row) => row.tags?.includes("VIP")).length;
  const inactive = rows.filter((row) => row.metrics.retentionStatus === "inativo").length;
  const lifetime = rows.reduce((acc, row) => acc + (row.metrics.lifetimeValue ?? 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Clientes"
        title="Cadastro de clientes"
        description="Busque por nome, telefone ou e-mail. Os indicadores usam apenas atendimentos concluídos e pagamentos registrados."
        actions={
          can("clients.edit") && (
            <Button onClick={() => setDialog({ open: true })}>
              <UserPlus className="mr-2 size-4" />
              Nova cliente
            </Button>
          )
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Clientes listados" value={rows.length} icon={<Users className="size-4" />} />
        <StatCard label="Clientes VIP" value={vip} icon={<Sparkles className="size-4" />} tone="primary" />
        <StatCard label="Inativas (>120 dias)" value={inactive} tone="warning" />
        <StatCard
          label="Receita acumulada"
          value={money(lifetime)}
          hint="Somatório do valor pago pelas clientes filtradas"
          tone="positive"
        />
      </div>

      <GlassCard padded={false} className="p-3">
        <div className="flex flex-wrap gap-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome, telefone ou e-mail"
            className="h-9 w-full sm:w-72"
          />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="ativo">Ativas</SelectItem>
              <SelectItem value="inativo">Inativas</SelectItem>
              <SelectItem value="vip">VIP</SelectItem>
              <SelectItem value="bloqueado">Bloqueadas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={tag} onValueChange={setTag}>
            <SelectTrigger className="h-9 w-44">
              <SelectValue placeholder="Etiqueta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as etiquetas</SelectItem>
              {(data.tags ?? []).map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={retention} onValueChange={setRetention}>
            <SelectTrigger className="h-9 w-52">
              <SelectValue placeholder="Retorno" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os retornos</SelectItem>
              {Object.entries(RETENTION_STATUS).map(([key, value]) => (
                <SelectItem key={key} value={key}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="ml-auto self-center text-xs text-muted-foreground">
            {data.total ?? 0} cliente(s)
          </span>
        </div>
      </GlassCard>

      {can("clients.view") ? (
        <GlassCard>
          <DataTable
            keyOf={(row: any) => row._id}
            onRowClick={(row: any) => navigate(`/app/clientes/${row._id}`)}
            rows={rows}
            empty={
              <EmptyState
                title="Nenhuma cliente encontrada"
                description="Ajuste os filtros ou cadastre uma nova cliente."
                icon={<Users className="size-5" />}
              />
            }
            columns={[
              {
                key: "name",
                header: "Cliente",
                render: (row: any) => (
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 items-center justify-center rounded-xl bg-primary/12 text-[0.7rem] font-semibold text-primary">
                      {initials(row.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{row.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.email ?? "sem e-mail"}
                      </p>
                    </div>
                  </div>
                ),
              },
              {
                key: "phone",
                header: "Contato",
                render: (row: any) => (
                  <div className="text-xs">
                    <p>{formatPhone(row.phone)}</p>
                    <a
                      href={whatsappLink(row.whatsapp ?? row.phone)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <MessageCircle className="size-3" /> WhatsApp
                    </a>
                  </div>
                ),
              },
              {
                key: "tags",
                header: "Etiquetas",
                render: (row: any) => (
                  <div className="flex flex-wrap gap-1">
                    {(row.tags ?? []).length === 0 && (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                    {(row.tags ?? []).map((item: string) => (
                      <Badge key={item} variant="outline" className="text-[0.62rem]">
                        {item}
                      </Badge>
                    ))}
                  </div>
                ),
              },
              {
                key: "visits",
                header: "Visitas",
                align: "center",
                render: (row: any) => row.metrics.completed,
              },
              {
                key: "lastVisit",
                header: "Última visita",
                render: (row: any) => (
                  <div className="text-xs">
                    <p>{row.metrics.lastVisit ? formatDate(row.metrics.lastVisit) : "—"}</p>
                    <p className="text-muted-foreground">
                      {row.metrics.daysSinceLastVisit !== undefined
                        ? `${row.metrics.daysSinceLastVisit} dias`
                        : "sem histórico"}
                    </p>
                  </div>
                ),
              },
              {
                key: "nextReturn",
                header: "Próximo retorno",
                render: (row: any) => (
                  <div className="text-xs">
                    <p>{row.metrics.nextReturn ? formatDate(row.metrics.nextReturn) : "—"}</p>
                    {row.metrics.nextAppointment && (
                      <p className="text-primary">
                        agendado {formatDate(row.metrics.nextAppointment)}
                      </p>
                    )}
                  </div>
                ),
              },
              {
                key: "retention",
                header: "Situação",
                render: (row: any) => (
                  <StatusPill
                    label={label(RETENTION_STATUS, row.metrics.retentionStatus)}
                    className={cn(
                      row.metrics.retentionStatus === "em_dia" &&
                        "border-emerald-200 bg-emerald-50 text-emerald-700",
                      row.metrics.retentionStatus === "atrasado" &&
                        "border-rose-200 bg-rose-50 text-rose-700",
                      row.metrics.retentionStatus === "inativo" &&
                        "border-slate-200 bg-slate-50 text-slate-600",
                    )}
                  />
                ),
              },
              {
                key: "lifetime",
                header: "Valor pago",
                align: "right",
                render: (row: any) => money(row.metrics.lifetimeValue),
              },
              {
                key: "open",
                header: "Em aberto",
                align: "right",
                render: (row: any) => (
                  <span
                    className={cn(
                      row.metrics.outstanding > 0 && "font-medium text-amber-600",
                    )}
                  >
                    {money(row.metrics.outstanding)}
                  </span>
                ),
              },
            ]}
          />
        </GlassCard>
      ) : (
        <InfoBanner tone="warning">
          Você não possui permissão para acessar os registros de clientes.
        </InfoBanner>
      )}

      {birthdays && birthdays.length > 0 && (
        <GlassCard>
          <SectionTitle
            title="Aniversários nos próximos 30 dias"
            description="Boa oportunidade para contato e ofertas personalizadas."
          />
          <div className="flex flex-wrap gap-2">
            {birthdays.map((item: any) => (
              <div key={item.client._id} className="glass-inset rounded-xl px-3 py-2 text-xs">
                <p className="font-medium">{item.client.name}</p>
                <p className="text-muted-foreground">
                  {formatDate(item.date)} · em {item.daysAway} dia(s)
                </p>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {dialog.open && orgId && (
        <ClientDialog
          orgId={orgId}
          client={dialog.client}
          onClose={() => setDialog({ open: false })}
        />
      )}
    </div>
  );
}

function ClientDialog({
  orgId,
  client,
  onClose,
}: {
  orgId: Id<"organizations">;
  client?: any;
  onClose: () => void;
}) {
  const create = useMutation(api.clients.createClient);
  const update = useMutation(api.clients.updateClient);
  const [form, setForm] = useState({
    name: client?.name ?? "",
    socialName: client?.socialName ?? "",
    phone: client?.phone ?? "",
    whatsapp: client?.whatsapp ?? "",
    email: client?.email ?? "",
    document: client?.document ?? "",
    birthday: client?.birthday ?? "",
    preferredContact: client?.preferredContact ?? "whatsapp",
    referralSource: client?.referralSource ?? "",
    status: client?.status ?? "ativo",
    tags: (client?.tags ?? []).join(", "),
    notes: client?.notes ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit() {
    setLoading(true);
    setError(null);
    const payload = {
      orgId,
      name: form.name,
      socialName: form.socialName || undefined,
      phone: form.phone,
      whatsapp: form.whatsapp || undefined,
      email: form.email || undefined,
      document: form.document || undefined,
      birthday: form.birthday || undefined,
      preferredContact: form.preferredContact,
      referralSource: form.referralSource || undefined,
      tags: form.tags
        .split(",")
        .map((tag: string) => tag.trim())
        .filter(Boolean),
      status: form.status,
      notes: form.notes || undefined,
    };
    try {
      if (client) {
        await update({ orgId, clientId: client._id, patch: payload });
        toast.success("Cliente atualizada.");
      } else {
        await create(payload);
        toast.success("Cliente cadastrada com sucesso.");
      }
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <FormDialog
      open
      onOpenChange={(value) => !value && onClose()}
      size="xl"
      title={client ? "Editar cliente" : "Nova cliente"}
      description="Dados de contato. CPF é opcional e usado apenas quando necessário."
      onSubmit={submit}
      loading={loading}
      error={error}
      submitLabel={client ? "Salvar alterações" : "Cadastrar cliente"}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome completo *">
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Nome social / como prefere ser chamada">
          <Input value={form.socialName} onChange={(e) => set("socialName", e.target.value)} />
        </Field>
        <Field label="Telefone *" hint="Formato brasileiro com DDD">
          <Input
            value={form.phone}
            onChange={(e) => set("phone", formatPhone(e.target.value))}
            placeholder="(11) 98765-4321"
          />
        </Field>
        <Field label="WhatsApp">
          <Input
            value={form.whatsapp}
            onChange={(e) => set("whatsapp", formatPhone(e.target.value))}
          />
        </Field>
        <Field label="E-mail">
          <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="CPF (opcional)">
          <Input value={form.document} onChange={(e) => set("document", e.target.value)} />
        </Field>
        <Field label="Data de nascimento">
          <Input
            type="date"
            value={form.birthday}
            onChange={(e) => set("birthday", e.target.value)}
          />
        </Field>
        <Field label="Contato preferido">
          <Select
            value={form.preferredContact}
            onValueChange={(value) => set("preferredContact", value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="telefone">Telefone</SelectItem>
              <SelectItem value="email">E-mail</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Origem / como nos conheceu">
          <Input
            value={form.referralSource}
            onChange={(e) => set("referralSource", e.target.value)}
            placeholder="Instagram, indicação, passou na porta…"
          />
        </Field>
        <Field label="Status">
          <Select value={form.status} onValueChange={(value) => set("status", value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ativo">Ativa</SelectItem>
              <SelectItem value="vip">VIP</SelectItem>
              <SelectItem value="inativo">Inativa</SelectItem>
              <SelectItem value="bloqueado">Bloqueada</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Etiquetas" hint="Separe por vírgulas. Ex.: VIP, Coloração, Cílios">
        <Input value={form.tags} onChange={(e) => set("tags", e.target.value)} />
      </Field>

      <Field label="Observações gerais">
        <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
      </Field>
    </FormDialog>
  );
}

// ---------------------------------------------------------------------------
// Client profile
// ---------------------------------------------------------------------------

export function ClientDetail() {
  const { clientId } = useParams();
  const { orgId, can } = useApp();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentType, setConsentType] = useState("tratamento");
  const [consentGranted, setConsentGranted] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const data = useQuery(
    api.clients.getClient,
    orgId && clientId
      ? { orgId, clientId: clientId as Id<"clients"> }
      : "skip",
  );
  const recordConsent = useMutation(api.crm.recordConsent);
  const deleteData = useMutation(api.clients.deleteClientData);

  if (!orgId) return <LoadingBlock rows={4} />;
  if (data === undefined) return <LoadingBlock rows={4} />;
  if (data === null) {
    return (
      <EmptyState
        title="Cliente não encontrada"
        description="O registro pode pertencer a outra organização."
        action={<Button onClick={() => navigate("/app/clientes")}>Voltar</Button>}
      />
    );
  }

  const client = data.client;
  const metrics = data.metrics;

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={() => navigate("/app/clientes")}>
        <ArrowLeft className="mr-1.5 size-4" />
        Voltar para clientes
      </Button>

      <PageHeader
        eyebrow="Ficha da cliente"
        title={client.name}
        description={`${formatPhone(client.phone)} · cliente desde ${formatDate(
          new Date(client.createdAt).toISOString().slice(0, 10),
        )}`}
        actions={
          <>
            <a href={whatsappLink(client.whatsapp ?? client.phone)} target="_blank" rel="noreferrer">
              <Button variant="outline" className="glass-soft">
                <MessageCircle className="mr-2 size-4" />
                WhatsApp
              </Button>
            </a>
            {can("appointments.edit") && (
              <Button onClick={() => navigate(`/app/agenda?client=${client._id}`)}>
                <CalendarPlus className="mr-2 size-4" />
                Agendar
              </Button>
            )}
            {can("clients.edit") && (
              <Button variant="outline" className="glass-soft" onClick={() => setEditOpen(true)}>
                <Pencil className="mr-2 size-4" />
                Editar
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Valor total pago" value={money(metrics.lifetimeValue)} tone="positive" />
        <StatCard label="Atendimentos concluídos" value={metrics.completed} />
        <StatCard
          label="Cancelamentos / faltas"
          value={`${metrics.cancelled} / ${metrics.noShows}`}
          tone="warning"
        />
        <StatCard
          label="Saldo em aberto"
          value={money(metrics.outstanding)}
          tone={metrics.outstanding > 0 ? "warning" : "neutral"}
        />
      </div>

      <Tabs defaultValue="visao" className="space-y-4">
        <div className="glass rounded-2xl p-2">
          <TabsList className="glass-soft flex-wrap">
            <TabsTrigger value="visao">Visão geral</TabsTrigger>
            <TabsTrigger value="atendimentos">Atendimentos</TabsTrigger>
            <TabsTrigger value="fichas">Fichas de tratamento</TabsTrigger>
            <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
            <TabsTrigger value="consentimentos">Consentimentos</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="visao">
          <div className="grid gap-4 lg:grid-cols-2">
            <GlassCard>
              <SectionTitle title="Dados de contato" />
              <dl className="space-y-2 text-sm">
                {[
                  ["Nome social", client.socialName ?? "—"],
                  ["Telefone", formatPhone(client.phone)],
                  ["WhatsApp", client.whatsapp ? formatPhone(client.whatsapp) : "—"],
                  ["E-mail", client.email ?? "—"],
                  ["Nascimento", client.birthday ? formatDate(client.birthday) : "—"],
                  ["Contato preferido", client.preferredContact ?? "—"],
                  ["Origem", client.referralSource ?? "—"],
                ].map(([term, value]) => (
                  <div key={term} className="flex justify-between gap-4 border-b border-white/50 pb-1.5 last:border-0">
                    <dt className="text-muted-foreground">{term}</dt>
                    <dd className="text-right">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-3 flex flex-wrap gap-1">
                {(client.tags ?? []).map((tag: string) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            </GlassCard>

            <GlassCard>
              <SectionTitle title="Observações e histórico" />
              <p className="text-sm text-muted-foreground">
                {client.notes ?? "Nenhuma observação geral."}
              </p>
              <div className="glass-rule my-3" />
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>
                  Última visita:{" "}
                  {metrics.lastVisit ? formatDate(metrics.lastVisit) : "sem histórico"}
                </p>
                <p>
                  Retorno recomendado:{" "}
                  {metrics.nextReturn ? formatDate(metrics.nextReturn) : "não definido"}
                </p>
                <p>Situação de retenção: {label(RETENTION_STATUS, metrics.retentionStatus)}</p>
              </div>
            </GlassCard>
          </div>
        </TabsContent>

        <TabsContent value="atendimentos">
          <GlassCard>
            <SectionTitle title="Histórico de atendimentos" />
            <DataTable
              dense
              keyOf={(row: any) => row._id}
              rows={data.appointments}
              columns={[
                { key: "date", header: "Data", render: (row: any) => formatDate(row.date) },
                {
                  key: "items",
                  header: "Serviços",
                  render: (row: any) => row.items.map((i: any) => i.name).join(", "),
                },
                {
                  key: "status",
                  header: "Status",
                  render: (row: any) => label(APPOINTMENT_STATUS, row.status),
                },
                {
                  key: "total",
                  header: "Valor",
                  align: "right",
                  render: (row: any) => money(row.totalPrice - row.discount),
                },
              ]}
            />
          </GlassCard>
        </TabsContent>

        <TabsContent value="fichas">
          <GlassCard>
            <SectionTitle
              title="Fichas de tratamento"
              description="Histórico cronológico de fórmulas, produtos e recomendações."
            />
            {data.records.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhuma ficha registrada ainda.
              </p>
            )}
            <div className="space-y-3">
              {data.records.map((record: any) => (
                <div key={record._id} className="glass-inset rounded-xl p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{formatDate(record.date)}</Badge>
                    <span className="font-medium">{record.serviceName}</span>
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {record.formula && <p>Fórmula: {record.formula}</p>}
                    {record.notes && <p>Notas: {record.notes}</p>}
                    {record.reactions && <p>Reações relatadas: {record.reactions}</p>}
                    {record.aftercare && <p>Cuidados: {record.aftercare}</p>}
                    {record.nextVisitDate && (
                      <p>
                        Retorno sugerido ({record.nextVisitIntervalDays} dias):{" "}
                        {formatDate(record.nextVisitDate)}
                      </p>
                    )}
                    {record.productsUsed?.length > 0 && (
                      <p>
                        Produtos:{" "}
                        {record.productsUsed
                          .map((p: any) => `${p.name} (${p.quantity})`)
                          .join(", ")}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </TabsContent>

        <TabsContent value="financeiro">
          <div className="grid gap-4 lg:grid-cols-2">
            <GlassCard>
              <SectionTitle title="Faturas" />
              <DataTable
                dense
                keyOf={(row: any) => row._id}
                rows={data.invoices}
                columns={[
                  { key: "number", header: "Número" },
                  { key: "issueDate", header: "Emissão", render: (row: any) => formatDate(row.issueDate) },
                  { key: "total", header: "Total", align: "right", render: (row: any) => money(row.total) },
                  { key: "status", header: "Status" },
                ]}
              />
            </GlassCard>
            <GlassCard>
              <SectionTitle title="Pagamentos" description="Inclui sinais, pagamentos e estornos." />
              <DataTable
                dense
                keyOf={(row: any) => row._id}
                rows={data.payments}
                columns={[
                  { key: "date", header: "Data", render: (row: any) => formatDate(row.date) },
                  {
                    key: "method",
                    header: "Forma",
                    render: (row: any) => label(PAYMENT_METHOD, row.method),
                  },
                  { key: "kind", header: "Tipo" },
                  {
                    key: "amount",
                    header: "Valor",
                    align: "right",
                    render: (row: any) => (
                      <span className={row.kind === "reembolso" ? "text-rose-600" : ""}>
                        {row.kind === "reembolso" ? "− " : ""}
                        {money(row.amount)}
                      </span>
                    ),
                  },
                ]}
              />
            </GlassCard>
          </div>
        </TabsContent>

        <TabsContent value="consentimentos">
          <GlassCard>
            <SectionTitle
              title="Consentimentos"
              description="Consentimento para tratamento é separado do consentimento para uso de imagem."
              action={
                can("consent.edit") && (
                  <Button size="sm" onClick={() => setConsentOpen(true)}>
                    <ShieldCheck className="mr-1.5 size-3.5" />
                    Registrar consentimento
                  </Button>
                )
              }
            />
            {data.consent.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhum consentimento registrado.
              </p>
            )}
            <div className="space-y-2">
              {data.consent.map((record: any) => (
                <div
                  key={record._id}
                  className="glass-inset flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs"
                >
                  <span>{label(CONSENT_TYPE, record.type)}</span>
                  <span className="flex items-center gap-2">
                    <StatusPill
                      label={record.granted ? "Autorizado" : "Não autorizado"}
                      className={
                        record.granted
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-rose-200 bg-rose-50 text-rose-700"
                      }
                    />
                    <span className="text-muted-foreground">{formatDate(record.date)}</span>
                  </span>
                </div>
              ))}
            </div>
          </GlassCard>
        </TabsContent>

      </Tabs>

      {can("settings.edit") && (
        <GlassCard>
          <SectionTitle
            title="Privacidade e retenção de dados (LGPD)"
            description="A exclusão anonimiza dados pessoais. Histórico financeiro é preservado para conformidade."
          />
          <Button variant="outline" className="text-rose-600" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="mr-2 size-4" />
            Excluir dados pessoais desta cliente
          </Button>
        </GlassCard>
      )}

      {editOpen && (
        <ClientDialog orgId={orgId} client={client} onClose={() => setEditOpen(false)} />
      )}

      <FormDialog
        open={consentOpen}
        onOpenChange={setConsentOpen}
        title="Registrar consentimento"
        description="Cada consentimento é gravado com data e é obrigatório para uso público de imagens."
        submitLabel="Registrar"
        onSubmit={async () => {
          try {
            await recordConsent({
              orgId,
              clientId: client._id,
              type: consentType,
              granted: consentGranted,
            });
            toast.success("Consentimento registrado.");
            setConsentOpen(false);
          } catch (err) {
            toast.error(errorMessage(err));
          }
        }}
      >
        <Field label="Tipo de consentimento">
          <Select value={consentType} onValueChange={setConsentType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CONSENT_TYPE).map(([key, value]) => (
                <SelectItem key={key} value={key}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Situação">
          <Select
            value={consentGranted ? "sim" : "nao"}
            onValueChange={(value) => setConsentGranted(value === "sim")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sim">Autorizado</SelectItem>
              <SelectItem value="nao">Não autorizado</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </FormDialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir dados pessoais"
        description="Esta ação remove nome, contatos e endereço. O histórico financeiro permanece para fins contábeis e não pode ser recriado."
        confirmLabel="Confirmar exclusão"
        onConfirm={async () => {
          try {
            await deleteData({ orgId, clientId: client._id });
            toast.success("Dados pessoais anonimizados.");
            setDeleteOpen(false);
            navigate("/app/clientes");
          } catch (err) {
            toast.error(errorMessage(err));
          }
        }}
      />
    </div>
  );
}
