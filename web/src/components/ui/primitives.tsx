import Link from "next/link";
import { cn } from "@/lib/utils";
import { signedPct } from "@/lib/format";
import type { Confidence, FormResult } from "@/lib/types";

export function Card({
  title,
  action,
  className,
  children,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-card border bg-surface p-4 sm:p-5", className)}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="text-sm font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function IconButton({
  label,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-[10px] bg-surface-2 text-muted transition-all duration-200 hover:text-text active:scale-90",
        className,
      )}
      {...props}
    />
  );
}

export function PrimaryLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 rounded-[10px] bg-accent-fill px-4 py-2.5 text-sm font-semibold text-on-accent transition-colors duration-200 hover:bg-accent-dim",
        className,
      )}
    >
      {children}
    </Link>
  );
}

const CONFIDENCE_STYLE: Record<Confidence, string> = {
  high: "bg-positive/15 text-positive",
  medium: "bg-warning/15 text-warning",
  low: "bg-surface-2 text-muted",
};

export function ConfidenceBadge({ level }: { level: Confidence }) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", CONFIDENCE_STYLE[level])}>
      {level}
    </span>
  );
}

/** EV as a signed percentage; green when positive. Sign is always shown so colour isn't the only cue. */
export function EvText({ ev, className }: { ev: number; className?: string }) {
  return (
    <span className={cn("tabular font-semibold", ev > 0 ? "text-positive" : "text-negative-text", className)}>
      {signedPct(ev)}
    </span>
  );
}

export function ValuePill() {
  return (
    <span className="inline-flex rounded-full bg-positive/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-positive">
      VALUE
    </span>
  );
}

export function OddsPill({ label, odds, highlight }: { label: string; odds: string; highlight?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-14 flex-col items-center rounded-xl px-2 py-1",
        highlight ? "bg-accent/15 ring-1 ring-accent" : "bg-surface-2",
      )}
    >
      <span className="text-[10px] text-muted">{label}</span>
      <span className="tabular text-sm font-semibold">{odds}</span>
    </span>
  );
}

const FORM_STYLE: Record<FormResult, string> = {
  W: "bg-positive text-black",
  D: "bg-surface-2 text-text",
  L: "bg-negative text-white",
};

export function FormPills({ form }: { form: FormResult[] }) {
  return (
    <span className="flex gap-1" aria-label={`Last ${form.length} results: ${form.join(", ")}`}>
      {form.map((r, i) => (
        <span key={i} className={cn("grid size-6 place-items-center rounded-md text-xs font-bold", FORM_STYLE[r])}>
          {r}
        </span>
      ))}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  highlight,
  children,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  highlight?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-card border p-4",
        highlight ? "border-transparent bg-gradient-cta text-on-accent" : "bg-surface",
      )}
    >
      <div className={cn("text-sm", highlight ? "text-on-accent/75" : "text-muted")}>{label}</div>
      <div className="tabular mt-1 text-[28px] font-semibold tracking-[-0.02em]">{value}</div>
      {hint && <div className={cn("mt-1 text-xs", highlight ? "text-on-accent/75" : "text-muted")}>{hint}</div>}
      {children}
    </div>
  );
}

/** Horizontal bar for a model factor; positive impact pushes toward the pick. */
export function FactorBar({ feature, impact, max }: { feature: string; impact: number; max: number }) {
  const width = `${(Math.abs(impact) / max) * 100}%`;
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span>{feature}</span>
        <span className={cn("tabular", impact >= 0 ? "text-positive" : "text-negative-text")}>
          {impact >= 0 ? "+" : "−"}
          {Math.abs(impact).toFixed(2)}
        </span>
      </div>
      <div className="h-2 rounded-full bg-surface-2">
        <div className={cn("h-full origin-left animate-grow-x rounded-full", impact >= 0 ? "bg-positive" : "bg-negative")} style={{ width }} />
      </div>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="animate-fade-in rounded-card border border-dashed px-6 py-10 text-center">
      <div className="font-medium">{title}</div>
      {hint && <div className="mt-1 text-sm text-muted">{hint}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-xl", className)} />;
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-200",
        active ? "border-line-strong bg-line-strong text-text" : "border-transparent bg-surface-2 text-muted hover:text-text",
      )}
    >
      {children}
    </button>
  );
}
