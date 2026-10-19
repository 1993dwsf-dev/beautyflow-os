import { api } from "@/convex/_generated/api";
import { useApp } from "@/components/app-context";
import {
  DataTable,
  EmptyState,
  GlassCard,
  LoadingBlock,
  PageHeader,
  SectionTitle,
  StatCard,
  StatusPill,
} from "@/components/glass";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  APPOINTMENT_STATUS,
  APPOINTMENT_STATUS_COLOR,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  addDays,
  durationLabel,
  formatDate,
  formatTime,
  label,
  money,
  monthLabelShort,
  startOfMonth,
  startOfWeek,
  todayISO,
  endOfMonth,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  CircleDollarSign,
  Clock,
  Package,
  PiggyBank,
  ReceiptText,
  Repeat,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const PERIODS = [
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Esta semana" },
  { key: "mes", label: "Este mês" },
  { key: "mes_anterior", label: "Mês anterior" },
  { key: "30d", label: "Últimos 30 dias" },
  { key: "90d", label: "Últimos 90 dias" },
  { key: "ano", label: "Ano atual" },
  { key: "custom", label: "Período personalizado" },
];

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function ChartFrame({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <GlassCard className={cn("min-w-0", className)}>
      <SectionTitle title={title} description={description} />
      <div className="h-60 w-full">{children}</div>
    </GlassCard>
  );
}

