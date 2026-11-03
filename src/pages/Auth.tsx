import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import logo from "@/assets/logo.svg";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

export default function AuthPage({ redirectAfterAuth = "/app" }: { redirectAfterAuth?: string }) {
  const { signIn, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (!isLoading && isAuthenticated) navigate(redirectAfterAuth, { replace: true }); }, [isAuthenticated, isLoading, navigate, redirectAfterAuth]);
  return <main className="glass-scene min-h-screen flex items-center justify-center p-4">
    <section className="glass-strong w-full max-w-md rounded-2xl border p-6">
      <Link to="/"><img src={logo} alt="BeautyFlow OS" className="mx-auto mb-5 size-14" /></Link>
      <h1 className="text-center text-2xl font-semibold">{flow === "signIn" ? "Entrar no BeautyFlow OS" : "Criar sua conta"}</h1>
      <p className="text-center text-sm text-muted-foreground mt-2 mb-6">Acesse com seu e-mail e senha.</p>
      <form className="space-y-4" onSubmit={async e => {
        e.preventDefault(); setBusy(true); setError("");
        const data = new FormData(e.currentTarget); data.set("flow", flow);
        try { await signIn("password", data); }
        catch { setError(flow === "signIn" ? "Não foi possível entrar. Confira o e-mail e a senha e tente novamente." : "Não foi possível criar a conta. Use uma senha de 8 a 128 caracteres ou entre se já tiver cadastro."); }
        finally { setBusy(false); }
      }}>
        <label className="block text-sm">E-mail<Input name="email" type="email" autoComplete="email" maxLength={254} required disabled={busy} /></label>
        <label className="block text-sm">Senha<Input name="password" type="password" autoComplete={flow === "signIn" ? "current-password" : "new-password"} minLength={flow === "signUp" ? 8 : undefined} maxLength={128} required disabled={busy} /></label>
        {flow === "signUp" && <p className="text-xs text-muted-foreground">Use pelo menos 8 caracteres. Guarde sua senha: o MVP não envia e-mails de recuperação.</p>}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Aguarde..." : flow === "signIn" ? "Entrar" : "Criar conta"}</Button>
      </form>
      <Button variant="ghost" className="w-full mt-3" disabled={busy} onClick={() => { setFlow(flow === "signIn" ? "signUp" : "signIn"); setError(""); }}>{flow === "signIn" ? "Criar uma conta" : "Já tenho conta"}</Button>
    </section>
  </main>;
}
