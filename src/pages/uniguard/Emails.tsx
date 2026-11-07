import { MailCheck, MailWarning, RefreshCw, RotateCw, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { EmailKind, EmailLogEntry, EmailStatus } from "@/api";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/PageState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/uniguard/AppLayout";
import { useEmailCountsQuery, useEmailLogQuery, useRetryAllFailedEmailsMutation, useRetryEmailMutation } from "@/hooks/useEmailOutbox";
import { getErrorMessage, showErrorToast } from "@/utils/error";

const SUBTITLE = "Every email the app sends: queued, sent, or failed and why. Emails are sent in the background and retried automatically.";

const FILTERS: Array<{ value: string | undefined; label: string }> = [
  { value: undefined, label: "All" },
  { value: "QUEUED", label: "Waiting" },
  { value: "SENT", label: "Sent" },
  { value: "FAILED", label: "Failed" },
];

const STATUS_STYLE: Record<EmailStatus, { label: string; className: string }> = {
  QUEUED: { label: "Waiting", className: "border-primary/30 text-primary" },
  SENDING: { label: "Sending", className: "border-primary/30 text-primary" },
  SENT: { label: "Sent", className: "border-success/30 text-success" },
  FAILED: { label: "Failed", className: "border-destructive/30 text-destructive" },
  CANCELLED: { label: "Replaced", className: "text-muted-foreground" },
};

const KIND_LABEL: Record<EmailKind, string> = {
  SCHEDULE: "Schedule",
  INVITE: "Invitation",
  PASSWORD_RESET: "Password reset",
};

function when(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "—";
}

export default function Emails() {
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(0);
  const countsQuery = useEmailCountsQuery();
  const counts = countsQuery.data?.counts ?? {};
  const live = (counts.QUEUED ?? 0) > 0 || (counts.SENDING ?? 0) > 0;
  const logQuery = useEmailLogQuery(page, status, live);
  const retryMutation = useRetryEmailMutation();
  const retryAllMutation = useRetryAllFailedEmailsMutation();

  async function retry(entry: EmailLogEntry) {
    try {
      await retryMutation.mutateAsync(entry.id);
      toast.success(`The email to ${entry.recipient} will be sent again.`);
    } catch (error) {
      showErrorToast(error, { title: "Could not send it again." });
    }
  }

  function actionFor(entry: EmailLogEntry) {
    if (entry.status !== "FAILED") return null;
    if (entry.kind === "SCHEDULE") {
      return (
        <Button size="sm" variant="outline" className="gap-1" disabled={retryMutation.isPending} onClick={() => void retry(entry)}>
          <RotateCw className="h-3.5 w-3.5" /> Send again
        </Button>
      );
    }
    return <span className="text-xs text-muted-foreground">Send a new {entry.kind === "INVITE" ? "invitation" : "reset"} from Users</span>;
  }

  async function retryAll() {
    try {
      const result = await retryAllMutation.mutateAsync();
      toast.success(result.queued > 0 ? `${result.queued} failed email(s) will be sent again.` : "No failed schedule emails to send again.");
    } catch (error) {
      showErrorToast(error, { title: "Could not send them again." });
    }
  }

  const actions = (
    <div className="flex gap-2">
      <Button variant="outline" className="gap-2" onClick={() => { void countsQuery.refetch(); void logQuery.refetch(); }}>
        <RefreshCw className="h-4 w-4" /> Refresh
      </Button>
      {(counts.FAILED ?? 0) > 0 && (
        <Button className="gap-2" disabled={retryAllMutation.isPending} onClick={() => void retryAll()}>
          <RotateCw className="h-4 w-4" /> Send failed again
        </Button>
      )}
    </div>
  );

  return (
    <AppLayout title="Emails" subtitle={SUBTITLE} actions={actions}>
      <section className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Totals">
        <Tile label="Waiting" value={(counts.QUEUED ?? 0) + (counts.SENDING ?? 0)} icon={<Send className="h-4 w-4" />} hint={live ? "Sending now..." : undefined} />
        <Tile label="Sent" value={counts.SENT ?? 0} icon={<MailCheck className="h-4 w-4 text-success" />} />
        <Tile label="Failed" value={counts.FAILED ?? 0} icon={<MailWarning className="h-4 w-4 text-destructive" />} />
        <Tile label="Replaced by a newer version" value={counts.CANCELLED ?? 0} icon={<RotateCw className="h-4 w-4 text-muted-foreground" />} />
      </section>

      <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Filter by status">
        {FILTERS.map((filter) => (
          <Button key={filter.label} size="sm" variant={status === filter.value ? "default" : "outline"} role="tab" aria-selected={status === filter.value}
            onClick={() => { setStatus(filter.value); setPage(0); }}>
            {filter.label}
          </Button>
        ))}
      </div>

      {logQuery.isLoading ? (
        <LoadingState title="Loading emails..." />
      ) : logQuery.isError ? (
        <ErrorState description={getErrorMessage(logQuery.error)} onRetry={() => void logQuery.refetch()} />
      ) : (logQuery.data?.items.length ?? 0) === 0 ? (
        <EmptyState title="No emails yet" description="Emails appear here when you send schedules to staff or invite users." />
      ) : (
        <>
        <div className="hidden overflow-x-auto rounded-xl border border-border bg-card shadow-card md:block">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">To</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Queued</th>
                <th className="px-4 py-3 font-medium">Sent</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {logQuery.data?.items.map((entry) => {
                const style = STATUS_STYLE[entry.status] ?? STATUS_STYLE.QUEUED;
                return (
                  <tr key={entry.id} className="border-t border-border align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium">{entry.recipientName ?? entry.recipient}</div>
                      {entry.recipientName && <div className="text-xs text-muted-foreground">{entry.recipient}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div>{KIND_LABEL[entry.kind] ?? entry.kind}</div>
                      <div className="max-w-[280px] truncate text-xs text-muted-foreground" title={entry.subject}>{entry.subject}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={style.className}>{style.label}</Badge>
                      {entry.attempts > 1 && <div className="mt-1 text-xs text-muted-foreground">{entry.attempts} attempts</div>}
                      {entry.status === "QUEUED" && entry.attempts > 0 && entry.nextAttemptAt && (
                        <div className="text-xs text-muted-foreground">next try {when(entry.nextAttemptAt)}</div>
                      )}
                      {entry.lastError && entry.status !== "SENT" && (
                        <div className="mt-1 max-w-[320px] text-xs text-destructive" title={entry.lastError}>{entry.lastError}</div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{when(entry.createdAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{when(entry.sentAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {actionFor(entry)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Phones: one card per email. */}
        <ul className="space-y-3 md:hidden" aria-label="Emails">
          {logQuery.data?.items.map((entry) => {
            const style = STATUS_STYLE[entry.status] ?? STATUS_STYLE.QUEUED;
            const name = entry.recipientName ?? entry.recipient;
            const action = actionFor(entry);
            return (
              <li key={entry.id} className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-card">
                <div className="flex items-start gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{name}</div>
                    {entry.recipientName && <div className="truncate text-xs text-muted-foreground">{entry.recipient}</div>}
                  </div>
                  <Badge variant="outline" className={`shrink-0 ${style.className}`}>{style.label}</Badge>
                </div>

                <div className="rounded-lg bg-muted/50 px-3 py-2">
                  <div className="text-xs font-medium">{KIND_LABEL[entry.kind] ?? entry.kind}</div>
                  <div className="line-clamp-2 text-xs text-muted-foreground">{entry.subject}</div>
                </div>

                {entry.lastError && entry.status !== "SENT" && (
                  <div className="flex gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    <MailWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 [overflow-wrap:anywhere]">{entry.lastError}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground">
                    {entry.sentAt ? `Sent ${when(entry.sentAt)}` : `Queued ${when(entry.createdAt)}`}
                    {entry.attempts > 1 && ` · ${entry.attempts} attempts`}
                    {entry.status === "QUEUED" && entry.attempts > 0 && entry.nextAttemptAt && ` · next try ${when(entry.nextAttemptAt)}`}
                  </div>
                  {action}
                </div>
              </li>
            );
          })}
        </ul>
        </>
      )}

      {(logQuery.data?.totalPages ?? 0) > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-sm">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="text-muted-foreground">Page {page + 1} of {logQuery.data?.totalPages}</span>
          <Button size="sm" variant="outline" disabled={page + 1 >= (logQuery.data?.totalPages ?? 1)} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
    </AppLayout>
  );
}

function Tile({ label, value, icon, hint }: { label: string; value: number; icon: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between text-xs text-muted-foreground">{label}{icon}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value.toLocaleString()}</div>
      {hint && <div className="text-xs text-primary">{hint}</div>}
    </div>
  );
}
