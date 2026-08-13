import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { ScheduleGroup, UUID } from "@/api";
import { useScheduleGroupsQuery } from "@/hooks/useScheduleGroups";
import { useAuth } from "@/state/auth";

const STORAGE_KEY = "uniguard.activeScheduleGroupId";

interface ScheduleGroupContextValue {
  groups: ScheduleGroup[];
  activeGroup: ScheduleGroup | null;
  activeGroupId: UUID | null;
  isLoading: boolean;
  error: unknown;
  refetch: () => Promise<unknown>;
  setActiveGroupId: (id: UUID) => void;
}

const ScheduleGroupContext = createContext<ScheduleGroupContextValue | null>(null);

function readStoredGroupId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredGroupId(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function ScheduleGroupProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const groupsQuery = useScheduleGroupsQuery(undefined, { enabled: isAuthenticated });
  const [activeGroupId, setActiveGroupIdState] = useState<UUID | null>(() => readStoredGroupId());

  const groups = useMemo(
    () => (isAuthenticated ? groupsQuery.data?.items ?? [] : []),
    [groupsQuery.data?.items, isAuthenticated],
  );

  useEffect(() => {
    if (!isAuthenticated || groups.length === 0) {
      return;
    }

    const storedIsValid = activeGroupId != null && groups.some((group) => group.id === activeGroupId);
    if (storedIsValid) {
      return;
    }

    const nextId = groups[0].id;
    setActiveGroupIdState(nextId);
    writeStoredGroupId(nextId);
  }, [activeGroupId, groups, isAuthenticated]);

  const setActiveGroupId = useCallback((id: UUID) => {
    setActiveGroupIdState(id);
    writeStoredGroupId(id);
  }, []);

  const activeGroup = useMemo(
    () => groups.find((group) => group.id === activeGroupId) ?? null,
    [activeGroupId, groups],
  );

  const value = useMemo<ScheduleGroupContextValue>(
    () => ({
      groups,
      activeGroup,
      activeGroupId: activeGroup?.id ?? null,
      isLoading: isAuthenticated && groupsQuery.isLoading && !groupsQuery.data,
      error: isAuthenticated ? groupsQuery.error : null,
      refetch: groupsQuery.refetch,
      setActiveGroupId,
    }),
    [activeGroup, groups, groupsQuery.data, groupsQuery.error, groupsQuery.isLoading, groupsQuery.refetch, isAuthenticated, setActiveGroupId],
  );

  return <ScheduleGroupContext.Provider value={value}>{children}</ScheduleGroupContext.Provider>;
}

export function useScheduleGroup() {
  const context = useContext(ScheduleGroupContext);
  if (!context) {
    throw new Error("useScheduleGroup must be used within ScheduleGroupProvider");
  }
  return context;
}
