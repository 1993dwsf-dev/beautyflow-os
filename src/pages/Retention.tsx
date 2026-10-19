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
  MoneyInput,
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
  CAMPAIGN_STATUS,
  FOLLOWUP_TYPE,
  MESSAGE_TEMPLATES,
  PAYMENT_METHOD,
  PRIORITY,
  WAITLIST_STATUS,
  addDays,
  centsToInput,
  formatDate,
  label,
  money,
  parseMoney,
  todayISO,
  whatsappLink,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  BellRing,
  Cake,
  Check,
  Copy,
  Gift,
  Megaphone,
  MessageCircle,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Retention dashboard
// ---------------------------------------------------------------------------

type Bucket = {
  clientId: Id<"clients">;
  name: string;
  phone: string;
  lastVisit?: string;
  nextReturn?: string;
  returnInDays?: number;
  daysSinceVisit: number;
  spend: number;
  visits: number;
  lastService?: string;
  nextAppointment?: string;
};

export function Retention() {
  const { orgId, can } = useApp();
  const [inactiveDays, setInactiveDays] = useState("120");
  const [tab, setTab] = useState("due");
  const [selected, setSelected] = useState<string[]>([]);
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskType, setTaskType] = useState("reagendamento");
  const [taskDate, setTaskDate] = useState(addDays(todayISO(), 3));
  const [taskNotes, setTaskNotes] = useState("");

  const data = useQuery(
    api.retention.retentionDashboard,
    orgId ? { orgId, inactiveDays: Number(inactiveDays) || 120 } : "skip",
  );
  const createTask = useMutation(api.retention.createRetentionTask);

  if (!orgId) return <LoadingBlock rows={4} />;
  if (data === undefined) return <LoadingBlock rows={4} />;

  const buckets: Record<string, Bucket[]> = {
    due: data.due as unknown as Bucket[],
    overdue: data.overdue as unknown as Bucket[],
    inactive: data.inactive as unknown as Bucket[],
    atRisk: data.atRisk as unknown as Bucket[],
    highValue: data.highValue as unknown as Bucket[],
  };
  const current = buckets[tab] ?? [];

  const columns = [
    {
      key: "name",
      header: "Cliente",
      render: (row: Bucket) => (
        <div>
          <p className="font-medium">{row.name}</p>
          <p className="text-xs text-muted-foreground">{row.phone}</p>
        </div>
      ),
    },
    {
      key: "lastVisit",
      header: "Último atendimento",
      render: (row: Bucket) => (
        <span className="text-xs">
          {row.lastVisit ? formatDate(row.lastVisit) : "sem histórico"}
          {row.visits > 0 && <span className="text-muted-foreground"> · {row.visits} visita(s)</span>}
        </span>
      ),
    },
    {
      key: "daysSinceVisit",
      header: "Dias sem visita",
      align: "right" as const,
      render: (row: Bucket) => (row.visits > 0 ? row.daysSinceVisit : "—"),
    },
    {
      key: "nextReturn",
      header: "Retorno previsto",
      render: (row: Bucket) => (
        <span className={cn("text-xs", row.returnInDays !== undefined && row.returnInDays < 0 && "text-rose-600")}>
          {row.nextReturn ? formatDate(row.nextReturn) : "não definido"}
          {row.returnInDays !== undefined && (
            <span className="text-muted-foreground">
              {" "}
              ({row.returnInDays >= 0 ? `em ${row.returnInDays} dia(s)` : `${Math.abs(row.returnInDays)} dia(s) atrás`})
            </span>
          )}
        </span>
      ),
    },
    {
      key: "lastService",
      header: "Último serviço",
      render: (row: Bucket) => <span className="text-xs">{row.lastService ?? "—"}</span>,
    },
    {
      key: "spend",
      header: "Total gasto",
      align: "right" as const,
      render: (row: Bucket) => money(row.spend),
    },
    {
      key: "contact",
      header: "",
      align: "right" as const,
      render: (row: Bucket) => (
        <a
          href={whatsappLink(
            row.phone,
            `Oi ${row.name.split(" ")[0]}! Sentimos sua falta 💚 Quer agendar seu ${row.lastService ?? "atendimento"}?`,
          )}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <MessageCircle className="size-3.5" />
          WhatsApp
        </a>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Relacionamento"
        title="Retenção e reagendamento"
        description="Clientes com retorno previsto, atrasado, inativos e de maior valor. O ciclo de retorno é sempre contado a partir do último atendimento concluído — cancelamentos e faltas não reiniciam o ciclo."
        actions={
          can("clients.edit") && (
            <Button disabled={!selected.length} onClick={() => setTaskOpen(true)}>
              <BellRing className="mr-2 size-4" />
              Criar tarefa ({selected.length})
            </Button>
          )
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Retorno previsto" value={data.summary.due} tone="info" hint="Nos próximos dias" />
        <StatCard label="Retorno atrasado" value={data.summary.overdue} tone="warning" />
        <StatCard label="Inativas" value={data.summary.inactive} tone="negative" hint={`+${inactiveDays} dias`} />
        <StatCard label="Em risco" value={data.summary.atRisk} tone="warning" />
        <StatCard
          label="Já reagendadas"
          value={data.summary.scheduled}
          tone="positive"
          hint="Com atendimento futuro marcado"
        />
      </div>

      <GlassCard padded={false} className="p-3">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Considerar inativa após (dias)">
            <Input
              type="number"
              value={inactiveDays}
              onChange={(event) => setInactiveDays(event.target.value)}
              className="w-40"
            />
          </Field>
          <span className="ml-auto text-xs text-muted-foreground">
            {selected.length} cliente(s) selecionado(s) para ação
          </span>
        </div>
      </GlassCard>

      <Tabs value={tab} onValueChange={(value) => { setTab(value); setSelected([]); }}>
        <TabsList className="glass-soft flex-wrap">
          <TabsTrigger value="due">Retorno previsto ({buckets.due.length})</TabsTrigger>
          <TabsTrigger value="overdue">Atrasadas ({buckets.overdue.length})</TabsTrigger>
          <TabsTrigger value="inactive">Inativas ({buckets.inactive.length})</TabsTrigger>
          <TabsTrigger value="atRisk">Em risco ({buckets.atRisk.length})</TabsTrigger>
          <TabsTrigger value="highValue">Maior valor ({buckets.highValue.length})</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <GlassCard>
            <SectionTitle
              title="Selecione clientes para criar tarefas de acompanhamento"
              description="As tarefas aparecem em Alertas. Mensagens externas nunca são enviadas automaticamente."
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setSelected(
                      current.length && selected.length === current.length
                        ? []
                        : current.map((row) => row.clientId as string),
                    )
                  }
                >
                  {selected.length === current.length && current.length ? "Limpar" : "Selecionar todos"}
                </Button>
              }
            />
            <DataTable
              keyOf={(row: Bucket) => row.clientId as string}
              rows={current}
              onRowClick={(row: Bucket) =>
                setSelected((prev) =>
                  prev.includes(row.clientId as string)
                    ? prev.filter((id) => id !== row.clientId)
                    : [...prev, row.clientId as string],
                )
              }
              empty={<EmptyState title="Nenhuma cliente nesta categoria" icon={<RefreshCw className="size-5" />} />}
              columns={columns.map((column) =>
                column.key === "name"
                  ? {
                      ...column,
                      render: (row: Bucket) => (
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "flex size-4 items-center justify-center rounded border",
                              selected.includes(row.clientId as string)
                                ? "border-primary bg-primary text-white"
                                : "border-white/70 bg-white/70",
                            )}
                          >
                            {selected.includes(row.clientId as string) && <Check className="size-3" />}
                          </span>
                          <div>
                            <p className="font-medium">{row.name}</p>
                            <p className="text-xs text-muted-foreground">{row.phone}</p>
                          </div>
                        </div>
                      ),
                    }
                  : column,
              )}
            />
          </GlassCard>
        </TabsContent>
      </Tabs>

      <GlassCard>
        <SectionTitle
          title="Modelos de mensagem"
          description="Copie o texto e envie pelo canal escolhido pela cliente. O sistema não dispara mensagens sem integração configurada."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MESSAGE_TEMPLATES.map((template) => (
            <div key={template.name} className="glass-inset rounded-xl p-3">
              <p className="text-xs font-semibold">{template.name}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{template.text}</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(template.text);
                    toast.success("Texto copiado.");
                  } catch {
                    toast.error("Não foi possível copiar. Selecione o texto manualmente.");
                  }
                }}
              >
                <Copy className="mr-1.5 size-3.5" />
                Copiar
              </Button>
            </div>
          ))}
        </div>
      </GlassCard>

      <FormDialog
        open={taskOpen}
        onOpenChange={setTaskOpen}
        title="Criar tarefas de acompanhamento"
        description={`${selected.length} cliente(s) receberão uma tarefa interna.`}
        submitLabel="Criar tarefas"
        onSubmit={async () => {
          try {
            await createTask({
              orgId,
              clientIds: selected as Id<"clients">[],
              type: taskType,
              dueDate: taskDate,
              notes: taskNotes || undefined,
            });
            toast.success("Tarefas criadas.");
            setTaskOpen(false);
            setSelected([]);
            setTaskNotes("");
          } catch (err) {
            toast.error(errorMessage(err));
          }
        }}
      >
        <Field label="Tipo">
          <Select value={taskType} onValueChange={setTaskType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(FOLLOWUP_TYPE).map(([key, value]) => (
                <SelectItem key={key} value={key}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Data prevista">
          <Input type="date" value={taskDate} onChange={(event) => setTaskDate(event.target.value)} />
        </Field>
        <Field label="Observações">
          <Textarea rows={2} value={taskNotes} onChange={(event) => setTaskNotes(event.target.value)} />
        </Field>
      </FormDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Follow-up tasks + alerts
// ---------------------------------------------------------------------------

export function Alerts() {
  const { orgId, can } = useApp();
  const notifications = useQuery(api.orgs.listNotifications, orgId ? { orgId } : "skip");
  const tasks = useQuery(api.retention.listFollowUps, orgId ? { orgId, status: "pendente" } : "skip");
  const alerts = useQuery(api.inventory.lowStockAlerts, orgId ? { orgId } : "skip");
  const invoices = useQuery(
    api.invoices.listInvoices,
    orgId ? { orgId, from: addDays(todayISO(), -120), to: addDays(todayISO(), 60) } : "skip",
  );
  const clients = useQuery(api.clients.clientOptions, orgId ? { orgId } : "skip");
  const markRead = useMutation(api.orgs.markNotificationRead);
  const completeTask = useMutation(api.retention.completeFollowUp);
  const createTask = useMutation(api.retention.createFollowUp);

  const [taskOpen, setTaskOpen] = useState(false);
  const [form, setForm] = useState({
    clientId: "",
    type: "reagendamento",
    dueDate: addDays(todayISO(), 2),
    notes: "",
  });

  if (!orgId) return <LoadingBlock rows={3} />;
  if (tasks === undefined || notifications === undefined) return <LoadingBlock rows={3} />;

  const outstanding = (invoices?.rows ?? []).filter(
    (row: any) => row.outstanding > 0 && row.status !== "cancelled",
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Visão geral"
        title="Alertas operacionais"
        description="Tarefas de acompanhamento, notificações internas, cobranças em aberto e itens de estoque que precisam de reposição."
        actions={
          can("clients.edit") && (
            <Button onClick={() => setTaskOpen(true)}>
              <Plus className="mr-2 size-4" />
              Nova tarefa
            </Button>
          )
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tarefas pendentes" value={tasks.length} tone="warning" />
        <StatCard
          label="Notificações não lidas"
          value={(notifications ?? []).filter((n: any) => !n.read).length}
          tone="info"
        />
        <StatCard label="Faturas em aberto" value={outstanding.length} tone="warning" />
        <StatCard
          label="Itens para repor"
          value={(alerts ?? []).length}
          tone={(alerts ?? []).length ? "negative" : "positive"}
        />
      </div>

      <GlassCard>
        <SectionTitle
          title="Tarefas de acompanhamento"
          description="Ações internas criadas a partir da retenção, aniversários ou pós-atendimento."
        />
        <DataTable
          keyOf={(row: any) => row._id}
          rows={tasks}
          empty={<EmptyState title="Nenhuma tarefa pendente" />}
          columns={[
            {
              key: "dueDate",
              header: "Vencimento",
              render: (row: any) => (
                <span className={row.overdue ? "text-rose-600" : ""}>{formatDate(row.dueDate)}</span>
              ),
            },
            { key: "clientName", header: "Cliente" },
            { key: "type", header: "Tipo", render: (row: any) => label(FOLLOWUP_TYPE, row.type) },
            { key: "notes", header: "Observações", render: (row: any) => row.notes ?? "—" },
            {
              key: "actions",
              header: "",
              align: "right",
              render: (row: any) =>
                can("clients.edit") && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await completeTask({ orgId, taskId: row._id });
                        toast.success("Tarefa concluída.");
                      } catch (err) {
                        toast.error(errorMessage(err));
                      }
                    }}
                  >
                    <Check className="mr-1 size-3.5" />
                    Concluir
                  </Button>
                ),
            },
          ]}
        />
      </GlassCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard>
          <SectionTitle title="Cobranças em aberto" description="Faturas com saldo pendente." />
          <DataTable
            keyOf={(row: any) => row._id}
            rows={outstanding}
            empty={<EmptyState title="Nenhuma cobrança em aberto" />}
            dense
            columns={[
              { key: "number", header: "Fatura" },
              { key: "clientName", header: "Cliente" },
              {
                key: "dueDate",
                header: "Vencimento",
                render: (row: any) => (row.dueDate ? formatDate(row.dueDate) : "—"),
              },
              {
                key: "outstanding",
                header: "Saldo",
                align: "right",
                render: (row: any) => money(row.outstanding),
              },
            ]}
          />
        </GlassCard>

        <GlassCard>
          <SectionTitle title="Estoque crítico" description="Produtos abaixo do estoque mínimo." />
          <DataTable
            keyOf={(row: any) => row._id}
            rows={alerts ?? []}
            empty={<EmptyState title="Nenhum item crítico" />}
            dense
            columns={[
              { key: "name", header: "Produto" },
              { key: "quantity", header: "Saldo", align: "right" },
              { key: "minStock", header: "Mínimo", align: "right" },
              { key: "reorderQty", header: "Repor", align: "right" },
            ]}
          />
        </GlassCard>
      </div>

      <GlassCard>
        <SectionTitle
          title="Notificações internas"
          description="Geradas pelo sistema para a equipe. Nenhuma mensagem externa é enviada automaticamente."
        />
        <div className="space-y-2">
          {(notifications ?? []).length === 0 && <EmptyState title="Nenhuma notificação" />}
          {(notifications ?? []).map((item: any) => (
            <button
              key={item._id}
              type="button"
              onClick={() => orgId && markRead({ orgId, id: item._id })}
              className={cn(
                "glass-inset flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left",
                !item.read && "ring-1 ring-primary/30",
              )}
            >
              <span className={cn("mt-1.5 size-2 rounded-full", item.read ? "bg-muted-foreground/40" : "bg-primary")} />
              <span className="min-w-0">
                <span className="block text-xs font-semibold">{item.title}</span>
                <span className="block text-xs leading-5 text-muted-foreground">{item.body}</span>
              </span>
            </button>
          ))}
        </div>
      </GlassCard>

      <FormDialog
        open={taskOpen}
        onOpenChange={setTaskOpen}
        title="Nova tarefa de acompanhamento"
        submitLabel="Criar tarefa"
        onSubmit={async () => {
          try {
            await createTask({
              orgId,
              clientId: form.clientId as Id<"clients">,
              type: form.type,
              dueDate: form.dueDate,
              notes: form.notes || undefined,
            });
            toast.success("Tarefa criada.");
            setTaskOpen(false);
          } catch (err) {
            toast.error(errorMessage(err));
          }
        }}
      >
        <Field label="Cliente *">
          <Select value={form.clientId} onValueChange={(value) => setForm({ ...form, clientId: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {(clients ?? []).map((client: any) => (
                <SelectItem key={client._id} value={client._id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo">
            <Select value={form.type} onValueChange={(value) => setForm({ ...form, type: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FOLLOWUP_TYPE).map(([key, value]) => (
                  <SelectItem key={key} value={key}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Data prevista">
            <Input
              type="date"
              value={form.dueDate}
              onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
            />
          </Field>
        </div>
        <Field label="Observações">
          <Textarea rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        </Field>
      </FormDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Waitlist
// ---------------------------------------------------------------------------

export function Waitlist() {
  const { orgId, can } = useApp();
  const [status, setStatus] = useState("aguardando");
  const [staffId, setStaffId] = useState("all");
  const [open, setOpen] = useState(false);
  const [removeId, setRemoveId] = useState<any | null>(null);

  const entries = useQuery(
    api.waitlist.listWaitlist,
    orgId
      ? { orgId, status: status === "all" ? undefined : status, staffId: staffId === "all" ? undefined : (staffId as Id<"staff">) }
      : "skip",
  );
  const clients = useQuery(api.clients.clientOptions, orgId ? { orgId } : "skip");
  const services = useQuery(api.services.serviceOptions, orgId ? { orgId } : "skip");
  const staff = useQuery(api.staff.staffOptions, orgId ? { orgId } : "skip");
  const create = useMutation(api.waitlist.createWaitlistEntry);
  const setEntryStatus = useMutation(api.waitlist.updateWaitlistStatus);
  const remove = useMutation(api.waitlist.deleteWaitlistEntry);

  const [form, setForm] = useState({
    clientId: "",
    serviceId: "",
    staffId: "",
    date1: addDays(todayISO(), 1),
    date2: addDays(todayISO(), 2),
    timeFrom: "09:00",
    timeTo: "18:00",
    priority: "media",
    contact: "",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);

  if (!orgId) return <LoadingBlock rows={4} />;
  if (entries === undefined) return <LoadingBlock rows={4} />;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Visão geral"
        title="Lista de espera"
        description="Clientes aguardando encaixe. Quando um horário liberar, a equipe identifica os contatos compatíveis e confirma manualmente — nunca de forma automática."
        actions={
          can("appointments.edit") && (
            <Button onClick={() => setOpen(true)}>
              <UserPlus className="mr-2 size-4" />
              Adicionar à lista
            </Button>
          )
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Aguardando" value={entries.filter((e: any) => e.status === "aguardando").length} tone="warning" />
        <StatCard label="Contatadas" value={entries.filter((e: any) => e.status === "contatado").length} tone="info" />
        <StatCard label="Prioridade alta" value={entries.filter((e: any) => e.priority === "alta").length} />
        <StatCard label="Listadas" value={entries.length} />
      </div>

      <GlassCard padded={false} className="p-3">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Situação">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.entries(WAITLIST_STATUS).map(([key, value]) => (
                  <SelectItem key={key} value={key}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Profissional preferida">
            <Select value={staffId} onValueChange={setStaffId}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Qualquer profissional</SelectItem>
                {(staff ?? []).map((member: any) => (
                  <SelectItem key={member._id} value={member._id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </GlassCard>

      <GlassCard>
        <DataTable
          keyOf={(row: any) => row._id}
          rows={entries}
          empty={<EmptyState title="Lista de espera vazia" />}
          columns={[
            {
              key: "clientName",
              header: "Cliente",
              render: (row: any) => (
                <div>
                  <p className="font-medium">{row.clientName}</p>
                  <p className="text-xs text-muted-foreground">{row.contact ?? row.clientPhone}</p>
                </div>
              ),
            },
            { key: "serviceName", header: "Serviço desejado" },
            { key: "staffName", header: "Profissional" },
            {
              key: "preferredDates",
              header: "Datas preferidas",
              render: (row: any) => (
                <span className="text-xs">
                  {(row.preferredDates ?? []).map((date: string) => formatDate(date)).join(", ") ||
                    "qualquer data"}
                </span>
              ),
            },
            {
              key: "window",
              header: "Janela de horário",
              render: (row: any) => (
                <span className="text-xs">
                  {String(Math.floor(row.timeFromMinutes / 60)).padStart(2, "0")}:
                  {String(row.timeFromMinutes % 60).padStart(2, "0")} –{" "}
                  {String(Math.floor(row.timeToMinutes / 60)).padStart(2, "0")}:
                  {String(row.timeToMinutes % 60).padStart(2, "0")}
                </span>
              ),
            },
            {
              key: "priority",
              header: "Prioridade",
              render: (row: any) => (
                <StatusPill
                  label={label(PRIORITY, row.priority)}
                  className={
                    row.priority === "alta"
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : row.priority === "media"
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-slate-200 bg-slate-50 text-slate-600"
                  }
                />
              ),
            },
            {
              key: "status",
              header: "Situação",
              render: (row: any) => <Badge variant="outline">{label(WAITLIST_STATUS, row.status)}</Badge>,
            },
            {
              key: "actions",
              header: "",
              align: "right",
              render: (row: any) =>
                can("appointments.edit") && (
                  <div className="flex justify-end gap-1">
                    <a
                      href={whatsappLink(
                        row.contact ?? row.clientPhone,
                        `Oi ${row.clientName.split(" ")[0]}! Abriu um horário para ${row.serviceName}. Quer garantir?`,
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-primary hover:bg-white/60"
                    >
                      <MessageCircle className="size-3.5" />
                      Contatar
                    </a>
                    <Select
                      value={row.status}
                      onValueChange={async (value) => {
                        try {
                          await setEntryStatus({ orgId, entryId: row._id, status: value });
                          toast.success("Situação atualizada.");
                        } catch (err) {
                          toast.error(errorMessage(err));
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(WAITLIST_STATUS).map(([key, value]) => (
                          <SelectItem key={key} value={key}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="text-rose-600" onClick={() => setRemoveId(row)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ),
            },
          ]}
        />
      </GlassCard>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        size="lg"
        title="Adicionar à lista de espera"
        submitLabel="Adicionar"
        error={error}
        onSubmit={async () => {
          setError(null);
          if (!form.clientId) {
            setError("Selecione a cliente.");
            return;
          }
          try {
            await create({
              orgId,
              clientId: form.clientId as Id<"clients">,
              serviceId: form.serviceId ? (form.serviceId as Id<"services">) : undefined,
              staffId: form.staffId ? (form.staffId as Id<"staff">) : undefined,
              preferredDates: [form.date1, form.date2].filter(Boolean),
              timeFrom: form.timeFrom,
              timeTo: form.timeTo,
              priority: form.priority,
              contact: form.contact || undefined,
              notes: form.notes || undefined,
            });
            toast.success("Cliente adicionada à lista de espera.");
            setOpen(false);
          } catch (err) {
            setError(errorMessage(err));
          }
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cliente *">
            <Select value={form.clientId} onValueChange={(value) => setForm({ ...form, clientId: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {(clients ?? []).map((client: any) => (
                  <SelectItem key={client._id} value={client._id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Serviço desejado">
            <Select value={form.serviceId} onValueChange={(value) => setForm({ ...form, serviceId: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Qualquer serviço" />
              </SelectTrigger>
              <SelectContent>
                {(services ?? []).map((service: any) => (
                  <SelectItem key={service._id} value={service._id}>
                    {service.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Profissional preferida">
            <Select value={form.staffId} onValueChange={(value) => setForm({ ...form, staffId: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Sem preferência" />
              </SelectTrigger>
              <SelectContent>
                {(staff ?? []).map((member: any) => (
                  <SelectItem key={member._id} value={member._id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Prioridade">
            <Select value={form.priority} onValueChange={(value) => setForm({ ...form, priority: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PRIORITY).map(([key, value]) => (
                  <SelectItem key={key} value={key}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Data preferida 1">
            <Input type="date" value={form.date1} onChange={(event) => setForm({ ...form, date1: event.target.value })} />
          </Field>
          <Field label="Data preferida 2">
            <Input type="date" value={form.date2} onChange={(event) => setForm({ ...form, date2: event.target.value })} />
          </Field>
          <Field label="Horário a partir de">
            <Input type="time" value={form.timeFrom} onChange={(event) => setForm({ ...form, timeFrom: event.target.value })} />
          </Field>
          <Field label="Horário até">
            <Input type="time" value={form.timeTo} onChange={(event) => setForm({ ...form, timeTo: event.target.value })} />
          </Field>
          <Field label="Contato para aviso">
            <Input value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} />
          </Field>
        </div>
        <Field label="Observações">
          <Textarea rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        </Field>
      </FormDialog>

      <ConfirmDialog
        open={!!removeId}
        onOpenChange={() => setRemoveId(null)}
        title="Remover da lista de espera"
        description={`Remover ${removeId?.clientName ?? ""} da lista?`}
        confirmLabel="Remover"
        onConfirm={async () => {
          try {
            await remove({ orgId, entryId: removeId._id });
            toast.success("Registro removido.");
            setRemoveId(null);
          } catch (err) {
            toast.error(errorMessage(err));
          }
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Birthdays
// ---------------------------------------------------------------------------

export function Birthdays() {
  const { orgId } = useApp();
  const [days, setDays] = useState("30");
  const birthdays = useQuery(
    api.clients.upcomingBirthdays,
    orgId ? { orgId, days: Number(days) || 30 } : "skip",
  );

  if (!orgId) return <LoadingBlock rows={3} />;
  if (birthdays === undefined) return <LoadingBlock rows={3} />;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Relacionamento"
        title="Aniversários"
        description="Oportunidades de contato no período. Use os modelos de mensagem para enviar pelo canal preferido da cliente."
      />

      <GlassCard padded={false} className="p-3">
        <Field label="Próximos (dias)">
          <Input
            type="number"
            value={days}
            onChange={(event) => setDays(event.target.value)}
            className="w-40"
          />
        </Field>
      </GlassCard>

      <GlassCard>
        <SectionTitle title={`${birthdays.length} aniversário(s) no horizonte`} />
        <DataTable
          keyOf={(row: any) => row.client._id}
          rows={birthdays}
          empty={<EmptyState title="Nenhum aniversário no período" icon={<Cake className="size-5" />} />}
          columns={[
            {
              key: "name",
              header: "Cliente",
              render: (row: any) => (
                <div>
                  <p className="font-medium">{row.client.name}</p>
                  <p className="text-xs text-muted-foreground">{row.client.phone}</p>
                </div>
              ),
            },
            { key: "date", header: "Data", render: (row: any) => formatDate(row.date) },
            {
              key: "daysAway",
              header: "Faltam",
              align: "right",
              render: (row: any) => `${row.daysAway} dia(s)`,
            },
            {
              key: "tags",
              header: "Tags",
              render: (row: any) => (
                <div className="flex flex-wrap gap-1">
                  {(row.client.tags ?? []).map((tag: string) => (
                    <Badge key={tag} variant="outline" className="text-[0.6rem]">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ),
            },
            {
              key: "contact",
              header: "",
              align: "right",
              render: (row: any) => (
                <a
                  href={whatsappLink(
                    row.client.whatsapp ?? row.client.phone,
                    `Parabéns, ${row.client.name.split(" ")[0]}! 🎉 Preparamos um mimo especial para o seu mês.`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <MessageCircle className="size-3.5" />
                  Enviar parabéns
                </a>
              ),
            },
          ]}
        />
      </GlassCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gift cards
// ---------------------------------------------------------------------------

export function GiftCards() {
  const { orgId, can } = useApp();
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [cancelId, setCancelId] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const data = useQuery(
    api.retention.listGiftCards,
    orgId ? { orgId, status: status === "all" ? undefined : status } : "skip",
  );
  const clients = useQuery(api.clients.clientOptions, orgId ? { orgId } : "skip");
  const sell = useMutation(api.retention.sellGiftCard);
  const cancel = useMutation(api.retention.cancelGiftCard);

  const [form, setForm] = useState({
    code: "",
    purchaserName: "",
    recipientName: "",
    clientId: "",
    value: "",
    expirationDate: addDays(todayISO(), 180),
    method: "pix",
  });
  const [error, setError] = useState<string | null>(null);

  if (!orgId) return <LoadingBlock rows={4} />;
  if (data === undefined) return <LoadingBlock rows={4} />;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Relacionamento"
        title="Cartões-presente"
        description="Venda e resgate de cartões-presente com saldo controlado. A receita é reconhecida na venda, portanto o resgate não é faturado novamente."
        actions={
          can("payments.edit") && (
            <Button onClick={() => setOpen(true)}>
              <Gift className="mr-2 size-4" />
              Vender cartão
            </Button>
          )
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Vendidos" value={money(data.totals.sold)} tone="positive" />
        <StatCard label="Saldo em circulação" value={money(data.totals.outstanding)} tone="warning" />
        <StatCard label="Já resgatado" value={money(data.totals.redeemed)} />
        <StatCard label="Cartões" value={(data.rows ?? []).length} />
      </div>

      <InfoBanner>
        Política financeira: o valor do cartão é reconhecido como receita na venda. O
        resgate consome o saldo sem gerar nova receita.
      </InfoBanner>

      <GlassCard padded={false} className="p-3">
        <Field label="Situação">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="utilizado">Utilizados</SelectItem>
              <SelectItem value="expirado">Expirados</SelectItem>
              <SelectItem value="cancelado">Cancelados</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </GlassCard>

      <GlassCard>
        <DataTable
          keyOf={(row: any) => row._id}
          rows={data.rows ?? []}
          empty={<EmptyState title="Nenhum cartão-presente" icon={<Gift className="size-5" />} />}
          columns={[
            { key: "code", header: "Código" },
            { key: "purchaserName", header: "Comprador" },
            { key: "recipientName", header: "Presenteado", render: (row: any) => row.recipientName ?? "—" },
            { key: "value", header: "Valor", align: "right", render: (row: any) => money(row.value) },
            {
              key: "balance",
              header: "Saldo",
              align: "right",
              render: (row: any) => (
                <span className={row.balance > 0 ? "font-medium text-emerald-700" : ""}>
                  {money(row.balance)}
                </span>
              ),
            },
            {
              key: "expirationDate",
              header: "Validade",
              render: (row: any) => (row.expirationDate ? formatDate(row.expirationDate) : "sem validade"),
            },
            {
              key: "status",
              header: "Situação",
              render: (row: any) => <Badge variant="outline">{row.status}</Badge>,
            },
            {
              key: "actions",
              header: "",
              align: "right",
              render: (row: any) =>
                can("payments.refund") && row.status === "ativo" ? (
                  <Button variant="ghost" size="icon" onClick={() => setCancelId(row)}>
                    <Trash2 className="size-4" />
                  </Button>
                ) : null,
            },
          ]}
        />
      </GlassCard>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Vender cartão-presente"
        description="A venda gera um recebimento na forma de pagamento escolhida."
        submitLabel="Registrar venda"
        error={error}
        onSubmit={async () => {
          setError(null);
          try {
            await sell({
              orgId,
              code: form.code || undefined,
              purchaserName: form.purchaserName,
              recipientName: form.recipientName || undefined,
              clientId: form.clientId ? (form.clientId as Id<"clients">) : undefined,
              value: parseMoney(form.value),
              expirationDate: form.expirationDate || undefined,
              method: form.method as any,
            });
            toast.success("Cartão-presente vendido.");
            setOpen(false);
          } catch (err) {
            setError(errorMessage(err));
          }
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Código" hint="Deixe vazio para gerar automaticamente">
            <Input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
          </Field>
          <Field label="Valor *">
            <MoneyInput value={form.value} onChange={(value) => setForm({ ...form, value })} />
          </Field>
          <Field label="Comprador *">
            <Input
              value={form.purchaserName}
              onChange={(event) => setForm({ ...form, purchaserName: event.target.value })}
            />
          </Field>
          <Field label="Presenteado">
            <Input
              value={form.recipientName}
              onChange={(event) => setForm({ ...form, recipientName: event.target.value })}
            />
          </Field>
          <Field label="Cliente vinculada">
            <Select value={form.clientId} onValueChange={(value) => setForm({ ...form, clientId: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Não vinculada" />
              </SelectTrigger>
              <SelectContent>
                {(clients ?? []).map((client: any) => (
                  <SelectItem key={client._id} value={client._id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Forma de pagamento">
            <Select value={form.method} onValueChange={(value) => setForm({ ...form, method: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PAYMENT_METHOD).map(([key, value]) => (
                  <SelectItem key={key} value={key}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Validade">
            <Input
              type="date"
              value={form.expirationDate}
              onChange={(event) => setForm({ ...form, expirationDate: event.target.value })}
            />
          </Field>
        </div>
      </FormDialog>

      <FormDialog
        open={!!cancelId}
        onOpenChange={() => setCancelId(null)}
        title={`Cancelar cartão ${cancelId?.code ?? ""}`}
        description="O cancelamento é auditado e o saldo remanescente deixa de ser utilizável."
        submitLabel="Cancelar cartão"
        onSubmit={async () => {
          try {
            await cancel({ orgId, giftCardId: cancelId._id, reason: cancelReason });
            toast.success("Cartão cancelado.");
            setCancelId(null);
            setCancelReason("");
          } catch (err) {
            toast.error(errorMessage(err));
          }
        }}
      >
        <Field label="Motivo *">
          <Textarea rows={2} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
        </Field>
      </FormDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loyalty
// ---------------------------------------------------------------------------

export function Loyalty() {
  const { orgId, can, flag } = useApp();
  const data = useQuery(api.retention.loyaltyOverview, orgId ? { orgId } : "skip");
  const clients = useQuery(api.clients.clientOptions, orgId ? { orgId } : "skip");
  const adjust = useMutation(api.retention.adjustLoyaltyPoints);
  const redeem = useMutation(api.retention.redeemReward);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ clientId: "", points: "", reason: "" });
  const [error, setError] = useState<string | null>(null);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeemForm, setRedeemForm] = useState({ clientId: "", rewardName: "", pointsCost: "" });

  if (!orgId) return <LoadingBlock rows={4} />;
  if (data === undefined) return <LoadingBlock rows={4} />;

  const settings = data.settings;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Relacionamento"
        title="Programa de fidelidade"
        description="Pontos por visita e por gasto, com histórico auditável. Saldos nunca são sobrescritos: cada movimento gera uma transação."
        actions={
          can("clients.edit") && (
            <>
              <Button variant="outline" className="glass-soft" onClick={() => setRedeemOpen(true)}>
                <Sparkles className="mr-2 size-4" />
                Resgatar recompensa
              </Button>
              <Button onClick={() => setOpen(true)}>
                <Plus className="mr-2 size-4" />
                Ajustar pontos
              </Button>
            </>
          )
        }
      />

      {!flag("loyalty") && (
        <InfoBanner tone="warning">
          O módulo de fidelidade está desativado nas configurações da organização. Os dados
          históricos permanecem preservados.
        </InfoBanner>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Clientes no programa" value={data.totals.clients} />
        <StatCard label="Pontos em circulação" value={data.totals.points} tone="info" />
        <StatCard
          label="Pontos por real gasto"
          value={settings ? `${settings.pointsPerReal ?? 0}` : "não configurado"}
          hint={settings ? `Visita: ${settings.pointsPerVisit ?? 0} ponto(s)` : undefined}
        />
        <StatCard
          label="Transações registradas"
          value={(data.transactions ?? []).length}
        />
      </div>

      <GlassCard>
        <SectionTitle title="Saldos por cliente" description="Ordenado pelos maiores saldos." />
        <DataTable
          keyOf={(row: any) => row._id}
          rows={data.accounts ?? []}
          empty={<EmptyState title="Nenhum cliente no programa ainda" />}
          columns={[
            { key: "clientName", header: "Cliente" },
            { key: "points", header: "Saldo", align: "right" },
            { key: "earned", header: "Acumulado", align: "right" },
            { key: "redeemed", header: "Resgatado", align: "right" },
            { key: "tier", header: "Nível", render: (row: any) => row.tier ?? "—" },
          ]}
        />
      </GlassCard>

      <GlassCard>
        <SectionTitle
          title="Extrato de pontos"
          description="Cada lançamento tem motivo e referência, permitindo auditoria completa."
        />
        <DataTable
          keyOf={(row: any) => row._id}
          rows={data.transactions ?? []}
          empty={<EmptyState title="Nenhuma movimentação de pontos" />}
          dense
          columns={[
            {
              key: "createdAt",
              header: "Data",
              render: (row: any) => formatDate(new Date(row.createdAt).toISOString().slice(0, 10)),
            },
            {
              key: "clientId",
              header: "Cliente",
              render: (row: any) =>
                (data.accounts ?? []).find((a: any) => a.clientId === row.clientId)?.clientName ?? "—",
            },
            {
              key: "points",
              header: "Pontos",
              align: "right",
              render: (row: any) => (
                <span className={row.points >= 0 ? "text-emerald-600" : "text-rose-600"}>
                  {row.points > 0 ? "+" : ""}
                  {row.points}
                </span>
              ),
            },
            { key: "reason", header: "Motivo" },
          ]}
        />
      </GlassCard>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Ajustar pontos"
        description="Use valores negativos para estornar pontos de transações canceladas."
        submitLabel="Registrar ajuste"
        error={error}
        onSubmit={async () => {
          setError(null);
          try {
            await adjust({
              orgId,
              clientId: form.clientId as Id<"clients">,
              points: Number(form.points),
              reason: form.reason,
            });
            toast.success("Ajuste registrado.");
            setOpen(false);
          } catch (err) {
            setError(errorMessage(err));
          }
        }}
      >
        <Field label="Cliente *">
          <Select value={form.clientId} onValueChange={(value) => setForm({ ...form, clientId: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {(clients ?? []).map((client: any) => (
                <SelectItem key={client._id} value={client._id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Pontos (use negativo para estorno) *">
          <Input
            type="number"
            value={form.points}
            onChange={(event) => setForm({ ...form, points: event.target.value })}
          />
        </Field>
        <Field label="Motivo *">
          <Textarea rows={2} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} />
        </Field>
      </FormDialog>

      <FormDialog
        open={redeemOpen}
        onOpenChange={setRedeemOpen}
        title="Resgatar recompensa"
        description="O resgate debita pontos e registra a transação com motivo."
        submitLabel="Confirmar resgate"
        onSubmit={async () => {
          try {
            await redeem({
              orgId,
              clientId: redeemForm.clientId as Id<"clients">,
              rewardName: redeemForm.rewardName,
              pointsCost: Number(redeemForm.pointsCost),
            });
            toast.success("Recompensa resgatada.");
            setRedeemOpen(false);
          } catch (err) {
            toast.error(errorMessage(err));
          }
        }}
      >
        <Field label="Cliente *">
          <Select
            value={redeemForm.clientId}
            onValueChange={(value) => setRedeemForm({ ...redeemForm, clientId: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {(data.accounts ?? []).map((account: any) => (
                <SelectItem key={account.clientId} value={account.clientId}>
                  {account.clientName} · {account.points} pts
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Recompensa *">
          <Input
            value={redeemForm.rewardName}
            onChange={(event) => setRedeemForm({ ...redeemForm, rewardName: event.target.value })}
            placeholder="Ex.: escova cortesia"
          />
        </Field>
        <Field label="Custo em pontos *">
          <Input
            type="number"
            value={redeemForm.pointsCost}
            onChange={(event) => setRedeemForm({ ...redeemForm, pointsCost: event.target.value })}
          />
        </Field>
      </FormDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

export function Campaigns() {
  const { orgId, can } = useApp();
  const campaigns = useQuery(api.retention.listCampaigns, orgId ? { orgId } : "skip");
  const save = useMutation(api.retention.saveCampaign);
  const remove = useMutation(api.retention.deleteCampaign);

  const [dialog, setDialog] = useState<{ open: boolean; campaign?: any }>({ open: false });
  const [removeId, setRemoveId] = useState<any | null>(null);

  if (!orgId) return <LoadingBlock rows={4} />;
  if (campaigns === undefined) return <LoadingBlock rows={4} />;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Relacionamento"
        title="Campanhas de marketing"
        description="Planejamento de ações e acompanhamento manual de resultados. O sistema não consulta métricas de redes sociais sem integração configurada."
        actions={
          can("marketing.manage") && (
            <Button onClick={() => setDialog({ open: true })}>
              <Plus className="mr-2 size-4" />
              Nova campanha
            </Button>
          )
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Campanhas" value={campaigns.length} />
        <StatCard label="Ativas" value={campaigns.filter((c: any) => c.status === "ativa").length} tone="positive" />
        <StatCard label="Planejadas" value={campaigns.filter((c: any) => c.status === "planejada").length} />
        <StatCard
          label="Investimento previsto"
          value={money(campaigns.reduce((acc: number, c: any) => acc + (c.budget ?? 0), 0))}
        />
      </div>

      <GlassCard>
        <DataTable
          keyOf={(row: any) => row._id}
          rows={campaigns}
          empty={<EmptyState title="Nenhuma campanha cadastrada" icon={<Megaphone className="size-5" />} />}
          columns={[
            {
              key: "name",
              header: "Campanha",
              render: (row: any) => (
                <div>
                  <p className="font-medium">{row.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.type} · {row.channel}
                  </p>
                </div>
              ),
            },
            { key: "audience", header: "Público" },
            {
              key: "period",
              header: "Período",
              render: (row: any) => (
                <span className="text-xs">
                  {formatDate(row.startDate)} – {formatDate(row.endDate)}
                </span>
              ),
            },
            { key: "budget", header: "Orçamento", align: "right", render: (row: any) => money(row.budget) },
            {
              key: "status",
              header: "Situação",
              render: (row: any) => (
                <StatusPill
                  label={label(CAMPAIGN_STATUS, row.status)}
                  className={
                    row.status === "ativa"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : row.status === "concluida"
                        ? "border-slate-200 bg-slate-50 text-slate-600"
                        : "border-sky-200 bg-sky-50 text-sky-700"
                  }
                />
              ),
            },
            { key: "results", header: "Resultados", render: (row: any) => row.results ?? "—" },
            {
              key: "actions",
              header: "",
              align: "right",
              render: (row: any) =>
                can("marketing.manage") && (
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setDialog({ open: true, campaign: row })}>
                      Editar
                    </Button>
                    <Button variant="ghost" size="icon" className="text-rose-600" onClick={() => setRemoveId(row)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ),
            },
          ]}
        />
      </GlassCard>

      {dialog.open && (
        <CampaignDialog
          campaign={dialog.campaign}
          onClose={() => setDialog({ open: false })}
          onSave={async (payload) => {
            await save({ orgId, campaignId: dialog.campaign?._id, ...payload });
            toast.success("Campanha salva.");
            setDialog({ open: false });
          }}
        />
      )}

      <ConfirmDialog
        open={!!removeId}
        onOpenChange={() => setRemoveId(null)}
        title="Excluir campanha"
        description="Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        onConfirm={async () => {
          try {
            await remove({ orgId, campaignId: removeId._id });
            toast.success("Campanha excluída.");
            setRemoveId(null);
          } catch (err) {
            toast.error(errorMessage(err));
          }
        }}
      />
    </div>
  );
}

function CampaignDialog({
  campaign,
  onClose,
  onSave,
}: {
  campaign?: any;
  onClose: () => void;
  onSave: (payload: any) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: campaign?.name ?? "",
    type: campaign?.type ?? "desconto",
    audience: campaign?.audience ?? "",
    channel: campaign?.channel ?? "Instagram",
    startDate: campaign?.startDate ?? todayISO(),
    endDate: campaign?.endDate ?? addDays(todayISO(), 14),
    offer: campaign?.offer ?? "",
    budget: campaign ? centsToInput(campaign.budget) : "",
    status: campaign?.status ?? "planejada",
    goal: campaign?.goal ?? "",
    results: campaign?.results ?? "",
    notes: campaign?.notes ?? "",
  });
  const [error, setError] = useState<string | null>(null);

  return (
    <FormDialog
      open
      onOpenChange={(value) => !value && onClose()}
      size="lg"
      title={campaign ? "Editar campanha" : "Nova campanha"}
      submitLabel="Salvar"
      error={error}
      onSubmit={async () => {
        setError(null);
        try {
          await onSave({ ...form, budget: parseMoney(form.budget) });
        } catch (err) {
          setError(errorMessage(err));
        }
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome *">
          <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </Field>
        <Field label="Tipo">
          <Select value={form.type} onValueChange={(value) => setForm({ ...form, type: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["desconto", "sazonal", "indicacao", "fidelidade", "aniversario", "lancamento", "reativacao", "redes"].map(
                (type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Público-alvo">
          <Input value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value })} />
        </Field>
        <Field label="Canal">
          <Select value={form.channel} onValueChange={(value) => setForm({ ...form, channel: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["Instagram", "Facebook", "TikTok", "WhatsApp", "E-mail", "SMS", "Presencial"].map((channel) => (
                <SelectItem key={channel} value={channel}>
                  {channel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Início">
          <Input
            type="date"
            value={form.startDate}
            onChange={(event) => setForm({ ...form, startDate: event.target.value })}
          />
        </Field>
        <Field label="Término">
          <Input
            type="date"
            value={form.endDate}
            onChange={(event) => setForm({ ...form, endDate: event.target.value })}
          />
        </Field>
        <Field label="Orçamento">
          <MoneyInput value={form.budget} onChange={(value) => setForm({ ...form, budget: value })} />
        </Field>
        <Field label="Situação">
          <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CAMPAIGN_STATUS).map(([key, value]) => (
                <SelectItem key={key} value={key}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field label="Oferta">
        <Input value={form.offer} onChange={(event) => setForm({ ...form, offer: event.target.value })} />
      </Field>
      <Field label="Meta">
        <Input value={form.goal} onChange={(event) => setForm({ ...form, goal: event.target.value })} />
      </Field>
      <Field label="Resultados observados" hint="Acompanhamento manual">
        <Textarea rows={2} value={form.results} onChange={(event) => setForm({ ...form, results: event.target.value })} />
      </Field>
      <Field label="Observações">
        <Textarea rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
      </Field>
      <InfoBanner>
        Respeite as preferências de comunicação e as bases legais de marketing. Mensagens
        automáticas exigem integração configurada e consentimento válido.
      </InfoBanner>
    </FormDialog>
  );
}

