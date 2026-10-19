import { api } from "@/convex/_generated/api";
import { useApp } from "@/components/app-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ORG_ROLE_LABELS, type FeatureKey, type OrgRole, type Permission } from "@/convex/lib/permissions";
import { useAuth } from "@/hooks/use-auth";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  Cake,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronsUpDown,
  Gift,
  History,
  LayoutDashboard,
  LineChart,
  ListChecks,
  LogOut,
  Megaphone,
  Menu,
  Package,
  PackageOpen,
  PiggyBank,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Truck,
  UserCog,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";

type NavItem = {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
  perm?: Permission;
  flag?: FeatureKey;
};

const GROUP_ICON = "size-4 shrink-0";

export const NAV_GROUPS: { group: string; items: NavItem[] }[] = [
  {
    group: "Visão Geral",
    items: [
      { to: "/app", label: "Dashboard", icon: <LayoutDashboard className={GROUP_ICON} />, end: true },
      { to: "/app/agenda", label: "Agenda", icon: <CalendarDays className={GROUP_ICON} /> },
      { to: "/app/lista-espera", label: "Lista de Espera", icon: <ListChecks className={GROUP_ICON} />, flag: "scheduling" },
      { to: "/app/alertas", label: "Alertas", icon: <AlertTriangle className={GROUP_ICON} /> },
    ],
  },
  {
    group: "Clientes",
    items: [
      { to: "/app/clientes", label: "Cadastro de Clientes", icon: <Users className={GROUP_ICON} />, perm: "clients.view" },
      { to: "/app/historico", label: "Histórico de Atendimentos", icon: <History className={GROUP_ICON} />, perm: "appointments.view" },
      { to: "/app/retornos", label: "Retornos Pendentes", icon: <CalendarClock className={GROUP_ICON} />, perm: "clients.view" },
    ],
  },
  {
    group: "Atendimentos",
    items: [
      { to: "/app/servicos", label: "Serviços", icon: <Sparkles className={GROUP_ICON} />, perm: "services.view" },
      { to: "/app/pacotes", label: "Pacotes", icon: <PackageOpen className={GROUP_ICON} />, perm: "services.view", flag: "memberships" },
      { to: "/app/orcamentos", label: "Orçamentos", icon: <Receipt className={GROUP_ICON} />, perm: "appointments.view" },
    ],
  },
  {
    group: "Equipe",
    items: [
      { to: "/app/profissionais", label: "Profissionais", icon: <UserCog className={GROUP_ICON} />, perm: "staff.view" },
      { to: "/app/comissoes", label: "Comissões", icon: <PiggyBank className={GROUP_ICON} />, perm: "commissions.view", flag: "commissions" },
      { to: "/app/desempenho", label: "Desempenho", icon: <TrendingUp className={GROUP_ICON} />, perm: "staff.view" },
    ],
  },
  {
    group: "Financeiro",
    items: [
      { to: "/app/faturas", label: "Faturas e Pagamentos", icon: <Receipt className={GROUP_ICON} />, perm: "invoices.view", flag: "finance" },
      { to: "/app/despesas", label: "Despesas", icon: <Wallet className={GROUP_ICON} />, perm: "expenses.view", flag: "finance" },
      { to: "/app/caixa", label: "Fluxo de Caixa", icon: <LineChart className={GROUP_ICON} />, perm: "reports.financial", flag: "finance" },
    ],
  },
  {
    group: "Estoque",
    items: [
      { to: "/app/produtos", label: "Produtos e Movimentações", icon: <Package className={GROUP_ICON} />, perm: "inventory.view", flag: "inventory" },
      { to: "/app/fornecedores", label: "Fornecedores", icon: <Truck className={GROUP_ICON} />, perm: "inventory.view", flag: "inventory" },
      { to: "/app/estoque-alertas", label: "Alertas de Estoque", icon: <AlertTriangle className={GROUP_ICON} />, perm: "inventory.view", flag: "inventory" },
    ],
  },
  {
    group: "Relacionamento",
    items: [
      { to: "/app/reagendamentos", label: "Reagendamentos e Retenção", icon: <RefreshCw className={GROUP_ICON} />, perm: "clients.view" },
      { to: "/app/campanhas", label: "Campanhas", icon: <Megaphone className={GROUP_ICON} />, flag: "marketing" },
      { to: "/app/aniversarios", label: "Aniversários", icon: <Cake className={GROUP_ICON} />, perm: "clients.view" },
      { to: "/app/cartoes-presente", label: "Cartões-Presente", icon: <Gift className={GROUP_ICON} />, flag: "giftcards" },
    ],
  },
  {
    group: "Relatórios",
    items: [
      { to: "/app/relatorios", label: "Relatórios e Exportações", icon: <BarChart3 className={GROUP_ICON} />, perm: "reports.operational" },
    ],
  },
  {
    group: "Configurações",
    items: [
      { to: "/app/configuracoes", label: "Organização e Preferências", icon: <Settings className={GROUP_ICON} />, perm: "settings.edit" },
      { to: "/app/auditoria", label: "Privacidade e Auditoria", icon: <ShieldCheck className={GROUP_ICON} />, perm: "settings.edit" },
    ],
  },
];

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[color-mix(in_oklab,var(--chart-2)_85%,white)] text-white shadow-[0_10px_24px_-12px_rgba(14,116,144,0.7)]",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M4 20c3-1.4 5-3.6 5.6-6.2" />
        <path d="M20 20c-3-1.4-5-3.6-5.6-6.2" />
        <circle cx="12" cy="7.5" r="3.5" />
        <path d="M8.5 13.8C9.6 14.6 12 15 12 15s2.4-.4 3.5-1.2" />
      </svg>
    </span>
  );
}

