import { AppProvider, useApp } from "@/components/app-context";
import { AppShell } from "@/components/AppShell";
import { LoadingBlock } from "@/components/glass";
import { RequireAuth } from "@/components/RequireAuth";
import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router";

const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const Onboarding = lazy(() => import("./pages/Onboarding.tsx"));
const PublicBooking = lazy(() => import("./pages/Booking.tsx"));

const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const Agenda = lazy(() => import("./pages/Agenda.tsx"));
const Clients = lazy(() => import("./pages/Clients.tsx"));
const ClientDetail = lazy(() =>
  import("./pages/Clients.tsx").then((module) => ({ default: module.ClientDetail })),
);
const Services = lazy(() =>
  import("./pages/Catalog.tsx").then((module) => ({ default: module.Services })),
);
const Packages = lazy(() =>
  import("./pages/Catalog.tsx").then((module) => ({ default: module.Packages })),
);
const Staff = lazy(() =>
  import("./pages/Team.tsx").then((module) => ({ default: module.Staff })),
);
const Performance = lazy(() =>
  import("./pages/Team.tsx").then((module) => ({ default: module.Performance })),
);
const Commissions = lazy(() =>
  import("./pages/Team.tsx").then((module) => ({ default: module.Commissions })),
);
const Billing = lazy(() =>
  import("./pages/Finance.tsx").then((module) => ({ default: module.Billing })),
);
const Expenses = lazy(() =>
  import("./pages/Finance.tsx").then((module) => ({ default: module.Expenses })),
);
const Cashflow = lazy(() =>
  import("./pages/Finance.tsx").then((module) => ({ default: module.Cashflow })),
);
const Quotes = lazy(() =>
  import("./pages/Finance.tsx").then((module) => ({ default: module.Quotes })),
);
const Inventory = lazy(() =>
  import("./pages/Inventory.tsx").then((module) => ({ default: module.Inventory })),
);
const Suppliers = lazy(() =>
  import("./pages/Inventory.tsx").then((module) => ({ default: module.Suppliers })),
);
const StockAlerts = lazy(() =>
  import("./pages/Inventory.tsx").then((module) => ({ default: module.StockAlerts })),
);
const TreatmentHistory = lazy(() =>
  import("./pages/CRM.tsx").then((module) => ({ default: module.TreatmentHistory })),
);
const Retention = lazy(() =>
  import("./pages/Retention.tsx").then((module) => ({ default: module.Retention })),
);
const Alerts = lazy(() =>
  import("./pages/Retention.tsx").then((module) => ({ default: module.Alerts })),
);
const Waitlist = lazy(() =>
  import("./pages/Retention.tsx").then((module) => ({ default: module.Waitlist })),
);
const GiftCards = lazy(() =>
  import("./pages/Retention.tsx").then((module) => ({ default: module.GiftCards })),
);
const Campaigns = lazy(() =>
  import("./pages/Retention.tsx").then((module) => ({ default: module.Campaigns })),
);
const Birthdays = lazy(() =>
  import("./pages/Retention.tsx").then((module) => ({ default: module.Birthdays })),
);
const Reports = lazy(() =>
  import("./pages/Reports.tsx").then((module) => ({ default: module.Reports })),
);
const Settings = lazy(() =>
  import("./pages/Settings.tsx").then((module) => ({ default: module.Settings })),
);
const Audit = lazy(() =>
  import("./pages/Settings.tsx").then((module) => ({ default: module.Audit })),
);

function RouteLoading() {
  return (
    <div className="glass-scene flex min-h-screen items-center justify-center p-8">
      <div className="glass w-full max-w-2xl rounded-2xl p-6">
        <LoadingBlock rows={4} />
      </div>
    </div>
  );
}

/** Every signed-in screen lives inside an organization context. */
function AppWorkspace({ children }: { children: ReactNode }) {
  const { isLoading, hasNoOrg } = useApp();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="glass-scene flex min-h-screen items-center justify-center p-8">
        <div className="glass w-full max-w-2xl rounded-2xl p-6">
          <LoadingBlock rows={5} />
        </div>
      </div>
    );
  }

  if (hasNoOrg) {
    return <Navigate to="/onboarding" replace state={{ from: location.pathname }} />;
  }

  return <AppShell>{children}</AppShell>;
}

/**
 * All signed-in product routes share one layout so the organization context
 * stays mounted while navigating. Every route below `/app` must be rendered
 * inside this provider — otherwise screens that call `useApp` crash.
 */
function WorkspaceLayout() {
  return (
    <RequireAuth redirectImmediately title="Entre para acessar o BeautyFlow OS">
      <AppProvider>
        <AppWorkspace>
          <Outlet />
        </AppWorkspace>
      </AppProvider>
    </RequireAuth>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<AuthPage redirectAfterAuth="/app" />} />
        <Route path="/agendar/:slug" element={<PublicBooking />} />
        {/* legacy link from the starter template */}
        <Route path="/dashboard" element={<Navigate to="/app" replace />} />
        <Route
          path="/onboarding"
          element={
            <RequireAuth redirectImmediately title="Entre para criar seu espaço de trabalho">
              <AppProvider>
                <Onboarding />
              </AppProvider>
            </RequireAuth>
          }
        />

        <Route element={<WorkspaceLayout />}>
          <Route path="/app" element={<Dashboard />} />

          {[
            { path: "/app/agenda", element: <Agenda /> },
            { path: "/app/lista-espera", element: <Waitlist /> },
            { path: "/app/alertas", element: <Alerts /> },
            { path: "/app/clientes", element: <Clients /> },
            { path: "/app/clientes/:clientId", element: <ClientDetail /> },
            { path: "/app/historico", element: <TreatmentHistory /> },
            { path: "/app/fichas", element: <Navigate to="/app/historico" replace /> },
            { path: "/app/retornos", element: <Retention /> },
            { path: "/app/fidelidade", element: <Navigate to="/app/retornos" replace /> },
            { path: "/app/servicos", element: <Services /> },
            { path: "/app/pacotes", element: <Packages /> },
            { path: "/app/orcamentos", element: <Quotes /> },
            { path: "/app/formularios", element: <Navigate to="/app/clientes" replace /> },
            { path: "/app/recomendacoes", element: <Navigate to="/app/servicos" replace /> },
            { path: "/app/fotos", element: <Navigate to="/app/clientes" replace /> },
            { path: "/app/profissionais", element: <Staff /> },
            { path: "/app/disponibilidade", element: <Navigate to="/app/profissionais" replace /> },
            { path: "/app/comissoes", element: <Commissions /> },
            { path: "/app/desempenho", element: <Performance /> },
            { path: "/app/faturas", element: <Billing /> },
            { path: "/app/pagamentos", element: <Navigate to="/app/faturas?aba=pagamentos" replace /> },
            { path: "/app/despesas", element: <Expenses /> },
            { path: "/app/caixa", element: <Cashflow /> },
            { path: "/app/produtos", element: <Inventory /> },
            { path: "/app/movimentacoes", element: <Navigate to="/app/produtos?aba=movimentacoes" replace /> },
            { path: "/app/fornecedores", element: <Suppliers /> },
            { path: "/app/estoque-alertas", element: <StockAlerts /> },
            { path: "/app/reagendamentos", element: <Retention /> },
            { path: "/app/campanhas", element: <Campaigns /> },
            { path: "/app/aniversarios", element: <Birthdays /> },
            { path: "/app/cartoes-presente", element: <GiftCards /> },
            { path: "/app/relatorios", element: <Reports /> },
            { path: "/app/configuracoes", element: <Settings /> },
            { path: "/app/auditoria", element: <Audit /> },
          ].map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
