import { Building, Info, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSsoProvidersQuery, useUniversitySsoQuery, useUpdateUniversitySsoMutation } from "@/hooks/useSso";
import { showErrorToast } from "@/utils/error";

const TENANT_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Administrators: the university's own Microsoft organisation. Its staff can then sign in with
 * Microsoft straight away (matched by email); without it, each person connects their account first.
 */
export function UniversitySsoCard() {
  const providersQuery = useSsoProvidersQuery();
  const microsoftOffered = (providersQuery.data ?? []).some((provider) => provider.id === "microsoft");
  const query = useUniversitySsoQuery(microsoftOffered);
  const mutation = useUpdateUniversitySsoMutation();
  const [tenant, setTenant] = useState("");

  useEffect(() => {
    setTenant(query.data?.microsoftTenantId ?? "");
  }, [query.data]);

  if (providersQuery.isLoading) {
    return (
      <section className="flex items-center gap-2 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-card">
        <LoaderCircle className="h-4 w-4 animate-spin" /> Checking which sign-in options this server offers…
      </section>
    );
  }

  if (!microsoftOffered) {
    // Nothing to set here yet: the server itself has no Microsoft app registered.
    return (
      <section className="space-y-3 rounded-xl border border-border bg-card p-6 shadow-card">
        <h3 className="text-display flex items-center gap-2 text-lg font-semibold"><Building className="h-4 w-4" /> Sign-in with Microsoft</h3>
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="space-y-1.5">
            <p className="font-medium">Not switched on for this server yet.</p>
            <p className="text-muted-foreground">
              The server administrator first registers the app with Microsoft and adds its keys to the server settings
              (MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET). After a restart, this page lets you connect your university's
              Microsoft organisation, so your staff can sign in with their university account.
            </p>
            <p className="text-muted-foreground">Until then, everyone signs in with their email and password{providersQuery.data?.some((provider) => provider.id === "google") ? " (or with Google, if they connected it)" : ""}.</p>
          </div>
        </div>
      </section>
    );
  }
  const trimmed = tenant.trim();
  const invalid = trimmed.length > 0 && !TENANT_PATTERN.test(trimmed);
  const unchanged = trimmed.toLowerCase() === (query.data?.microsoftTenantId ?? "");

  async function save() {
    try {
      await mutation.mutateAsync({ microsoftTenantId: trimmed || null });
      toast.success(trimmed ? "Microsoft organisation saved." : "Microsoft organisation removed.");
    } catch (error) {
      showErrorToast(error, { title: "Could not save." });
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-card">
      <header>
        <h3 className="text-display flex items-center gap-2 text-lg font-semibold"><Building className="h-4 w-4" /> Sign-in with Microsoft for your university</h3>
        <p className="text-sm text-muted-foreground">
          Enter your organisation's Microsoft tenant id (Microsoft Entra admin center &gt; Overview). Your staff can then sign in with
          their university Microsoft account straight away, matched by email. Leave it empty to require each person to connect their account first.
        </p>
      </header>
      <div className="space-y-1">
        <Label htmlFor="ms-tenant">Microsoft tenant id</Label>
        <Input id="ms-tenant" className="font-mono text-xs" placeholder="00000000-0000-0000-0000-000000000000" value={tenant} maxLength={36}
          onChange={(event) => setTenant(event.target.value)} />
        {invalid && <p className="text-xs text-destructive">A tenant id looks like 72f988bf-86f1-41af-91ab-2d7cd011db47.</p>}
      </div>
      <Button disabled={invalid || unchanged || mutation.isPending || query.isLoading} onClick={() => void save()}>
        {mutation.isPending ? "Saving..." : "Save"}
      </Button>
    </section>
  );
}
