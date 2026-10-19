import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { BrandMark } from "@/components/AppShell";
import { Field, GlassCard, InfoBanner, LoadingBlock, StatCard } from "@/components/glass";
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
  WEEKDAYS,
  addDays,
  durationLabel,
  formatDate,
  formatPhone,
  formatTime,
  money,
  todayISO,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { CalendarCheck, CheckCircle2, Clock, MapPin, Scissors, User } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";

export default function PublicBooking() {
  const { slug = "" } = useParams();
  const data = useQuery(api.orgs.publicBookingOrg, { slug });
  const [selected, setSelected] = useState<Id<"services">[]>([]);
  const [staffId, setStaffId] = useState("");
  const [date, setDate] = useState(addDays(todayISO(), 1));
  const [start, setStart] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ date: string; start: string } | null>(null);

  const staffOptions = useQuery(
    api.publicApi.publicStaffForServices,
    slug && selected.length ? { slug, serviceIds: selected } : "skip",
  );
  const availability = useQuery(
    api.publicApi.publicAvailability,
    slug && selected.length && staffId
      ? { slug, date, serviceIds: selected, staffId: staffId as Id<"staff"> }
      : "skip",
  );
  const book = useMutation(api.publicApi.createPublicBooking);

  if (data === undefined) {
    return (
      <div className="glass-scene min-h-screen px-5 py-16">
        <div className="mx-auto max-w-3xl">
          <LoadingBlock rows={4} />
        </div>
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="glass-scene min-h-screen">
        <div className="mx-auto max-w-2xl px-5 py-20 text-center">
          <BrandMark className="mx-auto" />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">
            Agendamento online indisponível
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Este endereço não existe ou o agendamento online está desativado para este
            negócio. Entre em contato pelo telefone do estabelecimento para agendar.
          </p>
          <Button className="mt-6" variant="outline" asChild>
            <Link to="/">Voltar para a página inicial</Link>
          </Button>
        </div>
      </div>
    );
  }

  const org = data.org;
  const services = data.services;
  const chosen = services.filter((service) => selected.includes(service._id));
  const totalPrice = chosen.reduce((acc, service) => acc + service.price, 0);
  const totalDuration = chosen.reduce((acc, service) => acc + service.durationMin, 0);
  const slots: any[] = (availability?.slots ?? []).filter((slot: any) => slot.available);

  if (done) {
    return (
      <div className="glass-scene min-h-screen">
        <div className="mx-auto max-w-2xl px-5 py-20">
          <GlassCard strong className="text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="size-6" />
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">Solicitação registrada</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Guardamos o seu horário em <strong>{org.name}</strong> para{" "}
              <strong>{formatDate(done.date)}</strong> às <strong>{done.start}</strong>.
              A equipe entrará em contato para confirmar.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link to={`/agendar/${slug}`} onClick={() => setDone(null)}>
                  Agendar outro horário
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/">Ir para o BeautyFlow OS</Link>
              </Button>
            </div>
          </GlassCard>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-scene min-h-screen">
      <div className="mx-auto max-w-[70rem] px-5 py-10 lg:py-14">
        <header className="flex flex-wrap items-center gap-4">
          <BrandMark />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight">{org.name}</h1>
            <p className="text-xs text-muted-foreground">
              Agendamento online · {org.phone ?? "sem telefone cadastrado"}
            </p>
          </div>
          <Badge variant="outline" className="ml-auto border-primary/30 bg-white/70 text-primary">
            Ambiente seguro
          </Badge>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-5">
            <GlassCard>
              <h2 className="text-sm font-semibold">1. Escolha os serviços</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Você pode combinar mais de um serviço no mesmo horário.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {services.map((service: any) => {
                  const active = selected.includes(service._id);
                  return (
                    <button
                      key={service._id}
                      type="button"
                      onClick={() => {
                        setSelected((prev) =>
                          prev.includes(service._id)
                            ? prev.filter((id) => id !== service._id)
                            : [...prev, service._id],
                        );
                        setStart("");
                      }}
                      className={cn(
                        "glass-inset rounded-2xl p-3 text-left transition",
                        active ? "ring-2 ring-primary" : "hover:bg-white/70",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{service.name}</p>
                        {active && <CheckCircle2 className="size-4 shrink-0 text-primary" />}
                      </div>
                      {service.description && (
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {service.description}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3.5" />
                          {durationLabel(service.durationMin)}
                        </span>
                        <span className="font-medium text-foreground">{money(service.price)}</span>
                      </div>
                      {service.depositType !== "none" && (
                        <Badge variant="outline" className="mt-2 text-[0.6rem]">
                          Sinal:{" "}
                          {service.depositType === "percent"
                            ? `${service.depositValue}%`
                            : money(service.depositValue)}
                        </Badge>
                      )}
                    </button>
                  );
                })}
                {services.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Nenhum serviço publicado para agendamento no momento.
                  </p>
                )}
              </div>
            </GlassCard>

            <GlassCard>
              <h2 className="text-sm font-semibold">2. Profissional, data e horário</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <Field label="Profissional">
                  <Select
                    value={staffId}
                    onValueChange={(value) => {
                      setStaffId(value);
                      setStart("");
                    }}
                    disabled={!selected.length}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={selected.length ? "Selecione" : "Escolha um serviço"} />
                    </SelectTrigger>
                    <SelectContent>
                      {(staffOptions ?? []).map((member: any) => (
                        <SelectItem key={member._id} value={member._id}>
                          {member.name}
                          {member.role ? ` · ${member.role}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Data">
                  <Input
                    type="date"
                    min={todayISO()}
                    value={date}
                    onChange={(event) => {
                      setDate(event.target.value);
                      setStart("");
                    }}
                  />
                </Field>
                <Field label="Duração estimada">
                  <Input value={durationLabel(totalDuration)} readOnly />
                </Field>
              </div>

              <div className="mt-4">
                <p className="text-xs font-medium text-muted-foreground">
                  Horários realmente disponíveis
                </p>
                {!selected.length || !staffId ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Escolha os serviços e a profissional para ver os horários livres.
                  </p>
                ) : availability === undefined ? (
                  <LoadingBlock rows={2} />
                ) : slots.length === 0 ? (
                  <p className="mt-2 text-xs text-rose-600">
                    Este horário não está mais disponível. Selecione outra data ou
                    profissional.
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {slots.map((slot: any) => (
                      <button
                        key={slot.startMinutes}
                        type="button"
                        onClick={() => setStart(formatTime(slot.startMinutes))}
                        className={cn(
                          "rounded-xl px-3 py-1.5 text-xs font-medium tabular-nums transition",
                          start === formatTime(slot.startMinutes)
                            ? "bg-primary text-white"
                            : "glass-soft hover:bg-white/80",
                        )}
                      >
                        {formatTime(slot.startMinutes)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </GlassCard>

            <GlassCard>
              <h2 className="text-sm font-semibold">3. Seus dados</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Nome completo *">
                  <Input
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                  />
                </Field>
                <Field label="Telefone com DDD *">
                  <Input
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: formatPhone(event.target.value) })}
                  />
                </Field>
                <Field label="E-mail">
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                  />
                </Field>
                <Field label="Observações">
                  <Input
                    value={form.notes}
                    onChange={(event) => setForm({ ...form, notes: event.target.value })}
                    placeholder="Alguma preferência ou informação importante?"
                  />
                </Field>
              </div>

              {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}

              <Button
                className="mt-4 w-full"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    if (!selected.length) throw new Error("Selecione pelo menos um serviço.");
                    if (!staffId) throw new Error("Selecione a profissional.");
                    if (!start) throw new Error("Selecione um horário disponível.");
                    await book({
                      slug,
                      name: form.name,
                      phone: form.phone,
                      email: form.email || undefined,
                      serviceIds: selected,
                      staffId: staffId as Id<"staff">,
                      date,
                      start,
                      notes: form.notes || undefined,
                    });
                    setDone({ date, start });
                    setStart("");
                  } catch (err) {
                    setError(errorMessage(err));
                    toast.error(errorMessage(err));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <CalendarCheck className="mr-2 size-4" />
                Solicitar agendamento
              </Button>
              <p className="mt-2 text-[0.7rem] leading-4 text-muted-foreground">
                A confirmação é feita pela equipe. O horário é validado novamente no
                momento do envio, então ninguém reserva o mesmo horário duas vezes.
              </p>
            </GlassCard>
          </div>

          <div className="space-y-5">
            <GlassCard>
              <h2 className="text-sm font-semibold">Seu resumo</h2>
              <div className="mt-3 space-y-2 text-xs">
                {chosen.length === 0 ? (
                  <p className="text-muted-foreground">Nenhum serviço selecionado.</p>
                ) : (
                  chosen.map((service: any) => (
                    <p key={service._id} className="flex justify-between">
                      <span>{service.name}</span>
                      <span className="tabular-nums">{money(service.price)}</span>
                    </p>
                  ))
                )}
                <p className="flex justify-between border-t border-white/60 pt-2 font-semibold">
                  <span>Total estimado</span>
                  <span className="tabular-nums">{money(totalPrice)}</span>
                </p>
                <p className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="size-3.5" />
                  Duração estimada: {durationLabel(totalDuration)}
                </p>
                <p className="flex items-center gap-1 text-muted-foreground">
                  <User className="size-3.5" />
                  {staffId
                    ? (staffOptions ?? []).find((member: any) => member._id === staffId)?.name
                    : "Profissional a definir"}
                </p>
                <p className="flex items-center gap-1 text-muted-foreground">
                  <Scissors className="size-3.5" />
                  {formatDate(date)}
                  {start ? ` · ${start}` : ""}
                </p>
              </div>
            </GlassCard>

            <GlassCard>
              <h2 className="text-sm font-semibold">Como funciona</h2>
              <ul className="mt-2 space-y-2 text-xs leading-5 text-muted-foreground">
                <li>• Você só vê horários que estão realmente livres na agenda.</li>
                <li>
                  • {org.depositPolicy ?? "Sinais podem ser solicitados para reservar horários de maior duração."}
                </li>
                <li>
                  • {org.cancellationPolicy ?? "Cancelamentos com antecedência liberam o horário para outras clientes."}
                </li>
                <li>• Seus dados não aparecem para outras pessoas.</li>
              </ul>
            </GlassCard>

            <GlassCard>
              <h2 className="text-sm font-semibold">Horário de funcionamento</h2>
              <ul className="mt-2 space-y-1 text-xs">
                {(org.openHours ?? []).map((entry: any) => (
                  <li key={entry.weekday} className="flex justify-between">
                    <span className="text-muted-foreground">{WEEKDAYS[entry.weekday]}</span>
                    <span>{entry.closed ? "Fechado" : `${entry.open} – ${entry.close}`}</span>
                  </li>
                ))}
              </ul>
              {org.address?.logradouro && (
                <p className="mt-3 flex items-start gap-1 text-xs text-muted-foreground">
                  <MapPin className="mt-0.5 size-3.5 shrink-0" />
                  {org.address.logradouro}
                  {org.address.numero ? `, ${org.address.numero}` : ""}
                  {org.address.cidade ? ` · ${org.address.cidade}` : ""}
                </p>
              )}
            </GlassCard>

            <StatCard
              label="Serviços publicados"
              value={services.length}
              hint="Preços e durações definidos pelo estúdio"
            />

            <InfoBanner>
              Esta página é pública e não exibe informações internas, históricos,
              prontuários ou dados financeiros de outras clientes.
            </InfoBanner>
          </div>
        </div>
      </div>
    </div>
  );
}
