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
import { centsToInput, durationLabel, money, parseMoney } from "@/lib/format";
import { useMutation, useQuery } from "convex/react";
import { Copy, PackageOpen, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const emptyService = {
  name: "",
  categoryId: "",
  description: "",
  price: "",
  durationMin: "60",
  bufferMin: "10",
  materialCost: "",
  laborCost: "",
  depositType: "none",
  depositValue: "",
  commissionPct: "",
  warrantyNotes: "",
  requiredResource: "",
  eligibleStaff: [] as string[],
};

export function Services() {
  const { orgId, can } = useApp();
  const [includeInactive, setIncludeInactive] = useState(false);
  const [dialog, setDialog] = useState<{ open: boolean; service?: any }>({ open: false });
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [usageOpen, setUsageOpen] = useState<any | null>(null);

  const data = useQuery(
    api.services.listServices,
    orgId ? { orgId, includeInactive } : "skip",
  );
  const staff = useQuery(api.staff.staffOptions, orgId ? { orgId } : "skip");
  const products = useQuery(api.inventory.productOptions, orgId ? { orgId } : "skip");
  const rules = useQuery(
    api.services.listConsumptionRules,
    orgId && usageOpen ? { orgId, serviceId: usageOpen._id } : "skip",
  );
  const createCategory = useMutation(api.services.createCategory);
  const updateService = useMutation(api.services.updateService);
  const saveRule = useMutation(api.services.saveConsumptionRule);
  const deleteRule = useMutation(api.services.deleteConsumptionRule);

  if (!orgId) return <LoadingBlock rows={4} />;
  if (data === undefined) return <LoadingBlock rows={4} />;

  const rows: any[] = data.rows ?? [];
  const averagePrice = rows.length
    ? Math.round(rows.reduce((acc, row) => acc + row.price, 0) / rows.length)
    : 0;
  const averageMargin = rows.length
    ? Math.round(
        (rows.reduce((acc, row) => acc + (row.marginPerService || 0), 0) / rows.length) * 10,
      ) / 10
    : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Atendimentos"
        title="Catálogo de serviços"
        description="Preço, duração, insumos e comissão de cada serviço. Alterações futuras não mudam valores já registrados em agendamentos."
        actions={
          can("services.edit") && (
            <>
              <Button
                variant="outline"
                className="glass-soft"
                onClick={() => setCategoryOpen(true)}
              >
                <Plus className="mr-2 size-4" />
                Categoria
              </Button>
              <Button onClick={() => setDialog({ open: true })}>
                <Sparkles className="mr-2 size-4" />
                Novo serviço
              </Button>
            </>
          )
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Serviços ativos" value={rows.filter((r) => r.active).length} />
        <StatCard label="Preço médio" value={money(averagePrice)} />
        <StatCard
          label="Margem média estimada"
          value={`${averageMargin}%`}
          hint="Preço − insumos − mão de obra"
          tone={averageMargin > 40 ? "positive" : "warning"}
        />
        <StatCard label="Categorias" value={(data.categories ?? []).length} />
      </div>

      <GlassCard padded={false} className="p-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(event) => setIncludeInactive(event.target.checked)}
          />
          Mostrar serviços inativos
        </label>
      </GlassCard>

      <GlassCard>
        <DataTable
          keyOf={(row: any) => row._id}
          rows={rows}
          empty={
            <EmptyState
              title="Nenhum serviço cadastrado"
              description="Cadastre os serviços oferecidos para começar a agendar."
              icon={<Sparkles className="size-5" />}
            />
          }
          columns={[
            {
              key: "name",
              header: "Serviço",
              render: (row: any) => (
                <div>
                  <p className="font-medium">
                    {row.name}
                    {!row.active && (
                      <span className="ml-2 text-xs text-muted-foreground">(inativo)</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.categoryName}
                    {row.requiredResource ? ` · ${row.requiredResource}` : ""}
                  </p>
                </div>
              ),
            },
            {
              key: "price",
              header: "Preço",
              align: "right",
              render: (row: any) => money(row.price),
            },
            {
              key: "durationMin",
              header: "Duração",
              render: (row: any) => (
                <span>
                  {durationLabel(row.durationMin)}
                  <span className="ml-1 text-xs text-muted-foreground">
                    +{row.bufferMin}min
                  </span>
                </span>
              ),
            },
            {
              key: "costs",
              header: "Custos",
              render: (row: any) => (
                <span className="text-xs text-muted-foreground">
                  Insumos {money(row.materialCost)} · Mão de obra {money(row.laborCost)}
                </span>
              ),
            },
            {
              key: "deposit",
              header: "Sinal",
              render: (row: any) =>
                row.depositType === "none" ? (
                  <span className="text-xs text-muted-foreground">Não exige</span>
                ) : (
                  <span className="text-xs">
                    {row.depositType === "percent"
                      ? `${row.depositValue}%`
                      : money(row.depositValue)}
                  </span>
                ),
            },
            {
              key: "commission",
              header: "Comissão",
              render: (row: any) =>
                row.commissionPct !== undefined && row.commissionPct !== null ? (
                  <Badge variant="outline">{row.commissionPct}%</Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">Regra padrão</span>
                ),
            },
            {
              key: "staff",
              header: "Profissionais",
              render: (row: any) => (
                <span className="text-xs text-muted-foreground">
                  {row.staffNames.length ? row.staffNames.join(", ") : "Todas"}
                </span>
              ),
            },
            {
              key: "margin",
              header: "Margem",
              align: "right",
              render: (row: any) => (
                <StatusPill
                  label={`${row.marginPerService}%`}
                  className={
                    row.marginPerService > 40
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
                can("services.edit") && (
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Consumo de estoque"
                      onClick={() => setUsageOpen(row)}
                    >
                      <PackageOpen className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Editar"
                      onClick={() => setDialog({ open: true, service: row })}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title={row.active ? "Desativar" : "Reativar"}
                      onClick={async () => {
                        try {
                          await updateService({
                            orgId,
                            serviceId: row._id,
                            patch: { active: !row.active },
                          });
                          toast.success(row.active ? "Serviço desativado." : "Serviço reativado.");
                        } catch (err) {
                          toast.error(errorMessage(err));
                        }
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ),
            },
          ]}
        />
      </GlassCard>

      {rows.length > 0 && (
        <InfoBanner>
          O consumo de estoque é definido por serviço e só é deduzido quando o
          atendimento é concluído — nunca na criação do agendamento.
        </InfoBanner>
      )}

      {dialog.open && (
        <ServiceDialog
          orgId={orgId}
          service={dialog.service}
          categories={data.categories ?? []}
          staff={staff ?? []}
          onClose={() => setDialog({ open: false })}
        />
      )}

      <FormDialog
        open={categoryOpen}
        onOpenChange={setCategoryOpen}
        title="Nova categoria de serviço"
        submitLabel="Criar categoria"
        onSubmit={async () => {
          try {
            await createCategory({
              orgId,
              name: categoryName,
              color: "#0ea5a4",
            });
            toast.success("Categoria criada.");
            setCategoryName("");
            setCategoryOpen(false);
          } catch (err) {
            toast.error(errorMessage(err));
          }
        }}
      >
        <Field label="Nome da categoria">
          <Input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} />
        </Field>
      </FormDialog>

      {usageOpen && (
        <FormDialog
          open
          onOpenChange={() => setUsageOpen(null)}
          size="lg"
          title={`Consumo de estoque · ${usageOpen.name}`}
          description="Quantidade estimada de cada produto usada por atendimento."
          submitLabel="Salvar consumo"
          onSubmit={async () => {
            const form = document.getElementById("usage-form") as HTMLFormElement | null;
            if (!form) return;
            const data2 = new FormData(form);
            const productId = String(data2.get("productId") ?? "");
            const quantity = Number(data2.get("quantity") ?? 0);
            if (!productId || !quantity) {
              toast.error("Selecione o produto e informe a quantidade.");
              return;
            }
            try {
              await saveRule({
                orgId,
                serviceId: usageOpen._id,
                productId: productId as Id<"products">,
                quantity,
              });
              toast.success("Regra de consumo salva.");
            } catch (err) {
              toast.error(errorMessage(err));
            }
          }}
        >
          <form id="usage-form" className="grid gap-4 sm:grid-cols-2">
            <Field label="Produto">
              <Select name="productId">
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {(products ?? []).map((product: any) => (
                    <SelectItem key={product._id} value={product._id}>
                      {product.name} · saldo {product.quantity}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Quantidade por atendimento">
              <Input name="quantity" type="number" min={1} step="0.5" defaultValue="1" />
            </Field>
          </form>

          <div className="mt-4">
            <SectionTitle title="Produtos vinculados" />
            {(rules ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhum produto vinculado a este serviço.
              </p>
            )}
            <div className="space-y-2">
              {(rules ?? []).map((rule: any) => (
                <div
                  key={rule._id}
                  className="glass-inset flex items-center justify-between rounded-xl px-3 py-2 text-xs"
                >
                  <span>
                    {rule.productName} · {rule.quantity} un · custo{" "}
                    {money(rule.unitCost * rule.quantity)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      try {
                        await deleteRule({ orgId, ruleId: rule._id });
                        toast.success("Vínculo removido.");
                      } catch (err) {
                        toast.error(errorMessage(err));
                      }
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </FormDialog>
      )}
    </div>
  );
}

function ServiceDialog({
  orgId,
  service,
  categories,
  staff,
  onClose,
}: {
  orgId: Id<"organizations">;
  service?: any;
  categories: any[];
  staff: any[];
  onClose: () => void;
}) {
  const create = useMutation(api.services.createService);
  const update = useMutation(api.services.updateService);
  const [form, setForm] = useState({
    name: service?.name ?? emptyService.name,
    categoryId: service?.categoryId ?? "",
    description: service?.description ?? "",
    price: service ? centsToInput(service.price) : "",
    durationMin: String(service?.durationMin ?? 60),
    bufferMin: String(service?.bufferMin ?? 10),
    materialCost: service ? centsToInput(service.materialCost) : "",
    laborCost: service ? centsToInput(service.laborCost) : "",
    depositType: service?.depositType ?? "none",
    depositValue:
      service?.depositType === "fixed"
        ? centsToInput(service.depositValue)
        : String(service?.depositValue ?? ""),
    commissionPct:
      service?.commissionPct !== undefined && service?.commissionPct !== null
        ? String(service.commissionPct)
        : "",
    warrantyNotes: service?.warrantyNotes ?? "",
    requiredResource: service?.requiredResource ?? "",
    eligibleStaff: (service?.eligibleStaff ?? []) as string[],
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    const payload = {
      orgId,
      name: form.name,
      categoryId: form.categoryId ? (form.categoryId as Id<"serviceCategories">) : undefined,
      description: form.description || undefined,
      price: parseMoney(form.price),
      durationMin: Number(form.durationMin) || 0,
      bufferMin: Number(form.bufferMin) || 0,
      materialCost: parseMoney(form.materialCost),
      laborCost: parseMoney(form.laborCost),
      depositType: form.depositType,
      depositValue:
        form.depositType === "fixed" ? parseMoney(form.depositValue) : Number(form.depositValue) || 0,
      commissionPct: form.commissionPct === "" ? undefined : Number(form.commissionPct),
      warrantyNotes: form.warrantyNotes || undefined,
      requiredResource: form.requiredResource || undefined,
      eligibleStaff: form.eligibleStaff as Id<"staff">[],
    };
    try {
      if (service) {
        await update({ orgId, serviceId: service._id, patch: payload });
        toast.success("Serviço atualizado.");
      } else {
        await create(payload);
        toast.success("Serviço criado.");
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
      title={service ? "Editar serviço" : "Novo serviço"}
      onSubmit={submit}
      loading={loading}
      error={error}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome do serviço *">
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label="Categoria">
          <Select
            value={form.categoryId}
            onValueChange={(value) => setForm({ ...form, categoryId: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category._id} value={category._id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Preço *">
          <MoneyInput
            value={form.price}
            onChange={(value) => setForm({ ...form, price: value })}
          />
        </Field>
        <Field label="Duração (minutos) *">
          <Input
            type="number"
            min={5}
            step={5}
            value={form.durationMin}
            onChange={(e) => setForm({ ...form, durationMin: e.target.value })}
          />
        </Field>
        <Field label="Intervalo entre atendimentos (min)">
          <Input
            type="number"
            min={0}
            step={5}
            value={form.bufferMin}
            onChange={(e) => setForm({ ...form, bufferMin: e.target.value })}
          />
        </Field>
        <Field label="Custo estimado de insumos">
          <MoneyInput
            value={form.materialCost}
            onChange={(value) => setForm({ ...form, materialCost: value })}
          />
        </Field>
        <Field label="Custo estimado de mão de obra">
          <MoneyInput
            value={form.laborCost}
            onChange={(value) => setForm({ ...form, laborCost: value })}
          />
        </Field>
        <Field label="Comissão específica (%)" hint="Deixe vazio para usar a regra da profissional">
          <Input
            type="number"
            min={0}
            max={100}
            value={form.commissionPct}
            onChange={(e) => setForm({ ...form, commissionPct: e.target.value })}
          />
        </Field>
        <Field label="Tipo de sinal">
          <Select
            value={form.depositType}
            onValueChange={(value) => setForm({ ...form, depositType: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Não exige sinal</SelectItem>
              <SelectItem value="percent">Percentual do serviço</SelectItem>
              <SelectItem value="fixed">Valor fixo</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field
          label={form.depositType === "fixed" ? "Valor do sinal" : "Percentual do sinal (%)"}
        >
          {form.depositType === "fixed" ? (
            <MoneyInput
              value={form.depositValue}
              onChange={(value) => setForm({ ...form, depositValue: value })}
            />
          ) : (
            <Input
              type="number"
              min={0}
              max={100}
              disabled={form.depositType === "none"}
              value={form.depositValue}
              onChange={(e) => setForm({ ...form, depositValue: e.target.value })}
            />
          )}
        </Field>
        <Field label="Sala / equipamento necessário">
          <Input
            value={form.requiredResource}
            onChange={(e) => setForm({ ...form, requiredResource: e.target.value })}
            placeholder="Sala de massagem, cadeira, maca…"
          />
        </Field>
      </div>

      <Field label="Profissionais habilitadas" hint="Sem seleção = todas as profissionais">
        <div className="flex flex-wrap gap-2">
          {staff.map((member) => {
            const checked = form.eligibleStaff.includes(member._id);
            return (
              <button
                key={member._id}
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    eligibleStaff: checked
                      ? form.eligibleStaff.filter((id) => id !== member._id)
                      : [...form.eligibleStaff, member._id],
                  })
                }
                className={
                  checked
                    ? "rounded-xl border border-primary/40 bg-primary/12 px-3 py-1 text-xs text-primary"
                    : "rounded-xl border border-white/70 bg-white/70 px-3 py-1 text-xs hover:bg-white"
                }
              >
                {member.name}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Descrição">
        <Textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={2}
        />
      </Field>
      <Field label="Garantia / política de retorno">
        <Textarea
          value={form.warrantyNotes}
          onChange={(e) => setForm({ ...form, warrantyNotes: e.target.value })}
          rows={2}
        />
      </Field>
    </FormDialog>
  );
}

// ---------------------------------------------------------------------------
// Packages
// ---------------------------------------------------------------------------

export function Packages() {
  const { orgId, can } = useApp();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<{ serviceId: string; quantity: number }[]>([]);
  const [form, setForm] = useState({
    name: "",
    description: "",
    packagePrice: "",
    validityDays: "90",
    restrictions: "",
  });
  const [error, setError] = useState<string | null>(null);

  const packages = useQuery(api.services.listPackages, orgId ? { orgId } : "skip");
  const services = useQuery(api.services.serviceOptions, orgId ? { orgId } : "skip");
  const save = useMutation(api.services.savePackage);
  const remove = useMutation(api.services.deletePackage);
  const [removeId, setRemoveId] = useState<any | null>(null);

  if (!orgId) return <LoadingBlock rows={3} />;

  const individual = items.reduce((acc, item) => {
    const service = (services ?? []).find((s: any) => s._id === item.serviceId);
    return acc + (service?.price ?? 0) * item.quantity;
  }, 0);
  const packagePrice = parseMoney(form.packagePrice);
  const discount = individual > 0 ? Math.round(((individual - packagePrice) / individual) * 1000) / 10 : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Atendimentos"
        title="Pacotes de serviços"
        description="Combinações de serviços com valor promocional e validade. O resgate de sessões não é contado como receita nova."
        actions={
          can("services.edit") && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 size-4" />
              Novo pacote
            </Button>
          )
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Pacotes cadastrados" value={(packages ?? []).length} />
        <StatCard
          label="Pacotes ativos"
          value={(packages ?? []).filter((p: any) => p.active).length}
          tone="positive"
        />
        <StatCard
          label="Desconto médio"
          value={`${
            (packages ?? []).length
              ? Math.round(
                  ((packages ?? []).reduce(
                    (acc: number, p: any) =>
                      acc +
                      (p.individualValue
                        ? ((p.individualValue - p.packagePrice) / p.individualValue) * 100
                        : 0),
                    0,
                  ) /
                    (packages ?? []).length) *
                    10,
                ) / 10
              : 0
          }%`}
        />
      </div>

      {(packages ?? []).length === 0 ? (
        <EmptyState
          title="Nenhum pacote cadastrado"
          description="Crie combinações de serviços para aumentar o ticket médio e a recorrência."
          icon={<PackageOpen className="size-5" />}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(packages ?? []).map((item: any) => (
            <GlassCard key={item._id} className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Validade de {item.validityDays} dias
                  </p>
                </div>
                {can("services.edit") && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-rose-600"
                    onClick={() => setRemoveId(item)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {item.items.map((line: any) => (
                  <li key={line.name} className="flex justify-between">
                    <span>
                      {line.quantity}× {line.name}
                    </span>
                    <span className="tabular-nums">{money(line.price * line.quantity)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 space-y-1 border-t border-white/60 pt-2 text-xs">
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Valor individual</span>
                  <span className="tabular-nums line-through">
                    {money(item.individualValue)}
                  </span>
                </p>
                <p className="flex justify-between font-semibold">
                  <span>Preço do pacote</span>
                  <span className="tabular-nums">{money(item.packagePrice)}</span>
                </p>
                <p className="text-emerald-600">
                  Economia de{" "}
                  {money(item.individualValue - item.packagePrice)}
                </p>
              </div>
              {item.restrictions && (
                <p className="mt-2 text-[0.7rem] text-muted-foreground">{item.restrictions}</p>
              )}
            </GlassCard>
          ))}
        </div>
      )}

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        size="lg"
        title="Novo pacote"
        description="O valor do pacote não pode superar a soma dos serviços individuais."
        submitLabel="Criar pacote"
        error={error}
        onSubmit={async () => {
          setError(null);
          if (!form.name.trim()) return setError("Informe o nome do pacote.");
          if (!items.length) return setError("Adicione pelo menos um serviço.");
          try {
            await save({
              orgId,
              name: form.name,
              description: form.description || undefined,
              items: items.map((item) => {
                const service = (services ?? []).find((s: any) => s._id === item.serviceId)!;
                return {
                  serviceId: item.serviceId as Id<"services">,
                  name: service.name,
                  price: service.price,
                  quantity: item.quantity,
                };
              }),
              packagePrice,
              validityDays: Number(form.validityDays) || 90,
              restrictions: form.restrictions || undefined,
            });
            toast.success("Pacote criado.");
            setOpen(false);
            setItems([]);
            setForm({
              name: "",
              description: "",
              packagePrice: "",
              validityDays: "90",
              restrictions: "",
            });
          } catch (err) {
            setError(errorMessage(err));
          }
        }}
      >
        <Field label="Nome do pacote *">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Serviços incluídos *">
          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <Select
                  value={item.serviceId}
                  onValueChange={(value) =>
                    setItems((prev) =>
                      prev.map((entry, i) =>
                        i === index ? { ...entry, serviceId: value } : entry,
                      ),
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
                  { serviceId: (services ?? [])[0]?._id ?? "", quantity: 1 },
                ])
              }
            >
              <Plus className="mr-1.5 size-3.5" />
              Adicionar serviço
            </Button>
          </div>
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Valor individual" hint="Calculado automaticamente">
            <Input value={money(individual)} readOnly />
          </Field>
          <Field label="Preço do pacote *">
            <MoneyInput
              value={form.packagePrice}
              onChange={(value) => setForm({ ...form, packagePrice: value })}
            />
          </Field>
          <Field label="Validade (dias)">
            <Input
              type="number"
              value={form.validityDays}
              onChange={(e) => setForm({ ...form, validityDays: e.target.value })}
            />
          </Field>
        </div>
        {individual > 0 && (
          <InfoBanner tone={discount > 0 ? "success" : "warning"}>
            Desconto aplicado: {discount}% ({money(individual - packagePrice)})
          </InfoBanner>
        )}
        <Field label="Descrição">
          <Textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
          />
        </Field>
        <Field label="Restrições de uso">
          <Input
            value={form.restrictions}
            onChange={(e) => setForm({ ...form, restrictions: e.target.value })}
          />
        </Field>
      </FormDialog>

      <ConfirmDialog
        open={!!removeId}
        onOpenChange={() => setRemoveId(null)}
        title="Excluir pacote"
        description="Pacotes já vendidos permanecem registrados nos atendimentos. Deseja continuar?"
        confirmLabel="Excluir"
        onConfirm={async () => {
          try {
            await remove({ orgId, packageId: removeId._id });
            toast.success("Pacote excluído.");
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
// Aftercare templates
// ---------------------------------------------------------------------------

export function Aftercare() {
  const { orgId, can } = useApp();
  const templates = useQuery(api.crm.listAftercareTemplates, orgId ? { orgId } : "skip");
  const services = useQuery(api.services.serviceOptions, orgId ? { orgId } : "skip");
  const save = useMutation(api.crm.saveAftercareTemplate);
  const [open, setOpen] = useState<{ open: boolean; template?: any }>({ open: false });
  const [form, setForm] = useState({ name: "", text: "", serviceId: "" });

  if (!orgId) return <LoadingBlock rows={3} />;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Atendimentos"
        title="Recomendações pós-atendimento"
        description="Modelos de cuidados que podem ser copiados, impressos ou enviados manualmente. O sistema não envia mensagens automaticamente."
        actions={
          can("settings.edit") && (
            <Button
              onClick={() => {
                setForm({ name: "", text: "", serviceId: "" });
                setOpen({ open: true });
              }}
            >
              <Plus className="mr-2 size-4" />
              Novo modelo
            </Button>
          )
        }
      />

      {(templates ?? []).length === 0 ? (
        <EmptyState
          title="Nenhum modelo cadastrado"
          description="Crie instruções de cuidado por serviço para manter a consistência no atendimento."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(templates ?? []).map((template: any) => (
            <GlassCard key={template._id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{template.name}</p>
                  <Badge variant="outline" className="mt-1">
                    {template.serviceName}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Copiar texto"
                  onClick={async () => {
                    await navigator.clipboard.writeText(template.text);
                    toast.success("Texto copiado.");
                  }}
                >
                  <Copy className="size-4" />
                </Button>
              </div>
              <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">
                {template.text}
              </p>
            </GlassCard>
          ))}
        </div>
      )}

      <FormDialog
        open={open.open}
        onOpenChange={(value) => setOpen({ open: value })}
        size="lg"
        title="Modelo de recomendação"
        submitLabel="Salvar modelo"
        onSubmit={async () => {
          try {
            await save({
              orgId,
              name: form.name,
              text: form.text,
              serviceId: form.serviceId ? (form.serviceId as Id<"services">) : undefined,
              templateId: open.template?._id,
            });
            toast.success("Modelo salvo.");
            setOpen({ open: false });
          } catch (err) {
            toast.error(errorMessage(err));
          }
        }}
      >
        <Field label="Nome do modelo *">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Serviço vinculado">
          <Select
            value={form.serviceId}
            onValueChange={(value) => setForm({ ...form, serviceId: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos os serviços" />
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
        <Field label="Texto das recomendações *">
          <Textarea
            rows={6}
            value={form.text}
            onChange={(e) => setForm({ ...form, text: e.target.value })}
          />
        </Field>
      </FormDialog>
    </div>
  );
}
