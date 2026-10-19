import { BrandMark } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/glass";
import { motion } from "framer-motion";
import { ArrowLeft, Compass } from "lucide-react";
import { Link } from "react-router";

export default function NotFound() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="glass-scene flex min-h-screen flex-col items-center justify-center px-5 py-16"
    >
      <GlassCard strong className="w-full max-w-lg text-center">
        <BrandMark className="mx-auto" />
        <p className="mt-5 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-primary/80">
          Erro 404
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Não encontramos esta página
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          O endereço pode ter sido digitado incorretamente ou a tela foi movida. Você pode
          voltar para o painel do seu espaço de trabalho ou iniciar uma nova busca.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link to="/app">
              <ArrowLeft className="mr-2 size-4" />
              Ir para o painel
            </Link>
          </Button>
          <Button variant="outline" className="glass-soft" asChild>
            <Link to="/">
              <Compass className="mr-2 size-4" />
              Página inicial
            </Link>
          </Button>
        </div>
      </GlassCard>
    </motion.div>
  );
}
