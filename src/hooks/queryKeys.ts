export const queryKeys = {
  users: {
    all: ["users"] as const,
  },
  reports: {
    workload: (groupId: string) => ["reports", "workload", groupId] as const,
    analytics: (groupId: string) => ["reports", "analytics", groupId] as const,
  },
  emails: {
    all: ["emails"] as const,
    counts: ["emails", "counts"] as const,
    log: (page: number, status?: string) => ["emails", "log", page, status ?? "all"] as const,
  },
  sso: {
    providers: ["sso", "providers"] as const,
    connections: ["sso", "connections"] as const,
    university: ["sso", "university"] as const,
  },
  twoFactor: {
    status: ["twoFactor", "status"] as const,
  },
  owner: {
    all: ["owner"] as const,
    overview: ["owner", "overview"] as const,
    activity: ["owner", "activity"] as const,
  },
  auth: {
    all: ["auth"] as const,
    session: (token?: string | null) => ["auth", "session", token ?? null] as const,
  },
  people: {
    all: ["people"] as const,
    list: (params?: unknown) => ["people", "list", params ?? null] as const,
  },
  roomCategories: {
    all: ["room-categories"] as const,
  },
  rooms: {
    all: ["rooms"] as const,
    list: (params?: unknown) => ["rooms", "list", params ?? null] as const,
  },
  timeSlots: {
    all: ["time-slots"] as const,
    list: (params?: unknown) => ["time-slots", "list", params ?? null] as const,
  },
  assignments: {
    all: ["assignments"] as const,
    list: (params?: unknown) => ["assignments", "list", params ?? null] as const,
  },
  settings: {
    all: ["settings"] as const,
    detail: () => ["settings", "detail"] as const,
  },
  scheduleGroups: {
    all: ["schedule-groups"] as const,
    list: (params?: unknown) => ["schedule-groups", "list", params ?? null] as const,
  },
};