import { CircleAlert, CircleCheck, CirclePause, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import type { OwnerUniversity, OwnerUniversityAdmin } from "@/api";
import { Skeleton } from "@/components/ui/skeleton";
import { adminStatus, initials, ISSUE_LABELS, type UniversityIssue } from "@/lib/owner/insights";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

const KPI_TONES = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
} as const;

export function KpiCard({ icon: Icon, label, value, hint, tone = "primary" }: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  hint?: ReactNode;
  tone?: keyof typeof KPI_TONES;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elevated">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-2 font-display text-3xl font-bold tabular-nums">{typeof value === "number" ? value.toLocaleString() : value}</p>
        </div>
        <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", KPI_TONES[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {hint ? <div className="mt-2 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

export function KpiSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-8 w-16" />
      <Skeleton className="mt-3 h-3 w-20" />
    </div>
  );
}

const AVATAR_COLORS = [
  "from-blue-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-violet-500 to-purple-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-cyan-500 to-sky-600",
];

export function UniversityAvatar({ university, size = "md" }: { university: Pick<OwnerUniversity, "name" | "slug" | "active">; size?: "sm" | "md" | "lg" }) {
  const hash = [...university.slug].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const sizes = { sm: "h-8 w-8 text-xs rounded-lg", md: "h-10 w-10 text-sm rounded-xl", lg: "h-14 w-14 text-lg rounded-2xl" };
  return (
    <div
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center bg-gradient-to-br font-semibold text-white shadow-sm",
        AVATAR_COLORS[hash % AVATAR_COLORS.length],
        sizes[size],
        !university.active && "opacity-50 grayscale",
      )}
    >
      {initials(university.name)}
    </div>
  );
}

export function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
      <CircleCheck className="h-3 w-3" /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      <CirclePause className="h-3 w-3" /> Switched off
    </span>
  );
}

const ADMIN_STATUS = {
  active: { label: "Active", className: "bg-success/10 text-success" },
  invited: { label: "Invitation sent", className: "bg-primary/10 text-primary" },
  waiting: { label: "Not signed in yet", className: "bg-warning/10 text-warning" },
  disabled: { label: "Disabled", className: "bg-destructive/10 text-destructive" },
} as const;

export function AdminStatusBadge({ admin }: { admin: OwnerUniversityAdmin }) {
  const status = ADMIN_STATUS[adminStatus(admin)];
  return <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", status.className)}>{status.label}</span>;
}

export function IssueChips({ issues, className }: { issues: UniversityIssue[]; className?: string }) {
  if (issues.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {issues.map((issue) => (
        <span key={issue} className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
          <CircleAlert className="h-3 w-3" /> {ISSUE_LABELS[issue]}
        </span>
      ))}
    </div>
  );
}

export function Panel({ title, description, action, children, className }: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card shadow-card", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
