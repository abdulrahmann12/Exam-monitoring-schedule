import type { ISOInstant, UUID } from "./api";

/** A sign-in option configured on the server ("microsoft", "google"). */
export interface SsoProvider {
  id: string;
  name: string;
}

/** A Microsoft / Google account connected to the signed-in account. */
export interface SsoConnection {
  id: UUID;
  provider: string;
  name: string;
  email: string | null;
  connectedAt: ISOInstant;
  lastUsedAt: ISOInstant | null;
}

/** The university's own Microsoft organisation (tenant id); null when not set. */
export interface UniversitySso {
  microsoftTenantId: string | null;
}
