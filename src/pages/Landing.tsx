import { BrandMark } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bell,
  CalendarDays,
  CircleDollarSign,
  Clock,
  CreditCard,
  Gift,
  HeartHandshake,
  Image as ImageIcon,
  LineChart,
  ListChecks,
  Lock,
  Package,
  Receipt,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Wand2,
} from "lucide-react";
import { Link } from "react-router";

const MODULES = [
  {
    icon: <CalendarDays className="size-5" />,
    title: "Agenda inteligente",
    text: "Visões de dia, semana e mês, prevenção de conflitos, buffer entre atendimentos e lista de espera com encaixe manual.",
  },
  {
    icon: <Users className="size-5" />,
    title: "CRM de clientes",
    text: "Ficha completa, histórico de atendimentos, preferências, tags, origem de indicação e valor gasto calculado no caixa.",
  },
  {
    icon: <HeartHandshake className="size-5" />,
    title: "Prontuário e consentimento",
    text: "Fórmulas, reações relatadas, cuidados pós-atendimento e consentimentos separados por finalidade.",
  },
  {
    icon: <ImageIcon className="size-5" />,
    title: "Antes e depois",
    text: "Fotos em armazenamento privado, comparação lado a lado e liberação de divulgação apenas com autorização.",
  },
  {
    icon: <Sparkles className="size-5" />,
    title: "Catálogo e pacotes",
    text: "Preço, duração, custo de material, comissão, sinal e profissionais elegíveis por serviço. Combos e pacotes.",
  },
  {
    icon: <Receipt className="size-5" />,
    title: "Faturas e recibos",
    text: "Itens, descontos, sinal aplicado, saldo em aberto e bloqueio de edição após a quitação.",
  },
  {
    icon: <CreditCard className="size-5" />,
    title: "Pagamentos e sinais",
    text: "PIX, dinheiro, débito, crédito e transferência. Pagamentos parciais, estornos auditáveis e sinais sem duplicidade.",
  },
  {
    icon: <CircleDollarSign className="size-5" />,
    title: "Comissões",
    text: "Regras por serviço, profissional ou global, com base configurada e extrato separando comissão estimada, ganha e paga.",
  },
  {
    icon: <Package className="size-5" />,
    title: "Estoque real",
    text: "Entradas, vendas, perdas e consumo por serviço com movimentação registrada — nada muda de saldo sem histórico.",
  },
  {
    icon: <TrendingUp className="size-5" />,
    title: "Retenção",
    text: "Quem está com retorno previsto, atrasado ou inativa, com tarefas de acompanhamento e mensagens prontas.",
  },
  {
    icon: <Gift className="size-5" />,
    title: "Fidelidade e presentes",
    text: "Extrato de pontos auditável, recompensas e cartões-presente com política de reconhecimento documentada.",
  },
  {
    icon: <BarChart3 className="size-5" />,
    title: "Relatórios e CSV",
    text: "Operacional, financeiro, clientes e estoque por período, com exportação para conferência contábil.",
  },
];

const JOURNEY = [
  { icon: <Users className="size-4" />, label: "Cliente" },
  { icon: <CalendarDays className="size-4" />, label: "Agendamento" },
  { icon: <Sparkles className="size-4" />, label: "Serviço" },
  { icon: <HeartHandshake className="size-4" />, label: "Prontuário" },
  { icon: <Receipt className="size-4" />, label: "Fatura" },
  { icon: <CreditCard className="size-4" />, label: "Pagamento" },
  { icon: <CircleDollarSign className="size-4" />, label: "Comissão" },
  { icon: <Package className="size-4" />, label: "Estoque" },
  { icon: <TrendingUp className="size-4" />, label: "Retenção" },
];

const PRINCIPLES = [
  {
    icon: <Clock className="size-5" />,
    title: "Agenda que não vende horário ocupado",
    text: "Disponibilidade validada com horário de funcionamento, escala da profissional, intervalos, bloqueios e agendamentos existentes — inclusive no agendamento online.",
  },
  {
    icon: <ShieldCheck className="size-5" />,
    title: "Dados sensíveis sob controle",
    text: "Permissões por papel verificadas no backend, trilha de auditoria e acesso restrito a fichas de saúde e fotos privadas.",
  },
  {
    icon: <BadgeCheck className="size-5" />,
    title: "Financeiro sem atalhos",
    text: "Agendado, faturado, recebido, despesa incorrida e despesa paga nunca se misturam — e sinal pago não é contado duas vezes.",
  },
  {
    icon: <ListChecks className="size-5" />,
    title: "Multi-tenant de verdade",
    text: "Cada salão, studio ou profissional autônoma tem registros isolados, com papéis, módulos e marca próprios.",
  },
];