function NavList({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const { can, flag } = useApp();
  return (
    <nav className="scroll-thin flex-1 space-y-6 overflow-y-auto px-3 pb-6">
      {NAV_GROUPS.map((group) => {
        const items = group.items.filter(
          (item) => (!item.perm || can(item.perm)) && (!item.flag || flag(item.flag)),
        );
        if (!items.length) return null;
        return (
          <div key={group.group}>
            <p className="px-3 pb-2 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
              {group.group}
            </p>
            <ul className="space-y-1">
              {items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-all",
                        isActive
                          ? "bg-white/85 text-primary shadow-[0_10px_24px_-18px_rgba(15,60,90,0.7)] ring-1 ring-white/80"
                          : "text-foreground/75 hover:bg-white/60 hover:text-foreground",
                      )
                    }
                    title={collapsed ? item.label : undefined}
                  >
                    {item.icon}
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function GlobalSearch() {
  const { orgId } = useApp();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const navigate = useNavigate();
  const clients = useQuery(
    api.clients.listClients,
    orgId ? { orgId, search: term || undefined, limit: 12 } : "skip",
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const routes = NAV_GROUPS.flatMap((g) => g.items);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="glass-soft flex h-9 w-full items-center gap-2 rounded-xl px-3 text-sm text-muted-foreground transition hover:text-foreground sm:w-64"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Buscar clientes, telas…</span>
        <kbd className="hidden rounded border border-white/70 bg-white/70 px-1.5 py-0.5 text-[0.65rem] sm:inline">
          ⌘K
        </kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Buscar por cliente, telefone ou tela…"
          value={term}
          onValueChange={setTerm}
        />
        <CommandList>
          <CommandEmpty>Nada encontrado.</CommandEmpty>
          <CommandGroup heading="Telas">
            {routes
              .filter((r) => r.label.toLowerCase().includes(term.toLowerCase()))
              .slice(0, 6)
              .map((route) => (
                <CommandItem
                  key={route.to}
                  value={`tela ${route.label}`}
                  onSelect={() => {
                    setOpen(false);
                    navigate(route.to);
                  }}
                >
                  {route.icon}
                  <span className="ml-2">{route.label}</span>
                </CommandItem>
              ))}
          </CommandGroup>
          <CommandGroup heading="Clientes">
            {(clients?.rows ?? []).map((client: any) => (
              <CommandItem
                key={client._id}
                value={`cliente ${client.name} ${client.phone}`}
                onSelect={() => {
                  setOpen(false);
                  navigate(`/app/clientes/${client._id}`);
                }}
              >
                <Users className="size-4" />
                <span className="ml-2">{client.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {client.phone}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

function Notifications() {
  const { orgId } = useApp();
  const notifications = useQuery(
    api.orgs.listNotifications,
    orgId ? { orgId } : "skip",
  );
  const markRead = useMutation(api.orgs.markNotificationRead);
  const unread = (notifications ?? []).filter((n: any) => !n.read).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-xl">
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[0.6rem] font-semibold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="glass-strong w-80 border-white/70 p-0">
        <div className="border-b border-white/60 px-4 py-3">
          <p className="text-sm font-semibold">Notificações internas</p>
          <p className="text-xs text-muted-foreground">
            Alertas operacionais gerados pelo sistema. Nenhuma mensagem externa é
            enviada automaticamente.
          </p>
        </div>
        <div className="scroll-thin max-h-80 overflow-y-auto">
          {(notifications ?? []).length === 0 && (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">
              Nenhuma notificação por aqui.
            </p>
          )}
          {(notifications ?? []).map((item: any) => (
            <button
              key={item._id}
              type="button"
              onClick={() => orgId && markRead({ orgId, id: item._id })}
              className={cn(
                "flex w-full gap-3 border-b border-white/40 px-4 py-3 text-left last:border-0 hover:bg-white/60",
                !item.read && "bg-white/40",
              )}
            >
              <span
                className={cn(
                  "mt-1 size-2 shrink-0 rounded-full",
                  item.read ? "bg-muted-foreground/30" : "bg-primary",
                )}
              />
              <span>
                <span className="block text-xs font-semibold">{item.title}</span>
                <span className="block text-xs leading-5 text-muted-foreground">
                  {item.body}
                </span>
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function OrgSwitcher() {
  const { orgs, orgId, selectOrg, context } = useApp();
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="glass-soft flex max-w-[15rem] items-center gap-2 rounded-xl px-3 py-1.5 text-left">
          <Building2 className="size-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {context?.org?.name ?? "Selecionar espaço"}
            </span>
            <span className="block truncate text-[0.65rem] uppercase tracking-wide text-muted-foreground">
              {context?.member?.role
                ? `${ORG_ROLE_LABELS[context.member.role as OrgRole]}${
                    context.org?.isDemo ? " · Demonstração" : ""
                  }`
                : ""}
            </span>
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="glass-strong w-72 border-white/70">
        <DropdownMenuLabel>Meus espaços de trabalho</DropdownMenuLabel>
        {orgs.map((org) => (
          <DropdownMenuItem
            key={org._id}
            onClick={() => selectOrg(org._id)}
            className="flex items-center gap-2"
          >
            <span className="flex-1 truncate">{org.name}</span>
            {orgId === org._id && <Check className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/onboarding")}>
          <Plus className="mr-2 size-4" />
          Criar novo negócio
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="glass-soft flex items-center gap-2 rounded-xl p-1 pr-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/12 text-[0.7rem] font-semibold text-primary">
            {initials(user?.name ?? user?.email ?? "BF")}
          </span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="glass-strong w-60 border-white/70">
        <DropdownMenuLabel className="truncate">
          {user?.name ?? "Profissional"}
          <span className="block text-xs font-normal text-muted-foreground">
            {user?.email ?? "conta autenticada"}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/app/configuracoes")}>
          <Settings className="mr-2 size-4" />
          Configurações
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/")}>
          <Building2 className="mr-2 size-4" />
          Ir para a página inicial
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await signOut();
            navigate("/");
          }}
        >
          <LogOut className="mr-2 size-4" />
          Sair da conta
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { context } = useApp();
  const location = useLocation();
  // Tracking which route the drawer was opened on closes it automatically on
  // navigation without syncing state inside an effect.
  const [drawerRoute, setDrawerRoute] = useState<string | null>(null);
  const mobileOpen = drawerRoute === location.pathname;
  const setMobileOpen = (open: boolean) =>
    setDrawerRoute(open ? location.pathname : null);

  return (
    <div className="glass-scene min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-[110rem]">
        {/* desktop sidebar */}
        <aside className="glass sticky top-0 hidden h-screen w-[17rem] shrink-0 flex-col rounded-none border-y-0 border-l-0 border-r border-white/60 lg:flex">
          <div className="flex items-center gap-3 px-5 py-5">
            <BrandMark />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">
                BeautyFlow<span className="text-primary"> OS</span>
              </p>
              <p className="text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">
                Gestão de beleza
              </p>
            </div>
          </div>
          <NavList />
          <div className="border-t border-white/60 px-5 py-4">
            <p className="text-[0.65rem] leading-4 text-muted-foreground">
              Dados fiscais e mensagens externas só funcionam com integrações
              configuradas.
            </p>
          </div>
        </aside>

        {/* mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Fechar menu"
              className="absolute inset-0 bg-slate-900/25 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="glass-strong relative flex h-full w-[18rem] flex-col">
              <div className="flex items-center justify-between px-5 py-5">
                <div className="flex items-center gap-3">
                  <BrandMark />
                  <p className="text-sm font-semibold">BeautyFlow OS</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileOpen(false)}
                >
                  <X className="size-4" />
                </Button>
              </div>
              <NavList onNavigate={() => setMobileOpen(false)} />
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="glass sticky top-0 z-30 flex flex-wrap items-center gap-3 rounded-none border-x-0 border-t-0 border-b border-white/60 px-4 py-3 sm:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="size-4" />
            </Button>
            <OrgSwitcher />
            <div className="ml-auto flex items-center gap-2">
              <div className="hidden sm:block">
                <GlobalSearch />
              </div>
              {context?.org?.isDemo && (
                <Badge
                  variant="outline"
                  className="hidden border-amber-300 bg-amber-50 text-[0.65rem] text-amber-700 md:inline-flex"
                >
                  Dados de demonstração
                </Badge>
              )}
              <Notifications />
              <UserMenu />
            </div>
            <div className="w-full sm:hidden">
              <GlobalSearch />
            </div>
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

/** Guard that renders a permission notice instead of a screen. */
export function PermissionNotice({ children }: { children?: ReactNode }) {
  return (
    <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">
      {children ?? "Você não possui permissão para acessar este registro."}
    </div>
  );
}

export { Link };
