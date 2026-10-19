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
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/errors";
import {
  COMMISSION_STATUS,
  WEEKDAYS,
  addDays,
  centsToInput,
  durationLabel,
  formatDate,
  formatTime,
  label,
  money,
  parseMoney,
  startOfMonth,
  todayISO,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  CalendarOff,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Pencil,
  PiggyBank,
  Plus,
  Receipt,
  Trash2,
  UserCog,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const emptyStaff = {
  name: "",
  phone: "",
  email: "",
  role: "Profissional",
  employmentType: "autonoma",
  startDate: "",
  workStart: "09:00",
  workEnd: "19:00",
  breakStart: "13:00",
  breakEnd: "14:00",
  commissionPct: "40",
  hourlyRate: "",
  fixedSalary: "",
  notes: "",
  workingDays: [1, 2, 3, 4, 5],
  serviceIds: [] as string[],
};

export function Staff() {
  const { orgId, can } = useApp();
  const [dialog, setDialog] = useState<{ open: boolean; staff?: any }>({ open: false });
  const staff = useQuery(api.staff.listStaff, orgId ? { orgId } : "skip");
  const services = useQuery(api.services.serviceOptions, orgId ? { orgId } : "skip");
  const update = useMutation(api.staff.updateStaff);

  if (!orgId) return <LoadingBlock rows={4} />;
  if (staff === undefined) return <LoadingBlock rows={4} />;

  const rows: any[] = staff ?? [];
  const active = rows.filter((row) => row.active);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Equipe"
        title="Profissionais"
        description="Cadastro, horários, serviços habilitados e regras de comissão. Permissões de acesso são gerenciadas separadamente."
        actions={
          can("staff.edit") && (
            <Button onClick={() => setDialog({ open: true })}>
              <Plus className="mr-2 size-4" />
              Nova profissional
            </Button>
          )
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Profissionais ativas" value={active.length} icon={<UserCog className="size-4" />} />
        <StatCard label="Total cadastrado" value={rows.length} />
        <StatCard
          label="Atendimentos hoje"
          value={active.reduce((acc, row) => acc + row.todayAppointments, 0)}
          icon={<Clock className="size-4" />}
        />
        <StatCard
          label="Horas agendadas hoje"
          value={durationLabel(active.reduce((acc, row) => acc + row.todayMinutes, 0))}
        />
      </div>

      {(services ?? []).length === 0 && (
        <InfoBanner tone="warning">
          Cadastre serviços no catálogo antes de atribuir habilitações às profissionais.
        </InfoBanner>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.length === 0 && (
          <EmptyState
            title="Nenhuma profissional cadastrada"
            description="Cadastre a equipe para montar a agenda e calcular comissões."
            icon={<UserCog className="size-5" />}
          />
        )}
        {rows.map((member: any) => (
          <GlassCard key={member._id} className="flex flex-col">
            <div className="flex items-start gap-3">
              <span
                className="flex size-10 items-center justify-center rounded-xl text-sm font-semibold text-white"
                style={{ background: member.color }}
              >
                {member.name.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{member.name}</p>
                <p className="text-xs text-muted-foreground">
                  {member.role} · {member.employmentType}
                </p>
              </div>
              {!member.active && <Badge variant="outline">Inativa</Badge>}
            </div>

            <dl className="mt-3 space-y-1 text-xs">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Horário</dt>
                <dd>
                  {member.workStart}–{member.workEnd}
                  {member.breakStart ? ` (intervalo ${member.breakStart}–${member.breakEnd})` : ""}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Dias</dt>
                <dd>
                  {member.workingDays
                    .map((day: number) => WEEKDAYS[day].slice(0, 3))
                    .join(", ")}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Comissão</dt>
                <dd>{member.commissionPct}%</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Hoje</dt>
                <dd>
                  {member.todayAppointments} atendimento(s) ·{" "}
                  {durationLabel(member.todayMinutes)}
                </dd>
              </div>
            </dl>

            <div className="mt-2 flex flex-wrap gap-1">
              {member.serviceNames.length === 0 && (
                <span className="text-[0.7rem] text-muted-foreground">
                  Nenhum serviço habilitado
                </span>
              )}
              {member.serviceNames.slice(0, 4).map((name: string) => (
                <Badge key={name} variant="outline" className="text-[0.62rem]">
                  {name}
                </Badge>
              ))}
              {member.serviceNames.length > 4 && (
                <Badge variant="outline" className="text-[0.62rem]">
                  +{member.serviceNames.length - 4}
                </Badge>
              )}
            </div>

            {can("staff.edit") && (
              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="glass-soft flex-1"
                  onClick={() => setDialog({ open: true, staff: member })}
                >
                  <Pencil className="mr-1.5 size-3.5" />
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    try {
                      await update({
                        orgId,
                        staffId: member._id,
                        patch: { active: !member.active },
                      });
                      toast.success(
                        member.active ? "Profissional desativada." : "Profissional reativada.",
                      );
                    } catch (err) {
                      toast.error(errorMessage(err));
                    }
                  }}
                >
                  {member.active ? "Desativar" : "Reativar"}
                </Button>
              </div>
            )}
          </GlassCard>
        ))}
      </div>

      {dialog.open && (
        <StaffDialog
          orgId={orgId}
          staff={dialog.staff}
          services={services ?? []}
          onClose={() => setDialog({ open: false })}
        />
      )}
    </div>
  );
}

function StaffDialog({
  orgId,
  staff,
  services,
  onClose,
}: {
  orgId: Id<"organizations">;
  staff?: any;
  services: any[];
  onClose: () => void;
}) {
  const create = useMutation(api.staff.createStaff);
  const update = useMutation(api.staff.updateStaff);
  const [form, setForm] = useState({
    name: staff?.name ?? emptyStaff.name,
    phone: staff?.phone ?? "",
    email: staff?.email ?? "",
    role: staff?.role ?? emptyStaff.role,
    employmentType: staff?.employmentType ?? emptyStaff.employmentType,
    startDate: staff?.startDate ?? "",
    workStart: staff?.workStart ?? emptyStaff.workStart,
    workEnd: staff?.workEnd ?? emptyStaff.workEnd,
    breakStart: staff?.breakStart ?? emptyStaff.breakStart,
    breakEnd: staff?.breakEnd ?? emptyStaff.breakEnd,
    commissionPct: String(staff?.commissionPct ?? emptyStaff.commissionPct),
    hourlyRate: staff?.hourlyRate ? centsToInput(staff.hourlyRate) : "",
    fixedSalary: staff?.fixedSalary ? centsToInput(staff.fixedSalary) : "",
    notes: staff?.notes ?? "",
    workingDays: (staff?.workingDays ?? emptyStaff.workingDays) as number[],
    serviceIds: (staff?.serviceIds ?? []) as string[],
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    const payload = {
      name: form.name,
      phone: form.phone || undefined,
      email: form.email || undefined,
      role: form.role,
      employmentType: form.employmentType,
      startDate: form.startDate || undefined,
      workingDays: form.workingDays,
      workStart: form.workStart,
      workEnd: form.workEnd,
      breakStart: form.breakStart || undefined,
      breakEnd: form.breakEnd || undefined,
      serviceIds: form.serviceIds as Id<"services">[],
      commissionPct: Number(form.commissionPct) || 0,
      hourlyRate: form.hourlyRate ? parseMoney(form.hourlyRate) : undefined,
      fixedSalary: form.fixedSalary ? parseMoney(form.fixedSalary) : undefined,
      notes: form.notes || undefined,
    };
    try {
      if (staff) {
        await update({ orgId, staffId: staff._id, patch: payload });
        toast.success("Profissional atualizada.");
      } else {
        await create({ orgId, ...payload });
        toast.success("Profissional cadastrada.");
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
      title={staff ? "Editar profissional" : "Nova profissional"}
      description="Horários e dias definidos aqui alimentam a validação de conflitos na agenda."
      onSubmit={submit}
      loading={loading}
      error={error}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome *">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Função">
          <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
        </Field>
        <Field label="Telefone">
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="E-mail">
          <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Tipo de vínculo">
          <Select
            value={form.employmentType}
            onValueChange={(value) => setForm({ ...form, employmentType: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="clt">CLT</SelectItem>
              <SelectItem value="autonoma">Autônoma / parceira</SelectItem>
              <SelectItem value="socio">Sócia</SelectItem>
              <SelectItem value="estagio">Estágio</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Início na equipe">
          <Input
            type="date"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
          />
        </Field>
      </div>

      <Field label="Dias de atendimento">
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((day, index) => {
            const checked = form.workingDays.includes(index);
            return (
              <button
                key={day}
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    workingDays: checked
                      ? form.workingDays.filter((value) => value !== index)
                      : [...form.workingDays, index].sort(),
                  })
                }
                className={cn(
                  "rounded-xl border px-3 py-1 text-xs transition",
                  checked
                    ? "border-primary/40 bg-primary/12 text-primary"
                    : "border-white/70 bg-white/70 hover:bg-white",
                )}
              >
                {day}
              </button>
            );
          })}
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Início">
          <Input
            type="time"
            value={form.workStart}
            onChange={(e) => setForm({ ...form, workStart: e.target.value })}
          />
        </Field>
        <Field label="Fim">
          <Input
            type="time"
            value={form.workEnd}
            onChange={(e) => setForm({ ...form, workEnd: e.target.value })}
          />
        </Field>
        <Field label="Intervalo início">
          <Input
            type="time"
            value={form.breakStart}
            onChange={(e) => setForm({ ...form, breakStart: e.target.value })}
          />
        </Field>
        <Field label="Intervalo fim">
          <Input
            type="time"
            value={form.breakEnd}
            onChange={(e) => setForm({ ...form, breakEnd: e.target.value })}
          />
        </Field>
      </div>

      <Field label="Serviços habilitados" hint="Sem seleção = realiza todos os serviços">
        <div className="grid max-h-40 gap-2 overflow-y-auto rounded-xl border border-white/70 bg-white/50 p-2 sm:grid-cols-2">
          {services.map((service) => {
            const checked = form.serviceIds.includes(service._id);
            return (
              <button
                key={service._id}
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    serviceIds: checked
                      ? form.serviceIds.filter((id) => id !== service._id)
                      : [...form.serviceIds, service._id],
                  })
                }
                className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-1.5 text-left text-xs transition",
                  checked ? "bg-primary/12 text-primary" : "hover:bg-white/70",
                )}
              >
                <span className="truncate">{service.name}</span>
                <span className="tabular-nums text-muted-foreground">
                  {money(service.price)}
                </span>
              </button>
            );
          })}
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Comissão padrão (%)">
          <Input
            type="number"
            min={0}
            max={100}
            value={form.commissionPct}
            onChange={(e) => setForm({ ...form, commissionPct: e.target.value })}
          />
        </Field>
        <Field label="Valor por hora" hint="Opcional, quando houver">
          <MoneyInput
            value={form.hourlyRate}
            onChange={(value) => setForm({ ...form, hourlyRate: value })}
          />
        </Field>
        <Field label="Salário fixo" hint="Opcional, quando houver">
          <MoneyInput
            value={form.fixedSalary}
            onChange={(value) => setForm({ ...form, fixedSalary: value })}
          />
        </Field>
      </div>

      <Field label="Observações internas">
        <Textarea
          rows={2}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </Field>
    </FormDialog>
  );
}

