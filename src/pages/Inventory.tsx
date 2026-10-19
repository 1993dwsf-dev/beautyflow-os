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
  MOVEMENT_TYPE,
  addDays,
  centsToInput,
  formatDate,
  label,
  money,
  parseMoney,
  startOfMonth,
  todayISO,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowLeftRight,
  CalendarClock,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  Trash2,
  Truck,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const MOVEMENT_OPTIONS = [
  { value: "entrada", label: "Entrada (compra/recebimento)" },
  { value: "saida", label: "Saída" },
  { value: "ajuste", label: "Ajuste de inventário" },
  { value: "venda", label: "Venda ao cliente" },
  { value: "consumo", label: "Consumo em serviço" },
  { value: "perda", label: "Perda / quebra / vencimento" },
  { value: "devolucao", label: "Devolução" },
];

export function Products() {
  const { orgId, can } = useApp();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [lowOnly, setLowOnly] = useState(false);
  const [dialog, setDialog] = useState<{ open: boolean; product?: any }>({ open: false });
  const [moveDialog, setMoveDialog] = useState<{ open: boolean; product?: any }>({
    open: false,
  });
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [removeId, setRemoveId] = useState<any | null>(null);

  const data = useQuery(
    api.inventory.listProducts,
    orgId
      ? {
          orgId,
          search: search || undefined,
          categoryId: categoryId === "all" ? undefined : (categoryId as Id<"productCategories">),
          lowStockOnly: lowOnly || undefined,
        }
      : "skip",
  );
  const suppliers = useQuery(api.inventory.listSuppliers, orgId ? { orgId } : "skip");
  const createCategory = useMutation(api.inventory.createProductCategory);
  const saveProduct = useMutation(api.inventory.saveProduct);

  if (!orgId) return <LoadingBlock rows={4} />;
  if (data === undefined) return <LoadingBlock rows={4} />;

  const rows: any[] = data.rows ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Estoque"
        title="Produtos"
        description="Produtos de varejo e insumos de serviço. Toda alteração de quantidade precisa de uma movimentação registrada."
        actions={
          can("inventory.edit") && (
            <>
              <Button variant="outline" className="glass-soft" onClick={() => setCategoryOpen(true)}>
                <Plus className="mr-2 size-4" />
                Categoria
              </Button>
              <Button onClick={() => setDialog({ open: true })}>
                <PackagePlus className="mr-2 size-4" />
                Novo produto
              </Button>
            </>
          )
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Itens cadastrados" value={rows.length} icon={<Package className="size-4" />} />
        <StatCard label="Valor em estoque (custo)" value={money(data.valuation ?? 0)} />
        <StatCard label="Valor de varejo" value={money((data as any).retailValue ?? 0)} />
        <StatCard
          label="Abaixo do mínimo"
          value={data.lowStock ?? 0}
          tone={data.lowStock ? "warning" : "positive"}
          icon={<AlertTriangle className="size-4" />}
        />
      </div>

      <GlassCard padded={false} className="p-3">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Buscar">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nome, marca, SKU, código de barras"
              className="w-64"
            />
          </Field>
          <Field label="Categoria">
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {(data.categories ?? []).map((category: any) => (
                  <SelectItem key={category._id} value={category._id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <label className="flex items-center gap-2 pb-1 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={lowOnly}
              onChange={(event) => setLowOnly(event.target.checked)}
            />
            Somente estoque baixo
          </label>
        </div>
      </GlassCard>

      <GlassCard>
        <DataTable
          keyOf={(row: any) => row._id}
          rows={rows}
          empty={<EmptyState title="Nenhum produto cadastrado" icon={<Package className="size-5" />} />}
          columns={[
            {
              key: "name",
              header: "Produto",
              render: (row: any) => (
                <div>
                  <p className="font-medium">{row.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[row.brand, row.categoryName, row.sku].filter(Boolean).join(" · ")}
                  </p>
                </div>
              ),
            },
            {
              key: "type",
              header: "Uso",
              render: (row: any) => (
                <Badge variant="outline">
                  {row.type === "varejo" ? "Varejo" : "Consumo em serviço"}
                </Badge>
              ),
            },
            { key: "supplierName", header: "Fornecedor" },
            {
              key: "quantity",
              header: "Estoque",
              align: "right",
              render: (row: any) => (
                <span className={cn("tabular-nums", row.lowStock && "font-semibold text-amber-600")}>
                  {row.quantity}
                </span>
              ),
            },
            { key: "minStock", header: "Mínimo", align: "right" },
            {
              key: "cost",
              header: "Custo",
              align: "right",
              render: (row: any) => money(row.cost),
            },
            { key: "price", header: "Preço", align: "right", render: (row: any) => money(row.price) },
            {
              key: "marginPct",
              header: "Margem",
              align: "right",
              render: (row: any) => `${row.marginPct}%`,
            },
            {
              key: "expirationDate",
              header: "Validade",
              render: (row: any) =>
                row.expirationDate ? (
                  <span className={row.expiringSoon ? "text-amber-600" : ""}>
                    {formatDate(row.expirationDate)}
                  </span>
                ) : (
                  "—"
                ),
            },
            {
              key: "actions",
              header: "",
              align: "right",
              render: (row: any) =>
                can("inventory.edit") && (
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setMoveDialog({ open: true, product: row })}
                    >
                      <ArrowLeftRight className="mr-1 size-3.5" />
                      Movimentar
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDialog({ open: true, product: row })}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-rose-600"
                      title="Inativar produto"
                      onClick={async () => {
                        try {
                          await saveProduct({
                            orgId,
                            productId: row._id,
                            name: row.name,
                            sku: row.sku,
                            cost: row.cost,
                            price: row.price,
                            minStock: row.minStock,
                            reorderQty: row.reorderQty,
                            type: row.type,
                            active: false,
                          });
                          toast.success("Produto inativado. O histórico de movimentações foi mantido.");
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

      {(data as any).retailValue !== undefined && (
        <InfoBanner>
          Produtos de varejo são vendidos ao cliente; insumos são consumidos durante o
          atendimento e baixados pelo agendamento concluído.
        </InfoBanner>
      )}

      {dialog.open && (
        <ProductDialog
          orgId={orgId}
          product={dialog.product}
          categories={data.categories ?? []}
          suppliers={suppliers ?? []}
          onClose={() => setDialog({ open: false })}
        />
      )}

      {moveDialog.open && (
        <MovementDialog
          orgId={orgId}
          product={moveDialog.product}
          suppliers={suppliers ?? []}
          onClose={() => setMoveDialog({ open: false })}
        />
      )}

      <FormDialog
        open={categoryOpen}
        onOpenChange={setCategoryOpen}
        title="Nova categoria de produto"
        submitLabel="Criar categoria"
        onSubmit={async () => {
          try {
            await createCategory({ orgId, name: categoryName });
            toast.success("Categoria criada.");
            setCategoryOpen(false);
            setCategoryName("");
          } catch (err) {
            toast.error(errorMessage(err));
          }
        }}
      >
        <Field label="Nome da categoria *">
          <Input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} />
        </Field>
      </FormDialog>

      <ConfirmDialog
        open={!!removeId}
        onOpenChange={() => setRemoveId(null)}
        title="Operação indisponível"
        description="Produtos não são excluídos para preservar o histórico de movimentações. Use a inativação."
        confirmLabel="Entendi"
        onConfirm={() => setRemoveId(null)}
      />
    </div>
  );
}

function ProductDialog({
  orgId,
  product,
  categories,
  suppliers,
  onClose,
}: {
  orgId: Id<"organizations">;
  product?: any;
  categories: any[];
  suppliers: any[];
  onClose: () => void;
}) {
  const save = useMutation(api.inventory.saveProduct);
  const [form, setForm] = useState({
    name: product?.name ?? "",
    brand: product?.brand ?? "",
    categoryId: product?.categoryId ?? "",
    sku: product?.sku ?? "",
    barcode: product?.barcode ?? "",
    supplierId: product?.supplierId ?? "",
    cost: product ? centsToInput(product.cost) : "",
    price: product ? centsToInput(product.price) : "",
    minStock: String(product?.minStock ?? 1),
    reorderQty: String(product?.reorderQty ?? 1),
    expirationDate: product?.expirationDate ?? "",
    location: product?.location ?? "",
    type: product?.type ?? "consumo",
    initialQuantity: "",
  });
  const [error, setError] = useState<string | null>(null);

  return (
    <FormDialog
      open
      onOpenChange={(value) => !value && onClose()}
      size="lg"
      title={product ? `Editar ${product.name}` : "Novo produto"}
      description="A quantidade inicial gera automaticamente uma movimentação de entrada."
      submitLabel={product ? "Salvar alterações" : "Cadastrar produto"}
      error={error}
      onSubmit={async () => {
        setError(null);
        try {
          await save({
            orgId,
            productId: product?._id,
            name: form.name,
            brand: form.brand || undefined,
            categoryId: form.categoryId ? (form.categoryId as Id<"productCategories">) : undefined,
            sku: form.sku,
            barcode: form.barcode || undefined,
            supplierId: form.supplierId ? (form.supplierId as Id<"suppliers">) : undefined,
            cost: parseMoney(form.cost),
            price: parseMoney(form.price),
            minStock: Number(form.minStock) || 0,
            reorderQty: Number(form.reorderQty) || 0,
            expirationDate: form.expirationDate || undefined,
            location: form.location || undefined,
            type: form.type,
            initialQuantity: form.initialQuantity ? Number(form.initialQuantity) : undefined,
          });
          toast.success("Produto salvo.");
          onClose();
        } catch (err) {
          setError(errorMessage(err));
        }
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome *">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Marca">
          <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
        </Field>
        <Field label="Categoria">
          <Select value={form.categoryId} onValueChange={(value) => setForm({ ...form, categoryId: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Sem categoria" />
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
        <Field label="Fornecedor">
          <Select value={form.supplierId} onValueChange={(value) => setForm({ ...form, supplierId: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Sem fornecedor" />
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
        <Field label="SKU *">
          <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
        </Field>
        <Field label="Código de barras">
          <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
        </Field>
        <Field label="Custo de compra *">
          <MoneyInput value={form.cost} onChange={(value) => setForm({ ...form, cost: value })} />
        </Field>
        <Field label="Preço de venda">
          <MoneyInput value={form.price} onChange={(value) => setForm({ ...form, price: value })} />
        </Field>
        <Field label="Estoque mínimo">
          <Input
            type="number"
            value={form.minStock}
            onChange={(e) => setForm({ ...form, minStock: e.target.value })}
          />
        </Field>
        <Field label="Quantidade de reposição">
          <Input
            type="number"
            value={form.reorderQty}
            onChange={(e) => setForm({ ...form, reorderQty: e.target.value })}
          />
        </Field>
        <Field label="Validade">
          <Input
            type="date"
            value={form.expirationDate}
            onChange={(e) => setForm({ ...form, expirationDate: e.target.value })}
          />
        </Field>
        <Field label="Local de armazenamento">
          <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        </Field>
        <Field label="Tipo de uso">
          <Select value={form.type} onValueChange={(value) => setForm({ ...form, type: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="consumo">Consumido em serviços</SelectItem>
              <SelectItem value="varejo">Vendido ao cliente (varejo)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {!product && (
          <Field label="Quantidade inicial" hint="Gera entrada de estoque automática">
            <Input
              type="number"
              value={form.initialQuantity}
              onChange={(e) => setForm({ ...form, initialQuantity: e.target.value })}
            />
          </Field>
        )}
      </div>
    </FormDialog>
  );
}

function MovementDialog({
  orgId,
  product,
  suppliers,
  onClose,
}: {
  orgId: Id<"organizations">;
  product: any;
  suppliers: any[];
  onClose: () => void;
}) {
  const move = useMutation(api.inventory.moveStock);
  const [form, setForm] = useState({
    type: "entrada",
    quantity: "1",
    reason: "",
    supplierId: "",
    unitCost: product ? centsToInput(product.cost) : "",
    date: todayISO(),
  });
  const [error, setError] = useState<string | null>(null);

  return (
    <FormDialog
      open
      onOpenChange={(value) => !value && onClose()}
      title={`Movimentar estoque · ${product.name}`}
      description={`Saldo atual: ${product.quantity} unidade(s). Toda movimentação fica auditável e pode ser corrigida.`}
      submitLabel="Registrar movimentação"
      error={error}
      onSubmit={async () => {
        setError(null);
        try {
          await move({
            orgId,
            productId: product._id,
            type: form.type as any,
            quantity: Number(form.quantity) || 0,
            reason: form.reason || undefined,
            supplierId: form.supplierId ? (form.supplierId as Id<"suppliers">) : undefined,
            unitCost: parseMoney(form.unitCost),
          });
          toast.success("Movimentação registrada.");
          onClose();
        } catch (err) {
          setError(errorMessage(err));
        }
      }}
    >
      <Field label="Tipo de movimentação *">
        <Select value={form.type} onValueChange={(value) => setForm({ ...form, type: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MOVEMENT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Quantidade *" hint="Use números decimais para produtos fracionados">
          <Input
            inputMode="decimal"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
          />
        </Field>
        <Field label="Custo unitário">
          <MoneyInput value={form.unitCost} onChange={(value) => setForm({ ...form, unitCost: value })} />
        </Field>
      </div>
      {form.type === "entrada" && (
        <Field label="Fornecedor">
          <Select value={form.supplierId} onValueChange={(value) => setForm({ ...form, supplierId: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
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
      )}
      <Field label="Motivo / observação">
        <Textarea rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
      </Field>
      <InfoBanner>
        Custos já lançados como despesa não devem ser duplicados aqui: registre apenas a
        movimentação física do produto.
      </InfoBanner>
    </FormDialog>
  );
}

export function Movements() {
  const { orgId, can } = useApp();
  const [type, setType] = useState("all");
  const [productId, setProductId] = useState("all");
  const [from, setFrom] = useState(addDays(todayISO(), -60));
  const [to, setTo] = useState(todayISO());
  const [correctId, setCorrectId] = useState<any | null>(null);
  const [correctReason, setCorrectReason] = useState("");

  const movements = useQuery(
    api.inventory.listMovements,
    orgId
      ? {
          orgId,
          type: type === "all" ? undefined : type,
          productId: productId === "all" ? undefined : (productId as Id<"products">),
          from,
          to,
        }
      : "skip",
  );
  const products = useQuery(api.inventory.listProducts, orgId ? { orgId } : "skip");
  const correct = useMutation(api.inventory.correctMovement);

  if (!orgId) return <LoadingBlock rows={4} />;
  if (movements === undefined) return <LoadingBlock rows={4} />;

  const consumption = movements
    .filter((m: any) => m.type === "consumo" || m.type === "perda")
    .reduce((acc: number, m: any) => acc + m.totalCost, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Estoque"
        title="Movimentações"
        description="Histórico completo de entradas, saídas, vendas, consumo em serviços, perdas e ajustes com saldo resultante."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Movimentações no período" value={movements.length} />
        <StatCard
          label="Entradas"
          value={movements.filter((m: any) => m.type === "entrada").length}
          tone="positive"
        />
        <StatCard
          label="Consumo e perdas"
          value={movements.filter((m: any) => m.type === "consumo" || m.type === "perda").length}
          tone="warning"
        />
        <StatCard label="Custo de consumo/perda" value={money(consumption)} />
      </div>

      <GlassCard padded={false} className="p-3">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="De">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </Field>
          <Field label="Até">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </Field>
          <Field label="Tipo">
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(MOVEMENT_TYPE).map(([key, value]) => (
                  <SelectItem key={key} value={key}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Produto">
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os produtos</SelectItem>
                {(products?.rows ?? []).map((product: any) => (
                  <SelectItem key={product._id} value={product._id}>
                    {product.name}
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
          rows={movements}
          empty={<EmptyState title="Nenhuma movimentação no período" />}
          columns={[
            { key: "date", header: "Data", render: (row: any) => formatDate(row.date) },
            { key: "productName", header: "Produto" },
            {
              key: "type",
              header: "Tipo",
              render: (row: any) => (
                <StatusPill
                  label={label(MOVEMENT_TYPE, row.type)}
                  className={
                    row.quantity > 0
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-rose-200 bg-rose-50 text-rose-700"
                  }
                />
              ),
            },
            {
              key: "quantity",
              header: "Quantidade",
              align: "right",
              render: (row: any) => (
                <span className={row.quantity > 0 ? "text-emerald-600" : "text-rose-600"}>
                  {row.quantity > 0 ? "+" : ""}
                  {row.quantity}
                </span>
              ),
            },
            { key: "balanceAfter", header: "Saldo", align: "right" },
            {
              key: "unitCost",
              header: "Custo unit.",
              align: "right",
              render: (row: any) => money(row.unitCost),
            },
            {
              key: "totalCost",
              header: "Custo total",
              align: "right",
              render: (row: any) => money(row.totalCost),
            },
            { key: "supplierName", header: "Fornecedor" },
            {
              key: "reason",
              header: "Motivo",
              render: (row: any) => (
                <span className="text-xs text-muted-foreground">{row.reason ?? "—"}</span>
              ),
            },
            {
              key: "actions",
              header: "",
              align: "right",
              render: (row: any) =>
                can("inventory.edit") && !row.corrected ? (
                  <Button size="sm" variant="ghost" onClick={() => setCorrectId(row)}>
                    Corrigir
                  </Button>
                ) : row.corrected ? (
                  <Badge variant="outline" className="text-[0.65rem]">
                    Corrigida
                  </Badge>
                ) : null,
            },
          ]}
        />
      </GlassCard>

      <FormDialog
        open={!!correctId}
        onOpenChange={() => setCorrectId(null)}
        title="Corrigir movimentação"
        description="A correção estorna o efeito no saldo e gera um registro de auditoria."
        submitLabel="Registrar correção"
        onSubmit={async () => {
          try {
            await correct({ orgId, movementId: correctId._id, reason: correctReason });
            toast.success("Movimentação corrigida.");
            setCorrectId(null);
            setCorrectReason("");
          } catch (err) {
            toast.error(errorMessage(err));
          }
        }}
      >
        <Field label="Motivo da correção *">
          <Textarea rows={2} value={correctReason} onChange={(e) => setCorrectReason(e.target.value)} />
        </Field>
      </FormDialog>
    </div>
  );
}

export function Suppliers() {
  const { orgId, can } = useApp();
  const suppliers = useQuery(api.inventory.listSuppliers, orgId ? { orgId } : "skip");
  const save = useMutation(api.inventory.saveSupplier);
  const remove = useMutation(api.inventory.deleteSupplier);
  const [dialog, setDialog] = useState<{ open: boolean; supplier?: any }>({ open: false });
  const [removeId, setRemoveId] = useState<any | null>(null);

  if (!orgId) return <LoadingBlock rows={3} />;
  if (suppliers === undefined) return <LoadingBlock rows={3} />;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Estoque"
        title="Fornecedores"
        description="Cadastro de fornecedores usado nas entradas de estoque e nas despesas de produtos."
        actions={
          can("inventory.edit") && (
            <Button onClick={() => setDialog({ open: true })}>
              <Plus className="mr-2 size-4" />
              Novo fornecedor
            </Button>
          )
        }
      />

      <GlassCard>
        <DataTable
          keyOf={(row: any) => row._id}
          rows={suppliers}
          empty={<EmptyState title="Nenhum fornecedor cadastrado" icon={<Truck className="size-5" />} />}
          columns={[
            { key: "name", header: "Fornecedor" },
            { key: "document", header: "CNPJ / CPF", render: (row: any) => row.document ?? "—" },
            { key: "contact", header: "Contato", render: (row: any) => row.contact ?? "—" },
            { key: "phone", header: "Telefone", render: (row: any) => row.phone ?? "—" },
            { key: "email", header: "E-mail", render: (row: any) => row.email ?? "—" },
            {
              key: "active",
              header: "Situação",
              render: (row: any) => (
                <Badge variant="outline">{row.active ? "Ativo" : "Inativo"}</Badge>
              ),
            },
            {
              key: "actions",
              header: "",
              align: "right",
              render: (row: any) =>
                can("inventory.edit") && (
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setDialog({ open: true, supplier: row })}>
                      <Pencil className="size-4" />
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
        <SupplierDialog
          orgId={orgId}
          supplier={dialog.supplier}
          onClose={() => setDialog({ open: false })}
        />
      )}

      <ConfirmDialog
        open={!!removeId}
        onOpenChange={() => setRemoveId(null)}
        title={`Excluir ${removeId?.name ?? ""}`}
        description="O histórico de movimentações permanece, mas o fornecedor é removido do cadastro."
        confirmLabel="Excluir"
        onConfirm={async () => {
          try {
            await remove({ orgId, supplierId: removeId._id });
            toast.success("Fornecedor excluído.");
            setRemoveId(null);
          } catch (err) {
            toast.error(errorMessage(err));
          }
        }}
      />
    </div>
  );
}

function SupplierDialog({
  orgId,
  supplier,
  onClose,
}: {
  orgId: Id<"organizations">;
  supplier?: any;
  onClose: () => void;
}) {
  const save = useMutation(api.inventory.saveSupplier);
  const [form, setForm] = useState({
    name: supplier?.name ?? "",
    contact: supplier?.contact ?? "",
    phone: supplier?.phone ?? "",
    email: supplier?.email ?? "",
    document: supplier?.document ?? "",
    notes: supplier?.notes ?? "",
    active: supplier?.active ?? true,
  });
  const [error, setError] = useState<string | null>(null);

  return (
    <FormDialog
      open
      onOpenChange={(value) => !value && onClose()}
      title={supplier ? `Editar ${supplier.name}` : "Novo fornecedor"}
      submitLabel="Salvar"
      error={error}
      onSubmit={async () => {
        setError(null);
        try {
          await save({
            orgId,
            supplierId: supplier?._id,
            name: form.name,
            contact: form.contact || undefined,
            phone: form.phone || undefined,
            email: form.email || undefined,
            document: form.document || undefined,
            notes: form.notes || undefined,
            active: form.active,
          });
          toast.success("Fornecedor salvo.");
          onClose();
        } catch (err) {
          setError(errorMessage(err));
        }
      }}
    >
      <Field label="Nome *">
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="CNPJ / CPF">
          <Input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} />
        </Field>
        <Field label="Pessoa de contato">
          <Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
        </Field>
        <Field label="Telefone">
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="E-mail">
          <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
      </div>
      <Field label="Observações">
        <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Field>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(event) => setForm({ ...form, active: event.target.checked })}
        />
        Fornecedor ativo
      </label>
    </FormDialog>
  );
}

export function StockAlerts() {
  const { orgId } = useApp();
  const alerts = useQuery(api.inventory.lowStockAlerts, orgId ? { orgId } : "skip");
  const valuation = useQuery(api.inventory.inventoryValuation, orgId ? { orgId } : "skip");
  const products = useQuery(
    api.inventory.listProducts,
    orgId ? { orgId, lowStockOnly: true } : "skip",
  );
  const consumption = useQuery(
    api.inventory.consumptionReport,
    orgId ? { orgId, from: addDays(todayISO(), -30), to: todayISO() } : "skip",
  );

  if (!orgId) return <LoadingBlock rows={3} />;
  if (alerts === undefined || products === undefined) return <LoadingBlock rows={3} />;

  const low: any[] = products.rows ?? [];
  const expiring = low.filter((row) => row.expiringSoon);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Estoque"
        title="Alertas de estoque"
        description="Itens abaixo do mínimo, produtos próximos do vencimento e consumo por produto nos últimos 30 dias."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Itens abaixo do mínimo"
          value={low.length}
          tone={low.length ? "warning" : "positive"}
          icon={<AlertTriangle className="size-4" />}
        />
        <StatCard
          label="Vencendo em 60 dias"
          value={expiring.length}
          tone={expiring.length ? "warning" : "neutral"}
          icon={<CalendarClock className="size-4" />}
        />
        <StatCard
          label="Valor em estoque (custo)"
          value={money(valuation?.cost ?? 0)}
          hint={`${valuation?.items ?? 0} item(ns) · varejo ${money(valuation?.retail ?? 0)}`}
          icon={<Package className="size-4" />}
        />
        <StatCard
          label="Custo de consumo (30 dias)"
          value={money((consumption as any)?.totalCost ?? 0)}
          icon={<TrendingUp className="size-4" />}
        />
      </div>

      <GlassCard>
        <SectionTitle
          title="Reposição sugerida"
          description="Quantidades calculadas a partir do estoque mínimo e da quantidade de reposição configurada."
        />
        <DataTable
          keyOf={(row: any) => row._id}
          rows={low}
          empty={<EmptyState title="Nenhum item abaixo do mínimo" />}
          columns={[
            { key: "name", header: "Produto" },
            { key: "brand", header: "Marca", render: (row: any) => row.brand ?? "—" },
            { key: "quantity", header: "Estoque", align: "right" },
            { key: "minStock", header: "Mínimo", align: "right" },
            {
              key: "reorderQty",
              header: "Sugestão",
              align: "right",
              render: (row: any) => row.reorderQty || row.minStock * 2,
            },
            { key: "supplierName", header: "Fornecedor" },
          ]}
        />
      </GlassCard>

      {expiring.length > 0 && (
        <GlassCard>
          <SectionTitle title="Vencimento próximo" description="Produtos com validade nos próximos 60 dias." />
          <DataTable
            keyOf={(row: any) => row._id}
            rows={expiring}
            columns={[
              { key: "name", header: "Produto" },
              { key: "quantity", header: "Estoque", align: "right" },
              {
                key: "expirationDate",
                header: "Validade",
                render: (row: any) => formatDate(row.expirationDate),
              },
            ]}
          />
        </GlassCard>
      )}

      <GlassCard>
        <SectionTitle
          title="Consumo por produto"
          description="Baixas registradas em serviços. O consumo é lançado ao concluir o atendimento, nunca na criação do agendamento."
        />
        <DataTable
          keyOf={(row: any) => row.productId}
          rows={consumption?.rows ?? []}
          empty={<EmptyState title="Sem consumo registrado no período" />}
          columns={[
            { key: "productName", header: "Produto" },
            { key: "quantity", header: "Quantidade consumida", align: "right" },
            { key: "cost", header: "Custo", align: "right", render: (row: any) => money(row.cost) },
          ]}
        />
        {(consumption?.byService ?? []).length > 0 && (
          <div className="mt-5">
            <SectionTitle
              title="Custo de material por serviço"
              description="Base para o cálculo de margem de contribuição por serviço."
            />
            <DataTable
              keyOf={(row: any) => row.serviceName}
              rows={consumption?.byService ?? []}
              columns={[
                { key: "serviceName", header: "Serviço" },
                { key: "count", header: "Registros", align: "right" },
                { key: "cost", header: "Custo de material", align: "right", render: (row: any) => money(row.cost) },
              ]}
            />
          </div>
        )}
      </GlassCard>
    </div>
  );
}
