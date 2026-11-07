import { Link2, Unlink } from "lucide-react";
import { AccountUsernameHint } from "@/components/uniguard/AccountUsernameHint";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import type { SsoConnection } from "@/api";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDisconnectSsoMutation, useLinkSsoMutation, useSsoConnectionsQuery, useSsoProvidersQuery } from "@/hooks/useSso";
import { ssoErrorMessage } from "@/lib/sso/messages";
import { showErrorToast } from "@/utils/error";

/** Connect a Microsoft or Google account to sign in with it. Hidden when the server offers neither. */
export function ConnectedAccountsCard({ returnPath = "/settings" }: { returnPath?: "/settings" | "/owner" }) {
  const providersQuery = useSsoProvidersQuery();
  const connectionsQuery = useSsoConnectionsQuery();
  const [searchParams, setSearchParams] = useSearchParams();
  const [connecting, setConnecting] = useState<{ id: string; name: string } | null>(null);
  const [disconnecting, setDisconnecting] = useState<SsoConnection | null>(null);

  // Result of coming back from Microsoft / Google: show it once, then clean the address bar.
  useEffect(() => {
    const linked = searchParams.get("sso");
    const error = searchParams.get("sso_error");
    if (!linked && !error) {
      return;
    }
    if (linked === "linked") {
      toast.success("Account connected. You can now sign in with it.");
    } else if (error) {
      toast.error(ssoErrorMessage(error));
    }
    const next = new URLSearchParams(searchParams);
    next.delete("sso");
    next.delete("sso_error");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const providers = providersQuery.data ?? [];
  if (providers.length === 0) {
    return null;
  }
  const connections = connectionsQuery.data ?? [];

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-card">
      <header>
        <h3 className="text-display flex items-center gap-2 text-lg font-semibold"><Link2 className="h-4 w-4" /> Connected accounts</h3>
        <p className="text-sm text-muted-foreground">Sign in with your Microsoft or Google account instead of typing your password.</p>
      </header>
      <ul className="space-y-2">
        {providers.map((provider) => {
          const connection = connections.find((item) => item.provider === provider.id);
          return (
            <li key={provider.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
              <div className="text-sm">
                <div className="font-medium">{provider.name}</div>
                <div className="text-xs text-muted-foreground">
                  {connection
                    ? `Connected${connection.email ? ` as ${connection.email}` : ""}${connection.lastUsedAt ? ` · last used ${new Date(connection.lastUsedAt).toLocaleDateString()}` : ""}`
                    : "Not connected"}
                </div>
              </div>
              {connection
                ? <Button size="sm" variant="outline" className="gap-1" onClick={() => setDisconnecting(connection)}><Unlink className="h-3.5 w-3.5" /> Disconnect</Button>
                : <Button size="sm" variant="outline" onClick={() => setConnecting(provider)}>Connect</Button>}
            </li>
          );
        })}
      </ul>
      {connecting && <ConnectDialog provider={connecting} returnPath={returnPath} onClose={() => setConnecting(null)} />}
      {disconnecting && <DisconnectDialog connection={disconnecting} onClose={() => setDisconnecting(null)} />}
    </section>
  );
}

function ConnectDialog({ provider, returnPath, onClose }: { provider: { id: string; name: string }; returnPath: "/settings" | "/owner"; onClose: () => void }) {
  const mutation = useLinkSsoMutation();
  const [password, setPassword] = useState("");

  async function submit() {
    try {
      const { url } = await mutation.mutateAsync({ provider: provider.id, currentPassword: password, returnPath });
      window.location.assign(url); // continues at Microsoft / Google, then comes back here
    } catch (error) {
      showErrorToast(error, { title: `Could not connect ${provider.name}.` });
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect {provider.name}</DialogTitle>
          <DialogDescription>Confirm your password. You will then sign in at {provider.name} and come back here.</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); if (password) void submit(); }}>
          <div className="space-y-1">
            <Label htmlFor="sso-password">Current password</Label>
            <AccountUsernameHint />
            <Input id="sso-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!password || mutation.isPending}>{mutation.isPending ? "Opening..." : `Continue to ${provider.name}`}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DisconnectDialog({ connection, onClose }: { connection: SsoConnection; onClose: () => void }) {
  const mutation = useDisconnectSsoMutation();

  async function confirm() {
    try {
      await mutation.mutateAsync(connection.id);
      toast.success(`${connection.name} disconnected.`);
      onClose();
    } catch (error) {
      showErrorToast(error, { title: "Could not disconnect." });
    }
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Disconnect {connection.name}?</AlertDialogTitle>
          <AlertDialogDescription>You will no longer be able to sign in with this {connection.name} account. Your password keeps working.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={mutation.isPending} onClick={(event) => { event.preventDefault(); void confirm(); }}>Disconnect</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
