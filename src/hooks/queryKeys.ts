export const queryKeys = {
  auth: {
    all: ["auth"] as const,
    session: (token?: string | null) => ["auth", "session", token ?? null] as const,
  },
  people: {
    all: ["people"] as const,
    list: (params?: unknown) => ["people", "list", params ?? null] as const,
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