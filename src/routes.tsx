import { AppProvider, useApp } from "@/components/app-context";
import { AppShell } from "@/components/AppShell";
import { LoadingBlock } from "@/components/glass";
import { RequireAuth } from "@/components/RequireAuth";
import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";

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
const Aftercare = lazy(() =>
  import("./pages/Catalog.tsx").then((module) => ({ default: module.Aftercare })),
);
const Staff = lazy(() =>
  import("./pages/Team.tsx").then((module) => ({ default: module.Staff })),
);
const Availability = lazy(() =>
  import("./pages/Team.tsx").then((module) => ({ default: module.Availability })),
);
const Performance = lazy(() =>
  import("./pages/Team.tsx").then((module) => ({ default: module.Performance })),
);
const Commissions = lazy(() =>
  import("./pages/Team.tsx").then((module) => ({ default: module.Commissions })),
);
const Invoices = lazy(() =>
  import("./pages/Finance.tsx").then((module) => ({ default: module.Invoices })),
);
const Payments = lazy(() =>
  import("./pages/Finance.tsx").then((module) => ({ default: module.Payments })),
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
const Products = lazy(() =>
  import("./pages/Inventory.tsx").then((module) => ({ default: module.Products })),
);
const Movements = lazy(() =>
  import("./pages/Inventory.tsx").then((module) => ({ default: module.Movements })),
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
const PatientRecords = lazy(() =>
  import("./pages/CRM.tsx").then((module) => ({ default: module.PatientRecords })),
);
const Forms = lazy(() =>
  import("./pages/CRM.tsx").then((module) => ({ default: module.Forms })),
);
const Photos = lazy(() =>
  import("./pages/CRM.tsx").then((module) => ({ default: module.Photos })),
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
const Loyalty = lazy(() =>
  import("./pages/Retention.tsx").then((module) => ({ default: module.Loyalty })),
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

        <Route
          path="/app"
          element={
            <RequireAuth redirectImmediately title="Entre para acessar o BeautyFlow OS">
              <AppProvider>
                <AppWorkspace>
                  <Dashboard />
                </AppWorkspace>
              </AppProvider>
            </RequireAuth>
          }
        />

        {[
          { path: "/app/agenda", element: <Agenda /> },
          { path: "/app/lista-espera", element: <Waitlist /> },
          { path: "/app/alertas", element: <Alerts /> },
          { path: "/app/clientes", element: <Clients /> },
          { path: "/app/clientes/:clientId", element: <ClientDetail /> },
          { path: "/app/historico", element: <TreatmentHistory /> },
          { path: "/app/fichas", element: <PatientRecords /> },
          { path: "/app/retornos", element: <Retention /> },
          { path: "/app/fidelidade", element: <Loyalty /> },
          { path: "/app/servicos", element: <Services /> },
          { path: "/app/pacotes", element: <Packages /> },
          { path: "/app/orcamentos", element: <Quotes /> },
          { path: "/app/formularios", element: <Forms /> },
          { path: "/app/recomendacoes", element: <Aftercare /> },
          { path: "/app/fotos", element: <Photos /> },
          { path: "/app/profissionais", element: <Staff /> },
          { path: "/app/disponibilidade", element: <Availability /> },
          { path: "/app/comissoes", element: <Commissions /> },
          { path: "/app/desempenho", element: <Performance /> },
          { path: "/app/faturas", element: <Invoices /> },
          { path: "/app/pagamentos", element: <Payments /> },
          { path: "/app/despesas", element: <Expenses /> },
          { path: "/app/caixa", element: <Cashflow /> },
          { path: "/app/produtos", element: <Products /> },
          { path: "/app/movimentacoes", element: <Movements /> },
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
          <Route
            key={route.path}
            path={route.path}
            element={<AppWorkspace>{route.element}</AppWorkspace>}
          />
        ))}

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
