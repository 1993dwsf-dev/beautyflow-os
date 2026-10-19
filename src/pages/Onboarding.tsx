import { api } from "@/convex/_generated/api";
import { useApp } from "@/components/app-context";
import { BrandMark } from "@/components/AppShell";
import { Field, GlassCard, InfoBanner, MoneyInput } from "@/components/glass";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { errorMessage } from "@/lib/errors";
import { formatPhone } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "convex/react";
import { ArrowRight, CheckCircle2, Sparkles, Wand2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

const BUSINESS_TYPES = [
  "Salão de beleza",
  "Studio de unhas",
  "Studio de cílios e sobrancelhas",
  "Espaço de estética",
  "Spa / massagem",
  "Barbearia",
  "Maquiagem",
  "Profissional autônoma",
  "Estúdio multidisciplinar",
];

const BENEFITS = [
  "Agenda com prevenção de conflitos e lista de espera",
  "Fichas de consulta, consentimentos e antes/depois",
  "Faturas, sinais, pagamentos, despesas e comissões",
  "Estoque com consumo por serviço e custo de material",
  "Retenção, fidelidade, cartões-presente e campanhas",
  "Relatórios operacionais e financeiros com exportação CSV",
];

export default function Onboarding() {
  const { createOrganization } = useOnboardingActions();
  const createDemo = useMutation(api.demo.createDemoWorkspace);
  const { selectOrg } = useApp();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    businessType: BUSINESS_TYPES[0],
    ownerName: user?.name ?? "",
    email: user?.email ?? "",
    phone: "",
    whatsapp: "",
    document: "",
    legalName: "",
    taxPct: "0",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);

  return (
    <div className="glass-scene min-h-screen">
      <div className="mx-auto grid max-w-[70rem] gap-8 px-5 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:py-16">
        <div>
          <div className="flex items-center gap-3">
            <BrandMark />
            <div>
              <p className="text-sm font-semibold tracking-tight">
                BeautyFlow<span className="text-primary"> OS</span>
              </p>
              <p className="text-[0.7rem] uppercase tracking-[0.16em] text-muted-foreground">
                Gestão completa para beleza
              </p>
            </div>
          </div>

          <h1 className="mt-8 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Configure o seu espaço de trabalho
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            Cada organização tem clientes, agenda, financeiro, estoque e relatórios
            totalmente isolados. Você pode criar mais de um espaço e alternar entre eles
            quando quiser.
          </p>

          <ul className="mt-6 space-y-2">
            {BENEFITS.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-foreground/80">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                {item}
              </li>
            ))}
          </ul>

          <GlassCard className="mt-8">
            <div className="flex items-start gap-3">
              <Wand2 className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-semibold">Quer apenas conhecer o produto?</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Criamos um estúdio de demonstração com clientes, profissionais, catálogo,
                  agenda de semanas, faturas, despesas, estoque e relatórios. Todos os
                  registros ficam marcados como dados de demonstração e podem ser limpos a
                  qualquer momento.
                </p>
                <Button
                  className="mt-3"
                  variant="secondary"
                  disabled={demoBusy}
                  onClick={async () => {
                    setDemoBusy(true);
                    try {
                      const result = await createDemo({});
                      toast.success("Espaço de demonstração pronto.");
                      if (result?.orgId) selectOrg(result.orgId);
                      navigate("/app");
                    } catch (err) {
                      toast.error(errorMessage(err));
                    } finally {
                      setDemoBusy(false);
                    }
                  }}
                >
                  <Sparkles className="mr-2 size-4" />
                  Criar workspace de demonstração
                </Button>
              </div>
            </div>
          </GlassCard>
        </div>

        <GlassCard strong className="h-fit">
          <h2 className="text-lg font-semibold tracking-tight">Dados do negócio</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Tudo pode ser ajustado depois em Configurações → Organização.
          </p>

          <div className="mt-5 space-y-4">
            <Field label="Nome do negócio *">
              <Input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Ex.: Studio Lumière"
              />
            </Field>
            <Field label="Tipo de negócio">
              <Select
                value={form.businessType}
                onValueChange={(value) => setForm({ ...form, businessType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUSINESS_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Responsável">
                <Input
                  value={form.ownerName}
                  onChange={(event) => setForm({ ...form, ownerName: event.target.value })}
                />
              </Field>
              <Field label="Razão social" hint="Opcional para profissionais autônomas">
                <Input
                  value={form.legalName}
                  onChange={(event) => setForm({ ...form, legalName: event.target.value })}
                />
              </Field>
              <Field label="CNPJ ou CPF" hint="Opcional">
                <Input
                  value={form.document}
                  onChange={(event) => setForm({ ...form, document: event.target.value })}
                />
              </Field>
              <Field label="E-mail">
                <Input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                />
              </Field>
              <Field label="Telefone">
                <Input
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: formatPhone(event.target.value) })}
                />
              </Field>
              <Field label="WhatsApp">
                <Input
                  value={form.whatsapp}
                  onChange={(event) => setForm({ ...form, whatsapp: formatPhone(event.target.value) })}
                />
              </Field>
            </div>
            <Field
              label="Taxa / imposto padrão (%)"
              hint="Aplicado apenas quando você configurar explicitamente em faturas"
            >
              <MoneyInput value={form.taxPct} onChange={(value) => setForm({ ...form, taxPct: value })} />
            </Field>
          </div>

          {error && <p className="mt-4 text-xs text-rose-600">{error}</p>}

          <Button
            className="mt-5 w-full"
            disabled={busy}
            onClick={async () => {
              setError(null);
              setBusy(true);
              try {
                if (!form.name.trim()) throw new Error("Informe o nome do negócio.");
                const orgId = await createOrganization({
                  name: form.name,
                  businessType: form.businessType,
                  ownerName: form.ownerName || undefined,
                  email: form.email || undefined,
                  phone: form.phone || undefined,
                  whatsapp: form.whatsapp || undefined,
                  document: form.document || undefined,
                  legalName: form.legalName || undefined,
                });
                toast.success("Espaço de trabalho criado.");
                if (orgId) selectOrg(orgId);
                navigate("/app");
              } catch (err) {
                setError(errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            Criar espaço de trabalho
            <ArrowRight className="ml-2 size-4" />
          </Button>

          <InfoBanner>
            A criação já inclui catálogo inicial de serviços, formas de pagamento,
            categorias de despesa e regras padrão de agendamento.
          </InfoBanner>
        </GlassCard>
      </div>
    </div>
  );
}

/** Small wrapper so the mutation stays typed against the generated API. */
function useOnboardingActions() {
  const create = useMutation(api.orgs.createOrganization);
  return {
    createOrganization: async (args: {
      name: string;
      businessType?: string;
      ownerName?: string;
      email?: string;
      phone?: string;
      whatsapp?: string;
      document?: string;
      legalName?: string;
    }) => create(args),
  };
}
