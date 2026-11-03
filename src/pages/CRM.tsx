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
  APPOINTMENT_STATUS_COLOR,
  CONSENT_TYPE,
  PAYMENT_STATUS,
  addDays,
  durationLabel,
  formatDate,
  formatTime,
  label,
  money,
  todayISO,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useAction } from "convex/react";
import {
  Camera,
  CheckCircle2,
  Eye,
  FileText,
  Image as ImageIcon,
  Images,
  Pencil,
  Plus,
  Receipt,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Appointment history (Histórico de Atendimentos)
// ---------------------------------------------------------------------------

export function TreatmentHistory() {
  const { orgId, can } = useApp();
  const [from, setFrom] = useState(addDays(todayISO(), -30));
  const [to, setTo] = useState(addDays(todayISO(), 1));
  const [staffId, setStaffId] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any | null>(null);

  const staff = useQuery(api.staff.staffOptions, orgId ? { orgId } : "skip");
  const data = useQuery(
    api.appointments.listAppointments,
    orgId
      ? {
          orgId,
          from,
          to,
          staffId: staffId === "all" ? undefined : (staffId as Id<"staff">),
          status: status === "all" ? undefined : status,
          search: search || undefined,
          limit: 300,
        }
      : "skip",
  );
  const createInvoice = useMutation(api.invoices.createInvoiceFromAppointment);

  if (!orgId) return <LoadingBlock rows={4} />;
  if (data === undefined) return <LoadingBlock rows={4} />;

  const rows: any[] = data.rows ?? [];
  const completed = rows.filter((row) => row.status === "completed");

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Clientes"
        title="Histórico de atendimentos"
        description="Todos os atendimentos realizados, com valor, profissional, status e situação de pagamento. Atendimentos concluídos aceitam registro de prontuário e faturamento."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Atendimentos no período" value={rows.length} />
        <StatCard label="Concluídos" value={completed.length} tone="positive" />
        <StatCard
          label="Cancelados / faltas"
          value={rows.filter((r) => r.status === "cancelled" || r.status === "no_show").length}
          tone="warning"
        />
        <StatCard
          label="Produção concluída"
          value={money(completed.reduce((acc, r) => acc + (r.total ?? 0), 0))}
        />
      </div>

      <GlassCard padded={false} className="p-3">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="De">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </Field>
          <Field label="Até">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </Field>
          <Field label="Profissional">
            <Select value={staffId} onValueChange={setStaffId}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {(staff ?? []).map((member: any) => (
                  <SelectItem key={member._id} value={member._id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(APPOINTMENT_STATUS).map(([key, value]) => (
                  <SelectItem key={key} value={key}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Cliente">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nome ou telefone"
              className="w-52"
            />
          </Field>
        </div>
      </GlassCard>

      <GlassCard>
        <DataTable
          keyOf={(row: any) => row._id}
          rows={rows}
          onRowClick={(row: any) => setSelected(row)}
          empty={<EmptyState title="Nenhum atendimento no período" />}
          dense
          columns={[
            {
              key: "date",
              header: "Data",
              render: (row: any) => (
                <div>
                  <p>{formatDate(row.date)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatTime(row.startMinutes)} · {durationLabel(row.endMinutes - row.startMinutes)}
                  </p>
                </div>
              ),
            },
            {
              key: "clientName",
              header: "Cliente",
              render: (row: any) => (
                <div>
                  <p className="font-medium">{row.clientName}</p>
                  <p className="text-xs text-muted-foreground">{row.clientPhone}</p>
                </div>
              ),
            },
            {
              key: "services",
              header: "Serviços",
              render: (row: any) => (
                <span className="text-xs">{row.services ?? row.items?.map((i: any) => i.name).join(", ")}</span>
              ),
            },
            { key: "staffName", header: "Profissional" },
            {
              key: "status",
              header: "Status",
              render: (row: any) => (
                <StatusPill
                  label={label(APPOINTMENT_STATUS, row.status)}
                  className={APPOINTMENT_STATUS_COLOR[row.status]}
                />
              ),
            },
            {
              key: "paymentStatus",
              header: "Pagamento",
              render: (row: any) => (
                <span className="text-xs">{label(PAYMENT_STATUS, row.paymentStatus)}</span>
              ),
            },
            {
              key: "total",
              header: "Total",
              align: "right",
              render: (row: any) => money((row.totalPrice ?? 0) - (row.discount ?? 0)),
            },
            {
              key: "actions",
              header: "",
              align: "right",
              render: (row: any) =>
                can("invoices.edit") &&
                row.status === "completed" &&
                !row.invoiceId && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async (event) => {
                      event.stopPropagation();
                      try {
                        await createInvoice({ orgId, appointmentId: row._id });
                        toast.success("Fatura gerada a partir do atendimento.");
                      } catch (err) {
                        toast.error(errorMessage(err));
                      }
                    }}
                  >
                    <Receipt className="mr-1 size-3.5" />
                    Faturar
                  </Button>
                ),
            },
          ]}
        />
      </GlassCard>

      {selected && (
        <AppointmentRecordDialog
          appointment={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function AppointmentRecordDialog({
  appointment,
  onClose,
}: {
  appointment: any;
  onClose: () => void;
}) {
  const { orgId, can } = useApp();
  const detail = useQuery(
    api.appointments.appointmentDetail,
    orgId ? { orgId, appointmentId: appointment._id } : "skip",
  );
  const products = useQuery(api.inventory.listProducts, orgId ? { orgId } : "skip");
  const complete = useMutation(api.appointments.completeAppointment);
  const createInvoice = useMutation(api.invoices.createInvoiceFromAppointment);

  const [notes, setNotes] = useState("");
  const [formula, setFormula] = useState("");
  const [reactions, setReactions] = useState("");
  const [aftercare, setAftercare] = useState("");
  const [intervalDays, setIntervalDays] = useState("30");
  const [usage, setUsage] = useState<{ productId: string; name: string; quantity: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!orgId) return null;

  const status = detail?.appointment.status ?? appointment.status;
  const record = detail?.records?.[0];

  return (
    <FormDialog
      open
      onOpenChange={(value) => !value && onClose()}
      size="lg"
      title={`Atendimento · ${appointment.clientName ?? detail?.client?.name ?? ""}`}
      description={`${formatDate(appointment.date)} às ${formatTime(appointment.startMinutes)} · ${label(
        APPOINTMENT_STATUS,
        status,
      )}`}
      submitLabel="Fechar"
      onSubmit={onClose}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="glass-inset rounded-xl p-3 text-xs">
          <p className="font-semibold">Serviços</p>
          <ul className="mt-1 space-y-0.5">
            {(detail?.appointment.items ?? appointment.items ?? []).map((item: any, index: number) => (
              <li key={index} className="flex justify-between">
                <span>
                  {item.name} · {item.durationMin}min
                </span>
                <span className="tabular-nums">{money(item.price)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 flex justify-between border-t border-white/60 pt-2 font-semibold">
            <span>Total</span>
            <span className="tabular-nums">
              {money(
                (detail?.appointment.totalPrice ?? appointment.totalPrice ?? 0) -
                  (detail?.appointment.discount ?? appointment.discount ?? 0),
              )}
            </span>
          </p>
        </div>
        <div className="glass-inset rounded-xl p-3 text-xs">
          <p className="font-semibold">Financeiro</p>
          <p className="mt-1 flex justify-between">
            <span className="text-muted-foreground">Sinal pago</span>
            <span className="tabular-nums">
              {money(detail?.depositPaid ?? appointment.depositPaid ?? 0)}
            </span>
          </p>
          <p className="flex justify-between">
            <span className="text-muted-foreground">Situação</span>
            <span>{label(PAYMENT_STATUS, detail?.appointment.paymentStatus ?? appointment.paymentStatus)}</span>
          </p>
          <p className="flex justify-between">
            <span className="text-muted-foreground">Fatura</span>
            <span>{detail?.invoices?.[0]?.number ?? "não emitida"}</span>
          </p>
        </div>
      </div>

      {record ? (
        <div className="glass-inset rounded-xl p-3 text-xs">
          <p className="font-semibold">Prontuário registrado</p>
          <div className="mt-1 space-y-1 text-muted-foreground">
            <p>Notas: {record.notes ?? "—"}</p>
            <p>Fórmula / cor: {record.formula ?? "—"}</p>
            <p>Reações relatadas: {record.reactions ?? "—"}</p>
            <p>Recomendações: {record.aftercare ?? "—"}</p>
            <p>
              Próximo retorno sugerido:{" "}
              {record.nextVisitDate ? formatDate(record.nextVisitDate) : "não definido"}
            </p>
          </div>
        </div>
      ) : (
        status === "completed" && (
          <InfoBanner tone="warning">
            Este atendimento ainda não possui prontuário. Atendimentos concluídos sem
            registro dificultam a continuidade do tratamento.
          </InfoBanner>
        )
      )}

      {status === "completed" && (
        <div className="flex flex-wrap gap-2">
          {can("invoices.edit") && (
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  await createInvoice({ orgId, appointmentId: appointment._id });
                  toast.success("Fatura gerada.");
                } catch (err) {
                  toast.error(errorMessage(err));
                }
              }}
            >
              <Receipt className="mr-1.5 size-3.5" />
              Gerar fatura
            </Button>
          )}
        </div>
      )}

      {can("appointments.edit") && status !== "completed" && status !== "cancelled" && (
        <div className="space-y-3 rounded-2xl border border-white/60 bg-white/45 p-3">
          <p className="text-sm font-semibold">Concluir atendimento</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Fórmula / cor / técnica">
              <Input value={formula} onChange={(event) => setFormula(event.target.value)} />
            </Field>
            <Field label="Retorno sugerido (dias)">
              <Input
                type="number"
                value={intervalDays}
                onChange={(event) => setIntervalDays(event.target.value)}
              />
            </Field>
          </div>
          <Field label="Notas do atendimento">
            <Textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Reações relatadas">
              <Input value={reactions} onChange={(event) => setReactions(event.target.value)} />
            </Field>
            <Field label="Cuidados pós-atendimento">
              <Input value={aftercare} onChange={(event) => setAftercare(event.target.value)} />
            </Field>
          </div>

          <Field label="Produtos utilizados" hint="Gera movimentação de consumo no estoque">
            <div className="space-y-2">
              {usage.map((entry, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Select
                    value={entry.productId}
                    onValueChange={(value) =>
                      setUsage((prev) =>
                        prev.map((item, i) => (i === index ? { ...item, productId: value } : item)),
                      )
                    }
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(products?.rows ?? []).map((product: any) => (
                        <SelectItem key={product._id} value={product._id}>
                          {product.name} · saldo {product.quantity}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    inputMode="decimal"
                    value={entry.quantity}
                    onChange={(event) =>
                      setUsage((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, quantity: event.target.value } : item,
                        ),
                      )
                    }
                    className="w-24"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setUsage((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  const first = (products?.rows ?? [])[0];
                  if (!first) {
                    toast.error("Cadastre produtos no estoque antes de registrar consumo.");
                    return;
                  }
                  setUsage((prev) => [
                    ...prev,
                    { productId: first._id, name: first.name, quantity: "1" },
                  ]);
                }}
              >
                <Plus className="mr-1.5 size-3.5" />
                Adicionar produto
              </Button>
            </div>
          </Field>

          {error && <p className="text-xs text-rose-600">{error}</p>}

          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await complete({
                  orgId,
                  appointmentId: appointment._id,
                  notes: notes || undefined,
                  formula: formula || undefined,
                  reactions: reactions || undefined,
                  aftercare: aftercare || undefined,
                  nextVisitIntervalDays: intervalDays ? Number(intervalDays) : undefined,
                  productsUsed: usage
                    .filter((entry) => entry.productId)
                    .map((entry) => ({
                      productId: entry.productId as Id<"products">,
                      name:
                        (products?.rows ?? []).find((p: any) => p._id === entry.productId)?.name ??
                        "Produto",
                      quantity: Number(entry.quantity) || 0,
                    })),
                  createTreatmentRecord: true,
                });
                toast.success("Atendimento concluído e prontuário registrado.");
                onClose();
              } catch (err) {
                setError(errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <CheckCircle2 className="mr-1.5 size-4" />
            Concluir atendimento
          </Button>
        </div>
      )}
    </FormDialog>
  );
}

// ---------------------------------------------------------------------------
// Treatment records + consultation responses (Fichas)
// ---------------------------------------------------------------------------

export function PatientRecords() {
  const { orgId, can } = useApp();
  const [clientId, setClientId] = useState("all");
  const [detail, setDetail] = useState<any | null>(null);

  const clients = useQuery(api.clients.clientOptions, orgId ? { orgId } : "skip");
  const records = useQuery(
    api.crm.listTreatmentRecords,
    orgId
      ? { orgId, clientId: clientId === "all" ? undefined : (clientId as Id<"clients">) }
      : "skip",
  );
  const responses = useQuery(
    api.crm.listResponses,
    orgId
      ? {
          orgId,
          clientId: clientId === "all" ? undefined : (clientId as Id<"clients">),
          canViewSensitive: true,
        }
      : "skip",
  );
  const update = useMutation(api.crm.updateTreatmentRecord);

  if (!orgId) return <LoadingBlock rows={4} />;
  if (records === undefined) return <LoadingBlock rows={4} />;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Clientes"
        title="Fichas de consulta e prontuários"
        description="Informações sensíveis de saúde e histórico técnico. O acesso é restrito por permissão e todo registro fica auditado."
      />

      <GlassCard padded={false} className="p-3">
        <Field label="Cliente">
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger className="w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {(clients ?? []).map((client: any) => (
                <SelectItem key={client._id} value={client._id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </GlassCard>

      <Tabs defaultValue="prontuarios">
        <TabsList className="glass-soft">
          <TabsTrigger value="prontuarios">Prontuários de tratamento</TabsTrigger>
          <TabsTrigger value="fichas">Fichas preenchidas</TabsTrigger>
        </TabsList>

        <TabsContent value="prontuarios" className="mt-4">
          <GlassCard>
            <DataTable
              keyOf={(row: any) => row._id}
              rows={records}
              onRowClick={(row: any) => setDetail(row)}
              empty={<EmptyState title="Nenhum prontuário registrado" icon={<FileText className="size-5" />} />}
              columns={[
                { key: "date", header: "Data", render: (row: any) => formatDate(row.date) },
                { key: "clientName", header: "Cliente" },
                { key: "serviceName", header: "Serviço" },
                { key: "staffName", header: "Profissional" },
                {
                  key: "nextVisitDate",
                  header: "Retorno sugerido",
                  render: (row: any) =>
                    row.nextVisitDate ? formatDate(row.nextVisitDate) : "—",
                },
                {
                  key: "sensitive",
                  header: "Visibilidade",
                  render: (row: any) => (
                    <Badge variant="outline">
                      {row.canViewSensitive === false ? "Restrito" : "Equipe autorizada"}
                    </Badge>
                  ),
                },
                {
                  key: "actions",
                  header: "",
                  align: "right",
                  render: (row: any) => (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(event) => {
                        event.stopPropagation();
                        setDetail(row);
                      }}
                    >
                      <Eye className="mr-1 size-3.5" />
                      Abrir
                    </Button>
                  ),
                },
              ]}
            />
          </GlassCard>
        </TabsContent>

        <TabsContent value="fichas" className="mt-4">
          <GlassCard>
            <DataTable
              keyOf={(row: any) => row._id}
              rows={responses ?? []}
              empty={<EmptyState title="Nenhuma ficha preenchida" icon={<ShieldCheck className="size-5" />} />}
              columns={[
                { key: "date", header: "Data", render: (row: any) => formatDate(row.date) },
                { key: "clientName", header: "Cliente" },
                { key: "formName", header: "Formulário" },
                {
                  key: "formVersion",
                  header: "Versão",
                  render: (row: any) => `v${row.formVersion ?? 1}`,
                },
                {
                  key: "acknowledgedBy",
                  header: "Confirmado por",
                  render: (row: any) => row.acknowledgedBy ?? "—",
                },
                {
                  key: "answers",
                  header: "Respostas registradas",
                  align: "right",
                  render: (row: any) => (row.answers ?? []).length,
                },
              ]}
            />
          </GlassCard>
        </TabsContent>
      </Tabs>

      {detail && (
        <FormDialog
          open
          onOpenChange={(value) => !value && setDetail(null)}
          size="lg"
          title={`Prontuário · ${detail.clientName}`}
          description={`${detail.serviceName} em ${formatDate(detail.date)} · ${detail.staffName}`}
          submitLabel="Fechar"
          onSubmit={() => setDetail(null)}
        >
          <div className="glass-inset space-y-1 rounded-xl p-3 text-xs">
            <p>Notas: {detail.notes ?? "—"}</p>
            <p>Fórmula / cor: {detail.formula ?? "—"}</p>
            <p>Preferências: {detail.preferences ?? "—"}</p>
            <p>Reações relatadas: {detail.reactions ?? "—"}</p>
            <p>Cuidados pós-atendimento: {detail.aftercare ?? "—"}</p>
            <p>
              Produtos usados:{" "}
              {(detail.productsUsed ?? []).map((p: any) => `${p.name} (${p.quantity})`).join(", ") || "—"}
            </p>
          </div>

          {can("appointments.edit") && (
            <FollowUpEditor
              onSave={async (patch) => {
                try {
                  await update({ orgId, recordId: detail._id, patch });
                  toast.success("Prontuário atualizado.");
                  setDetail(null);
                } catch (err) {
                  toast.error(errorMessage(err));
                }
              }}
            />
          )}
        </FormDialog>
      )}
    </div>
  );
}

function FollowUpEditor({
  onSave,
}: {
  onSave: (patch: {
    notes?: string;
    aftercare?: string;
    nextVisitIntervalDays?: number;
  }) => Promise<void>;
}) {
  const [aftercare, setAftercare] = useState("");
  const [notes, setNotes] = useState("");
  const [days, setDays] = useState("30");

  return (
    <div className="space-y-3 rounded-2xl border border-white/60 bg-white/45 p-3">
      <p className="text-sm font-semibold">Atualizar prontuário</p>
      <Field label="Cuidados pós-atendimento">
        <Textarea rows={2} value={aftercare} onChange={(event) => setAftercare(event.target.value)} />
      </Field>
      <Field label="Notas complementares">
        <Textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>
      <Field label="Novo intervalo de retorno (dias)">
        <Input type="number" value={days} onChange={(event) => setDays(event.target.value)} />
      </Field>
      <Button
        size="sm"
        onClick={() =>
          onSave({
            aftercare: aftercare || undefined,
            notes: notes || undefined,
            nextVisitIntervalDays: days ? Number(days) : undefined,
          })
        }
      >
        Salvar prontuário
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Forms + consents
// ---------------------------------------------------------------------------

export function Forms() {
  const { orgId, can } = useApp();
  const forms = useQuery(api.crm.listForms, orgId ? { orgId } : "skip");
  const consents = useQuery(api.crm.listConsents, orgId ? { orgId } : "skip");
  const clients = useQuery(api.clients.clientOptions, orgId ? { orgId } : "skip");
  const staff = useQuery(api.staff.staffOptions, orgId ? { orgId } : "skip");
  const saveForm = useMutation(api.crm.saveForm);
  const recordConsent = useMutation(api.crm.recordConsent);
  const submitResponse = useMutation(api.crm.submitConsultationResponse);

  const [formDialog, setFormDialog] = useState<{ open: boolean; form?: any }>({ open: false });
  const [consentOpen, setConsentOpen] = useState(false);
  const [fillOpen, setFillOpen] = useState(false);

  if (!orgId) return <LoadingBlock rows={4} />;
  if (forms === undefined || consents === undefined) return <LoadingBlock rows={4} />;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Atendimentos"
        title="Formulários e consentimentos"
        description="Formulários configuráveis para anamnese e consentimentos. O consentimento para tratamento é sempre separado do consentimento para uso de imagem."
        actions={
          can("settings.edit") && (
            <>
              <Button variant="outline" className="glass-soft" onClick={() => setConsentOpen(true)}>
                <ShieldCheck className="mr-2 size-4" />
                Registrar consentimento
              </Button>
              <Button variant="outline" className="glass-soft" onClick={() => setFillOpen(true)}>
                <FileText className="mr-2 size-4" />
                Preencher ficha
              </Button>
              <Button onClick={() => setFormDialog({ open: true })}>
                <Plus className="mr-2 size-4" />
                Novo formulário
              </Button>
            </>
          )
        }
      />

      <InfoBanner>
        Fichas de anamnese podem conter dados sensíveis de saúde. O sistema restringe o
        acesso por permissão, registra auditoria e não emite diagnósticos médicos.
      </InfoBanner>

      <GlassCard>
        <SectionTitle
          title="Modelos de formulário"
          description="Versões são preservadas: fichas antigas continuam com a versão usada no momento do preenchimento."
        />
        <DataTable
          keyOf={(row: any) => row._id}
          rows={forms}
          empty={<EmptyState title="Nenhum formulário configurado" />}
          columns={[
            { key: "name", header: "Formulário" },
            { key: "purpose", header: "Finalidade" },
            {
              key: "fields",
              header: "Campos",
              align: "right",
              render: (row: any) => (row.fields ?? []).length,
            },
            {
              key: "sensitive",
              header: "Dados sensíveis",
              render: (row: any) => (
                <Badge variant="outline">{row.sensitive ? "Sim" : "Não"}</Badge>
              ),
            },
            { key: "version", header: "Versão", render: (row: any) => `v${row.version ?? 1}` },
            {
              key: "actions",
              header: "",
              align: "right",
              render: (row: any) =>
                can("settings.edit") && (
                  <Button variant="ghost" size="icon" onClick={() => setFormDialog({ open: true, form: row })}>
                    <Pencil className="size-4" />
                  </Button>
                ),
            },
          ]}
        />
      </GlassCard>

      <GlassCard>
        <SectionTitle title="Consentimentos registrados" description="Histórico com tipo, data e cliente." />
        <DataTable
          keyOf={(row: any) => row._id}
          rows={consents}
          empty={<EmptyState title="Nenhum consentimento registrado" />}
          columns={[
            { key: "date", header: "Data", render: (row: any) => formatDate(row.date) },
            { key: "clientName", header: "Cliente" },
            { key: "type", header: "Tipo", render: (row: any) => label(CONSENT_TYPE, row.type) },
            {
              key: "granted",
              header: "Situação",
              render: (row: any) => (
                <StatusPill
                  label={row.granted ? "Concedido" : "Negado"}
                  className={
                    row.granted
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-rose-200 bg-rose-50 text-rose-700"
                  }
                />
              ),
            },
            { key: "notes", header: "Observações", render: (row: any) => row.notes ?? "—" },
          ]}
        />
      </GlassCard>

      {formDialog.open && (          <FormBuilderDialog
          form={formDialog.form}
          onClose={() => setFormDialog({ open: false })}
          onSave={async (payload) => {
            await saveForm({ orgId, formId: formDialog.form?._id, ...payload } as any);
            toast.success("Formulário salvo.");
            setFormDialog({ open: false });
          }}
        />
      )}

      <FormDialog
        open={consentOpen}
        onOpenChange={setConsentOpen}
        title="Registrar consentimento"
        description="O consentimento é gravado separadamente do consentimento de imagem."
        submitLabel="Fechar"
        onSubmit={() => setConsentOpen(false)}
      >
        <ConsentForm
          orgId={orgId}
          clients={clients ?? []}
          staff={staff ?? []}
          onDone={() => setConsentOpen(false)}
          onSave={recordConsent}
        />
      </FormDialog>

      {fillOpen && (
        <FormDialog
          open
          onOpenChange={(value) => !value && setFillOpen(false)}
          size="lg"
          title="Preencher ficha"
          submitLabel="Fechar"
          onSubmit={() => setFillOpen(false)}
        >
          <FillFormPanel
            orgId={orgId}
            forms={forms}
            clients={clients ?? []}
            staff={staff ?? []}
            onSubmit={submitResponse}
          />
        </FormDialog>
      )}
    </div>
  );
}

function FormBuilderDialog({
  form,
  onClose,
  onSave,
}: {
  form?: any;
  onClose: () => void;
  onSave: (payload: any) => Promise<void>;
}) {
  const [name, setName] = useState(form?.name ?? "");
  const [purpose, setPurpose] = useState(form?.purpose ?? "anamnese");
  const [sensitive, setSensitive] = useState(form?.sensitive ?? true);
  const [fields, setFields] = useState<{ key: string; label: string; type: string; options: string; required: boolean }[]>(
    (form?.fields ?? []).map((field: any) => ({
      key: field.key,
      label: field.label,
      type: field.type,
      options: (field.options ?? []).join(", "),
      required: field.required,
    })),
  );
  const [error, setError] = useState<string | null>(null);

  return (
    <FormDialog
      open
      onOpenChange={(value) => !value && onClose()}
      size="lg"
      title={form ? `Editar ${form.name}` : "Novo formulário"}
      description="A alteração de campos cria uma nova versão. Fichas já preenchidas mantêm a versão original."
      submitLabel="Salvar formulário"
      error={error}
      onSubmit={async () => {
        setError(null);
        if (!name.trim()) {
          setError("Informe o nome do formulário.");
          return;
        }
        if (!fields.length) {
          setError("Adicione pelo menos um campo.");
          return;
        }
        try {
          await onSave({
            name,
            purpose,
            sensitive,
            fields: fields.map((field, index) => ({
              key: field.key || `campo_${index + 1}`,
              label: field.label,
              type: field.type,
              options: field.options
                ? field.options.split(",").map((option) => option.trim()).filter(Boolean)
                : [],
              required: field.required,
            })),
            active: true,
          });
        } catch (err) {
          setError(errorMessage(err));
        }
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome *">
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Finalidade">
          <Input value={purpose} onChange={(event) => setPurpose(event.target.value)} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={sensitive}
          onChange={(event) => setSensitive(event.target.checked)}
        />
        Contém dados sensíveis de saúde (acesso restrito)
      </label>

      <Field label="Campos do formulário *">
        <div className="space-y-2">
          {fields.map((field, index) => (
            <div key={index} className="glass-inset space-y-2 rounded-xl p-2">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Rótulo da pergunta"
                  value={field.label}
                  onChange={(event) =>
                    setFields((prev) =>
                      prev.map((item, i) => (i === index ? { ...item, label: event.target.value } : item)),
                    )
                  }
                />
                <Select
                  value={field.type}
                  onValueChange={(value) =>
                    setFields((prev) =>
                      prev.map((item, i) => (i === index ? { ...item, type: value } : item)),
                    )
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Texto</SelectItem>
                    <SelectItem value="textarea">Texto longo</SelectItem>
                    <SelectItem value="select">Seleção</SelectItem>
                    <SelectItem value="boolean">Sim / Não</SelectItem>
                    <SelectItem value="date">Data</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setFields((prev) => prev.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              {field.type === "select" && (
                <Input
                  placeholder="Opções separadas por vírgula"
                  value={field.options}
                  onChange={(event) =>
                    setFields((prev) =>
                      prev.map((item, i) => (i === index ? { ...item, options: event.target.value } : item)),
                    )
                  }
                />
              )}
              <label className="flex items-center gap-2 text-[0.7rem] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(event) =>
                    setFields((prev) =>
                      prev.map((item, i) =>
                        i === index ? { ...item, required: event.target.checked } : item,
                      ),
                    )
                  }
                />
                Obrigatório
              </label>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setFields((prev) => [
                ...prev,
                { key: `campo_${prev.length + 1}`, label: "", type: "text", options: "", required: false },
              ])
            }
          >
            <Plus className="mr-1.5 size-3.5" />
            Adicionar campo
          </Button>
        </div>
      </Field>
    </FormDialog>
  );
}

function ConsentForm({
  orgId,
  clients,
  staff,
  onDone,
  onSave,
}: {
  orgId: Id<"organizations">;
  clients: any[];
  staff: any[];
  onDone: () => void;
  onSave: any;
}) {
  const [clientId, setClientId] = useState("");
  const [type, setType] = useState("tratamento");
  const [staffId, setStaffId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <Field label="Cliente *">
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((client) => (
              <SelectItem key={client._id} value={client._id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Tipo de consentimento *">
        <Select value={type} onValueChange={setType}>
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
      <Field label="Profissional responsável">
        <Select value={staffId} onValueChange={setStaffId}>
          <SelectTrigger>
            <SelectValue placeholder="Não informado" />
          </SelectTrigger>
          <SelectContent>
            {staff.map((member) => (
              <SelectItem key={member._id} value={member._id}>
                {member.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Observações / evidência">
        <Textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <Button
        onClick={async () => {
          setError(null);
          if (!clientId) {
            setError("Selecione a cliente.");
            return;
          }
          try {
            await onSave({
              orgId,
              clientId,
              type,
              granted: true,
              staffId: staffId || undefined,
              notes: notes || undefined,
            });
            toast.success("Consentimento registrado.");
            onDone();
          } catch (err) {
            setError(errorMessage(err));
          }
        }}
      >
        Registrar consentimento
      </Button>
    </div>
  );
}

function FillFormPanel({
  orgId,
  forms,
  clients,
  staff,
  onSubmit,
}: {
  orgId: Id<"organizations">;
  forms: any[];
  clients: any[];
  staff: any[];
  onSubmit: any;
}) {
  const [formId, setFormId] = useState(forms[0]?._id ?? "");
  const [clientId, setClientId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [acknowledgedBy, setAcknowledgedBy] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const form = forms.find((item) => item._id === formId);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Formulário *">
          <Select
            value={formId}
            onValueChange={(value) => {
              setFormId(value);
              setAnswers({});
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {forms.map((item) => (
                <SelectItem key={item._id} value={item._id}>
                  {item.name} (v{item.version ?? 1})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Cliente *">
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((client) => (
                <SelectItem key={client._id} value={client._id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Profissional">
          <Select value={staffId} onValueChange={setStaffId}>
            <SelectTrigger>
              <SelectValue placeholder="Não informado" />
            </SelectTrigger>
            <SelectContent>
              {staff.map((member) => (
                <SelectItem key={member._id} value={member._id}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Confirmado por *" hint="Quem validou as informações com a cliente">
          <Input value={acknowledgedBy} onChange={(event) => setAcknowledgedBy(event.target.value)} />
        </Field>
      </div>

      <div className="glass-inset space-y-3 rounded-xl p-3">
        {(form?.fields ?? []).map((field: any) => (
          <Field key={field.key} label={`${field.label}${field.required ? " *" : ""}`}>
            {field.type === "select" ? (
              <Select
                value={answers[field.key] ?? ""}
                onValueChange={(value) => setAnswers((prev) => ({ ...prev, [field.key]: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {(field.options ?? []).map((option: string) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : field.type === "textarea" ? (
              <Textarea
                rows={2}
                value={answers[field.key] ?? ""}
                onChange={(event) => setAnswers((prev) => ({ ...prev, [field.key]: event.target.value }))}
              />
            ) : field.type === "boolean" ? (
              <Select
                value={answers[field.key] ?? ""}
                onValueChange={(value) => setAnswers((prev) => ({ ...prev, [field.key]: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sim">Sim</SelectItem>
                  <SelectItem value="Não">Não</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Input
                type={field.type === "date" ? "date" : "text"}
                value={answers[field.key] ?? ""}
                onChange={(event) => setAnswers((prev) => ({ ...prev, [field.key]: event.target.value }))}
              />
            )}
          </Field>
        ))}
        {!form && <p className="text-xs text-muted-foreground">Selecione um formulário para preencher.</p>}
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}

      <Button
        onClick={async () => {
          setError(null);
          if (!form || !clientId || !acknowledgedBy.trim()) {
            setError("Informe cliente, formulário e quem confirmou as informações.");
            return;
          }
          try {
            await onSubmit({
              orgId,
              clientId,
              formId,
              staffId: staffId || undefined,
              acknowledgedBy,
              answers: (form.fields ?? []).map((field: any) => ({
                key: field.key,
                label: field.label,
                value: answers[field.key] ?? "",
              })),
            });
            toast.success("Ficha registrada.");
            setAnswers({});
          } catch (err) {
            setError(errorMessage(err));
          }
        }}
      >
        Salvar ficha
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Photo gallery
// ---------------------------------------------------------------------------

export function Photos() {
  const { orgId, can } = useApp();
  const [clientId, setClientId] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);
  const [removeId, setRemoveId] = useState<any | null>(null);

  const clients = useQuery(api.clients.clientOptions, orgId ? { orgId } : "skip");
  const photos = useQuery(
    api.crm.listPhotos,
    orgId ? { orgId, clientId: clientId === "all" ? undefined : (clientId as Id<"clients">) } : "skip",
  );
  const updateConsent = useMutation(api.crm.updatePhotoConsent);
  const removePhoto = useMutation(api.crm.deletePhoto);

  if (!orgId) return <LoadingBlock rows={4} />;
  if (photos === undefined) return <LoadingBlock rows={4} />;

  const filtered = (photos as any[]).filter((photo) =>
    kindFilter === "all" ? true : photo.kind === kindFilter,
  );
  const selectedPhotos = filtered.filter((photo) => selection.includes(photo._id));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Atendimentos"
        title="Antes e depois"
        description="Galeria privada de fotos de tratamento. O consentimento para uso interno é diferente do consentimento para divulgação pública."
        actions={
          <>
            <Button
              variant="outline"
              className="glass-soft"
              onClick={() => {
                setCompareMode((value) => !value);
                setSelection([]);
              }}
            >
              <Images className="mr-2 size-4" />
              {compareMode ? "Sair da comparação" : "Comparar"}
            </Button>
            {can("photos.view") && (
              <Button onClick={() => setUploadOpen(true)}>
                <Upload className="mr-2 size-4" />
                Enviar foto
              </Button>
            )}
          </>
        }
      />

      {compareMode && selectedPhotos.length === 2 && (
        <GlassCard>
          <SectionTitle
            title={`Comparação · ${selectedPhotos[0].clientName}`}
            description="Prévia de antes e depois para uso interno."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {selectedPhotos.map((photo: any) => (
              <div key={photo._id} className="glass-inset overflow-hidden rounded-2xl">
                {photo.url ? (
                  <img src={photo.url} alt={photo.notes ?? photo.kind} className="h-72 w-full object-cover" />
                ) : (
                  <div className="flex h-72 items-center justify-center text-xs text-muted-foreground">
                    Sem arquivo disponível
                  </div>
                )}
                <div className="p-3 text-xs">
                  <p className="font-medium">
                    {photo.kind === "antes" ? "Antes" : "Depois"} · {formatDate(photo.captureDate)}
                  </p>
                  <p className="text-muted-foreground">{photo.notes ?? "Sem observações"}</p>
                </div>
              </div>
            ))}
          </div>
          <InfoBanner>
            Compartilhamento promocional exige consentimento de imagem pública registrado
            para cada cliente.
          </InfoBanner>
        </GlassCard>
      )}

      <GlassCard padded={false} className="p-3">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Cliente">
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as clientes</SelectItem>
                {(clients ?? []).map((client: any) => (
                  <SelectItem key={client._id} value={client._id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Momento">
            <Select value={kindFilter} onValueChange={setKindFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="antes">Antes</SelectItem>
                <SelectItem value="depois">Depois</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <span className="ml-auto text-xs text-muted-foreground">
            {filtered.length} foto(s) · {filtered.filter((p: any) => p.consentPublic).length} liberada(s)
            para divulgação
          </span>
        </div>
      </GlassCard>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhuma foto registrada"
          description="Envie fotos de antes e depois vinculadas à cliente e ao atendimento."
          icon={<ImageIcon className="size-5" />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((photo: any) => (
            <div
              key={photo._id}
              className={cn(
                "glass overflow-hidden rounded-2xl",
                compareMode && selection.includes(photo._id) && "ring-2 ring-primary",
              )}
            >
              <button
                type="button"
                className="block w-full"
                onClick={() => {
                  if (!compareMode) return;
                  setSelection((prev) =>
                    prev.includes(photo._id)
                      ? prev.filter((id) => id !== photo._id)
                      : prev.length >= 2
                        ? [prev[1], photo._id]
                        : [...prev, photo._id],
                  );
                }}
              >
                {photo.url ? (
                  <img src={photo.url} alt={photo.notes ?? "Foto"} className="h-44 w-full object-cover" />
                ) : (
                  <div className="flex h-44 items-center justify-center text-muted-foreground">
                    <Camera className="size-6" />
                  </div>
                )}
              </button>
              <div className="space-y-1 p-3 text-xs">
                <p className="font-medium">{photo.clientName}</p>
                <p className="text-muted-foreground">
                  {photo.kind === "antes" ? "Antes" : "Depois"} · {formatDate(photo.captureDate)} ·{" "}
                  {photo.staffName}
                </p>
                <div className="flex flex-wrap gap-1 pt-1">
                  <Badge variant="outline" className="text-[0.6rem]">
                    {photo.consentInternal ? "Uso interno OK" : "Interno negado"}
                  </Badge>
                  <Badge variant="outline" className="text-[0.6rem]">
                    {photo.consentPublic ? "Divulgação OK" : "Divulgação negada"}
                  </Badge>
                </div>
                {can("photos.share") && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await updateConsent({
                            orgId,
                            photoId: photo._id,
                            consentInternal: !photo.consentInternal,
                            consentPublic: photo.consentPublic,
                          });
                          toast.success("Consentimento atualizado.");
                        } catch (err) {
                          toast.error(errorMessage(err));
                        }
                      }}
                    >
                      Alternar uso interno
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await updateConsent({
                            orgId,
                            photoId: photo._id,
                            consentInternal: photo.consentInternal,
                            consentPublic: !photo.consentPublic,
                          });
                          toast.success("Consentimento de divulgação atualizado.");
                        } catch (err) {
                          toast.error(errorMessage(err));
                        }
                      }}
                    >
                      Alternar divulgação
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-rose-600"
                      onClick={() => setRemoveId(photo)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {uploadOpen && <UploadPhotoDialog orgId={orgId} clients={clients ?? []} onClose={() => setUploadOpen(false)} />}

      <ConfirmDialog
        open={!!removeId}
        onOpenChange={() => setRemoveId(null)}
        title="Excluir foto"
        description="A foto e o arquivo privado serão removidos definitivamente."
        confirmLabel="Excluir"
        onConfirm={async () => {
          try {
            await removePhoto({ orgId, photoId: removeId._id });
            toast.success("Foto excluída.");
            setRemoveId(null);
          } catch (err) {
            toast.error(errorMessage(err));
          }
        }}
      />
    </div>
  );
}

function UploadPhotoDialog({
  orgId,
  clients,
  onClose,
}: {
  orgId: Id<"organizations">;
  clients: any[];
  onClose: () => void;
}) {
  const services = useQuery(api.services.serviceOptions, orgId ? { orgId } : "skip");
  const staff = useQuery(api.staff.staffOptions, orgId ? { orgId } : "skip");
  const uploadPhoto = useAction(api.crm.uploadPhotoFile);
  const savePhoto = useMutation(api.crm.savePhoto);

  const [clientId, setClientId] = useState("");
  const [kind, setKind] = useState("antes");
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [captureDate, setCaptureDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <FormDialog
      open
      onOpenChange={(value) => !value && onClose()}
      size="lg"
      title="Enviar foto de tratamento"
      description="Galeria restrita à equipe autorizada. Não compartilhe links de fotos sem o consentimento da cliente."
      submitLabel="Enviar foto"
      loading={busy}
      error={error}
      onSubmit={async () => {
        setBusy(true);
        setError(null);
        try {
          if (!clientId) throw new Error("Selecione a cliente.");
          if (!file || file.size > 4 * 1024 * 1024) throw new Error("Selecione uma foto JPEG, PNG ou WebP de até 4 MB.");
          const storageId = await uploadPhoto({ orgId, data: await file.arrayBuffer(), contentType: file.type });
          await savePhoto({
            orgId,
            clientId: clientId as Id<"clients">,
            kind,
            serviceId: serviceId ? (serviceId as Id<"services">) : undefined,
            staffId: staffId ? (staffId as Id<"staff">) : undefined,
            captureDate,
            notes: notes || undefined,
            storageId,
            consentInternal: true,
            consentPublic: false,
          });
          toast.success("Foto enviada.");
          onClose();
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cliente *">
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((client) => (
                <SelectItem key={client._id} value={client._id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Momento">
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="antes">Antes</SelectItem>
              <SelectItem value="depois">Depois</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Serviço">
          <Select value={serviceId} onValueChange={setServiceId}>
            <SelectTrigger>
              <SelectValue placeholder="Não informado" />
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
        <Field label="Profissional">
          <Select value={staffId} onValueChange={setStaffId}>
            <SelectTrigger>
              <SelectValue placeholder="Não informada" />
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
        <Field label="Data da captura">
          <Input type="date" value={captureDate} onChange={(event) => setCaptureDate(event.target.value)} />
        </Field>
        <Field label="Arquivo" hint="JPG ou PNG, até 10 MB">
          <Input
            type="file"
            accept="image/*"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </Field>
      </div>
      <Field label="Observações internas">
        <Textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>
      <InfoBanner>
        O upload não autoriza divulgação. Marque o consentimento de imagem pública
        somente com autorização registrada da cliente.
      </InfoBanner>
    </FormDialog>
  );
}

