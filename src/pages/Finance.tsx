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
  INVOICE_STATUS,
  PAYMENT_KIND,
  PAYMENT_METHOD,
  QUOTE_STATUS,
  addDays,
  centsToInput,
  formatDate,
  label,
  money,
  monthLabel,
  monthLabelShort,
  parseMoney,
  startOfMonth,
  todayISO,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  Ban,
  BellRing,
  BadgeCheck,
  CreditCard,
  FileText,
  Plus,
  Printer,
  Receipt,
  RefreshCcw,
  Trash2,
  Undo2,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export function Invoices() {
  const { orgId, can } = useApp();
  const today = todayISO();
  const [from, setFrom] = useState(startOfMonth(today));
  const [to, setTo] = useState(addDays(today, 30));
  const [status, setStatus] = useState("all");
  const [detailId, setDetailId] = useState<Id<"invoices"> | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [cancelId, setCancelId] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const data = useQuery(
    api.invoices.listInvoices,
    orgId
      ? { orgId, from, to, status: status === "all" ? undefined : status }
      : "skip",
  );
  const cancel = useMutation(api.invoices.cancelInvoice);

  if (!orgId) return <LoadingBlock rows={4} />;
  if (data === undefined) return <LoadingBlock rows={4} />;

  const rows: any[] = data.rows ?? [];
  const overdue = rows.filter(
    (row) => row.outstanding > 0 && row.dueDate && row.dueDate < today,
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Financeiro"
        title="Faturas e recibos"
        description="Faturamento operacional com itens, sinal aplicado e saldo em aberto. Faturas quitadas ficam bloqueadas para edição."
        actions={
          can("invoices.edit") && (
            <Button onClick={() => setNewOpen(true)}>
              <Plus className="mr-2 size-4" />
              Nova fatura
            </Button>
          )
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Faturado no período" value={money(data.totals.issued)} />
        <StatCard label="Recebido" value={money(data.totals.paid)} tone="positive" />
        <StatCard
          label="Em aberto"
          value={money(data.totals.outstanding)}
          tone={data.totals.outstanding > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="Faturas vencidas"
          value={overdue.length}
          tone={overdue.length ? "negative" : "neutral"}
          hint="Com saldo e data de vencimento anterior a hoje"
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
          <Field label="Status">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(INVOICE_STATUS).map(([key, value]) => (
                  <SelectItem key={key} value={key}>
                    {value}
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
          rows={rows}
          onRowClick={(row: any) => setDetailId(row._id)}
          empty={<EmptyState title="Nenhuma fatura no período" icon={<Receipt className="size-5" />} />}
          columns={[
            { key: "number", header: "Número" },
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
            { key: "issueDate", header: "Emissão", render: (row: any) => formatDate(row.issueDate) },
            {
              key: "dueDate",
              header: "Vencimento",
              render: (row: any) => (row.dueDate ? formatDate(row.dueDate) : "—"),
            },
            { key: "total", header: "Total", align: "right", render: (row: any) => money(row.total) },
            {
              key: "paid",
              header: "Recebido",
              align: "right",
              render: (row: any) => money(row.paid),
            },
            {
              key: "outstanding",
              header: "Saldo",
              align: "right",
              render: (row: any) => (
                <span className={cn(row.outstanding > 0 && "font-medium text-amber-600")}>
                  {money(row.outstanding)}
                </span>
              ),
            },
            {
              key: "status",
              header: "Status",
              render: (row: any) => (
                <StatusPill
                  label={label(INVOICE_STATUS, row.status)}
                  className={
                    row.status === "paid"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : row.status === "cancelled"
                        ? "border-slate-200 bg-slate-50 text-slate-500"
                        : row.status === "partial"
                          ? "border-sky-200 bg-sky-50 text-sky-700"
                          : "border-amber-200 bg-amber-50 text-amber-700"
                  }
                />
              ),
            },
            {
              key: "actions",
              header: "",
              align: "right",
              render: (row: any) =>
                can("invoices.edit") && row.status !== "cancelled" && row.paid === 0 ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Cancelar fatura"
                    onClick={(event) => {
                      event.stopPropagation();
                      setCancelId(row);
                    }}
                  >
                    <Ban className="size-4" />
                  </Button>
                ) : null,
            },
          ]}
        />
      </GlassCard>

      <InfoBanner>
        O BeautyFlow OS é uma ferramenta de faturamento operacional. Emissão fiscal
        oficial depende de integração fiscal configurada e não está habilitada por padrão.
      </InfoBanner>

      {detailId && <InvoiceDetail invoiceId={detailId} onClose={() => setDetailId(null)} />}
      {newOpen && <NewInvoiceDialog onClose={() => setNewOpen(false)} />}

      <ConfirmDialog
        open={!!cancelId}
        onOpenChange={() => {
          setCancelId(null);
          setCancelReason("");
        }}
        title={`Cancelar fatura ${cancelId?.number ?? ""}`}
        description="Somente faturas sem pagamentos podem ser canceladas. O histórico é preservado."
        confirmLabel="Cancelar fatura"
        onConfirm={async () => {
          try {
            await cancel({
              orgId,
              invoiceId: cancelId._id,
              reason: cancelReason || "Cancelada pela equipe",
            });
            toast.success("Fatura cancelada.");
            setCancelId(null);
          } catch (err) {
            toast.error(errorMessage(err));
          }
        }}
      >
        <Textarea
          value={cancelReason}
          onChange={(event) => setCancelReason(event.target.value)}
          placeholder="Motivo do cancelamento"
          className="mt-2"
        />
      </ConfirmDialog>
    </div>
  );
}

function InvoiceDetail({
  invoiceId,
  onClose,
}: {
  invoiceId: Id<"invoices">;
  onClose: () => void;
}) {
  const { orgId, can } = useApp();
  const detail = useQuery(
    api.invoices.invoiceDetail,
    orgId ? { orgId, invoiceId } : "skip",
  );
  const [payOpen, setPayOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const addAdjustment = useMutation(api.invoices.addInvoiceAdjustment);
  const remind = useMutation(api.invoices.remindInvoice);
  const applyDeposit = useMutation(api.payments.applyDepositToInvoice);
  const deposits = useQuery(api.payments.listPayments, orgId ? { orgId, kind: "sinal" } : "skip");

  if (!orgId || detail === undefined) return <LoadingBlock rows={3} />;
  if (detail === null) return null;

  const invoice = detail.invoice;

  return (
    <>
      <FormDialog
        open
        onOpenChange={(value) => !value && onClose()}
        size="lg"
        title={`Fatura ${invoice.number}`}
        description={`${detail.client?.name ?? ""} · emitida em ${formatDate(invoice.issueDate)}`}
        submitLabel="Fechar"
        onSubmit={onClose}
      >
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill label={label(INVOICE_STATUS, invoice.status)} />
          {invoice.locked && (
            <StatusPill
              label="Bloqueada para edição"
              className="border-slate-200 bg-slate-50 text-slate-600"
            />
          )}
        </div>

        <div className="glass-inset rounded-xl p-3 text-xs">
          <table className="w-full">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pb-1">Item</th>
                <th className="pb-1 text-right">Qtd</th>
                <th className="pb-1 text-right">Unitário</th>
                <th className="pb-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item: any, index: number) => (
                <tr key={index} className="border-t border-white/50">
                  <td className="py-1">
                    {item.name}
                    <span className="ml-1 text-muted-foreground">({item.kind})</span>
                  </td>
                  <td className="py-1 text-right tabular-nums">{item.quantity}</td>
                  <td className="py-1 text-right tabular-nums">{money(item.unitPrice)}</td>
                  <td className="py-1 text-right tabular-nums">{money(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 space-y-0.5 border-t border-white/60 pt-2">
            <p className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">{money(invoice.subtotal)}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-muted-foreground">Desconto</span>
              <span className="tabular-nums">− {money(invoice.discount)}</span>
            </p>
            {invoice.tax > 0 && (
              <p className="flex justify-between">
                <span className="text-muted-foreground">Taxas / impostos</span>
                <span className="tabular-nums">{money(invoice.tax)}</span>
              </p>
            )}
            <p className="flex justify-between font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{money(invoice.total)}</span>
            </p>
            <p className="flex justify-between text-emerald-700">
              <span>Recebido (inclui sinal aplicado)</span>
              <span className="tabular-nums">{money(invoice.paid)}</span>
            </p>
            <p className="flex justify-between font-semibold text-amber-700">
              <span>Saldo em aberto</span>
              <span className="tabular-nums">{money(invoice.outstanding)}</span>
            </p>
          </div>
        </div>

        {detail.payments.length > 0 && (
          <div className="glass-inset rounded-xl p-3 text-xs">
            <p className="font-semibold">Pagamentos vinculados</p>
            <ul className="mt-1 space-y-1">
              {detail.payments.map((payment: any) => (
                <li key={payment._id} className="flex justify-between">
                  <span>
                    {formatDate(payment.date)} · {label(PAYMENT_METHOD, payment.method)} ·{" "}
                    {label(PAYMENT_KIND, payment.kind)}
                  </span>
                  <span className="tabular-nums">{money(payment.allocated)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(() => {
          const unapplied = (deposits?.rows ?? []).filter(
            (payment: any) =>
              payment.clientId === invoice.clientId &&
              !payment.invoiceId &&
              payment.amount > 0,
          );
          if (!unapplied.length) return null;
          return (
            <div className="glass-inset rounded-xl p-3 text-xs">
              <p className="font-semibold">Sinais disponíveis para aplicar</p>
              <p className="mt-0.5 text-muted-foreground">
                O sinal é contado apenas uma vez: ao aplicar, ele baixa o saldo desta fatura.
              </p>
              <ul className="mt-2 space-y-2">
                {unapplied.map((payment: any) => (
                  <li key={payment._id} className="flex items-center justify-between gap-2">
                    <span>
                      {formatDate(payment.date)} · {label(PAYMENT_METHOD, payment.method)}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums">{money(payment.amount)}</span>
                      {can("payments.edit") && invoice.outstanding > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            try {
                              await applyDeposit({
                                orgId,
                                invoiceId,
                                paymentId: payment._id,
                              });
                              toast.success("Sinal aplicado à fatura.");
                            } catch (err) {
                              toast.error(errorMessage(err));
                            }
                          }}
                        >
                          Aplicar à fatura
                        </Button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })()}

        {detail.commissions.length > 0 && (
          <div className="glass-inset rounded-xl p-3 text-xs">
            <p className="font-semibold">Comissões geradas</p>
            <ul className="mt-1 space-y-1">
              {detail.commissions.map((commission: any) => (
                <li key={commission._id} className="flex justify-between">
                  <span>{commission.ruleLabel}</span>
                  <span className="tabular-nums">{money(commission.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {can("payments.edit") && invoice.outstanding > 0 && (
            <Button size="sm" onClick={() => setPayOpen(true)}>
              <CreditCard className="mr-1.5 size-3.5" />
              Registrar pagamento
            </Button>
          )}
          {can("invoices.edit") && (
            <Button size="sm" variant="outline" onClick={() => setAdjustOpen(true)}>
              <RefreshCcw className="mr-1.5 size-3.5" />
              Ajuste autorizado
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              window.print();
            }}
          >
            <Printer className="mr-1.5 size-3.5" />
            Imprimir / PDF
          </Button>
          {can("invoices.view") && invoice.outstanding > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                try {
                  await remind({ orgId, invoiceId });
                  toast.success("Alerta de cobrança criado nas notificações internas.");
                } catch (err) {
                  toast.error(errorMessage(err));
                }
              }}
            >
              <BellRing className="mr-1.5 size-3.5" />
              Criar alerta de cobrança
            </Button>
          )}
        </div>

        <InfoBanner>
          Recibos podem ser impressos pelo navegador. O envio por e-mail exige uma
          integração de e-mail configurada.
        </InfoBanner>
      </FormDialog>

      {payOpen && (
        <PaymentDialog
          invoiceId={invoiceId}
          clientId={invoice.clientId}
          suggestedAmount={invoice.outstanding}
          onClose={() => setPayOpen(false)}
        />
      )}

      <FormDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        title="Ajuste autorizado"
        description="Correções em faturas emitidas geram um lançamento de ajuste com motivo registrado na auditoria."
        submitLabel="Registrar ajuste"
        onSubmit={async () => {
          try {
            await addAdjustment({
              orgId,
              invoiceId,
              amount: parseMoney(adjustAmount),
              reason: adjustReason,
            });
            toast.success("Ajuste registrado.");
            setAdjustOpen(false);
            setAdjustAmount("");
            setAdjustReason("");
          } catch (err) {
            toast.error(errorMessage(err));
          }
        }}
      >
        <Field label="Valor do ajuste" hint="Use valor negativo para reduzir">
          <MoneyInput value={adjustAmount} onChange={setAdjustAmount} />
        </Field>
        <Field label="Motivo *">
          <Textarea
            rows={2}
            value={adjustReason}
            onChange={(event) => setAdjustReason(event.target.value)}
          />
        </Field>
      </FormDialog>
    </>
  );
}

function NewInvoiceDialog({ onClose }: { onClose: () => void }) {
  const { orgId } = useApp();
  const clients = useQuery(api.clients.clientOptions, orgId ? { orgId } : "skip");
  const services = useQuery(api.services.serviceOptions, orgId ? { orgId } : "skip");
  const create = useMutation(api.invoices.createInvoice);
  const [clientId, setClientId] = useState("");
  const [items, setItems] = useState<
    { kind: "service"; refId: string; quantity: number }[]
  >([]);
  const [discount, setDiscount] = useState("");
  const [dueDate, setDueDate] = useState(addDays(todayISO(), 7));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!orgId) return null;

  const lines = items.map((item) => {
    const service = (services ?? []).find((s: any) => s._id === item.refId);
    return {
      kind: "service" as const,
      refId: item.refId,
      name: service?.name ?? "Serviço",
      quantity: item.quantity,
      unitPrice: service?.price ?? 0,
      total: (service?.price ?? 0) * item.quantity,
    };
  });
  const subtotal = lines.reduce((acc, line) => acc + line.total, 0);

  return (
    <FormDialog
      open
      onOpenChange={(value) => !value && onClose()}
      size="lg"
      title="Nova fatura"
      description="Use para vendas avulsas de produtos ou serviços não vinculados a um agendamento."
      submitLabel="Emitir fatura"
      error={error}
      onSubmit={async () => {
        setError(null);
        if (!clientId) return setError("Selecione a cliente.");
        if (!lines.length) return setError("Adicione pelo menos um item.");
        try {
          await create({
            orgId,
            clientId: clientId as Id<"clients">,
            items: lines,
            discount: parseMoney(discount),
            dueDate,
            notes: notes || undefined,
          });
          toast.success("Fatura emitida.");
          onClose();
        } catch (err) {
          setError(errorMessage(err));
        }
      }}
    >
      <Field label="Cliente *">
        <Select value={clientId} onValueChange={setClientId}>
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

      <Field label="Itens *">
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <Select
                value={item.refId}
                onValueChange={(value) =>
                  setItems((prev) =>
                    prev.map((entry, i) => (i === index ? { ...entry, refId: value } : entry)),
                  )
                }
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(services ?? []).map((service: any) => (
                    <SelectItem key={service._id} value={service._id}>
                      {service.name} · {money(service.price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={1}
                value={item.quantity}
                onChange={(event) =>
                  setItems((prev) =>
                    prev.map((entry, i) =>
                      i === index
                        ? { ...entry, quantity: Number(event.target.value) || 1 }
                        : entry,
                    ),
                  )
                }
                className="w-20"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setItems((prev) => [
                ...prev,
                { kind: "service", refId: (services ?? [])[0]?._id ?? "", quantity: 1 },
              ])
            }
          >
            <Plus className="mr-1.5 size-3.5" />
            Adicionar item
          </Button>
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Desconto">
          <MoneyInput value={discount} onChange={setDiscount} />
        </Field>
        <Field label="Vencimento">
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
      </div>

      <div className="glass-inset rounded-xl px-3 py-2 text-xs">
        <p className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="tabular-nums">{money(subtotal)}</span>
        </p>
        <p className="flex justify-between font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{money(subtotal - parseMoney(discount))}</span>
        </p>
      </div>

      <Field label="Observações">
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
    </FormDialog>
  );
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

function PaymentDialog({
  invoiceId,
  clientId,
  suggestedAmount,
  onClose,
}: {
  invoiceId?: Id<"invoices">;
  clientId?: Id<"clients">;
  suggestedAmount?: number;
  onClose: () => void;
}) {
  const { orgId, context } = useApp();
  const clients = useQuery(api.clients.clientOptions, orgId ? { orgId } : "skip");
  const invoices = useQuery(api.invoices.listInvoices, orgId ? { orgId } : "skip");
  const accounts = useQuery(api.payments.listAccounts, orgId ? { orgId } : "skip");
  const giftCards = useQuery(api.retention.listGiftCards, orgId ? { orgId } : "skip");
  const create = useMutation(api.payments.createPayment);

  const [selectedClient, setSelectedClient] = useState(clientId ?? "");
  const [selectedInvoice, setSelectedInvoice] = useState(invoiceId ?? "");
  const [amount, setAmount] = useState(
    suggestedAmount ? centsToInput(suggestedAmount) : "",
  );
  const [method, setMethod] = useState("pix");
  const [kind, setKind] = useState("pagamento");
  const [date, setDate] = useState(todayISO());
  const [reference, setReference] = useState("");
  const [accountId, setAccountId] = useState("");
  const [giftCardId, setGiftCardId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!orgId) return null;
  const activeOrgId = orgId;

  const methods = context?.org?.paymentMethods ?? [
    "pix",
    "dinheiro",
    "cartao_credito",
    "cartao_debito",
    "transferencia",
  ];
  const openInvoices = (invoices?.rows ?? []).filter(
    (row: any) => row.outstanding > 0 && row.status !== "cancelled",
  );

  async function submit() {
    setLoading(true);
    setError(null);
    if (!selectedClient) {
      setError("Selecione a cliente.");
      setLoading(false);
      return;
    }
    if (parseMoney(amount) <= 0) {
      setError("Informe um valor maior que zero.");
      setLoading(false);
      return;
    }
    try {
      await create({
        orgId: activeOrgId,
        clientId: selectedClient as Id<"clients">,
        invoiceId: selectedInvoice ? (selectedInvoice as Id<"invoices">) : undefined,
        amount: parseMoney(amount),
        method: method as any,
        kind,
        date,
        reference: reference || undefined,
        accountId: accountId ? (accountId as Id<"financialAccounts">) : undefined,
        giftCardId: giftCardId ? (giftCardId as Id<"giftCards">) : undefined,
        notes: notes || undefined,
      });
      toast.success("Pagamento registrado.");
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
      size="lg"
      title="Registrar pagamento"
      description="Sinais, pagamentos parciais e integrais são registrados separadamente e ficam auditáveis."
      submitLabel="Registrar"
      onSubmit={submit}
      loading={loading}
      error={error}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cliente *">
          <Select value={selectedClient} onValueChange={setSelectedClient}>
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
        <Field label="Fatura" hint="Opcional para sinais sem fatura emitida">
          <Select value={selectedInvoice} onValueChange={setSelectedInvoice}>
            <SelectTrigger>
              <SelectValue placeholder="Sem fatura (sinal)" />
            </SelectTrigger>
            <SelectContent>
              {openInvoices.map((invoice: any) => (
                <SelectItem key={invoice._id} value={invoice._id}>
                  {invoice.number} · saldo {money(invoice.outstanding)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Valor *">
          <MoneyInput value={amount} onChange={setAmount} />
        </Field>
        <Field label="Data">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Forma de pagamento">
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {methods.map((option: string) => (
                <SelectItem key={option} value={option}>
                  {PAYMENT_METHOD[option] ?? option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Tipo">
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pagamento">Pagamento</SelectItem>
              <SelectItem value="sinal">Sinal / depósito</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Conta financeira">
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger>
              <SelectValue placeholder="Não informar" />
            </SelectTrigger>
            <SelectContent>
              {(accounts ?? []).map((account: any) => (
                <SelectItem key={account._id} value={account._id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Referência">
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="ID da transação PIX, NSU…"
          />
        </Field>
      </div>

      {method === "gift_card" && (
        <Field label="Cartão-presente *">
          <Select value={giftCardId} onValueChange={setGiftCardId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o cartão" />
            </SelectTrigger>
            <SelectContent>
              {(giftCards?.rows ?? [])
                .filter((card: any) => card.status === "ativo")
                .map((card: any) => (
                  <SelectItem key={card._id} value={card._id}>
                    {card.code} · saldo {money(card.balance)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      <InfoBanner>
        Não armazenamos dados de cartão. A integração com gateway de pagamento precisa ser
        configurada separadamente e não está ativa por padrão.
      </InfoBanner>

      <Field label="Observações">
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
    </FormDialog>
  );
}

export function Payments() {
  const { orgId, can } = useApp();
  const today = todayISO();
  const [from, setFrom] = useState(startOfMonth(today));
  const [to, setTo] = useState(today);
  const [method, setMethod] = useState("all");
  const [kind, setKind] = useState("all");
  const [newOpen, setNewOpen] = useState(false);
  const [refundId, setRefundId] = useState<any | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");

  const data = useQuery(
    api.payments.listPayments,
    orgId
      ? {
          orgId,
          from,
          to,
          method: method === "all" ? undefined : method,
          kind: kind === "all" ? undefined : kind,
        }
      : "skip",
  );
  const refund = useMutation(api.payments.refundPayment);

  if (!orgId) return <LoadingBlock rows={4} />;
  if (data === undefined) return <LoadingBlock rows={4} />;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Financeiro"
        title="Pagamentos e sinais"
        description="Todo valor recebido é registrado com forma de pagamento, data e vínculo com fatura ou agendamento."
        actions={
          can("payments.edit") && (
            <Button onClick={() => setNewOpen(true)}>
              <Plus className="mr-2 size-4" />
              Registrar pagamento
            </Button>
          )
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total recebido" value={money(data.received ?? 0)} tone="positive" />
        <StatCard label="Reembolsos" value={money(data.refunded ?? 0)} tone="negative" />
        <StatCard
          label="Recebido líquido"
          value={money((data.received ?? 0) - (data.refunded ?? 0))}
        />
        <StatCard
          label="Formas usadas"
          value={Object.keys(data.totals ?? {}).length}
          hint={Object.entries(data.totals ?? {})
            .map(([key, value]) => `${PAYMENT_METHOD[key] ?? key}: ${money(value as number)}`)
            .join(" · ")}
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
          <Field label="Forma">
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.entries(PAYMENT_METHOD).map(([key, value]) => (
                  <SelectItem key={key} value={key}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Tipo">
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(PAYMENT_KIND).map(([key, value]) => (
                  <SelectItem key={key} value={key}>
                    {value}
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
          rows={data.rows ?? []}
          empty={<EmptyState title="Nenhum pagamento no período" />}
          columns={[
            { key: "date", header: "Data", render: (row: any) => formatDate(row.date) },
            { key: "clientName", header: "Cliente" },
            {
              key: "kind",
              header: "Tipo",
              render: (row: any) => (
                <Badge variant="outline">{label(PAYMENT_KIND, row.kind)}</Badge>
              ),
            },
            {
              key: "method",
              header: "Forma",
              render: (row: any) => label(PAYMENT_METHOD, row.method),
            },
            {
              key: "invoiceNumber",
              header: "Fatura",
              render: (row: any) => row.invoiceNumber ?? "—",
            },
            { key: "reference", header: "Referência", render: (row: any) => row.reference ?? "—" },
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
            {
              key: "actions",
              header: "",
              align: "right",
              render: (row: any) =>
                can("payments.refund") && row.kind !== "reembolso" ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Registrar estorno"
                    onClick={() => {
                      setRefundId(row);
                      setRefundAmount(centsToInput(row.amount));
                    }}
                  >
                    <Undo2 className="size-4" />
                  </Button>
                ) : null,
            },
          ]}
        />
      </GlassCard>

      {newOpen && <PaymentDialog onClose={() => setNewOpen(false)} />}

      <FormDialog
        open={!!refundId}
        onOpenChange={() => setRefundId(null)}
        title="Registrar estorno"
        description="O estorno reduz a receita líquida e gera um lançamento auditável."
        submitLabel="Confirmar estorno"
        onSubmit={async () => {
          try {
            await refund({
              orgId,
              paymentId: refundId._id,
              amount: parseMoney(refundAmount),
              reason: refundReason,
            });
            toast.success("Estorno registrado.");
            setRefundId(null);
            setRefundReason("");
          } catch (err) {
            toast.error(errorMessage(err));
          }
        }}
      >
        <Field label="Valor do estorno">
          <MoneyInput value={refundAmount} onChange={setRefundAmount} />
        </Field>
        <Field label="Motivo *">
          <Textarea rows={2} value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
        </Field>
      </FormDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export function Expenses() {
  const { orgId, can, context } = useApp();
  const today = todayISO();
  const [from, setFrom] = useState(startOfMonth(today));
  const [to, setTo] = useState(addDays(today, 30));
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [dialog, setDialog] = useState<{ open: boolean; expense?: any }>({ open: false });

  const data = useQuery(
    api.payments.listExpenses,
    orgId
      ? {
          orgId,
          from,
          to,
          category: category === "all" ? undefined : category,
          status: status === "all" ? undefined : status,
        }
      : "skip",
  );
  const suppliers = useQuery(api.inventory.listSuppliers, orgId ? { orgId } : "skip");
  const accounts = useQuery(api.payments.listAccounts, orgId ? { orgId } : "skip");
  const payExpense = useMutation(api.payments.payExpense);
  const remove = useMutation(api.payments.deleteExpense);
  const generateRecurring = useMutation(api.payments.generateRecurringExpenses);
  const [removeId, setRemoveId] = useState<any | null>(null);

  if (!orgId) return <LoadingBlock rows={4} />;
  if (data === undefined) return <LoadingBlock rows={4} />;

  const categories = context?.org?.expenseCategories ?? [];
  const byCategory: Record<string, number> = data.totals.byCategory ?? {};

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Financeiro"
        title="Despesas"
        description="Despesas incorridas e despesas pagas são controladas separadamente para um fluxo de caixa fiel."
        actions={
          can("expenses.edit") && (
            <>
              <Button
                variant="outline"
                className="glass-soft"
                onClick={async () => {
                  try {
                    const created = await generateRecurring({
                      orgId,
                      month: today.slice(0, 7),
                    });
                    toast.success(
                      created
                        ? `${created} despesa(s) recorrente(s) geradas.`
                        : "Nenhuma despesa recorrente nova para este mês.",
                    );
                  } catch (err) {
                    toast.error(errorMessage(err));
                  }
                }}
              >
                <RefreshCcw className="mr-2 size-4" />
                Gerar recorrentes
              </Button>
              <Button onClick={() => setDialog({ open: true })}>
                <Plus className="mr-2 size-4" />
                Nova despesa
              </Button>
            </>
          )
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Despesas no período" value={money(data.totals.all)} />
        <StatCard label="Pagas" value={money(data.totals.paid)} tone="positive" />
        <StatCard
          label="Pendentes"
          value={money(data.totals.pending)}
          tone={data.totals.pending > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="Maior categoria"
          value={
            Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—"
          }
          hint={
            Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]
              ? money(Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0][1])
              : undefined
          }
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
          <Field label="Categoria">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {categories.map((item: string) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Situação">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="pago">Pagas</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </GlassCard>

      <GlassCard>
        <DataTable
          keyOf={(row: any) => row._id}
          rows={data.rows ?? []}
          empty={<EmptyState title="Nenhuma despesa no período" icon={<Wallet className="size-5" />} />}
          columns={[
            { key: "date", header: "Data", render: (row: any) => formatDate(row.date) },
            {
              key: "description",
              header: "Descrição",
              render: (row: any) => (
                <div>
                  <p className="font-medium">{row.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.category}
                    {row.recurring ? " · recorrente" : ""}
                  </p>
                </div>
              ),
            },
            { key: "supplierName", header: "Fornecedor" },
            {
              key: "dueDate",
              header: "Vencimento",
              render: (row: any) => (row.dueDate ? formatDate(row.dueDate) : "—"),
            },
            {
              key: "amount",
              header: "Valor",
              align: "right",
              render: (row: any) => money(row.amount),
            },
            {
              key: "status",
              header: "Situação",
              render: (row: any) => (
                <StatusPill
                  label={row.status === "pago" ? "Paga" : "Pendente"}
                  className={
                    row.status === "pago"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  }
                />
              ),
            },
            {
              key: "actions",
              header: "",
              align: "right",
              render: (row: any) =>
                can("expenses.edit") && (
                  <div className="flex justify-end gap-1">
                    {row.status !== "pago" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            await payExpense({
                              orgId,
                              expenseId: row._id,
                              paymentDate: todayISO(),
                            });
                            toast.success("Despesa marcada como paga.");
                          } catch (err) {
                            toast.error(errorMessage(err));
                          }
                        }}
                      >
                        <BadgeCheck className="mr-1 size-3.5" />
                        Marcar paga
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => setDialog({ open: true, expense: row })}>
                      <FileText className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-rose-600"
                      onClick={() => setRemoveId(row)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ),
            },
          ]}
        />
      </GlassCard>

      {dialog.open && (
        <ExpenseDialog
          orgId={orgId}
          expense={dialog.expense}
          categories={categories}
          suppliers={suppliers ?? []}
          accounts={accounts ?? []}
          onClose={() => setDialog({ open: false })}
        />
      )}

      <ConfirmDialog
        open={!!removeId}
        onOpenChange={() => setRemoveId(null)}
        title="Excluir despesa"
        description="A exclusão é definitiva. Considere manter o histórico para fins contábeis."
        confirmLabel="Excluir"
        onConfirm={async () => {
          try {
            await remove({ orgId, expenseId: removeId._id });
            toast.success("Despesa excluída.");
            setRemoveId(null);
          } catch (err) {
            toast.error(errorMessage(err));
          }
        }}
      />
    </div>
  );
}

function ExpenseDialog({
  orgId,
  expense,
  categories,
  suppliers,
  accounts,
  onClose,
}: {
  orgId: Id<"organizations">;
  expense?: any;
  categories: string[];
  suppliers: any[];
  accounts: any[];
  onClose: () => void;
}) {
  const save = useMutation(api.payments.saveExpense);
  const [form, setForm] = useState({
    category: expense?.category ?? categories[0] ?? "Outras despesas",
    description: expense?.description ?? "",
    supplierId: expense?.supplierId ?? "",
    amount: expense ? centsToInput(expense.amount) : "",
    date: expense?.date ?? todayISO(),
    dueDate: expense?.dueDate ?? "",
    status: expense?.status ?? "pendente",
    method: expense?.method ?? "pix",
    accountId: expense?.accountId ?? "",
    recurring: expense?.recurring ?? false,
    notes: expense?.notes ?? "",
  });
  const [error, setError] = useState<string | null>(null);

  return (
    <FormDialog
      open
      onOpenChange={(value) => !value && onClose()}
      size="lg"
      title={expense ? "Editar despesa" : "Nova despesa"}
      submitLabel={expense ? "Salvar alterações" : "Lançar despesa"}
      error={error}
      onSubmit={async () => {
        setError(null);
        try {
          await save({
            orgId,
            expenseId: expense?._id,
            category: form.category,
            description: form.description,
            supplierId: form.supplierId
              ? (form.supplierId as Id<"suppliers">)
              : undefined,
            amount: parseMoney(form.amount),
            date: form.date,
            dueDate: form.dueDate || undefined,
            status: form.status,
            method: form.method as any,
            accountId: form.accountId
              ? (form.accountId as Id<"financialAccounts">)
              : undefined,
            recurring: form.recurring,
            notes: form.notes || undefined,
          });
          toast.success("Despesa salva.");
          onClose();
        } catch (err) {
          setError(errorMessage(err));
        }
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Categoria *">
          <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Descrição *">
          <Input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
        <Field label="Valor *">
          <MoneyInput value={form.amount} onChange={(value) => setForm({ ...form, amount: value })} />
        </Field>
        <Field label="Data">
          <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </Field>
        <Field label="Vencimento">
          <Input
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
          />
        </Field>
        <Field label="Situação">
          <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="pago">Paga</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Fornecedor">
          <Select
            value={form.supplierId}
            onValueChange={(value) => setForm({ ...form, supplierId: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Não informado" />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((supplier) => (
                <SelectItem key={supplier._id} value={supplier._id}>
                  {supplier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Conta financeira">
          <Select
            value={form.accountId}
            onValueChange={(value) => setForm({ ...form, accountId: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Não informada" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account._id} value={account._id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={form.recurring}
          onChange={(event) => setForm({ ...form, recurring: event.target.checked })}
        />
        Despesa recorrente mensal (pode ser gerada automaticamente pelo botão “Gerar recorrentes”)
      </label>
      <Field label="Observações">
        <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Field>
    </FormDialog>
  );
}

// ---------------------------------------------------------------------------
// Cash flow
// ---------------------------------------------------------------------------

export function Cashflow() {
  const { orgId, can } = useApp();
  const buckets = useQuery(api.payments.cashFlow, orgId ? { orgId, months: 6 } : "skip");
  const accounts = useQuery(api.payments.listAccounts, orgId ? { orgId } : "skip");
  const saveAccount = useMutation(api.payments.saveAccount);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountForm, setAccountForm] = useState({
    name: "",
    type: "caixa",
    openingBalance: "",
  });

  if (!orgId) return <LoadingBlock rows={4} />;
  if (buckets === undefined) return <LoadingBlock rows={4} />;

  const totalInflow = buckets.reduce((acc, item) => acc + item.inflow, 0);
  const totalOutflow = buckets.reduce((acc, item) => acc + item.expensesPaid, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Financeiro"
        title="Fluxo de caixa"
        description="Entradas recebidas, estornos e despesas efetivamente pagas por mês. Valores faturados não entram no caixa antes do recebimento."
        actions={
          can("expenses.edit") && (
            <Button onClick={() => setAccountOpen(true)}>
              <Plus className="mr-2 size-4" />
              Nova conta
            </Button>
          )
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Entradas (6 meses)" value={money(totalInflow)} tone="positive" />
        <StatCard label="Saídas (6 meses)" value={money(totalOutflow)} tone="negative" />
        <StatCard
          label="Resultado de caixa"
          value={money(totalInflow - totalOutflow)}
          tone={totalInflow - totalOutflow >= 0 ? "positive" : "negative"}
        />
        <StatCard label="Contas cadastradas" value={(accounts ?? []).length} />
      </div>

      <GlassCard>
        <SectionTitle
          title="Movimento mensal"
          description="Recebimentos, estornos, despesas incorridas e despesas pagas."
        />
        <DataTable
          keyOf={(row: any) => row.month}
          rows={buckets}
          columns={[
            { key: "month", header: "Mês", render: (row: any) => monthLabel(row.month) },
            { key: "inflow", header: "Recebido", align: "right", render: (row: any) => money(row.inflow) },
            {
              key: "refunds",
              header: "Estornos",
              align: "right",
              render: (row: any) => (
                <span className={row.refunds > 0 ? "text-rose-600" : ""}>
                  {money(row.refunds)}
                </span>
              ),
            },
            { key: "invoiced", header: "Faturado", align: "right", render: (row: any) => money(row.invoiced) },
            {
              key: "expensesIncurred",
              header: "Despesas lançadas",
              align: "right",
              render: (row: any) => money(row.expensesIncurred),
            },
            {
              key: "expensesPaid",
              header: "Despesas pagas",
              align: "right",
              render: (row: any) => money(row.expensesPaid),
            },
            {
              key: "net",
              header: "Resultado",
              align: "right",
              render: (row: any) => (
                <span className={row.net >= 0 ? "text-emerald-600" : "text-rose-600"}>
                  {money(row.net)}
                </span>
              ),
            },
          ]}
        />
      </GlassCard>

      <GlassCard>
        <SectionTitle title="Contas financeiras" description="Saldo calculado a partir de pagamentos, estornos e despesas pagas." />
        <DataTable
          keyOf={(row: any) => row._id}
          rows={accounts ?? []}
          empty={<EmptyState title="Nenhuma conta cadastrada" />}
          columns={[
            { key: "name", header: "Conta" },
            { key: "type", header: "Tipo" },
            {
              key: "openingBalance",
              header: "Saldo inicial",
              align: "right",
              render: (row: any) => money(row.openingBalance),
            },
            {
              key: "inflow",
              header: "Entradas",
              align: "right",
              render: (row: any) => money(row.inflow),
            },
            {
              key: "outflow",
              header: "Saídas",
              align: "right",
              render: (row: any) => money(row.outflow),
            },
            {
              key: "balance",
              header: "Saldo atual",
              align: "right",
              render: (row: any) => (
                <span className={row.balance >= 0 ? "text-emerald-600" : "text-rose-600"}>
                  {money(row.balance)}
                </span>
              ),
            },
          ]}
        />
      </GlassCard>

      <FormDialog
        open={accountOpen}
        onOpenChange={setAccountOpen}
        title="Nova conta financeira"
        submitLabel="Criar conta"
        onSubmit={async () => {
          try {
            await saveAccount({
              orgId,
              name: accountForm.name,
              type: accountForm.type,
              openingBalance: parseMoney(accountForm.openingBalance),
            });
            toast.success("Conta criada.");
            setAccountOpen(false);
          } catch (err) {
            toast.error(errorMessage(err));
          }
        }}
      >
        <Field label="Nome *">
          <Input
            value={accountForm.name}
            onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
          />
        </Field>
        <Field label="Tipo">
          <Select
            value={accountForm.type}
            onValueChange={(value) => setAccountForm({ ...accountForm, type: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="caixa">Caixa</SelectItem>
              <SelectItem value="banco">Conta bancária</SelectItem>
              <SelectItem value="cartao">Cartão</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Saldo inicial">
          <MoneyInput
            value={accountForm.openingBalance}
            onChange={(value) => setAccountForm({ ...accountForm, openingBalance: value })}
          />
        </Field>
      </FormDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

export function Quotes() {
  const { orgId, can } = useApp();
  const [status, setStatus] = useState("all");
  const quotes = useQuery(
    api.invoices.listQuotes,
    orgId ? { orgId, status: status === "all" ? undefined : status } : "skip",
  );
  const clients = useQuery(api.clients.clientOptions, orgId ? { orgId } : "skip");
  const services = useQuery(api.services.serviceOptions, orgId ? { orgId } : "skip");
  const staff = useQuery(api.staff.staffOptions, orgId ? { orgId } : "skip");
  const save = useMutation(api.invoices.saveQuote);
  const setQuoteStatus = useMutation(api.invoices.setQuoteStatus);
  const convert = useMutation(api.invoices.convertQuoteToAppointment);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    clientId: "",
    validUntil: addDays(todayISO(), 15),
    discount: "",
    staffId: "",
    notes: "",
  });
  const [items, setItems] = useState<
    { serviceId: string; quantity: number; unitPrice: string }[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [convertQuote, setConvertQuote] = useState<any | null>(null);
  const [convertForm, setConvertForm] = useState({
    staffId: "",
    date: todayISO(),
    start: "10:00",
  });

  if (!orgId) return <LoadingBlock rows={4} />;
  if (quotes === undefined) return <LoadingBlock rows={4} />;

  const lines = items.map((item) => {
    const service = (services ?? []).find((s: any) => s._id === item.serviceId);
    const unitPrice = item.unitPrice ? parseMoney(item.unitPrice) : (service?.price ?? 0);
    return {
      kind: "service" as const,
      refId: item.serviceId,
      name: service?.name ?? "Serviço",
      quantity: item.quantity,
      unitPrice,
      total: unitPrice * item.quantity,
    };
  });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Atendimentos"
        title="Orçamentos"
        description="Fluxo guiado: orçamento → aprovação → agendamento → atendimento → fatura. O histórico aprovado é preservado."
        actions={
          can("appointments.edit") && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 size-4" />
              Novo orçamento
            </Button>
          )
        }
      />

      <GlassCard padded={false} className="p-3">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Situação">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(QUOTE_STATUS).map(([key, value]) => (
                  <SelectItem key={key} value={key}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <span className="ml-auto text-xs text-muted-foreground">
            {quotes.length} orçamento(s)
          </span>
        </div>
      </GlassCard>

      <GlassCard>
        <DataTable
          keyOf={(row: any) => row._id}
          rows={quotes}
          empty={<EmptyState title="Nenhum orçamento registrado" />}
          columns={[
            { key: "number", header: "Número" },
            { key: "clientName", header: "Cliente" },
            {
              key: "items",
              header: "Itens",
              render: (row: any) => (
                <span className="text-xs">{row.items.map((i: any) => i.name).join(", ")}</span>
              ),
            },
            { key: "total", header: "Total", align: "right", render: (row: any) => money(row.total) },
            {
              key: "validUntil",
              header: "Validade",
              render: (row: any) => (
                <span className={row.expired ? "text-rose-600" : ""}>
                  {formatDate(row.validUntil)}
                </span>
              ),
            },
            {
              key: "status",
              header: "Situação",
              render: (row: any) => (
                <StatusPill label={label(QUOTE_STATUS, row.status)} />
              ),
            },
            {
              key: "actions",
              header: "",
              align: "right",
              render: (row: any) =>
                can("appointments.edit") && (
                  <div className="flex justify-end gap-1">
                    <Select
                      value={row.status}
                      onValueChange={async (value) => {
                        try {
                          await setQuoteStatus({ orgId, quoteId: row._id, status: value });
                          toast.success("Situação atualizada.");
                        } catch (err) {
                          toast.error(errorMessage(err));
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(QUOTE_STATUS).map(([key, value]) => (
                          <SelectItem key={key} value={key}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {["aprovado", "enviado", "aguardando"].includes(row.status) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setConvertQuote(row);
                          setConvertForm({
                            staffId: (staff ?? [])[0]?._id ?? "",
                            date: todayISO(),
                            start: "10:00",
                          });
                        }}
                      >
                        Agendar
                      </Button>
                    )}
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
        title="Novo orçamento"
        submitLabel="Salvar orçamento"
        error={error}
        onSubmit={async () => {
          setError(null);
          if (!form.clientId) return setError("Selecione a cliente.");
          if (!lines.length) return setError("Adicione pelo menos um item.");
          try {
            await save({
              orgId,
              clientId: form.clientId as Id<"clients">,
              items: lines,
              discount: parseMoney(form.discount),
              validUntil: form.validUntil,
              staffId: form.staffId ? (form.staffId as Id<"staff">) : undefined,
              notes: form.notes || undefined,
              status: "rascunho",
            });
            toast.success("Orçamento criado.");
            setOpen(false);
            setItems([]);
          } catch (err) {
            setError(errorMessage(err));
          }
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cliente *">
            <Select
              value={form.clientId}
              onValueChange={(value) => setForm({ ...form, clientId: value })}
            >
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
          <Field label="Profissional responsável">
            <Select
              value={form.staffId}
              onValueChange={(value) => setForm({ ...form, staffId: value })}
            >
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
          <Field label="Validade">
            <Input
              type="date"
              value={form.validUntil}
              onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
            />
          </Field>
          <Field label="Desconto">
            <MoneyInput value={form.discount} onChange={(value) => setForm({ ...form, discount: value })} />
          </Field>
        </div>

        <Field label="Itens do orçamento *">
          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2">
                <Select
                  value={item.serviceId}
                  onValueChange={(value) =>
                    setItems((prev) =>
                      prev.map((entry, i) => (i === index ? { ...entry, serviceId: value } : entry)),
                    )
                  }
                >
                  <SelectTrigger className="min-w-[12rem] flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(services ?? []).map((service: any) => (
                      <SelectItem key={service._id} value={service._id}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <MoneyInput
                  value={item.unitPrice}
                  onChange={(value) =>
                    setItems((prev) =>
                      prev.map((entry, i) => (i === index ? { ...entry, unitPrice: value } : entry)),
                    )
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setItems((prev) => [
                  ...prev,
                  { serviceId: (services ?? [])[0]?._id ?? "", quantity: 1, unitPrice: "" },
                ])
              }
            >
              <Plus className="mr-1.5 size-3.5" />
              Adicionar item
            </Button>
          </div>
        </Field>

        <div className="glass-inset rounded-xl px-3 py-2 text-xs">
          <p className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">
              {money(lines.reduce((acc, line) => acc + line.total, 0))}
            </span>
          </p>
          <p className="flex justify-between font-semibold">
            <span>Total</span>
            <span className="tabular-nums">
              {money(
                lines.reduce((acc, line) => acc + line.total, 0) - parseMoney(form.discount),
              )}
            </span>
          </p>
        </div>

        <Field label="Observações">
          <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
      </FormDialog>

      <FormDialog
        open={!!convertQuote}
        onOpenChange={() => setConvertQuote(null)}
        title={`Converter orçamento ${convertQuote?.number ?? ""}`}
        description="Os itens aprovados são preservados e não são recalculados a partir do catálogo atual."
        submitLabel="Criar agendamento"
        onSubmit={async () => {
          try {
            await convert({
              orgId,
              quoteId: convertQuote._id,
              staffId: convertForm.staffId as Id<"staff">,
              date: convertForm.date,
              start: convertForm.start,
            });
            toast.success("Agendamento criado a partir do orçamento.");
            setConvertQuote(null);
          } catch (err) {
            toast.error(errorMessage(err));
          }
        }}
      >
        <Field label="Profissional">
          <Select
            value={convertForm.staffId}
            onValueChange={(value) => setConvertForm({ ...convertForm, staffId: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Data">
            <Input
              type="date"
              value={convertForm.date}
              onChange={(e) => setConvertForm({ ...convertForm, date: e.target.value })}
            />
          </Field>
          <Field label="Horário">
            <Input
              type="time"
              value={convertForm.start}
              onChange={(e) => setConvertForm({ ...convertForm, start: e.target.value })}
            />
          </Field>
        </div>
        <InfoBanner>
          A disponibilidade é validada no momento da conversão. Se o horário estiver ocupado,
          o sistema informa o conflito e nada é salvo.
        </InfoBanner>
      </FormDialog>
    </div>
  );
}

export { PaymentDialog };
