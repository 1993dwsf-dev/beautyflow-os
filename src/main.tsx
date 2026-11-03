import { Toaster } from "@/components/ui/sonner";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { AppRoutes } from "./routes";
import "./index.css";

class RootErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <main className="p-8 text-center"><h1>Não foi possível carregar o BeautyFlow OS.</h1><p>Tente atualizar a página. Se continuar, fale com o suporte.</p><button onClick={() => window.location.reload()}>Atualizar</button></main> : this.props.children; }
}
const url = import.meta.env.VITE_CONVEX_URL;
const root = createRoot(document.getElementById("root")!);
if (!url) {
  root.render(<main className="p-8 text-center">BeautyFlow OS: configuração de acesso pendente. Entre em contato com o suporte.</main>);
} else {
  const convex = new ConvexReactClient(url);
  root.render(<StrictMode><RootErrorBoundary><ConvexAuthProvider client={convex}><BrowserRouter><AppRoutes /></BrowserRouter><Toaster /></ConvexAuthProvider></RootErrorBoundary></StrictMode>);
}
