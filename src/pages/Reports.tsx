import { api } from "@/convex/_generated/api";
import { useApp } from "@/components/app-context";
import {
  DataTable,
  EmptyState,
  Field,
  GlassCard,
  InfoBanner,
  LoadingBlock,
  PageHeader,
  SectionTitle,
  StatCard,
} from "@/components/glass";
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
import {
  APPOINTMENT_STATUS,
  PAYMENT_METHOD,
  addDays,
  downloadCsv,
  durationLabel,
  formatDate,
  label,
  money,
  startOfMonth,
  todayISO,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { useConvex, useQuery } from "convex/react";
import { Download, FileSpreadsheet, TrendingUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const PERIODS = [
  { key: "mes", label: "Este mês" },
  { key: "mes_anterior", label: "Mês anterior" },
  { key: "30d", label: "Últimos 30 dias" },
  { key: "90d", label: "Últimos 90 dias" },
  { key: "ano", label: "Ano atual" },
];

const axisProps = {
  stroke: "color-mix(in oklab, var(--muted-foreground) 60%, transparent)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

const EXPORTS = [
  { key: "clientes", label: "Clientes" },
  { key: "agendamentos", label: "Agendamentos" },
  { key: "servicos", label: "Serviços" },
  { key: "equipe", label: "Equipe" },
  { key: "produtos", label: "Produtos" },
  { key: "movimentacoes", label: "Movimentações de estoque" },
  { key: "receitas", label: "Faturas / receitas" },
  { key: "despesas", label: "Despesas" },
  { key: "pagamentos", label: "Pagamentos" },
  { key: "comissoes", label: "Comissões" },
];

export function Reports() {
  const { orgId } = useApp();
  const convex = useConvex();
  const today = todayISO();
  const [period, setPeriod] = useState("mes");
  const [customFrom, setCustomFrom] = useState(startOfMonth(today));
  const [customTo, setCustomTo] = useState(today);
  const [useCustom, setUseCustom] = useState(false);
  const [dataset, setDataset] = useState("clientes");
  const [exporting, setExporting] = useState(false);

  const range = (() => {
    if (useCustom) return { from: customFrom, to: customTo };
    switch (period) {
      case "mes_anterior": {
        const prev = addDays(startOfMonth(today), -1);
        return { from: startOfMonth(prev), to: prev };
      }
      case "30d":
        return { from: addDays(today, -29), to: today };
      case "90d":
        return { from: addDays(today, -89), to: today };
      case "ano":
        return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
      default:
        return { from: startOfMonth(today), to: today };
    }
  })();

  const bundle = useQuery(
    api.reports.reportBundle,
    orgId ? { orgId, from: range.from, to: range.to } : "skip",
  );

  if (!orgId) return <LoadingBlock rows={4} />;
  if (bundle === undefined) return <LoadingBlock rows={4} />;
  if (bundle === null) {
    return <EmptyState title="Não foi possível carregar os relatórios" />;
  }

  const op = bundle.operational;
  const fin = bundle.financial;
  const cli = bundle.clients;
  const inv = bundle.inventory;

  const staffRows = Object.entries(op.byStaff).map(([name, value]: [string, any]) => ({
    name,
    ...value,
  }));
  const serviceRows = Object.entries(op.byService)
    .map(([name, value]: [string, any]) => ({ name, ...value }))
    .sort((a, b) => b.revenue - a.revenue);
  const expenseRows = Object.entries(fin.expensesByCategory)
    .map(([category, value]) => ({ category, value: value as number }))
    .sort((a, b) => b.value - a.value);
  const methodRows = Object.entries(fin.methods).map(([method, value]) => ({
    method,
    value: value as number,
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Relatórios"
        title="Relatórios e exportações"
        description="Indicadores construídos a partir dos registros persistidos. Agendado, faturado, recebido, despesa incorrida e despesa paga são sempre apresentados separadamente."
      />

      <GlassCard padded={false} className="p-3">
        <div className="flex flex-wrap items-end gap-2">
          {PERIODS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => {
                setPeriod(option.key);
                setUseCustom(false);
              }}
              className={cn(
                "rounded-xl px-3 py-1.5 text-xs font-medium transition",
                !useCustom && period === option.key
                  ? "bg-white/90 text-primary ring-1 ring-white/80"
                  : "text-foreground/70 hover:bg-white/60",
              )}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setUseCustom(true)}
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-medium transition",
              useCustom ? "bg-white/90 text-primary ring-1 ring-white/80" : "text-foreground/70 hover:bg-white/60",
            )}
          >
            Período personalizado
          </button>
          {useCustom && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={customFrom}
                onChange={(event) => setCustomFrom(event.target.value)}
                className="h-8 w-36"
              />
              <span className="text-xs text-muted-foreground">até</span>
              <Input
                type="date"
                value={customTo}
                onChange={(event) => setCustomTo(event.target.value)}
                className="h-8 w-36"
              />
            </div>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            {formatDate(range.from)} – {formatDate(range.to)}
          </span>
        </div>
      </GlassCard>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Agendado (serviços)" value={money(fin.booked)} hint="Valor contratado no período" />
        <StatCard label="Faturado" value={money(fin.invoiced)} />
        <StatCard label="Recebido" value={money(fin.collected)} tone="positive" />
        <StatCard label="A receber" value={money(fin.receivable)} tone="warning" />
        <StatCard label="Despesas incorridas" value={money(fin.expensesIncurred)} />
        <StatCard label="Despesas pagas" value={money(fin.expensesPaid)} tone="negative" />
        <StatCard
          label="Resultado operacional"
          value={money(fin.net)}
          tone={fin.net >= 0 ? "positive" : "negative"}
          hint="Recebido − despesas pagas − comissões pagas − insumos"
        />
        <StatCard
          label="Comissões"
          value={money(fin.commissionsEarned)}
          hint={`Pagas ${money(fin.commissionsPaid)}`}
        />
      </div>

      <Tabs defaultValue="operacional">
        <TabsList className="glass-soft flex-wrap">
          <TabsTrigger value="operacional">Operacional</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="estoque">Estoque</TabsTrigger>
          <TabsTrigger value="exportar">Exportações</TabsTrigger>
        </TabsList>

        <TabsContent value="operacional" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <GlassCard className="lg:col-span-2">
              <SectionTitle title="Horários de pico" description="Volume de agendamentos por hora de início." />
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={op.hours}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,150,180,0.18)" />
                    <XAxis dataKey="hour" {...axisProps} />
                    <YAxis {...axisProps} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 14,
                        border: "1px solid rgba(255,255,255,0.7)",
                        background: "rgba(255,255,255,0.92)",
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="value" name="Agendamentos" fill="var(--chart-1)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            <GlassCard>
              <SectionTitle title="Distribuição por status" />
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={Object.entries(op.totals).map(([status, value]) => ({ status, value }))}
                      dataKey="value"
                      nameKey="status"
                      innerRadius={45}
                      outerRadius={78}
                      paddingAngle={3}
                    >
                      {Object.keys(op.totals).map((status, index) => (
                        <Cell key={status} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, _name, item: any) => [
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
                      formatter={(_value, entry: any) => label(APPOINTMENT_STATUS, entry?.payload?.status)}
                      wrapperStyle={{ fontSize: 11 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
          </div>

          <GlassCard>
            <SectionTitle
              title="Desempenho por profissional"
              description={`Duração média dos atendimentos concluídos: ${durationLabel(op.avgDuration)} · cancelamento ${op.cancellationRate}% · faltas ${op.noShowRate}%`}
            />
            <DataTable
              keyOf={(row: any) => row.name}
              rows={staffRows}
              empty={<EmptyState title="Sem dados no período" />}
              columns={[
                { key: "name", header: "Profissional" },
                { key: "total", header: "Agendados", align: "right" },
                { key: "completed", header: "Concluídos", align: "right" },
                { key: "cancelled", header: "Cancelados", align: "right" },
                { key: "noShow", header: "Faltas", align: "right" },
                {
                  key: "revenue",
                  header: "Produção",
                  align: "right",
                  render: (row: any) => money(row.revenue),
                },
              ]}
            />
          </GlassCard>

          <GlassCard>
            <SectionTitle title="Serviços realizados" description="Baseado nos itens dos atendimentos concluídos." />
            <DataTable
              keyOf={(row: any) => row.name}
              rows={serviceRows}
              empty={<EmptyState title="Nenhum serviço concluído no período" />}
              columns={[
                { key: "name", header: "Serviço" },
                { key: "count", header: "Atendimentos", align: "right" },
                { key: "minutes", header: "Tempo total", align: "right", render: (row: any) => durationLabel(row.minutes) },
                { key: "revenue", header: "Receita", align: "right", render: (row: any) => money(row.revenue) },
              ]}
            />
          </GlassCard>
        </TabsContent>

        <TabsContent value="financeiro" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <GlassCard>
              <SectionTitle title="Despesas por categoria" />
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={expenseRows} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,150,180,0.18)" />
                    <XAxis type="number" tickFormatter={(v) => `${Math.round(Number(v) / 100)}`} {...axisProps} />
                    <YAxis type="category" dataKey="category" width={150} {...axisProps} />
                    <Tooltip
                      formatter={(value: number) => money(value)}
                      contentStyle={{
                        borderRadius: 14,
                        border: "1px solid rgba(255,255,255,0.7)",
                        background: "rgba(255,255,255,0.92)",
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="value" fill="var(--chart-3)" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            <GlassCard>
              <SectionTitle title="Recebimentos por forma de pagamento" description="Valores líquidos de estornos." />
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={methodRows}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,150,180,0.18)" />
                    <XAxis dataKey="method" tickFormatter={(v) => label(PAYMENT_METHOD, String(v))} {...axisProps} />
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
              </div>
            </GlassCard>
          </div>

          <GlassCard>
            <SectionTitle title="Conciliação do período" description="Como cada valor foi reconhecido." />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Agendado (serviços)", fin.booked, "Valor contratado dos agendamentos no período"],
                ["Faturado", fin.invoiced, "Faturas emitidas no período"],
                ["Recebido", fin.collected, "Pagamentos recebidos menos estornos"],
                ["Sinais recebidos", fin.deposits, "Depósitos registrados separadamente"],
                ["Estornos", fin.refunds, "Devoluções registradas"],
                ["A receber", fin.receivable, "Saldo em aberto das faturas emitidas"],
                ["Despesas incorridas", fin.expensesIncurred, "Competência do período"],
                ["Despesas pagas", fin.expensesPaid, "Saída efetiva de caixa"],
                ["Custo de insumos", fin.materialCost, "Consumo de produtos em serviços"],
                ["Comissões ganhas", fin.commissionsEarned, "Ganhas ou pagas (exclui estimativas)"],
                ["Comissões pagas", fin.commissionsPaid, "Efetivamente quitadas"],
                ["Resultado operacional", fin.net, "Recebido − despesas pagas − comissões pagas − insumos"],
              ].map(([title, value, hint]) => (
                <div key={String(title)} className="glass-inset rounded-xl p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {title}
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{money(value as number)}</p>
                  <p className="mt-0.5 text-[0.7rem] leading-4 text-muted-foreground">{hint}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        </TabsContent>

        <TabsContent value="clientes" className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Clientes cadastrados" value={cli.total} />
            <StatCard label="Ativos" value={cli.active} tone="positive" />
            <StatCard label="Novos no período" value={cli.newInPeriod} tone="info" />
            <StatCard label="Ticket médio por cliente" value={money(cli.lifetimeValue)} hint="Média do valor recebido" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <GlassCard>
              <SectionTitle title="Clientes de maior valor" description="Calculado a partir dos pagamentos recebidos." />
              <DataTable
                keyOf={(row: any) => row.name}
                rows={cli.mostValuable}
                empty={<EmptyState title="Sem histórico financeiro" />}
                dense
                columns={[
                  { key: "name", header: "Cliente" },
                  { key: "phone", header: "Telefone" },
                  { key: "visits", header: "Visitas", align: "right" },
                  {
                    key: "lastVisit",
                    header: "Última visita",
                    render: (row: any) => (row.lastVisit === "—" ? "—" : formatDate(row.lastVisit)),
                  },
                  { key: "spend", header: "Total gasto", align: "right", render: (row: any) => money(row.spend) },
                ]}
              />
            </GlassCard>

            <GlassCard>
              <SectionTitle title="Clientes inativas" description="Sem atendimento há 120 dias ou mais." />
              <DataTable
                keyOf={(row: any) => row.name}
                rows={cli.inactive}
                empty={<EmptyState title="Nenhuma cliente inativa" />}
                dense
                columns={[
                  { key: "name", header: "Cliente" },
                  { key: "phone", header: "Telefone" },
                  { key: "daysSince", header: "Dias sem visita", align: "right" },
                ]}
              />
            </GlassCard>
          </div>
        </TabsContent>

        <TabsContent value="estoque" className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Valor de estoque (custo)" value={money(inv.inventoryValue)} />
            <StatCard label="Valor de venda" value={money(inv.retailValue)} />
            <StatCard label="Itens cadastrados" value={inv.items} />
            <StatCard label="Custo de insumos" value={money(inv.consumption)} tone="warning" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <GlassCard>
              <SectionTitle title="Itens abaixo do mínimo" />
              <DataTable
                keyOf={(row: any) => row.name}
                rows={inv.lowStock}
                empty={<EmptyState title="Nenhum item abaixo do mínimo" />}
                dense
                columns={[
                  { key: "name", header: "Produto" },
                  { key: "quantity", header: "Saldo", align: "right" },
                  { key: "minStock", header: "Mínimo", align: "right" },
                ]}
              />
            </GlassCard>

            <GlassCard>
              <SectionTitle title="Vendas de produtos" description="Movimentações do tipo venda no período." />
              <DataTable
                keyOf={(row: any) => row.name}
                rows={inv.productSales}
                empty={<EmptyState title="Nenhuma venda de produto" />}
                dense
                columns={[
                  { key: "name", header: "Produto" },
                  { key: "quantity", header: "Quantidade", align: "right" },
                  { key: "revenue", header: "Custo/valor", align: "right", render: (row: any) => money(row.revenue) },
                ]}
              />
            </GlassCard>
          </div>
        </TabsContent>

        <TabsContent value="exportar" className="mt-4 space-y-4">
          <GlassCard>
            <SectionTitle
              title="Exportações autorizadas (CSV)"
              description="Os arquivos usam ponto e vírgula como separador e codificação UTF-8 com BOM, prontos para Excel brasileiro."
            />
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Conjunto de dados">
                <Select value={dataset} onValueChange={setDataset}>
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPORTS.map((option) => (
                      <SelectItem key={option.key} value={option.key}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Button
                disabled={exporting}
                onClick={async () => {
                  setExporting(true);
                  try {
                    const result = await convex.query(api.reports.exportDataset, {
                      orgId,
                      dataset,
                      from: range.from,
                      to: range.to,
                    });
                    if (!result || !result.rows?.length) {
                      toast.error("Nenhum registro para exportar neste período.");
                      return;
                    }
                    downloadCsv(result.filename ?? `${dataset}.csv`, result.columns ?? [], result.rows);
                    toast.success(`Exportação gerada com ${result.rows.length} registro(s).`);
                  } catch {
                    toast.error("Não foi possível gerar a exportação. Tente novamente.");
                  } finally {
                    setExporting(false);
                  }
                }}
              >
                <Download className="mr-2 size-4" />
                Exportar CSV
              </Button>
            </div>
            <InfoBanner>
              Exportações incluem dados pessoais. Compartilhe apenas com pessoas
              autorizadas e armazene o arquivo em local seguro (LGPD).
            </InfoBanner>
          </GlassCard>

          <GlassCard>
            <SectionTitle title="Backup e portabilidade" description="O que está disponível hoje." />
            <ul className="space-y-2 text-xs leading-5 text-muted-foreground">
              <li className="flex gap-2">
                <FileSpreadsheet className="mt-0.5 size-3.5 shrink-0 text-primary" />
                Dados vivem no banco da organização, com tabelas e índices próprios — não dependem
                do navegador.
              </li>
              <li className="flex gap-2">
                <FileSpreadsheet className="mt-0.5 size-3.5 shrink-0 text-primary" />
                Cada módulo permite exportação CSV do período selecionado.
              </li>
              <li className="flex gap-2">
                <TrendingUp className="mt-0.5 size-3.5 shrink-0 text-primary" />
                Backups automáticos de infraestrutura seguem a política do provedor de dados. Backups
                não são expostos por URLs públicas.
              </li>
              <li className="flex gap-2">
                <TrendingUp className="mt-0.5 size-3.5 shrink-0 text-primary" />
                Toda alteração em registro financeiro deixa trilha de auditoria consultável em
                Privacidade e Auditoria.
              </li>
            </ul>
          </GlassCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

