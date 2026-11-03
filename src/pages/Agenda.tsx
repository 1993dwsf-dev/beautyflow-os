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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/errors";
import {
  APPOINTMENT_STATUS,
  APPOINTMENT_STATUS_COLOR,
  PAYMENT_STATUS,
  addDays,
  durationLabel,
  formatDate,
  formatTime,
  label,
  money,
  parseMoney,
  startOfMonth,
  startOfWeek,
  todayISO,
  weekdayOf,
  WEEKDAYS,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  History,
  Play,
  Receipt,
  Trash2,
  UserCheck,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";

const PX_PER_MIN = 1.05;

export default function Agenda() {
  const { orgId, context, can } = useApp();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<"dia" | "semana" | "lista">("dia");
  const [date, setDate] = useState(context?.today ?? todayISO());
  const [staffFilter, setStaffFilter] = useState("all");
  const statusFilter = params.get("status") ?? "all";
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [detailId, setDetailId] = useState<Id<"appointments"> | null>(null);


  const range = useMemo(() => {
    if (view === "dia") return { from: date, to: date };
    if (view === "semana") {
      const start = startOfWeek(date);
      return { from: start, to: addDays(start, 6) };
    }
    return { from: startOfMonth(date), to: addDays(startOfMonth(addDays(date, 32)), -1) };
  }, [view, date]);

  const appointments = useQuery(
    api.appointments.listAppointments,
    orgId
      ? {
          orgId,
          from: range.from,
          to: range.to,
          staffId: staffFilter === "all" ? undefined : (staffFilter as Id<"staff">),
          status: statusFilter === "all" ? undefined : statusFilter,
          search: search || undefined,
        }
      : "skip",
  );
  const staff = useQuery(api.staff.staffOptions, orgId ? { orgId } : "skip");

  const dayStart = useMemo(() => {
    const hours = context?.org?.openHours ?? [];
    const weekday = weekdayOf(date);
    const open = hours.find((h: any) => h.weekday === weekday);
    if (!open || open.closed) return 8 * 60;
    const [h] = open.open.split(":").map(Number);
    return Math.max(0, (h - 1) * 60);
  }, [context, date]);

  const dayEnd = useMemo(() => {
    const hours = context?.org?.openHours ?? [];
    const weekday = weekdayOf(date);
    const open = hours.find((h: any) => h.weekday === weekday);
    if (!open || open.closed) return 20 * 60;
    const [h] = open.close.split(":").map(Number);
    return Math.min(24 * 60, (h + 1) * 60);
  }, [context, date]);

  if (!orgId) return <LoadingBlock rows={5} />;
  if (appointments === undefined) return <LoadingBlock rows={5} />;

  const rows: any[] = appointments.rows ?? [];
  const activeStaff = (staff ?? []).filter(
    (member: any) => staffFilter === "all" || member._id === staffFilter,
  );
  const hourMarks: number[] = [];
  for (let m = Math.ceil(dayStart / 60) * 60; m <= dayEnd; m += 60) hourMarks.push(m);
  const isClosed = (() => {
    const hours = context?.org?.openHours ?? [];
    const open = hours.find((h: any) => h.weekday === weekdayOf(date));
    return !open || open.closed;
  })();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Atendimentos"
        title="Agenda"
        description="Calendário com validação de disponibilidade, intervalos, bloqueios e prevenção de conflitos por profissional."
        actions={
          can("appointments.edit") && (
            <Button onClick={() => setNewOpen(true)}>
              <CalendarPlus className="mr-2 size-4" />
              Novo agendamento
            </Button>
          )
        }
      />

      <GlassCard padded={false} className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={view} onValueChange={(value) => setView(value as typeof view)}>
            <TabsList className="glass-soft">
              <TabsTrigger value="dia">Dia</TabsTrigger>
              <TabsTrigger value="semana">Semana</TabsTrigger>
              <TabsTrigger value="lista">Lista</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                setDate(addDays(date, view === "dia" ? -1 : view === "semana" ? -7 : -30))
              }
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="h-9 w-40"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                setDate(addDays(date, view === "dia" ? 1 : view === "semana" ? 7 : 30))
              }
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDate(todayISO())}>
              Hoje
            </Button>
          </div>

          <Select value={staffFilter} onValueChange={setStaffFilter}>
            <SelectTrigger className="h-9 w-48">
              <SelectValue placeholder="Profissional" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os profissionais</SelectItem>
              {(staff ?? []).map((member: any) => (
                <SelectItem key={member._id} value={member._id}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(value) => {
              const next = new URLSearchParams(params);
              if (value === "all") next.delete("status");
              else next.set("status", value);
              setParams(next, { replace: true });
            }}
          >
            <SelectTrigger className="h-9 w-48">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(APPOINTMENT_STATUS).map(([key, value]) => (
                <SelectItem key={key} value={key}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar cliente ou telefone"
            className="h-9 w-56"
          />

          <div className="ml-auto flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Receipt className="size-3.5" /> {money(appointments.revenue ?? 0)} concluídos
            </span>
            <span>{appointments.total ?? 0} registros</span>
          </div>
        </div>
      </GlassCard>

      {view === "dia" && isClosed && (
        <InfoBanner tone="warning">
          O estabelecimento está configurado como fechado em{" "}
          {WEEKDAYS[weekdayOf(date)]}. Ajuste o horário de funcionamento em
          Configurações › Organização para permitir agendamentos nesta data.
        </InfoBanner>
      )}

      {view === "dia" && (
        <GlassCard padded={false} className="overflow-hidden">
          <div className="scroll-thin overflow-x-auto">
            <div className="min-w-[52rem]">
              <div
                className="grid border-b border-white/60"
                style={{
                  gridTemplateColumns: `4.5rem repeat(${Math.max(activeStaff.length, 1)}, minmax(11rem, 1fr))`,
                }}
              >
                <div className="px-3 py-3 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
                  Hora
                </div>
                {activeStaff.map((member: any) => (
                  <div key={member._id} className="flex items-center gap-2 px-3 py-3">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ background: member.color }}
                    />
                    <span className="truncate text-sm font-medium">{member.name}</span>
                    <span className="ml-auto text-[0.65rem] text-muted-foreground">
                      {member.workStart}–{member.workEnd}
                    </span>
                  </div>
                ))}
              </div>

              <div
                className="relative grid"
                style={{
                  gridTemplateColumns: `4.5rem repeat(${Math.max(activeStaff.length, 1)}, minmax(11rem, 1fr))`,
                  height: (dayEnd - dayStart) * PX_PER_MIN,
                }}
              >
                <div className="relative border-r border-white/50">
                  {hourMarks.map((minutes) => (
                    <div
                      key={minutes}
                      className="absolute left-0 right-0 -translate-y-1/2 px-3 text-[0.68rem] tabular-nums text-muted-foreground"
                      style={{ top: (minutes - dayStart) * PX_PER_MIN }}
                    >
                      {formatTime(minutes)}
                    </div>
                  ))}
                </div>

                {activeStaff.length === 0 && (
                  <div className="col-span-6 flex items-center justify-center">
                    <EmptyState
                      title="Nenhuma profissional cadastrada"
                      description="Cadastre a equipe em Equipe › Profissionais para visualizar a agenda."
                    />
                  </div>
                )}

                {activeStaff.map((member: any) => {
                  const mine = rows.filter((row) => row.staffId === member._id);
                  return (
                    <div key={member._id} className="relative border-r border-white/50 last:border-0">
                      {hourMarks.map((minutes) => (
                        <div
                          key={minutes}
                          className="absolute left-0 right-0 border-t border-dashed border-white/60"
                          style={{ top: (minutes - dayStart) * PX_PER_MIN }}
                        />
                      ))}
                      {mine.map((item) => {
                        const top = (item.startMinutes - dayStart) * PX_PER_MIN;
                        const height = Math.max(
                          (item.endMinutes - item.startMinutes) * PX_PER_MIN,
                          34,
                        );
                        return (
                          <button
                            key={item._id}
                            type="button"
                            onClick={() => setDetailId(item._id)}
                            className={cn(
                              "absolute left-1.5 right-2 overflow-hidden rounded-xl border px-2.5 py-1.5 text-left text-[0.7rem] shadow-sm transition hover:z-10 hover:shadow-md",
                              APPOINTMENT_STATUS_COLOR[item.status] ??
                                "border-border bg-white/80",
                              item.status === "cancelled" && "opacity-60 line-through",
                            )}
                            style={{ top, height, background: "rgba(255,255,255,0.82)" }}
                          >
                            <span className="block truncate font-semibold">
                              {formatTime(item.startMinutes)} · {item.clientName}
                            </span>
                            <span className="block truncate text-[0.65rem] opacity-80">
                              {item.items?.map((i: any) => i.name).join(", ")}
                            </span>
                            <span className="block truncate text-[0.65rem] opacity-70">
                              {money(item.totalPrice - item.discount)} ·{" "}
                              {label(APPOINTMENT_STATUS, item.status)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {view === "semana" && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          {Array.from({ length: 7 }).map((_, index) => {
            const day = addDays(startOfWeek(date), index);
            const dayRows = rows.filter((row) => row.date === day);
            return (
              <GlassCard key={day} className="min-h-[16rem]">
                <div className="mb-3 flex items-baseline justify-between">
                  <p className="text-sm font-semibold">
                    {WEEKDAYS[weekdayOf(day)].slice(0, 3)}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(day)}</p>
                </div>
                {dayRows.length === 0 && (
                  <p className="text-xs text-muted-foreground">Sem atendimentos</p>
                )}
                <div className="space-y-2">
                  {dayRows.map((item) => (
                    <button
                      key={item._id}
                      type="button"
                      onClick={() => setDetailId(item._id)}
                      className="glass-inset w-full rounded-xl px-2.5 py-2 text-left"
                    >
                      <span className="block text-[0.7rem] font-semibold tabular-nums">
                        {formatTime(item.startMinutes)}
                      </span>
                      <span className="block truncate text-[0.7rem]">
                        {item.clientName}
                      </span>
                      <span
                        className={cn(
                          "mt-1 inline-flex rounded-full border px-1.5 py-0.5 text-[0.6rem]",
                          APPOINTMENT_STATUS_COLOR[item.status],
                        )}
                      >
                        {label(APPOINTMENT_STATUS, item.status)}
                      </span>
                    </button>
                  ))}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {view === "lista" && (
        <GlassCard>
          <SectionTitle
            title="Atendimentos do período"
            description="Histórico completo com valores, status e situação de pagamento."
          />
          <DataTable
            keyOf={(row: any) => row._id}
            onRowClick={(row: any) => setDetailId(row._id)}
            rows={rows}
            empty={
              <EmptyState
                title="Nenhum atendimento no período"
                description="Ajuste os filtros ou crie um novo agendamento."
                icon={<History className="size-5" />}
              />
            }
            columns={[
              {
                key: "date",
                header: "Data",
                render: (row: any) => (
                  <div>
                    <p className="font-medium tabular-nums">{formatDate(row.date)}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatTime(row.startMinutes)} – {formatTime(row.endMinutes)}
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
                key: "staffName",
                header: "Profissional",
                render: (row: any) => (
                  <span className="flex items-center gap-2">
                    <span
                      className="size-2 rounded-full"
                      style={{ background: row.staffColor }}
                    />
                    {row.staffName}
                  </span>
                ),
              },
              {
                key: "items",
                header: "Serviços",
                render: (row: any) => (
                  <span className="text-xs">
                    {row.items?.map((item: any) => item.name).join(", ")}
                  </span>
                ),
              },
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
                  <span className="text-xs text-muted-foreground">
                    {label(PAYMENT_STATUS, row.paymentStatus)}
                  </span>
                ),
              },
              {
                key: "total",
                header: "Total",
                align: "right",
                render: (row: any) => money(row.totalPrice - row.discount),
              },
            ]}
          />
        </GlassCard>
      )}

      {newOpen && orgId && (
        <NewAppointmentDialog
          open={newOpen}
          onOpenChange={setNewOpen}
          orgId={orgId}
          defaultDate={date}
        />
      )}

      {detailId && orgId && (
        <AppointmentDetailDialog
          orgId={orgId}
          appointmentId={detailId}
          can={can}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function NewAppointmentDialog({
  open,
  onOpenChange,
  orgId,
  defaultDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: Id<"organizations">;
  defaultDate: string;
}) {
  const clients = useQuery(api.clients.clientOptions, { orgId });
  const services = useQuery(api.services.serviceOptions, { orgId });
  const staff = useQuery(api.staff.staffOptions, { orgId });
  const create = useMutation(api.appointments.createAppointment);

  const [clientId, setClientId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [date, setDate] = useState(defaultDate);
  const [start, setStart] = useState("");
  const [discount, setDiscount] = useState("");
  const [notes, setNotes] = useState("");
  const [source, setSource] = useState("interno");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const availability = useQuery(
    api.appointments.availability,
    selected.length
      ? {
          orgId,
          date,
          serviceIds: selected as Id<"services">[],
          staffId: staffId ? (staffId as Id<"staff">) : undefined,
        }
      : "skip",
  );

  const eligibleStaff = (staff ?? []).filter(
    (member: any) =>
      !selected.length ||
      selected.every((serviceId) => {
        const service = (services ?? []).find((s: any) => s._id === serviceId);
        return (
          !service ||
          !service.eligibleStaff?.length ||
          service.eligibleStaff.includes(member._id)
        );
      }),
  );

  const slots: any[] = availability?.slots ?? [];
  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const slot of slots) {
      const key = slot.staffName;
      map.set(key, [...(map.get(key) ?? []), slot]);
    }
    return Array.from(map.entries());
  }, [slots]);

  const totalCents = selected.reduce((acc, id) => {
    const service = (services ?? []).find((s: any) => s._id === id);
    return acc + (service?.price ?? 0);
  }, 0);
  const discountCents = parseMoney(discount);

  async function submit() {
    setError(null);
    if (!clientId) return setError("Selecione a cliente.");
    if (!staffId) return setError("Selecione a profissional.");
    if (!selected.length) return setError("Selecione pelo menos um serviço.");
    if (!start) return setError("Escolha um horário disponível.");
    setLoading(true);
    try {
      await create({
        orgId,
        clientId: clientId as Id<"clients">,
        staffId: staffId as Id<"staff">,
        serviceIds: selected as Id<"services">[],
        date,
        start,
        discount: discountCents,
        notes: notes || undefined,
        source,
      });
      toast.success("Agendamento criado com sucesso.");
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title="Novo agendamento"
      description="O sistema valida horário de funcionamento, escala, intervalos, bloqueios e conflitos antes de salvar."
      submitLabel="Confirmar agendamento"
      onSubmit={submit}
      loading={loading}
      error={error}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cliente *">
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a cliente" />
            </SelectTrigger>
            <SelectContent>
              {(clients ?? []).map((client: any) => (
                <SelectItem key={client._id} value={client._id}>
                  {client.name} · {client.phone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Profissional *">
          <Select value={staffId} onValueChange={setStaffId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a profissional" />
            </SelectTrigger>
            <SelectContent>
              {eligibleStaff.map((member: any) => (
                <SelectItem key={member._id} value={member._id}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Serviços *" hint="A duração e o valor são congelados no momento do agendamento.">
        <div className="grid max-h-44 gap-2 overflow-y-auto rounded-xl border border-white/70 bg-white/50 p-2 sm:grid-cols-2">
          {(services ?? []).map((service: any) => {
            const checked = selected.includes(service._id);
            return (
              <button
                key={service._id}
                type="button"
                onClick={() =>
                  setSelected((prev) =>
                    checked
                      ? prev.filter((id) => id !== service._id)
                      : [...prev, service._id],
                  )
                }
                className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition",
                  checked
                    ? "bg-primary/12 text-primary ring-1 ring-primary/30"
                    : "hover:bg-white/70",
                )}
              >
                <span className="truncate">{service.name}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {money(service.price)} · {durationLabel(service.durationMin)}
                </span>
              </button>
            );
          })}
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Data *">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Desconto" hint="Em reais">
          <MoneyInput value={discount} onChange={setDiscount} />
        </Field>
        <Field label="Origem">
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="interno">Recepção / interno</SelectItem>
              <SelectItem value="cliente">Solicitado pela cliente</SelectItem>
              <SelectItem value="rebook">Reagendamento</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-foreground/80">
          Horários disponíveis
        </p>
        {!selected.length && (
          <p className="text-xs text-muted-foreground">
            Selecione os serviços para calcular a duração e os horários livres.
          </p>
        )}
        {selected.length > 0 && slots.length === 0 && (
          <InfoBanner tone="warning">
            Nenhum horário disponível nesta data. Verifique escala, bloqueios,
            horário de funcionamento ou antecedência mínima para agendamento online.
          </InfoBanner>
        )}
        <div className="space-y-3">
          {grouped.map(([name, list]) => (
            <div key={name}>
              <p className="mb-1 text-[0.7rem] font-medium text-muted-foreground">{name}</p>
              <div className="flex flex-wrap gap-1.5">
                {list.map((slot) => (
                  <button
                    key={`${slot.staffId}-${slot.startMinutes}`}
                    type="button"
                    onClick={() => {
                      setStart(formatTime(slot.startMinutes));
                      setStaffId(slot.staffId);
                    }}
                    className={cn(
                      "rounded-lg border px-2.5 py-1 text-xs tabular-nums transition",
                      start === formatTime(slot.startMinutes) &&
                        staffId === slot.staffId
                        ? "border-primary bg-primary text-white"
                        : "border-white/70 bg-white/70 hover:bg-white",
                    )}
                  >
                    {formatTime(slot.startMinutes)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Field label="Observações">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Preferências, alergias relatadas, pedidos especiais…"
        />
      </Field>

      <div className="glass-inset rounded-xl px-3 py-2 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Serviços ({selected.length})</span>
          <span className="tabular-nums">{money(totalCents)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Desconto</span>
          <span className="tabular-nums">− {money(discountCents)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-white/60 pt-1 font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{money(totalCents - discountCents)}</span>
        </div>
      </div>
    </FormDialog>
  );
}

// ---------------------------------------------------------------------------

function AppointmentDetailDialog({
  orgId,
  appointmentId,
  can,
  onClose,
}: {
  orgId: Id<"organizations">;
  appointmentId: Id<"appointments">;
  can: (permission: any) => boolean;
  onClose: () => void;
}) {
  const detail = useQuery(api.appointments.appointmentDetail, { orgId, appointmentId });
  const setStatus = useMutation(api.appointments.setAppointmentStatus);
  const remove = useMutation(api.appointments.deleteAppointment);
  const createInvoice = useMutation(api.invoices.createInvoiceFromAppointment);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (detail === undefined) return <LoadingBlock rows={3} />;
  if (detail === null) {
    return (
      <FormDialog
        open
        onOpenChange={onClose}
        title="Atendimento indisponível"
        onSubmit={onClose}
        submitLabel="Fechar"
      >
        <p className="text-sm text-muted-foreground">
          Este registro não pertence à organização selecionada.
        </p>
      </FormDialog>
    );
  }

  const apt = detail.appointment;

  async function changeStatus(status: string, note?: string) {
    setBusy(true);
    try {
      await setStatus({
        orgId,
        appointmentId,
        status: status as any,
        reason: note,
      });
      toast.success("Status atualizado.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <FormDialog
        open
        onOpenChange={(value) => !value && onClose()}
        size="lg"
        title={`${detail.client?.name ?? "Cliente"} · ${formatDate(apt.date)}`}
        description={`${formatTime(apt.startMinutes)} – ${formatTime(apt.endMinutes)} · ${detail.staff?.name ?? ""}`}
        onSubmit={onClose}
        submitLabel="Fechar"
      >
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill
            label={label(APPOINTMENT_STATUS, apt.status)}
            className={APPOINTMENT_STATUS_COLOR[apt.status]}
          />
          <StatusPill label={label(PAYMENT_STATUS, apt.paymentStatus)} />
          <Badge variant="outline">{apt.source}</Badge>
          {apt.status === "completed" && <Badge variant="outline">Concluído</Badge>}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="glass-inset rounded-xl p-3 text-xs">
            <p className="font-semibold">Serviços</p>
            <ul className="mt-1 space-y-1">
              {apt.items.map((item: any, index: number) => (
                <li key={index} className="flex justify-between gap-2">
                  <span className="truncate">{item.name}</span>
                  <span className="tabular-nums">{money(item.total)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex justify-between border-t border-white/60 pt-1 font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{money(apt.totalPrice - apt.discount)}</span>
            </div>
          </div>

          <div className="glass-inset rounded-xl p-3 text-xs">
            <p className="font-semibold">Financeiro</p>
            <p className="mt-1 flex justify-between">
              <span className="text-muted-foreground">Sinal exigido</span>
              <span className="tabular-nums">{money(apt.depositRequired)}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-muted-foreground">Sinal recebido</span>
              <span className="tabular-nums">{money(detail.depositPaid)}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-muted-foreground">Alocado em faturas</span>
              <span className="tabular-nums">{money(detail.paid)}</span>
            </p>
            <p className="mt-1 border-t border-white/60 pt-1 text-[0.68rem] text-muted-foreground">
              Um sinal não significa atendimento pago: o saldo é calculado a partir
              das faturas e dos valores recebidos.
            </p>
          </div>
        </div>

        {apt.notes && (
          <InfoBanner>Observações: {apt.notes}</InfoBanner>
        )}

        {detail.records.length > 0 && (
          <div className="glass-inset rounded-xl p-3 text-xs">
            <p className="font-semibold">Ficha do atendimento</p>
            {detail.records.map((record: any) => (
              <div key={record._id} className="mt-1 space-y-0.5 text-muted-foreground">
                {record.formula && <p>Fórmula: {record.formula}</p>}
                {record.notes && <p>Notas: {record.notes}</p>}
                {record.nextVisitDate && (
                  <p>Retorno sugerido: {formatDate(record.nextVisitDate)}</p>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="glass-inset rounded-xl p-3 text-xs">
          <p className="font-semibold">Histórico de status</p>
          <ul className="mt-1 space-y-1 text-muted-foreground">
            {detail.history.map((entry: any) => (
              <li key={entry._id} className="flex justify-between gap-2">
                <span>
                  {label(APPOINTMENT_STATUS, entry.from)} →{" "}
                  {label(APPOINTMENT_STATUS, entry.to)}
                  {entry.note ? ` (${entry.note})` : ""}
                </span>
                <span className="tabular-nums">
                  {new Date(entry.at).toLocaleString("pt-BR")}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {can("appointments.edit") && (
          <div className="flex flex-wrap gap-2">
            {["confirmed", "checked_in", "in_progress"].includes(apt.status) === false &&
              apt.status !== "completed" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => changeStatus("confirmed")}
                >
                  <CheckCircle2 className="mr-1.5 size-3.5" />
                  Confirmar
                </Button>
              )}
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => changeStatus("checked_in")}
            >
              <UserCheck className="mr-1.5 size-3.5" />
              Check-in
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => changeStatus("in_progress")}
            >
              <Play className="mr-1.5 size-3.5" />
              Iniciar
            </Button>
            {apt.status !== "completed" && (
              <Button size="sm" onClick={() => setCompleteOpen(true)}>
                <CheckCircle2 className="mr-1.5 size-3.5" />
                Concluir atendimento
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setRescheduleOpen(true)}>
              <CalendarDays className="mr-1.5 size-3.5" />
              Remarcar
            </Button>
            <Button size="sm" variant="outline" onClick={() => setCancelOpen(true)}>
              <XCircle className="mr-1.5 size-3.5" />
              Cancelar / falta
            </Button>
          </div>
        )}

        {can("invoices.edit") &&
          apt.status === "completed" &&
          detail.invoices.length === 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                setBusy(true);
                try {
                  await createInvoice({ orgId, appointmentId });
                  toast.success("Fatura gerada a partir do atendimento.");
                } catch (err) {
                  toast.error(errorMessage(err));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Receipt className="mr-1.5 size-3.5" />
              Gerar fatura
            </Button>
          )}

        {detail.invoices.length > 0 && (
          <InfoBanner tone="success">
            {detail.invoices.length} fatura(s) vinculada(s):{" "}
            {detail.invoices.map((invoice: any) => invoice.number).join(", ")}
          </InfoBanner>
        )}

        {can("appointments.delete") && apt.status !== "completed" && (
          <Button
            variant="ghost"
            size="sm"
            className="text-rose-600"
            onClick={async () => {
              setBusy(true);
              try {
                await remove({ orgId, appointmentId });
                toast.success("Agendamento excluído.");
                onClose();
              } catch (err) {
                toast.error(errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Trash2 className="mr-1.5 size-3.5" />
            Excluir agendamento
          </Button>
        )}
      </FormDialog>

      {completeOpen && (
        <CompleteDialog
          orgId={orgId}
          appointmentId={appointmentId}
          onClose={() => {
            setCompleteOpen(false);
            onClose();
          }}
        />
      )}

      {rescheduleOpen && (
        <RescheduleDialog
          orgId={orgId}
          appointmentId={appointmentId}
          serviceIds={apt.items
            .filter((item: any) => item.kind === "service" && item.refId)
            .map((item: any) => item.refId)}
          currentDate={apt.date}
          onClose={() => setRescheduleOpen(false)}
        />
      )}

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancelar ou registrar falta"
        description="Informe o motivo. Atendimentos cancelados ou faltas não alteram o ciclo de retorno já registrado."
        confirmLabel="Registrar cancelamento"
        loading={busy}
        onConfirm={async () => {
          if (!reason.trim()) {
            toast.error("Informe o motivo do cancelamento.");
            return;
          }
          await changeStatus("cancelled", reason);
          setCancelOpen(false);
        }}
      >
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Motivo do cancelamento ou da falta"
          className="mt-2"
        />
        <div className="mt-2 flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={async () => {
              await changeStatus("no_show", reason || "Cliente não compareceu");
              setCancelOpen(false);
            }}
          >
            Registrar falta
          </Button>
        </div>
      </ConfirmDialog>
    </>
  );
}

// ---------------------------------------------------------------------------

function CompleteDialog({
  orgId,
  appointmentId,
  onClose,
}: {
  orgId: Id<"organizations">;
  appointmentId: Id<"appointments">;
  onClose: () => void;
}) {
  const products = useQuery(api.inventory.productOptions, { orgId });
  const complete = useMutation(api.appointments.completeAppointment);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [formula, setFormula] = useState("");
  const [reactions, setReactions] = useState("");
  const [interval, setInterval] = useState("30");
  const [createRecord, setCreateRecord] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const result = await complete({
        orgId,
        appointmentId,
        notes: notes || undefined,
        formula: formula || undefined,
        reactions: reactions || undefined,
        nextVisitIntervalDays:
          interval && interval !== "none" ? Number(interval) : undefined,
        createTreatmentRecord: createRecord,
        productsUsed: Object.entries(usage)
          .filter(([, quantity]) => quantity > 0)
          .map(([productId, quantity]) => {
            const product = (products ?? []).find((p: any) => p._id === productId);
            return {
              productId: productId as Id<"products">,
              name: product?.name ?? "Produto",
              quantity,
            };
          }),
      });
      toast.success(
        result.nextVisitDate
          ? `Atendimento concluído. Retorno sugerido para ${formatDate(result.nextVisitDate)}.`
          : "Atendimento concluído com sucesso.",
      );
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
      title="Concluir atendimento"
      description="Registra ficha, consumo de estoque, comissão e a data de retorno recomendada."
      submitLabel="Concluir atendimento"
      onSubmit={submit}
      loading={loading}
      error={error}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fórmula / técnica" hint="Ex.: 7.1 + oxidante 20 vol">
          <Input value={formula} onChange={(e) => setFormula(e.target.value)} />
        </Field>
        <Field label="Intervalo de retorno" hint="Em dias (fins de semana e ciclos)">
          <Select value={interval} onValueChange={setInterval}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="14">2 semanas</SelectItem>
              <SelectItem value="21">3 semanas</SelectItem>
              <SelectItem value="28">4 semanas</SelectItem>
              <SelectItem value="45">6 semanas</SelectItem>
              <SelectItem value="60">2 meses</SelectItem>
              <SelectItem value="90">3 meses</SelectItem>
              <SelectItem value="none">Sem sugestão de retorno</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Anotações do atendimento">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </Field>

      <Field label="Reações observadas" hint="Somente o que a cliente relatou durante o atendimento.">
        <Textarea value={reactions} onChange={(e) => setReactions(e.target.value)} rows={2} />
      </Field>

      <Field
        label="Produtos utilizados"
        hint="Informe a quantidade real consumida. O estoque só é deduzido ao concluir o atendimento."
      >
        <div className="scroll-thin max-h-48 space-y-2 overflow-y-auto rounded-xl border border-white/70 bg-white/50 p-2">
          {(products ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">
              Nenhum produto cadastrado no estoque.
            </p>
          )}
          {(products ?? []).map((product: any) => (
            <div key={product._id} className="flex items-center gap-3 text-xs">
              <span className="min-w-0 flex-1 truncate">
                {product.name}
                <span className="ml-2 text-muted-foreground">
                  saldo {product.quantity}
                </span>
              </span>
              <Input
                type="number"
                min={0}
                value={usage[product._id] ?? ""}
                onChange={(event) =>
                  setUsage((prev) => ({
                    ...prev,
                    [product._id]: Number(event.target.value),
                  }))
                }
                className="h-8 w-20"
                placeholder="0"
              />
            </div>
          ))}
        </div>
      </Field>

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={createRecord}
          onChange={(event) => setCreateRecord(event.target.checked)}
        />
        Criar ficha de atendimento no histórico da cliente
      </label>
    </FormDialog>
  );
}

function RescheduleDialog({
  orgId,
  appointmentId,
  serviceIds,
  currentDate,
  onClose,
}: {
  orgId: Id<"organizations">;
  appointmentId: Id<"appointments">;
  serviceIds: string[];
  currentDate: string;
  onClose: () => void;
}) {
  const [date, setDate] = useState(currentDate);
  const [start, setStart] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const reschedule = useMutation(api.appointments.rescheduleAppointment);
  const availability = useQuery(
    api.appointments.availability,
    serviceIds.length
      ? { orgId, date, serviceIds: serviceIds as Id<"services">[] }
      : "skip",
  );

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      await reschedule({
        orgId,
        appointmentId,
        date,
        start,
      });
      toast.success("Atendimento remarcado.");
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
      title="Remarcar atendimento"
      description="O sistema valida a nova disponibilidade antes de confirmar."
      submitLabel="Confirmar remarcação"
      onSubmit={submit}
      loading={loading}
      error={error}
    >
      <Field label="Nova data">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="Horário disponível">
        <div className="flex flex-wrap gap-1.5">
          {(availability?.slots ?? []).map((slot: any) => (
            <button
              key={`${slot.staffId}-${slot.startMinutes}`}
              type="button"
              onClick={() => setStart(formatTime(slot.startMinutes))}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-xs tabular-nums transition",
                start === formatTime(slot.startMinutes)
                  ? "border-primary bg-primary text-white"
                  : "border-white/70 bg-white/70 hover:bg-white",
              )}
            >
              {formatTime(slot.startMinutes)} · {slot.staffName}
            </button>
          ))}
          {(availability?.slots ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">
              Nenhum horário livre nesta data.
            </p>
          )}
        </div>
      </Field>
    </FormDialog>
  );
}