const axisProps = {
  stroke: "color-mix(in oklab, var(--muted-foreground) 60%, transparent)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

export default function Dashboard() {
  const { orgId, can, flag, context } = useApp();
  const navigate = useNavigate();
  const today = context?.today ?? todayISO();
  const [period, setPeriod] = useState("mes");
  const [customFrom, setCustomFrom] = useState(startOfMonth(today));
  const [customTo, setCustomTo] = useState(today);

  const range = useMemo(() => {
    switch (period) {
      case "hoje":
        return { from: today, to: today };
      case "semana":
        return { from: startOfWeek(today), to: addDays(startOfWeek(today), 6) };
      case "mes":
        return { from: startOfMonth(today), to: endOfMonth(today) };
      case "mes_anterior": {
        const prev = addDays(startOfMonth(today), -1);
        return { from: startOfMonth(prev), to: endOfMonth(prev) };
      }
      case "30d":
        return { from: addDays(today, -29), to: today };
      case "90d":
        return { from: addDays(today, -89), to: today };
      case "ano":
        return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
      default:
        return { from: customFrom, to: customTo };
    }
  }, [period, today, customFrom, customTo]);

  const data = useQuery(
    api.reports.dashboard,
    orgId ? { orgId, from: range.from, to: range.to } : "skip",
  );

  if (!orgId) return <LoadingBlock rows={4} />;
  if (data === undefined) return <LoadingBlock rows={4} />;
  if (data === null) {
    return (
      <EmptyState
        title="Não foi possível carregar o painel"
        description="Verifique se você ainda faz parte desta organização."
      />
    );
  }

  const k = data.kpis;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Visão geral"
        title="Painel operacional"
        description="Indicadores calculados a partir dos atendimentos, faturas, pagamentos, despesas e movimentações registrados nesta organização."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => navigate("/app/agenda")}
              className="glass-soft"
            >
              <CalendarCheck className="mr-2 size-4" />
              Nova agenda
            </Button>
            {can("invoices.view") && (
              <Button onClick={() => navigate("/app/faturas")}>
                <ReceiptText className="mr-2 size-4" />
                Faturamento
              </Button>
            )}
          </>
        }
      />

      <GlassCard padded={false} className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          {PERIODS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setPeriod(option.key)}
              className={cn(
                "rounded-xl px-3 py-1.5 text-xs font-medium transition",
                period === option.key
                  ? "bg-white/90 text-primary ring-1 ring-white/80"
                  : "text-foreground/70 hover:bg-white/60",
              )}
            >
              {option.label}
            </button>
          ))}
          {period === "custom" && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-8 w-36"
              />
              <span className="text-xs text-muted-foreground">até</span>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-8 w-36"
              />
            </div>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            Período: {formatDate(range.from)} – {formatDate(range.to)}
          </span>
        </div>
      </GlassCard>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <StatCard
          label="Agendamentos de hoje"
          value={k.todayAppointments}
          hint={`${k.todayCompleted} concluído(s) hoje`}
          icon={<CalendarCheck className="size-4" />}
          tone="primary"
          onClick={() => navigate("/app/agenda")}
        />
        <StatCard
          label="Próximos atendimentos"
          value={k.upcoming}
          hint="Confirmados e em andamento"
          icon={<CalendarClock className="size-4" />}
          onClick={() => navigate("/app/agenda")}
        />
        <StatCard
          label="Atendimentos concluídos"
          value={k.completed}
          hint={`Ticket médio ${money(k.averageTicket)}`}
          icon={<ClipboardIcon />}
          tone="positive"
          onClick={() => navigate("/app/historico")}
        />
        <StatCard
          label="Cancelamentos"
          value={k.cancelled}
          hint={`Taxa de ${k.cancellationRate}%`}
          icon={<CalendarX className="size-4" />}
          tone="warning"
          onClick={() => navigate("/app/agenda?status=cancelled")}
        />
        <StatCard
          label="Faltas"
          value={k.noShows}
          hint={`Taxa de ${k.noShowRate}%`}
          icon={<TrendingDown className="size-4" />}
          tone="negative"
          onClick={() => navigate("/app/agenda?status=no_show")}
        />
        <StatCard
          label="Faturamento do dia"
          value={money(k.revenueToday)}
          hint="Valores efetivamente recebidos hoje"
          icon={<CircleDollarSign className="size-4" />}
          tone="positive"
          onClick={() => navigate("/app/pagamentos")}
        />
        <StatCard
          label="Faturamento do mês"
          value={money(k.revenueMonth)}
          hint="Recebimentos do mês corrente"
          icon={<BadgeDollarSign className="size-4" />}
          tone="positive"
        />
        <StatCard
          label="Recebimentos pendentes"
          value={money(k.pendingPayments)}
          hint="Saldo em aberto nas faturas emitidas"
          icon={<ReceiptText className="size-4" />}
          tone="warning"
          onClick={() => navigate("/app/faturas?status=issued")}
        />
        <StatCard
          label="Despesas do mês"
          value={money(k.expensesMonth)}
          hint={`Pagas no período ${money(k.expensesPaid)}`}
          icon={<TrendingDown className="size-4" />}
          onClick={() => navigate("/app/despesas")}
        />
        <StatCard
          label="Lucro operacional estimado"
          value={money(k.operatingProfit)}
          hint="Recebido − despesas pagas − comissões pagas − insumos"
          icon={<TrendingUp className="size-4" />}
          tone={k.operatingProfit >= 0 ? "positive" : "negative"}
          onClick={() => navigate("/app/relatorios")}
        />
        <StatCard
          label="Novos clientes"
          value={k.newClients}
          hint={`${k.activeClients} clientes ativos`}
          icon={<UserPlus className="size-4" />}
          onClick={() => navigate("/app/clientes")}
        />
        <StatCard
          label="Clientes com retorno pendente"
          value={k.clientsPendingReturn}
          hint="Retorno recomendado nos próximos 7 dias"
          icon={<Repeat className="size-4" />}
          tone="warning"
          onClick={() => navigate("/app/retornos")}
        />
        <StatCard
          label="Receita reservada (agendada)"
          value={money(k.bookedRevenue)}
          hint="Valor dos serviços agendados no período"
          icon={<CalendarClock className="size-4" />}
        />
        <StatCard
          label="Faturado no período"
          value={money(k.invoiced)}
          hint={`Recebido ${money(k.revenueRange)}`}
          icon={<ReceiptText className="size-4" />}
          tone="info"
        />
        <StatCard
          label="Comissões ganhas"
          value={money(k.commissionsEarned)}
          hint={`Pagas ${money(k.commissionsPaid)}`}
          icon={<PiggyBank className="size-4" />}
          onClick={() => navigate("/app/comissoes")}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartFrame
          title="Receitas versus despesas"
          description="Últimos 6 meses — recebido, faturado e despesas lançadas."
          className="lg:col-span-2"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.charts.revenueVsExpenses}>
              <defs>
                <linearGradient id="rec" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="desp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,150,180,0.18)" />
              <XAxis
                dataKey="month"
                tickFormatter={(value) => monthLabelShort(value)}
                {...axisProps}
              />
              <YAxis
                tickFormatter={(value) => `${Math.round(Number(value) / 100)}`}
                {...axisProps}
              />
              <Tooltip
                formatter={(value: number, name: string) => [money(value), name]}
                labelFormatter={(value) => monthLabelShort(String(value))}
                contentStyle={{
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.7)",
                  background: "rgba(255,255,255,0.92)",
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area name="Recebido" type="monotone" dataKey="receita" stroke="var(--chart-1)" fill="url(#rec)" strokeWidth={2} />
              <Area name="Despesas" type="monotone" dataKey="despesas" stroke="var(--chart-3)" fill="url(#desp)" strokeWidth={2} />
              <Line name="Faturado" type="monotone" dataKey="faturado" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartFrame>

        <ChartFrame title="Agendamentos por status" description="Distribuição no período selecionado.">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.charts.appointmentsByStatus}
                dataKey="value"
                nameKey="status"
                innerRadius={48}
                outerRadius={78}
                paddingAngle={3}
              >
                {data.charts.appointmentsByStatus.map((entry: any, index: number) => (
                  <Cell key={entry.status} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, _n, item: any) => [
                  value,
                  label(APPOINTMENT_STATUS, item?.payload?.status),
                ]}
                contentStyle={{
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.7)",
                  background: "rgba(255,255,255,0.92)",
                  fontSize: 12,
                }}
              />
              <Legend
                formatter={(value, entry: any) =>
                  label(APPOINTMENT_STATUS, entry?.payload?.status)
                }
                wrapperStyle={{ fontSize: 11 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartFrame>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartFrame title="Receita por serviço" description="Serviços concluídos no período.">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.charts.revenueByService} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,150,180,0.18)" />
              <XAxis type="number" tickFormatter={(v) => `${Math.round(Number(v) / 100)}`} {...axisProps} />
              <YAxis type="category" dataKey="name" width={110} {...axisProps} />
              <Tooltip
                formatter={(value: number) => money(value)}
                contentStyle={{
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.7)",
                  background: "rgba(255,255,255,0.92)",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="value" fill="var(--chart-1)" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>

        <ChartFrame title="Receita por profissional" description="Produção registrada no período.">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.charts.revenueByStaff}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,150,180,0.18)" />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 100)}`} {...axisProps} />
              <Tooltip
                formatter={(value: number) => money(value)}
                contentStyle={{
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.7)",
                  background: "rgba(255,255,255,0.92)",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="value" fill="var(--chart-2)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>

        <ChartFrame title="Receita por forma de pagamento" description="Soma dos pagamentos recebidos.">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.charts.revenueByMethod}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,150,180,0.18)" />
              <XAxis
                dataKey="method"
                tickFormatter={(value) => label(PAYMENT_METHOD, String(value))}
                {...axisProps}
              />
              <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 100)}`} {...axisProps} />
              <Tooltip
                formatter={(value: number) => money(value)}
                labelFormatter={(value) => label(PAYMENT_METHOD, String(value))}
                contentStyle={{
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.7)",
                  background: "rgba(255,255,255,0.92)",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="value" fill="var(--chart-5)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartFrame title="Novas versus recorrentes" description="Baseado no primeiro atendimento de cada cliente.">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.charts.newVsReturning}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,150,180,0.18)" />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip
                contentStyle={{
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.7)",
                  background: "rgba(255,255,255,0.92)",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="value" fill="var(--chart-4)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>

        <ChartFrame title="Retenção e reagendamento" description="Clientes ativos por situação de retorno.">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.charts.retentionBuckets}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,150,180,0.18)" />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip
                contentStyle={{
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.7)",
                  background: "rgba(255,255,255,0.92)",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="value" fill="var(--chart-2)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>

        {flag("inventory") && (
          <ChartFrame title="Consumo de estoque" description="Quantidade consumida em serviços no período.">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.charts.stockConsumption}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,150,180,0.18)" />
                <XAxis dataKey="name" {...axisProps} interval={0} angle={-12} height={48} />
                <YAxis {...axisProps} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.7)",
                    background: "rgba(255,255,255,0.92)",
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--chart-3)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartFrame>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <GlassCard className="xl:col-span-2">
          <SectionTitle
            title="Agenda de hoje"
            description={`${(data.todayAgenda ?? []).length} atendimento(s) previsto(s) para ${formatDate(today)}`}
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate("/app/agenda")}>
                Abrir agenda <ArrowRight className="ml-1 size-3.5" />
              </Button>
            }
          />
          <div className="space-y-2">
            {(data.todayAgenda ?? []).length === 0 && (
              <EmptyState
                title="Nenhum atendimento hoje"
                description="Crie um agendamento na agenda para começar o dia."
                icon={<CalendarCheck className="size-5" />}
              />
            )}
            {(data.todayAgenda ?? []).map((item: any) => (
              <div
                key={item._id}
                className="glass-inset flex flex-wrap items-center gap-3 rounded-xl px-3 py-2.5"
              >
                <div className="flex w-16 shrink-0 flex-col">
                  <span className="text-sm font-semibold tabular-nums">
                    {formatTime(item.startMinutes)}
                  </span>
                  <span className="text-[0.65rem] text-muted-foreground">
                    {durationLabel(item.endMinutes - item.startMinutes)}
                  </span>
                </div>
                <span
                  className="h-8 w-1 rounded-full"
                  style={{ background: item.staffColor }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.clientName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.services} · {item.staffName}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill
                    label={label(APPOINTMENT_STATUS, item.status)}
                    className={APPOINTMENT_STATUS_COLOR[item.status]}
                  />
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {money(item.total)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <div className="space-y-4">
          <GlassCard>
            <SectionTitle title="Próximos atendimentos" description="Os 8 mais próximos." />
            <div className="space-y-2">
              {(data.upcoming ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nenhum atendimento futuro agendado.
                </p>
              )}
              {(data.upcoming ?? []).map((item: any) => (
                <div key={item._id} className="flex items-center gap-3 text-xs">
                  <span className="w-14 shrink-0 tabular-nums text-muted-foreground">
                    {formatDate(item.date).slice(0, 5)}
                  </span>
                  <span className="w-10 shrink-0 tabular-nums">
                    {formatTime(item.startMinutes)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.clientName}</span>
                  <span className="shrink-0 text-muted-foreground">{item.staffName}</span>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard>
            <SectionTitle
              title="Serviços mais vendidos"
              description="Por receita no período."
            />
            <DataTable
              dense
              keyOf={(row: any) => row.name}
              columns={[
                { key: "name", header: "Serviço" },
                {
                  key: "value",
                  header: "Receita",
                  align: "right",
                  render: (row: any) => money(row.value),
                },
              ]}
              rows={data.topServices ?? []}
              empty={<p className="text-xs text-muted-foreground">Sem dados no período.</p>}
            />
          </GlassCard>

          {flag("inventory") && (
            <GlassCard>
              <SectionTitle
                title="Produtos com estoque baixo"
                description="Quantidade igual ou abaixo do mínimo."
                action={
                  <Button variant="ghost" size="sm" onClick={() => navigate("/app/estoque-alertas")}>
                    <Package className="mr-1 size-3.5" /> Ver
                  </Button>
                }
              />
              {(data.lowStock ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nenhum produto abaixo do mínimo. 🎉
                </p>
              )}
              <div className="space-y-2">
                {(data.lowStock ?? []).map((product: any) => (
                  <div
                    key={product._id}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <AlertTriangle className="size-3.5 text-amber-500" />
                      {product.name}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {product.quantity} / {product.minStock}
                    </span>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>
      </div>

      <GlassCard>
        <SectionTitle
          title="Resumo financeiro do período"
          description="Valores separados por estágio: agendado, faturado, recebido e pago. Nada é somado duas vezes."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Agendado (serviços)", value: k.bookedRevenue, hint: "Valor dos serviços agendados" },
            { label: "Faturado", value: k.invoiced, hint: "Faturas emitidas no período" },
            { label: "Recebido", value: k.revenueRange, hint: "Pagamentos líquidos de reembolsos" },
            { label: "Insumos consumidos", value: k.materialCost, hint: "Custo de produtos usados em serviços" },
            { label: "Despesas incorridas", value: k.expensesRange, hint: "Lançadas no período" },
            { label: "Despesas pagas", value: k.expensesPaid, hint: "Saída efetiva de caixa" },
            { label: "Comissões ganhas", value: k.commissionsEarned, hint: "Calculadas por regra aplicada" },
            { label: "Comissões pagas", value: k.commissionsPaid, hint: "Extratos quitados" },
          ].map((item) => (
            <div key={item.label} className="glass-inset rounded-xl px-3 py-2.5">
              <p className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                {item.label}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {money(item.value)}
              </p>
              <p className="text-[0.68rem] text-muted-foreground">{item.hint}</p>
            </div>
          ))}
        </div>
      </GlassCard>

      <p className="flex items-center gap-2 px-1 text-[0.7rem] text-muted-foreground">
        <Clock className="size-3.5" />
        Indicadores recalculados a cada alteração no banco de dados. Fuso horário
        padrão: America/Sao_Paulo · Moeda: BRL.
        <span className="hidden sm:inline">
          {/* keep payment status legend handy for support */}
        </span>
      </p>
      <p className="sr-only">
        {Object.values(PAYMENT_STATUS).join(", ")}
      </p>
    </div>
  );
}

function ClipboardIcon() {
  return <Users className="size-4" />;
}