// ---------------------------------------------------------------------------
// Availability & schedule
// ---------------------------------------------------------------------------

export function Availability() {
  const { orgId, can } = useApp();
  const staff = useQuery(api.staff.staffOptions, orgId ? { orgId } : "skip");
  const [staffId, setStaffId] = useState("");
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockForm, setBlockForm] = useState({
    date: todayISO(),
    start: "12:00",
    end: "14:00",
    reason: "Compromisso pessoal",
  });

  const availability = useQuery(
    api.staff.staffAvailability,
    orgId && staffId ? { orgId, staffId: staffId as Id<"staff"> } : "skip",
  );
  const blocks = useQuery(
    api.staff.listBlocks,
    orgId && staffId
      ? { orgId, staffId: staffId as Id<"staff">, from: addDays(todayISO(), -30), to: addDays(todayISO(), 90) }
      : "skip",
  );
  const setDay = useMutation(api.staff.setAvailabilityDay);
  const createBlock = useMutation(api.staff.createBlock);
  const deleteBlock = useMutation(api.staff.deleteBlock);

  if (!orgId) return <LoadingBlock rows={4} />;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Equipe"
        title="Disponibilidade e escalas"
        description="Defina a escala semanal por profissional e registre bloqueios pontuais, folgas e ausências."
        actions={
          can("staff.edit") && staffId && (
            <Button onClick={() => setBlockOpen(true)}>
              <CalendarOff className="mr-2 size-4" />
              Novo bloqueio
            </Button>
          )
        }
      />

      <GlassCard padded={false} className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={staffId} onValueChange={setStaffId}>
            <SelectTrigger className="h-9 w-64">
              <SelectValue placeholder="Selecione a profissional" />
            </SelectTrigger>
            <SelectContent>
              {(staff ?? []).map((member: any) => (
                <SelectItem key={member._id} value={member._id}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            A escala é validada em cada agendamento e no agendamento online.
          </span>
        </div>
      </GlassCard>

      {!staffId && (
        <EmptyState
          title="Selecione uma profissional"
          description="Escolha quem você quer configurar para ver a escala semanal e os bloqueios."
          icon={<Clock className="size-5" />}
        />
      )}

      {staffId && (
        <div className="grid gap-4 lg:grid-cols-2">
          <GlassCard>
            <SectionTitle
              title="Escala semanal"
              description="Ajuste os horários de cada dia. Alterações são aplicadas imediatamente na agenda."
            />
            <div className="space-y-2">
              {WEEKDAYS.map((day, weekday) => {
                const row = (availability ?? []).find((item: any) => item.weekday === weekday);
                return (
                  <div
                    key={day}
                    className="glass-inset flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-xs"
                  >
                    <span className="w-24 font-medium">{day}</span>
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={row?.active ?? false}
                        disabled={!can("staff.edit")}
                        onChange={async (event) => {
                          try {
                            await setDay({
                              orgId,
                              staffId: staffId as Id<"staff">,
                              weekday,
                              active: event.target.checked,
                              start: row?.start ?? "09:00",
                              end: row?.end ?? "19:00",
                              breakStart: row?.breakStart,
                              breakEnd: row?.breakEnd,
                            });
                            toast.success("Escala atualizada.");
                          } catch (err) {
                            toast.error(errorMessage(err));
                          }
                        }}
                      />
                      atende
                    </label>
                    <Input
                      type="time"
                      className="h-8 w-24"
                      defaultValue={row?.start ?? "09:00"}
                      disabled={!can("staff.edit")}
                      onBlur={async (event) => {
                        try {
                          await setDay({
                            orgId,
                            staffId: staffId as Id<"staff">,
                            weekday,
                            active: row?.active ?? true,
                            start: event.target.value,
                            end: row?.end ?? "19:00",
                            breakStart: row?.breakStart,
                            breakEnd: row?.breakEnd,
                          });
                          toast.success("Horário atualizado.");
                        } catch (err) {
                          toast.error(errorMessage(err));
                        }
                      }}
                    />
                    <span className="text-muted-foreground">até</span>
                    <Input
                      type="time"
                      className="h-8 w-24"
                      defaultValue={row?.end ?? "19:00"}
                      disabled={!can("staff.edit")}
                      onBlur={async (event) => {
                        try {
                          await setDay({
                            orgId,
                            staffId: staffId as Id<"staff">,
                            weekday,
                            active: row?.active ?? true,
                            start: row?.start ?? "09:00",
                            end: event.target.value,
                            breakStart: row?.breakStart,
                            breakEnd: row?.breakEnd,
                          });
                          toast.success("Horário atualizado.");
                        } catch (err) {
                          toast.error(errorMessage(err));
                        }
                      }}
                    />
                    <span className="ml-auto text-muted-foreground">
                      {row
                        ? `intervalo ${row.breakStart ?? "—"}–${row.breakEnd ?? "—"}`
                        : "sem escala"}
                    </span>
                  </div>
                );
              })}
            </div>
          </GlassCard>

          <GlassCard>
            <SectionTitle
              title="Bloqueios, folgas e ausências"
              description="Períodos bloqueados não aparecem como disponíveis para agendamento."
            />
            {(blocks ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhum bloqueio registrado nos próximos 90 dias.
              </p>
            )}
            <div className="space-y-2">
              {(blocks ?? []).map((block: any) => (
                <div
                  key={block._id}
                  className="glass-inset flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs"
                >
                  <span>
                    <span className="font-medium tabular-nums">{formatDate(block.date)}</span> ·{" "}
                    {formatTime(block.startMinutes)}–{formatTime(block.endMinutes)}
                    <span className="block text-muted-foreground">{block.reason}</span>
                  </span>
                  {can("staff.edit") && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        try {
                          await deleteBlock({ orgId, blockId: block._id });
                          toast.success("Bloqueio removido.");
                        } catch (err) {
                          toast.error(errorMessage(err));
                        }
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      )}

      <FormDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        title="Novo bloqueio de agenda"
        description="Usado para folgas, ausências, cursos e compromissos pessoais."
        submitLabel="Criar bloqueio"
        onSubmit={async () => {
          try {
            await createBlock({
              orgId,
              staffId: staffId as Id<"staff">,
              date: blockForm.date,
              start: blockForm.start,
              end: blockForm.end,
              reason: blockForm.reason,
            });
            toast.success("Bloqueio criado.");
            setBlockOpen(false);
          } catch (err) {
            toast.error(errorMessage(err));
          }
        }}
      >
        <Field label="Data">
          <Input
            type="date"
            value={blockForm.date}
            onChange={(e) => setBlockForm({ ...blockForm, date: e.target.value })}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Início">
            <Input
              type="time"
              value={blockForm.start}
              onChange={(e) => setBlockForm({ ...blockForm, start: e.target.value })}
            />
          </Field>
          <Field label="Fim">
            <Input
              type="time"
              value={blockForm.end}
              onChange={(e) => setBlockForm({ ...blockForm, end: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Motivo">
          <Input
            value={blockForm.reason}
            onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })}
          />
        </Field>
      </FormDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Performance
// ---------------------------------------------------------------------------

export function Performance() {
  const { orgId } = useApp();
  const today = todayISO();
  const [from, setFrom] = useState(startOfMonth(today));
  const [to, setTo] = useState(today);
  const rows = useQuery(
    api.staff.staffPerformance,
    orgId ? { orgId, from, to } : "skip",
  );

  if (!orgId) return <LoadingBlock rows={4} />;
  if (rows === undefined) return <LoadingBlock rows={4} />;

  const totalRevenue = rows.reduce((acc, row) => acc + row.revenue, 0);
  const totalCompleted = rows.reduce((acc, row) => acc + row.completed, 0);
  const totalCommissions = rows.reduce((acc, row) => acc + row.commissionEarned, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Equipe"
        title="Desempenho da equipe"
        description="Métricas calculadas a partir de atendimentos concluídos, comissões registradas e histórico de clientes."
      />

      <GlassCard padded={false} className="p-3">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="De">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </Field>
          <Field label="Até">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </Field>
          <span className="ml-auto text-xs text-muted-foreground">
            {formatDate(from)} – {formatDate(to)}
          </span>
        </div>
      </GlassCard>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Receita da equipe" value={money(totalRevenue)} tone="positive" />
        <StatCard label="Atendimentos concluídos" value={totalCompleted} />
        <StatCard label="Comissões ganhas" value={money(totalCommissions)} />
        <StatCard
          label="Ticket médio"
          value={money(totalCompleted ? Math.round(totalRevenue / totalCompleted) : 0)}
        />
      </div>

      <GlassCard>
        <DataTable
          keyOf={(row: any) => row.staff._id}
          rows={rows}
          empty={<EmptyState title="Sem dados no período" />}
          columns={[
            {
              key: "name",
              header: "Profissional",
              render: (row: any) => (
                <span className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: row.staff.color }} />
                  <span className="font-medium">{row.staff.name}</span>
                </span>
              ),
            },
            { key: "completed", header: "Concluídos", align: "center" },
            { key: "total", header: "Total agendado", align: "center" },
            {
              key: "revenue",
              header: "Receita",
              align: "right",
              render: (row: any) => money(row.revenue),
            },
            {
              key: "averageTicket",
              header: "Ticket médio",
              align: "right",
              render: (row: any) => money(row.averageTicket),
            },
            {
              key: "repeatRate",
              header: "Recorrência",
              align: "right",
              render: (row: any) => `${row.repeatRate}%`,
            },
            {
              key: "commissionEarned",
              header: "Comissão ganha",
              align: "right",
              render: (row: any) => money(row.commissionEarned),
            },
            {
              key: "commissionPaid",
              header: "Comissão paga",
              align: "right",
              render: (row: any) => money(row.commissionPaid),
            },
            {
              key: "cancelled",
              header: "Cancel./Faltas",
              align: "center",
              render: (row: any) => `${row.cancelled} / ${row.noShows}`,
            },
            {
              key: "occupancy",
              header: "Horas em serviço",
              align: "right",
              render: (row: any) => durationLabel(row.occupancyMinutes),
            },
          ]}
        />
      </GlassCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Commissions
// ---------------------------------------------------------------------------

export function Commissions() {
  const { orgId, can } = useApp();
  const today = todayISO();
  const [from, setFrom] = useState(startOfMonth(today));
  const [to, setTo] = useState(today);
  const [staffFilter, setStaffFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ruleOpen, setRuleOpen] = useState(false);
  const [statementOpen, setStatementOpen] = useState(false);
  const [statementForm, setStatementForm] = useState({
    staffId: "",
    periodStart: startOfMonth(today),
    periodEnd: today,
  });

  const data = useQuery(
    api.commissions.listCommissions,
    orgId
      ? {
          orgId,
          from,
          to,
          staffId: staffFilter === "all" ? undefined : (staffFilter as Id<"staff">),
          status: statusFilter === "all" ? undefined : statusFilter,
        }
      : "skip",
  );
  const rules = useQuery(api.commissions.listCommissionRules, orgId ? { orgId } : "skip");
  const statements = useQuery(api.commissions.listStatements, orgId ? { orgId } : "skip");
  const staff = useQuery(api.staff.staffOptions, orgId ? { orgId } : "skip");
  const services = useQuery(api.services.serviceOptions, orgId ? { orgId } : "skip");
  const saveRule = useMutation(api.commissions.saveCommissionRule);
  const deleteRule = useMutation(api.commissions.deleteCommissionRule);
  const generate = useMutation(api.commissions.generateStatement);
  const pay = useMutation(api.commissions.payStatement);

  const [ruleForm, setRuleForm] = useState({
    name: "",
    scope: "global",
    type: "percent",
    basis: "net_discount",
    value: "40",
    serviceId: "",
    staffId: "",
  });
  const [removeRule, setRemoveRule] = useState<any | null>(null);

  if (!orgId) return <LoadingBlock rows={4} />;
  if (data === undefined) return <LoadingBlock rows={4} />;

  const summary: any[] = data.summary ?? [];
  const totals = summary.reduce(
    (acc, row) => ({
      estimated: acc.estimated + row.estimated,
      earned: acc.earned + row.earned,
      paid: acc.paid + row.paid,
    }),
    { estimated: 0, earned: 0, paid: 0 },
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Equipe e financeiro"
        title="Comissões"
        description="Regras configuráveis por profissional, serviço ou produto. Estimado, ganho e pago são sempre separados."
        actions={
          can("commissions.pay") && (
            <>
              <Button variant="outline" className="glass-soft" onClick={() => setRuleOpen(true)}>
                <Plus className="mr-2 size-4" />
                Nova regra
              </Button>
              <Button onClick={() => setStatementOpen(true)}>
                <FileSpreadsheet className="mr-2 size-4" />
                Gerar extrato
              </Button>
            </>
          )
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Comissões estimadas"
          value={money(totals.estimated)}
          hint="Baseada em receita ainda não recebida"
          tone="info"
        />
        <StatCard
          label="Comissões ganhas"
          value={money(totals.earned)}
          hint="Serviços concluídos no período"
          tone="positive"
        />
        <StatCard
          label="Comissões pagas"
          value={money(totals.paid)}
          hint="Extratos quitados"
        />
        <StatCard label="Base de cálculo" value={money(data.gross)} hint="Soma da base usada" />
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
            <Select value={staffFilter} onValueChange={setStaffFilter}>
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
          <Field label="Situação">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.entries(COMMISSION_STATUS).map(([key, value]) => (
                  <SelectItem key={key} value={key}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </GlassCard>

      <div className="grid gap-4 lg:grid-cols-3">
        <GlassCard className="lg:col-span-2">
          <SectionTitle title="Resumo por profissional" description="Período selecionado." />
          <DataTable
            keyOf={(row: any) => row.staffId}
            rows={summary}
            empty={<EmptyState title="Nenhuma comissão no período" />}
            columns={[
              { key: "name", header: "Profissional" },
              { key: "items", header: "Lançamentos", align: "center" },
              {
                key: "estimated",
                header: "Estimada",
                align: "right",
                render: (row: any) => money(row.estimated),
              },
              {
                key: "earned",
                header: "Ganha",
                align: "right",
                render: (row: any) => money(row.earned),
              },
              {
                key: "paid",
                header: "Paga",
                align: "right",
                render: (row: any) => money(row.paid),
              },
            ]}
          />
        </GlassCard>

        <GlassCard>
          <SectionTitle title="Regras configuradas" />
          {(rules ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">
              Nenhuma regra específica: usa-se o percentual da profissional sobre o valor
              líquido do desconto.
            </p>
          )}
          <div className="space-y-2">
            {(rules ?? []).map((rule: any) => (
              <div key={rule._id} className="glass-inset rounded-xl px-3 py-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <span>
                    <span className="font-medium">{rule.name}</span>
                    <span className="block text-muted-foreground">
                      {rule.type === "percent" ? `${rule.value}%` : money(rule.value)} ·{" "}
                      {rule.basisLabel}
                      {rule.serviceName ? ` · ${rule.serviceName}` : ""}
                      {rule.staffName ? ` · ${rule.staffName}` : ""}
                    </span>
                  </span>
                  {can("commissions.pay") && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setRemoveRule(rule)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <GlassCard>
        <SectionTitle
          title="Lançamentos de comissão"
          description="Cada lançamento guarda a regra aplicada e o valor base usado no cálculo."
        />
        <DataTable
          keyOf={(row: any) => row._id}
          rows={data.rows}
          empty={<EmptyState title="Nenhum lançamento no período" />}
          columns={[
            { key: "date", header: "Data", render: (row: any) => formatDate(row.date) },
            { key: "staffName", header: "Profissional" },
            {
              key: "kind",
              header: "Tipo",
              render: (row: any) => (
                <Badge variant="outline">{row.kind}</Badge>
              ),
            },
            { key: "ruleLabel", header: "Regra aplicada" },
            {
              key: "baseAmount",
              header: "Base",
              align: "right",
              render: (row: any) => money(row.baseAmount),
            },
            {
              key: "amount",
              header: "Comissão",
              align: "right",
              render: (row: any) => money(row.amount),
            },
            {
              key: "status",
              header: "Situação",
              render: (row: any) => (
                <StatusPill
                  label={label(COMMISSION_STATUS, row.status)}
                  className={
                    row.status === "paga"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : row.status === "estimada"
                        ? "border-sky-200 bg-sky-50 text-sky-700"
                        : "border-amber-200 bg-amber-50 text-amber-700"
                  }
                />
              ),
            },
          ]}
        />
      </GlassCard>

      <GlassCard>
        <SectionTitle
          title="Extratos de comissão"
          description="Ao pagar um extrato, os lançamentos passam de “ganha” para “paga” e permanecem auditáveis."
        />
        <DataTable
          keyOf={(row: any) => row._id}
          rows={statements ?? []}
          empty={<EmptyState title="Nenhum extrato gerado" />}
          columns={[
            { key: "staffName", header: "Profissional" },
            {
              key: "period",
              header: "Período",
              render: (row: any) => `${formatDate(row.periodStart)} – ${formatDate(row.periodEnd)}`,
            },
            {
              key: "totalEarned",
              header: "Total ganho",
              align: "right",
              render: (row: any) => money(row.totalEarned),
            },
            {
              key: "totalPaid",
              header: "Total pago",
              align: "right",
              render: (row: any) => money(row.totalPaid),
            },
            {
              key: "status",
              header: "Situação",
              render: (row: any) => (
                <StatusPill
                  label={row.status === "pago" ? "Pago" : "Aberto"}
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
                row.status !== "pago" && can("commissions.pay") ? (
                  <Button
                    size="sm"
                    onClick={async () => {
                      try {
                        await pay({ orgId, statementId: row._id });
                        toast.success("Extrato marcado como pago.");
                      } catch (err) {
                        toast.error(errorMessage(err));
                      }
                    }}
                  >
                    <Wallet className="mr-1.5 size-3.5" />
                    Registrar pagamento
                  </Button>
                ) : null,
            },
          ]}
        />
      </GlassCard>

      <InfoBanner>
        A base de cálculo padrão desta organização é “valor com desconto aplicado”. Cada
        lançamento registra explicitamente a regra usada para que estimativa, ganho e
        pagamento nunca sejam confundidos.
      </InfoBanner>

      <FormDialog
        open={ruleOpen}
        onOpenChange={setRuleOpen}
        size="lg"
        title="Nova regra de comissão"
        description="Regras específicas têm prioridade sobre a regra global."
        submitLabel="Salvar regra"
        onSubmit={async () => {
          try {
            await saveRule({
              orgId,
              name: ruleForm.name,
              scope: ruleForm.scope,
              type: ruleForm.type,
              basis: ruleForm.basis,
              value:
                ruleForm.type === "percent" ? Number(ruleForm.value) : parseMoney(ruleForm.value),
              serviceId: ruleForm.serviceId
                ? (ruleForm.serviceId as Id<"services">)
                : undefined,
              staffId: ruleForm.staffId ? (ruleForm.staffId as Id<"staff">) : undefined,
            });
            toast.success("Regra criada.");
            setRuleOpen(false);
          } catch (err) {
            toast.error(errorMessage(err));
          }
        }}
      >
        <Field label="Nome da regra *">
          <Input
            value={ruleForm.name}
            onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Aplicação">
            <Select
              value={ruleForm.scope}
              onValueChange={(value) => setRuleForm({ ...ruleForm, scope: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Toda a organização</SelectItem>
                <SelectItem value="service">Serviço específico</SelectItem>
                <SelectItem value="staff">Profissional específica</SelectItem>
                <SelectItem value="product">Venda de produtos</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Tipo">
            <Select
              value={ruleForm.type}
              onValueChange={(value) => setRuleForm({ ...ruleForm, type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">Percentual</SelectItem>
                <SelectItem value="fixed">Valor fixo por serviço</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field
            label="Base de cálculo"
            hint="Explícita para nunca misturar bases diferentes"
          >
            <Select
              value={ruleForm.basis}
              onValueChange={(value) => setRuleForm({ ...ruleForm, basis: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gross">Valor bruto do serviço</SelectItem>
                <SelectItem value="net_discount">Valor com desconto aplicado</SelectItem>
                <SelectItem value="collected">Somente receita efetivamente recebida</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={ruleForm.type === "percent" ? "Percentual (%)" : "Valor por serviço"}>
            {ruleForm.type === "percent" ? (
              <Input
                type="number"
                value={ruleForm.value}
                onChange={(e) => setRuleForm({ ...ruleForm, value: e.target.value })}
              />
            ) : (
              <MoneyInput
                value={ruleForm.value}
                onChange={(value) => setRuleForm({ ...ruleForm, value })}
              />
            )}
          </Field>
        </div>
        {ruleForm.scope === "service" && (
          <Field label="Serviço">
            <Select
              value={ruleForm.serviceId}
              onValueChange={(value) => setRuleForm({ ...ruleForm, serviceId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o serviço" />
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
        )}
        {ruleForm.scope === "staff" && (
          <Field label="Profissional">
            <Select
              value={ruleForm.staffId}
              onValueChange={(value) => setRuleForm({ ...ruleForm, staffId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a profissional" />
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
        )}
      </FormDialog>

      <FormDialog
        open={statementOpen}
        onOpenChange={setStatementOpen}
        title="Gerar extrato de comissão"
        description="Somente lançamentos sem extrato e com status “ganha” entram no período."
        submitLabel="Gerar extrato"
        onSubmit={async () => {
          try {
            await generate({
              orgId,
              staffId: statementForm.staffId as Id<"staff">,
              periodStart: statementForm.periodStart,
              periodEnd: statementForm.periodEnd,
            });
            toast.success("Extrato gerado.");
            setStatementOpen(false);
          } catch (err) {
            toast.error(errorMessage(err));
          }
        }}
      >
        <Field label="Profissional *">
          <Select
            value={statementForm.staffId}
            onValueChange={(value) => setStatementForm({ ...statementForm, staffId: value })}
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
          <Field label="Início do período">
            <Input
              type="date"
              value={statementForm.periodStart}
              onChange={(e) =>
                setStatementForm({ ...statementForm, periodStart: e.target.value })
              }
            />
          </Field>
          <Field label="Fim do período">
            <Input
              type="date"
              value={statementForm.periodEnd}
              onChange={(e) => setStatementForm({ ...statementForm, periodEnd: e.target.value })}
            />
          </Field>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!removeRule}
        onOpenChange={() => setRemoveRule(null)}
        title="Remover regra de comissão"
        description="Lançamentos já calculados mantêm a regra registrada no histórico."
        confirmLabel="Remover"
        onConfirm={async () => {
          try {
            await deleteRule({ orgId, ruleId: removeRule._id });
            toast.success("Regra removida.");
            setRemoveRule(null);
          } catch (err) {
            toast.error(errorMessage(err));
          }
        }}
      />
    </div>
  );
}