const PLANS = [
  {
    name: "Essencial",
    price: "R$ 79",
    hint: "por mês · profissional autônoma",
    features: [
      "Agenda e agenda online pública",
      "CRM de clientes e histórico",
      "Catálogo de serviços e pacotes",
      "Faturas, pagamentos e sinais",
    ],
  },
  {
    name: "Studio",
    price: "R$ 149",
    hint: "por mês · salão com equipe",
    highlight: true,
    features: [
      "Tudo do Essencial",
      "Equipe, escalas e comissões",
      "Estoque com consumo por serviço",
      "Despesas, fluxo de caixa e relatórios",
      "Fidelidade, cartões-presente e campanhas",
    ],
  },
  {
    name: "Multi-unidade",
    price: "R$ 289",
    hint: "por mês · rede ou estúdios",
    features: [
      "Tudo do Studio",
      "Vários espaços por usuário",
      "Permissões avançadas por papel",
      "Exportações completas e auditoria",
    ],
  },
];

const TESTIMONIALS = [
  {
    quote:
      "Antes eu controlava sinal em caderno e às vezes cobrava duas vezes. Agora o sinal entra na fatura e o saldo aparece certinho.",
    author: "Studio de cílios · São Paulo",
  },
  {
    quote:
      "A lista de espera e o alerta de retorno mudaram o meu mês: consigo chamar quem está atrasada sem depender da memória.",
    author: "Cabeleireira autônoma · Belo Horizonte",
  },
  {
    quote:
      "O consumo de produto por serviço finalmente mostrou quais procedimentos dão margem de verdade.",
    author: "Salão com quatro profissionais · Curitiba",
  },
];

