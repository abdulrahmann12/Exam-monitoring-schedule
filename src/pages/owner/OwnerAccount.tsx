import { ArrowDown, Check, Crown, PencilLine, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChangeEmailDialog } from "@/components/uniguard/ChangeEmailDialog";
import { ChangePasswordCard } from "@/components/uniguard/ChangePasswordCard";
import { ConnectedAccountsCard } from "@/components/uniguard/ConnectedAccountsCard";
import { TwoFactorCard } from "@/components/uniguard/TwoFactorCard";
import { useUpdateProfileMutation } from "@/hooks";
import { cn } from "@/lib/utils";
import { useAuth } from "@/state/auth";
import { showErrorToast } from "@/utils/error";

import { PageHeader } from "./OwnerUi";

export default function OwnerAccount() {
  const { user } = useAuth();
  const email = user?.email ?? "";
  const name = user?.displayName || "Platform owner";
  const twoFactorOn = Boolean(user?.twoFactorEnabled);
  const [changingEmail, setChangingEmail] = useState(false);

  function goToTwoFactor() {
    document.getElementById("two-factor-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Account & security" description="The owner account controls every university. Keep it protected." />

      <section className="rounded-2xl border border-border bg-card shadow-card">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-hero font-display text-xl font-bold text-primary-foreground shadow-sm">
            {(name || email || "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <EditableName current={user?.displayName ?? ""} fallback={name} />
            <div className="flex flex-wrap items-center gap-x-2">
              <p className="truncate text-sm text-muted-foreground">{email}</p>
              <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setChangingEmail(true)}>
                Change email
              </button>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "flex flex-col gap-3 border-t px-5 py-3.5 sm:flex-row sm:items-center sm:px-6",
            twoFactorOn ? "border-border" : "border-warning/20 bg-warning/5",
          )}
        >
          <div className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", twoFactorOn ? "bg-success/10 text-success" : "bg-warning/15 text-warning")}>
            {twoFactorOn ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
          </div>
          <div className="min-w-0 flex-1 text-sm">
            <span className="font-medium">{twoFactorOn ? "Two-step sign-in is on" : "Two-step sign-in is off"}</span>
            <span className="text-muted-foreground">
              {twoFactorOn ? " · Your account is protected by your authenticator app." : " · A stolen password alone could control every university."}
            </span>
          </div>
          {!twoFactorOn && (
            <Button size="sm" className="gap-1.5 self-start sm:self-auto" onClick={goToTwoFactor}>
              Set up now <ArrowDown className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div id="two-factor-card" className="scroll-mt-24">
          <TwoFactorCard />
        </div>
        <ChangePasswordCard showSignOutEverywhere />
        <div className="lg:col-span-2">
          <ConnectedAccountsCard returnPath="/owner" />
        </div>
      </div>

      {changingEmail && <ChangeEmailDialog currentEmail={email} onClose={() => setChangingEmail(false)} />}
    </div>
  );
}

const NAME_MAX = 120;

/** The owner's own name: shown with a pencil, edited in place. */
function EditableName({ current, fallback }: { current: string; fallback: string }) {
  const mutation = useUpdateProfileMutation();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current);
  const trimmed = value.trim().replace(/\s+/g, " ");
  const canSave = trimmed.length > 0 && trimmed.length <= NAME_MAX && trimmed !== current && !mutation.isPending;

  async function save() {
    try {
      await mutation.mutateAsync(trimmed);
      toast.success("Name updated.");
      setEditing(false);
    } catch (error) {
      showErrorToast(error, { title: "Could not change the name." });
    }
  }

  if (editing) {
    return (
      <form
        className="flex max-w-md items-center gap-2"
        onSubmit={(event) => { event.preventDefault(); if (canSave) void save(); }}
      >
        <Input
          value={value}
          maxLength={NAME_MAX}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Escape") setEditing(false); }}
          placeholder="Your name"
          aria-label="Your name"
          className="h-9"
          autoFocus
        />
        <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={!canSave} aria-label="Save name">
          <Check className="h-4 w-4" />
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={() => setEditing(false)} aria-label="Cancel">
          <X className="h-4 w-4" />
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="truncate text-lg font-semibold">{fallback}</h2>
      <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
        <Crown className="h-3 w-3" /> Owner
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 px-2 text-xs text-muted-foreground"
        onClick={() => { setValue(current); setEditing(true); }}
      >
        <PencilLine className="h-3.5 w-3.5" /> Edit name
      </Button>
    </div>
  );
}
