/**
 * Shared glass-morphism presentation primitives.
 * Every module screen is built from these so spacing, blur and hierarchy stay
 * consistent across the whole product.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Inbox, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export function GlassCard({
  children,
  className,
  padded = true,
  strong = false,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        strong ? "glass-strong" : "glass",
        "rounded-2xl",
        padded && "p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-primary/80">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight sm:text-[1.7rem]">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const TONES: Record<string, string> = {
  primary: "text-primary",
  positive: "text-emerald-600",
  warning: "text-amber-600",
  negative: "text-rose-600",
  neutral: "text-foreground",
  info: "text-indigo-600",
};

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
  onClick,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: keyof typeof TONES;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "glass glass-hover w-full rounded-2xl p-4 text-left disabled:cursor-default",
        onClick && "cursor-pointer",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {icon && (
          <span className={cn("opacity-80", TONES[tone])}>{icon}</span>
        )}
      </div>
      <p className={cn("mt-2 text-2xl font-semibold tabular-nums", TONES[tone])}>
        {value}
      </p>
      {hint && (
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p>
      )}
    </button>
  );
}

export function SectionTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function StatusPill({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.7rem] font-medium",
        className ?? "border-border/70 bg-white/70 text-foreground",
      )}
    >
      {label}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="glass-inset flex flex-col items-center rounded-2xl px-6 py-10 text-center">
      <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-white/70 text-primary">
        {icon ?? <Inbox className="size-5" />}
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description && (
        <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingBlock({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-xl" />
      ))}
    </div>
  );
}

export type Column<T> = {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
};

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  empty,
  keyOf,
  onRowClick,
  dense = false,
}: {
  columns: Column<T>[];
  rows: T[];
  empty?: ReactNode;
  keyOf: (row: T) => string;
  onRowClick?: (row: T) => void;
  dense?: boolean;
}) {
  if (!rows.length) {
    return (
      <>{empty ?? <EmptyState title="Nenhum registro encontrado" />}</>
    );
  }
  return (
    <div className="glass-inset scroll-thin overflow-x-auto rounded-2xl">
      <table className="w-full min-w-[46rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-white/60">
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  "px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground",
                  column.align === "right" && "text-right",
                  column.align === "center" && "text-center",
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={keyOf(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                "border-b border-white/40 transition-colors last:border-0",
                onRowClick && "cursor-pointer hover:bg-white/60",
              )}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    dense ? "px-4 py-2" : "px-4 py-3",
                    "align-middle",
                    column.align === "right" && "text-right tabular-nums",
                    column.align === "center" && "text-center",
                    column.className,
                  )}
                >
                  {column.render
                    ? column.render(row)
                    : String(row[column.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
  error,
  className,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string | null;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs font-medium text-foreground/80">{label}</Label>
      {children}
      {hint && !error && (
        <p className="text-[0.7rem] leading-4 text-muted-foreground">{hint}</p>
      )}
      {error && <p className="text-[0.7rem] leading-4 text-rose-600">{error}</p>}
    </div>
  );
}

export function MoneyInput({
  value,
  onChange,
  placeholder = "0,00",
  disabled,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
        R$
      </span>
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => {
          const raw = event.target.value.replace(/[^\d.,]/g, "");
          onChange(raw);
        }}
        className="pl-9"
      />
    </div>
  );
}

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  submitLabel = "Salvar",
  loading,
  error,
  size = "md",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  onSubmit: () => void | Promise<void>;
  submitLabel?: string;
  loading?: boolean;
  error?: string | null;
  size?: "md" | "lg" | "xl";
}) {
  const width =
    size === "xl"
      ? "sm:max-w-3xl"
      : size === "lg"
        ? "sm:max-w-2xl"
        : "sm:max-w-lg";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("glass-strong border-white/70", width)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            await onSubmit();
          }}
          className="space-y-4"
        >
          <div className="scroll-thin max-h-[62vh] space-y-4 overflow-y-auto pr-1">
            {children}
          </div>
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/80 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  onConfirm,
  destructive = true,
  loading,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  destructive?: boolean;
  loading?: boolean;
  children?: ReactNode;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="glass-strong border-white/70">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <AlertDialogAction
            onClick={async (event) => {
              event.preventDefault();
              await onConfirm();
            }}
            disabled={loading}
            className={cn(
              destructive &&
                "bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-400",
            )}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function InfoBanner({
  children,
  tone = "info",
  className,
}: {
  children: ReactNode;
  tone?: "info" | "warning" | "success" | "danger";
  className?: string;
}) {
  const tones = {
    info: "border-sky-200/80 bg-sky-50/70 text-sky-900",
    warning: "border-amber-200/80 bg-amber-50/70 text-amber-900",
    success: "border-emerald-200/80 bg-emerald-50/70 text-emerald-900",
    danger: "border-rose-200/80 bg-rose-50/70 text-rose-900",
  };
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 text-xs leading-5",
        tones[tone],
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "primary" | "positive" | "warning" | "negative";
}) {
  const tones = {
    neutral: "",
    primary: "border-primary/30 bg-primary/10 text-primary",
    positive: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    negative: "border-rose-200 bg-rose-50 text-rose-700",
  };
  return <Badge className={cn("border", tones[tone])} variant="outline">{children}</Badge>;
}