const FAQ = [
  {
    question: "O BeautyFlow OS emite nota fiscal?",
    answer:
      "A plataforma é uma ferramenta operacional de faturamento: gera faturas, recibos e relatórios internos. Emissão fiscal oficial depende de uma integração fiscal configurada, que pode ser ativada quando disponível.",
  },
  {
    question: "Vocês enviam mensagens automáticas por WhatsApp ou e-mail?",
    answer:
      "Hoje o sistema prepara as mensagens, cria tarefas internas e monta o link do WhatsApp para envio manual. Disparos automáticos exigem uma integração configurada e consentimento válido da cliente.",
  },
  {
    question: "Preciso ter CNPJ para usar?",
    answer:
      "Não. Profissionais autônomas podem operar apenas com nome e telefone. CNPJ, razão social e endereço completo são opcionais e podem ser preenchidos depois em Configurações.",
  },
  {
    question: "Consigo testar antes de migrar meus dados?",
    answer:
      "Sim. Existe um workspace de demonstração com catálogo, clientes, agenda de semanas, faturas, despesas e estoque. Todos os registros ficam marcados como dados de demonstração e podem ser recriados a qualquer momento.",
  },
  {
    question: "Como funciona o isolamento entre profissionais?",
    answer:
      "Cada organização tem seus próprios registros. As operações verificam a organização do usuário no backend, então uma profissional nunca acessa agenda, ficha ou financeiro de outro negócio.",
  },
];

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function Landing() {
  return (
    <div className="glass-scene min-h-screen">
      {/* ------------------------------------------------------------------ */}
      <header className="mx-auto flex w-full max-w-[76rem] items-center gap-4 px-5 py-6">
        <div className="flex items-center gap-3">
          <BrandMark />
          <div>
            <p className="text-sm font-semibold tracking-tight">
              BeautyFlow<span className="text-primary"> OS</span>
            </p>
            <p className="text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">
              Gestão de beleza
            </p>
          </div>
        </div>
        <nav className="ml-6 hidden items-center gap-6 text-sm text-foreground/75 lg:flex">
          <a href="#modulos" className="transition hover:text-foreground">
            Módulos
          </a>
          <a href="#jornada" className="transition hover:text-foreground">
            Jornada
          </a>
          <a href="#principios" className="transition hover:text-foreground">
            Como pensamos
          </a>
          <a href="#planos" className="transition hover:text-foreground">
            Planos
          </a>
          <a href="#duvidas" className="transition hover:text-foreground">
            Dúvidas
          </a>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" asChild className="glass-soft">
            <Link to="/auth">Entrar</Link>
          </Button>
          <Button asChild>
            <Link to="/auth?returnTo=%2Fonboarding">
              Criar conta
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      <section className="mx-auto w-full max-w-[76rem] px-5 pb-10 pt-6 lg:pt-12">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge
              variant="outline"
              className="border-white/70 bg-white/70 text-[0.7rem] text-primary"
            >
              <Wand2 className="mr-1.5 size-3.5" />
              Feito para o mercado brasileiro · R$ e datas em pt-BR
            </Badge>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
              Todo o seu negócio de beleza
              <span className="block text-primary">em um só fluxo, do agendamento ao lucro</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
              Salões, studios de unhas e cílios, estética, massagem, barbearia e
              profissionais autônomas. Agenda sem conflito, ficha de tratamento, fatura,
              sinal, comissão, estoque, retenção e relatórios — com dados persistentes e
              permissões aplicadas no servidor.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button size="lg" asChild>
                <Link to="/auth?returnTo=%2Fonboarding">
                  Começar agora
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="glass-soft" asChild>
                <Link to="/auth?returnTo=%2Fonboarding">
                  <Sparkles className="mr-2 size-4" />
                  Explorar com dados de demonstração
                </Link>
              </Button>
            </div>

            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <BadgeCheck className="size-3.5 text-primary" />
                Sinal nunca contado duas vezes
              </span>
              <span className="flex items-center gap-1.5">
                <BadgeCheck className="size-3.5 text-primary" />
                Multi-tenant com permissões
              </span>
              <span className="flex items-center gap-1.5">
                <BadgeCheck className="size-3.5 text-primary" />
                Exportação CSV por módulo
              </span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="relative"
          >
            <div className="glass-strong rounded-3xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Painel operacional
                  </p>
                  <p className="text-sm font-semibold">Hoje · agenda da equipe</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Bell className="size-4" />
                  <Lock className="size-4" />
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {[
                  { time: "09:00", name: "Coloração completa", pro: "Camila", tone: "bg-teal-400" },
                  { time: "11:30", name: "Alongamento de unhas", pro: "Larissa", tone: "bg-pink-400" },
                  { time: "14:00", name: "Volume russo", pro: "Renata", tone: "bg-indigo-400" },
                  { time: "16:15", name: "Corte masculino", pro: "Bruno", tone: "bg-orange-400" },
                ].map((item) => (
                  <div
                    key={item.time}
                    className="glass-inset flex items-center gap-3 rounded-xl px-3 py-2.5"
                  >
                    <span className="w-12 text-xs font-semibold tabular-nums">{item.time}</span>
                    <span className={`h-8 w-1 rounded-full ${item.tone}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.name}</span>
                      <span className="block text-xs text-muted-foreground">{item.pro}</span>
                    </span>
                    <span className="rounded-full border border-white/70 bg-white/70 px-2 py-0.5 text-[0.65rem]">
                      Confirmado
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {[
                  ["Recebido hoje", currency.format(1280)],
                  ["Saldo em aberto", currency.format(340)],
                  ["Comissões do mês", currency.format(2140)],
                ].map(([label, value]) => (
                  <div key={label} className="glass-inset rounded-xl p-3">
                    <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                      {label}
                    </p>
                    <p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
                  </div>
                ))}
              </div>

              <p className="mt-3 text-center text-[0.65rem] text-muted-foreground">
                Ilustração da interface. Os valores exibidos dentro do produto vêm sempre dos
                seus próprios registros.
              </p>
            </div>
            <div className="glass pointer-events-none absolute -bottom-6 -left-4 hidden w-48 rounded-2xl p-3 sm:block">
              <p className="flex items-center gap-1.5 text-xs font-semibold">
                <LineChart className="size-3.5 text-primary" />
                Retorno previsto
              </p>
              <p className="mt-1 text-[0.7rem] leading-4 text-muted-foreground">
                12 clientes com manutenção chegando nesta semana.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="mx-auto w-full max-w-[76rem] px-5 py-10">
        <div className="glass grid gap-4 rounded-3xl p-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["12", "módulos conectados no mesmo fluxo"],
            ["6", "papéis de acesso com permissões granulares"],
            ["10", "conjuntos de dados para exportar em CSV"],
            ["18", "funcionalidades controladas por feature flag"],
          ].map(([value, label]) => (
            <div key={label}>
              <p className="text-2xl font-semibold text-primary">{value}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section id="modulos" className="mx-auto w-full max-w-[76rem] px-5 py-12">
        <div className="max-w-2xl">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-primary/80">
            Módulos
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">
            Um sistema operacional para o seu studio
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Cada módulo conversa com os outros: o serviço concluído gera prontuário, fatura,
            comissão, baixa de estoque e o próximo retorno da cliente.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((module, index) => (
            <motion.div
              key={module.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.35, delay: index * 0.03 }}
              className="glass glass-hover rounded-2xl p-5"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-white/70 text-primary">
                {module.icon}
              </span>
              <p className="mt-3 text-sm font-semibold">{module.title}</p>
              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{module.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section id="jornada" className="mx-auto w-full max-w-[76rem] px-5 py-12">
        <div className="glass rounded-3xl p-6 sm:p-8">
          <div className="max-w-2xl">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-primary/80">
              Jornada
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">
              Da cliente ao resultado, sem planilha paralela
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              O BeautyFlow OS mantém os valores históricos de preço, duração e regra de
              comissão aplicados em cada transação — mudanças no catálogo não reescrevem o
              passado.
            </p>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-2">
            {JOURNEY.map((step, index) => (
              <div key={step.label} className="flex items-center gap-2">
                <span className="glass-inset flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium">
                  <span className="text-primary">{step.icon}</span>
                  {step.label}
                </span>
                {index < JOURNEY.length - 1 && <ArrowRight className="size-3.5 text-muted-foreground" />}
              </div>
            ))}
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Sinal pago", "Registrado como depósito e aplicado à fatura final"],
              ["Atendimento concluído", "Gera prontuário e libera o faturamento do serviço"],
              ["Baixa de estoque", "Consumo real do serviço com custo de material"],
              ["Próximo retorno", "Data sugerida alimenta a retenção automaticamente"],
            ].map(([title, text]) => (
              <div key={title} className="glass-inset rounded-2xl p-3">
                <p className="text-xs font-semibold">{title}</p>
                <p className="mt-1 text-[0.7rem] leading-4 text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section id="principios" className="mx-auto w-full max-w-[76rem] px-5 py-12">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-primary/80">
              Como pensamos
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">
              Correção antes de enfeite
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Foi construído por quem já viu ficha de papel perdida, sinal esquecido e
              estoque que não fecha. O produto prioriza integridade de dados, privacidade e
              cálculos confiáveis — a interface bonita vem junto, mas nunca no lugar disso.
            </p>
            <div className="mt-6 flex items-center gap-3 text-xs text-muted-foreground">
              <ShieldCheck className="size-4 text-primary" />
              Você é responsável pelos seus dados e pode exportá-los a qualquer momento.
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {PRINCIPLES.map((item) => (
              <div key={item.title} className="glass rounded-2xl p-5">
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-white/70 text-primary">
                  {item.icon}
                </span>
                <p className="mt-3 text-sm font-semibold">{item.title}</p>
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="mx-auto w-full max-w-[76rem] px-5 py-12">
        <div className="grid gap-4 sm:grid-cols-3">
          {TESTIMONIALS.map((item) => (
            <div key={item.author} className="glass rounded-2xl p-5">
              <div className="flex gap-0.5 text-amber-500">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star key={index} className="size-3.5" fill="currentColor" />
                ))}
              </div>
              <p className="mt-3 text-sm leading-6 text-foreground/85">“{item.quote}”</p>
              <p className="mt-3 text-xs text-muted-foreground">{item.author}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section id="planos" className="mx-auto w-full max-w-[76rem] px-5 py-12">
        <div className="max-w-2xl">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-primary/80">
            Planos
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">
            Preços de referência por tamanho de operação
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Os módulos são habilitados por organização e aplicados no servidor. A cobrança
            da assinatura ainda é feita manualmente — nenhuma cobrança automática é
            executada sem um gateway configurado.
          </p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={
                plan.highlight
                  ? "glass-strong relative rounded-3xl p-6 ring-2 ring-primary/30"
                  : "glass rounded-3xl p-6"
              }
            >
              {plan.highlight && (
                <Badge className="absolute -top-3 left-6 border-0 bg-primary text-white">
                  Mais escolhido
                </Badge>
              )}
              <p className="text-sm font-semibold">{plan.name}</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight">{plan.price}</p>
              <p className="mt-1 text-xs text-muted-foreground">{plan.hint}</p>
              <ul className="mt-5 space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-xs leading-5">
                    <BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                className="mt-6 w-full"
                variant={plan.highlight ? "default" : "outline"}
                asChild
              >
                <Link to="/auth?returnTo=%2Fonboarding">Criar meu espaço</Link>
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section id="duvidas" className="mx-auto w-full max-w-[56rem] px-5 py-12">
        <div className="glass rounded-3xl p-6 sm:p-8">
          <h2 className="text-2xl font-semibold tracking-tight">Dúvidas frequentes</h2>
          <Accordion type="single" collapsible className="mt-4">
            {FAQ.map((item, index) => (
              <AccordionItem key={item.question} value={`item-${index}`}>
                <AccordionTrigger className="text-left text-sm">{item.question}</AccordionTrigger>
                <AccordionContent className="text-xs leading-6 text-muted-foreground">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="mx-auto w-full max-w-[76rem] px-5 py-12">
        <div className="glass-strong flex flex-wrap items-center gap-6 rounded-3xl p-8">
          <div className="min-w-[16rem] flex-1">
            <h2 className="text-2xl font-semibold tracking-tight">
              Comece hoje e mantenha tudo no mesmo lugar
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Crie seu espaço em menos de um minuto, cadastre seus serviços e comece a
              agendar. Se preferir, explore primeiro com os dados de demonstração.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link to="/auth?returnTo=%2Fonboarding">
                Criar conta
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="glass-soft" asChild>
              <Link to="/auth">Já tenho conta</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      <footer className="mx-auto w-full max-w-[76rem] px-5 pb-12">
        <div className="glass rounded-3xl p-6">
          <div className="flex flex-wrap items-start gap-6">
            <div className="min-w-[14rem] flex-1">
              <div className="flex items-center gap-2">
                <BrandMark className="size-8" />
                <p className="text-sm font-semibold">
                  BeautyFlow<span className="text-primary"> OS</span>
                </p>
              </div>
              <p className="mt-3 max-w-md text-xs leading-5 text-muted-foreground">
                Sistema de gestão para salões, studios, spas, barbearias e profissionais
                autônomas no Brasil. Interface em português, valores em reais, datas no
                formato DD/MM/AAAA e fuso de America/Sao_Paulo.
              </p>
            </div>
            <div className="text-xs">
              <p className="font-semibold">Produto</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>
                  <a className="transition hover:text-foreground" href="#modulos">
                    Módulos
                  </a>
                </li>
                <li>
                  <a className="transition hover:text-foreground" href="#jornada">
                    Jornada do atendimento
                  </a>
                </li>
                <li>
                  <a className="transition hover:text-foreground" href="#planos">
                    Planos
                  </a>
                </li>
              </ul>
            </div>
            <div className="text-xs">
              <p className="font-semibold">Acesso</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>
                  <Link className="transition hover:text-foreground" to="/auth">
                    Entrar
                  </Link>
                </li>
                <li>
                  <Link className="transition hover:text-foreground" to="/onboarding">
                    Criar espaço
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <p className="mt-6 border-t border-white/60 pt-4 text-[0.7rem] leading-5 text-muted-foreground">
            O BeautyFlow OS é uma ferramenta operacional de gestão e faturamento interno.
            Não substitui sistema fiscal certificado, contador ou revisão jurídica. Apoia boas
            práticas de privacidade e LGPD, mas a conformidade final é responsabilidade do
            negócio.
          </p>
        </div>
      </footer>
    </div>
  );
}
