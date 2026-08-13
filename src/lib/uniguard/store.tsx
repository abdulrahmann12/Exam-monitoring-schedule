import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type {
    Assignment as ApiAssignment,
    Room as ApiRoom,
    TimeSlot as ApiTimeSlot,
    AssignmentsQuery,
    BulkAssignmentRequest,
    NormalizedPaginatedResponse,
    PeopleQuery,
    Person,
    RoomsQuery,
    TimeSlotsQuery,
} from "@/api";
import { queryKeys } from "@/hooks/queryKeys";
import { assignmentsService, peopleService, roomsService, timeSlotsService } from "@/services";
import { useScheduleGroup } from "@/state/scheduleGroup";
import { showErrorToast } from "@/utils/error";
import { unwrapServiceResponse } from "@/utils/serviceResponse";

import { overlappingAssignmentsForSlot, validateAssignment, validateSlotAssignments } from "./constraintEngine";
import { generateSchedule } from "./engine";
import { Assignment, Day, dayOfDate, minInvigilatorsForCapacity, Room, ScheduleEntry, Slot, Staff } from "./types";

const MAX_BACKEND_PAGE_SIZE = 100;

const PEOPLE_QUERY_PARAMS = {
  page: 0,
  size: MAX_BACKEND_PAGE_SIZE,
  sortBy: "name",
  direction: "ASC",
} as const;

const ROOMS_QUERY_PARAMS = {
  page: 0,
  size: MAX_BACKEND_PAGE_SIZE,
  sortBy: "name",
  direction: "ASC",
} as const;

const SLOT_QUERY_PARAMS = {
  page: 0,
  size: MAX_BACKEND_PAGE_SIZE,
  sortBy: "sortOrder",
  direction: "ASC",
  activeOnly: true,
} as const;

const ASSIGNMENTS_QUERY_PARAMS = {
  page: 0,
  size: MAX_BACKEND_PAGE_SIZE,
  sortBy: "examDate",
  direction: "ASC",
} as const;

type PaginatedQueryParams = {
  page?: number;
  size?: number;
};

function clampPageSize(size?: number): number {
  if (typeof size !== "number" || !Number.isFinite(size)) {
    return MAX_BACKEND_PAGE_SIZE;
  }

  return Math.min(Math.max(Math.trunc(size), 1), MAX_BACKEND_PAGE_SIZE);
}

async function fetchAllPaginatedItems<TItem, TParams extends PaginatedQueryParams>(
  params: TParams,
  fetchPage: (params: TParams) => Promise<NormalizedPaginatedResponse<TItem>>,
): Promise<NormalizedPaginatedResponse<TItem>> {
  const baseParams = {
    ...params,
    page: 0,
    size: clampPageSize(params.size),
  } as TParams;

  const firstPage = await fetchPage(baseParams);
  const totalPages = Math.max(
    firstPage.totalPages,
    firstPage.totalItems > 0 ? Math.ceil(firstPage.totalItems / baseParams.size) : 0,
  );

  if (totalPages <= 1) {
    return {
      ...firstPage,
      page: 0,
      size: baseParams.size,
    };
  }

  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      fetchPage({
        ...baseParams,
        page: index + 1,
      } as TParams)),
  );

  const items = [
    ...firstPage.items,
    ...remainingPages.flatMap((page) => page.items),
  ];

  return {
    ...firstPage,
    items,
    page: 0,
    size: baseParams.size,
    totalItems: Math.max(firstPage.totalItems, items.length),
    totalPages,
  };
}

function useAllPagesQuery<TItem, TParams extends PaginatedQueryParams>(
  queryKey: readonly unknown[],
  params: TParams,
  fetchPage: (params: TParams) => Promise<NormalizedPaginatedResponse<TItem>>,
  enabled = true,
) {
  return useQuery({
    queryKey: [...queryKey, "all-pages", params],
    queryFn: async () => fetchAllPaginatedItems(params, fetchPage),
    enabled,
    refetchOnWindowFocus: true,
  });
}

interface Ctx {
  staff: Staff[];
  rooms: Room[];
  slots: Slot[];
  schedule: ScheduleEntry[];
  isLoading: boolean;
  isPersisting: boolean;
  error: unknown;
  isEntryDirty: (date: string, slotId: string) => boolean;
  setStaffWorkingDays: (id: string, days: Day[]) => void;
  addStaff: (s: Omit<Staff, "id" | "totalAssignments">) => void;
  removeStaff: (id: string) => void;
  addRoom: (r: Omit<Room, "id" | "minInvigilators"> & { minInvigilators?: number }) => void;
  removeRoom: (id: string) => void;
  updateSlot: (slotId: string, patch: Partial<Omit<Slot, "id">>) => void;
  generate: (opts: { date: string; slotId: string; roomIds: string[]; partial?: boolean }) => { conflicts: string[] };
  toggleLock: (date: string, slotId: string, roomId: string) => void;
  manualAssign: (date: string, slotId: string, roomId: string, kind: "chief" | "invigilator", index: number, staffId: string | null) => { ok: boolean; message?: string };
  addInvigilatorSlot: (date: string, slotId: string, roomId: string) => void;
  removeInvigilatorSlot: (date: string, slotId: string, roomId: string, index: number) => void;
  updateAssignmentSubject: (date: string, slotId: string, roomId: string, patch: { subjectName?: string; subjectCode?: string }) => void;
  addRoomToSlot: (date: string, slotId: string, roomId: string) => void;
  swapInvigilators: (date: string, slotId: string, fromRoomId: string, fromIdx: number, toRoomId: string, toIdx: number) => void;
  saveEntry: (date: string, slotId: string) => Promise<boolean>;
  undoLastChange: () => boolean;
  resetSlotToGenerated: (date: string, slotId: string) => boolean;
  getEntry: (date: string, slotId: string) => ScheduleEntry | undefined;
  validateEntry: (entry: ScheduleEntry) => ReturnType<typeof validateSlotAssignments>;
  validateOne: (entry: ScheduleEntry, assignment: Assignment) => ReturnType<typeof validateAssignment>;
}

const Ctx = createContext<Ctx | null>(null);

function normalizeTimeValue(value: string): string {
  if (value.length === 5) {
    return `${value}:00`;
  }

  return value;
}

function formatLocalTime(value: string): string {
  return value.length >= 5 ? value.slice(0, 5) : value;
}

function cloneAssignment(assignment: Assignment): Assignment {
  return {
    ...assignment,
    invigilatorIds: [...assignment.invigilatorIds],
  };
}

function cloneEntry(entry: ScheduleEntry): ScheduleEntry {
  return {
    ...entry,
    assignments: entry.assignments.map(cloneAssignment),
    lastGeneratedAssignments: entry.lastGeneratedAssignments?.map(cloneAssignment),
  };
}

function cloneSchedule(entries: ScheduleEntry[]): ScheduleEntry[] {
  return entries.map(cloneEntry);
}

function mergeAssignmentsForPartialRegeneration(existing: Assignment[], generated: Assignment[]): Assignment[] {
  const generatedByRoom = new Map(generated.map((assignment) => [assignment.roomId, cloneAssignment(assignment)]));
  const merged = existing.map((assignment) => generatedByRoom.get(assignment.roomId) ?? cloneAssignment(assignment));

  generated.forEach((assignment) => {
    if (!generatedByRoom.has(assignment.roomId)) {
      return;
    }

    if (existing.some((currentAssignment) => currentAssignment.roomId === assignment.roomId)) {
      return;
    }

    merged.push(cloneAssignment(assignment));
  });

  return merged;
}

function withSharedFlags(assignments: Assignment[]): Assignment[] {
  const counts = new Map<string, number>();

  assignments.forEach((assignment) => {
    if (assignment.chiefInvigilatorId) {
      counts.set(assignment.chiefInvigilatorId, (counts.get(assignment.chiefInvigilatorId) ?? 0) + 1);
    }
  });

  return assignments.map((assignment) => ({
    ...assignment,
    sharedChief: Boolean(
      assignment.chiefInvigilatorId && (counts.get(assignment.chiefInvigilatorId) ?? 0) >= 2,
    ),
  }));
}

function toStaff(person: Person): Staff {
  return {
    id: person.id,
    name: person.name,
    role: person.role,
    department: person.department,
    workingDays: person.availableDays,
    totalAssignments: person.totalAssignments,
  };
}

function toRoom(room: ApiRoom): Room {
  return {
    id: room.id,
    name: room.name,
    capacity: room.capacity,
    minInvigilators: room.minInvigilators,
  };
}

function toSlot(slot: ApiTimeSlot): Slot {
  return {
    id: slot.id,
    label: slot.label,
    sortOrder: slot.sortOrder,
    startTime: formatLocalTime(slot.startTime),
    endTime: formatLocalTime(slot.endTime),
  };
}

function toLocalAssignment(assignment: ApiAssignment, roomMap: Map<string, Room>): Assignment {
  const orderedInvigilators = [...assignment.invigilators].sort(
    (left, right) => left.positionIndex - right.positionIndex,
  );
  const invigilatorIds = orderedInvigilators.map((invigilator) => invigilator.invigilatorId);
  const room = roomMap.get(assignment.roomId);

  if (room && invigilatorIds.length < room.minInvigilators) {
    invigilatorIds.push(...Array.from({ length: room.minInvigilators - invigilatorIds.length }, () => null));
  }

  return {
    roomId: assignment.roomId,
    slotId: assignment.timeSlotId,
    chiefInvigilatorId: assignment.chiefInvigilatorId,
    invigilatorIds,
    locked: assignment.locked,
    subjectName: assignment.subjectName ?? undefined,
    subjectCode: assignment.subjectCode ?? undefined,
  };
}

function toScheduleEntries(assignments: ApiAssignment[], rooms: Room[]): ScheduleEntry[] {
  const roomMap = new Map(rooms.map((room) => [room.id, room]));
  const grouped = new Map<string, ScheduleEntry>();

  assignments.forEach((assignment) => {
    const key = `${assignment.examDate}::${assignment.timeSlotId}`;
    const existing = grouped.get(key);
    const nextAssignment = toLocalAssignment(assignment, roomMap);

    if (existing) {
      existing.assignments.push(nextAssignment);
      return;
    }

    grouped.set(key, {
      date: assignment.examDate,
      slotId: assignment.timeSlotId,
      day: dayOfDate(assignment.examDate),
      assignments: [nextAssignment],
    });
  });

  return [...grouped.values()]
    .map((entry) => {
      const sharedAssignments = withSharedFlags(entry.assignments);
      return {
        ...entry,
        assignments: sharedAssignments,
        lastGeneratedAssignments: sharedAssignments.map(cloneAssignment),
      };
    })
    .sort((left, right) => {
      if (left.date !== right.date) {
        return left.date.localeCompare(right.date);
      }

      return left.slotId.localeCompare(right.slotId);
    });
}

function normalizeText(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toBulkAssignmentRequest(
  date: string,
  assignment: Assignment,
  scheduleGroupId?: string,
): BulkAssignmentRequest {
  return {
    scheduleGroupId,
    examDate: date,
    roomId: assignment.roomId,
    slotId: assignment.slotId,
    subjectName: normalizeText(assignment.subjectName),
    subjectCode: normalizeText(assignment.subjectCode),
    chiefInvigilatorId: assignment.chiefInvigilatorId,
    isLocked: assignment.locked,
    invigilatorIds: assignment.invigilatorIds,
  };
}

function sameInvigilatorList(left: Array<string | null>, right: Array<string | null>): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function matchesPersistedAssignment(payload: BulkAssignmentRequest, assignment: ApiAssignment): boolean {
  const persistedInvigilators = [...assignment.invigilators]
    .sort((left, right) => left.positionIndex - right.positionIndex)
    .map((invigilator) => invigilator.invigilatorId);

  return (
    payload.examDate === assignment.examDate
    && payload.roomId === assignment.roomId
    && payload.slotId === assignment.timeSlotId
    && (payload.subjectName ?? null) === (assignment.subjectName ?? null)
    && (payload.subjectCode ?? null) === (assignment.subjectCode ?? null)
    && (payload.chiefInvigilatorId ?? null) === (assignment.chiefInvigilatorId ?? null)
    && payload.isLocked === assignment.locked
    && sameInvigilatorList(payload.invigilatorIds, persistedInvigilators)
  );
}

function entryMatchesPersisted(
  persistedAssignments: ApiAssignment[],
  target: { date: string; slotId: string },
  entry?: ScheduleEntry,
): boolean {
  const slotAssignments = persistedAssignments.filter(
    (assignment) => assignment.examDate === target.date && assignment.timeSlotId === target.slotId,
  );

  if (!entry) {
    return slotAssignments.length === 0;
  }

  if (slotAssignments.length !== entry.assignments.length) {
    return false;
  }

  const persistedByRoom = new Map(slotAssignments.map((assignment) => [assignment.roomId, assignment]));

  return entry.assignments.every((assignment) => {
    const persisted = persistedByRoom.get(assignment.roomId);
    return persisted ? matchesPersistedAssignment(toBulkAssignmentRequest(target.date, assignment), persisted) : false;
  });
}

function entryKey(date: string, slotId: string): string {
  return `${date}::${slotId}`;
}

export function UniGuardProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { activeGroupId, error: groupError } = useScheduleGroup();
  const slotQueryParams = {
    ...SLOT_QUERY_PARAMS,
    scheduleGroupId: activeGroupId ?? undefined,
  } satisfies TimeSlotsQuery;
  const assignmentQueryParams = {
    ...ASSIGNMENTS_QUERY_PARAMS,
    scheduleGroupId: activeGroupId ?? undefined,
  } satisfies AssignmentsQuery;
  const hasActiveGroup = Boolean(activeGroupId);

  const peopleQueryParams = {
    ...PEOPLE_QUERY_PARAMS,
    scheduleGroupId: activeGroupId ?? undefined,
  } satisfies PeopleQuery;
  const peopleQuery = useAllPagesQuery(
    queryKeys.people.all,
    peopleQueryParams,
    async (params) => unwrapServiceResponse(await peopleService.getPeople(params)),
  );
  const roomsQuery = useAllPagesQuery(
    queryKeys.rooms.all,
    ROOMS_QUERY_PARAMS satisfies RoomsQuery,
    async (params) => unwrapServiceResponse(await roomsService.getRooms(params)),
  );
  const timeSlotsQuery = useAllPagesQuery(
    queryKeys.timeSlots.all,
    slotQueryParams,
    async (params) => unwrapServiceResponse(await timeSlotsService.getTimeSlots(params)),
    hasActiveGroup,
  );
  const assignmentsQuery = useAllPagesQuery(
    queryKeys.assignments.all,
    assignmentQueryParams,
    async (params) => unwrapServiceResponse(await assignmentsService.getAssignments(params)),
    hasActiveGroup,
  );

  const [staff, setStaff] = useState<Staff[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [history, setHistory] = useState<ScheduleEntry[][]>([]);
  const [dirtyEntryKeys, setDirtyEntryKeys] = useState<string[]>([]);
  const [isPersisting, setIsPersisting] = useState(false);
  const persistedAssignmentsRef = useRef<ApiAssignment[]>([]);
  const scheduleInitializedRef = useRef(false);

  const isLoading = Boolean(
    (!hasActiveGroup && !groupError)
    || (peopleQuery.isLoading && !peopleQuery.data)
    || (roomsQuery.isLoading && !roomsQuery.data)
    || (timeSlotsQuery.isLoading && !timeSlotsQuery.data)
    || (assignmentsQuery.isLoading && !assignmentsQuery.data),
  );
  const error = groupError ?? peopleQuery.error ?? roomsQuery.error ?? timeSlotsQuery.error ?? assignmentsQuery.error;

  useEffect(() => {
    scheduleInitializedRef.current = false;
    persistedAssignmentsRef.current = [];
    setSchedule([]);
    setHistory([]);
    setDirtyEntryKeys([]);
    setSlots([]);
  }, [activeGroupId]);

  useEffect(() => {
    if (!assignmentsQuery.data) {
      return;
    }

    persistedAssignmentsRef.current = assignmentsQuery.data.items;
  }, [assignmentsQuery.data]);

  useEffect(() => {
    if (!peopleQuery.data || !roomsQuery.data || !timeSlotsQuery.data) {
      return;
    }

    const nextRooms = roomsQuery.data.items.map(toRoom);
    const nextStaff = peopleQuery.data.items.map(toStaff);
    const nextSlots = timeSlotsQuery.data.items.map(toSlot);

    setRooms(nextRooms);
    setStaff(nextStaff);
    setSlots(nextSlots);
  }, [peopleQuery.data, roomsQuery.data, timeSlotsQuery.data]);

  useEffect(() => {
    if (!assignmentsQuery.data || rooms.length === 0 || scheduleInitializedRef.current) {
      return;
    }

    setSchedule(toScheduleEntries(assignmentsQuery.data.items, rooms));
    setHistory([]);
    setDirtyEntryKeys([]);
    scheduleInitializedRef.current = true;
  }, [assignmentsQuery.data, rooms]);

  const getEntry = useCallback((date: string, slotId: string) => schedule.find((e) => e.date === date && e.slotId === slotId), [schedule]);

  const pushHistory = useCallback((entries: ScheduleEntry[]) => {
    setHistory((prev) => [...prev.slice(-9), cloneSchedule(entries)]);
  }, []);

  const recomputeStaffCounts = useCallback((entries: ScheduleEntry[]) => {
    setStaff((prev) => {
      const counts = new Map<string, number>();
      for (const e of entries) {
        for (const a of e.assignments) {
          if (a.chiefInvigilatorId) counts.set(a.chiefInvigilatorId, (counts.get(a.chiefInvigilatorId) ?? 0) + 1);
          a.invigilatorIds.forEach((id) => id && counts.set(id, (counts.get(id) ?? 0) + 1));
        }
      }
      return prev.map((s) => ({ ...s, totalAssignments: counts.get(s.id) ?? 0 }));
    });
  }, []);

  const syncDirtyEntry = useCallback((target: { date: string; slotId: string }, entry?: ScheduleEntry) => {
    const key = entryKey(target.date, target.slotId);
    const dirty = !entryMatchesPersisted(persistedAssignmentsRef.current, target, entry);

    setDirtyEntryKeys((previous) => {
      const hasKey = previous.includes(key);
      if (dirty && !hasKey) {
        return [...previous, key];
      }
      if (!dirty && hasKey) {
        return previous.filter((value) => value !== key);
      }
      return previous;
    });
  }, []);

  const isEntryDirty: Ctx["isEntryDirty"] = useCallback(
    (date, slotId) => dirtyEntryKeys.includes(entryKey(date, slotId)),
    [dirtyEntryKeys],
  );

  const saveEntry: Ctx["saveEntry"] = useCallback(async (date, slotId) => {
    const currentEntry = getEntry(date, slotId);
    if (!currentEntry) {
      return false;
    }

    try {
      setIsPersisting(true);

      const savedAssignments = unwrapServiceResponse(
        await assignmentsService.saveAssignmentsBulk(
          currentEntry.assignments.map((assignment) =>
            toBulkAssignmentRequest(date, assignment, activeGroupId ?? undefined)),
        ),
      );

      persistedAssignmentsRef.current = [
        ...persistedAssignmentsRef.current.filter(
          (assignment) => !(assignment.examDate === date && assignment.timeSlotId === slotId),
        ),
        ...savedAssignments,
      ];

      const nextRooms = rooms;
      const synchronizedEntry = toScheduleEntries(savedAssignments, nextRooms).find(
        (entry) => entry.date === date && entry.slotId === slotId,
      );

      setSchedule((previous) => previous.flatMap((entry) => {
        if (entry.date !== date || entry.slotId !== slotId) {
          return [entry];
        }

        if (!synchronizedEntry) {
          return [];
        }

        return [{
          ...synchronizedEntry,
          lastGeneratedAssignments: entry.lastGeneratedAssignments?.map(cloneAssignment)
            ?? synchronizedEntry.lastGeneratedAssignments?.map(cloneAssignment),
        }];
      }));

      syncDirtyEntry({ date, slotId }, synchronizedEntry
        ? {
            ...synchronizedEntry,
            lastGeneratedAssignments: currentEntry.lastGeneratedAssignments?.map(cloneAssignment)
              ?? synchronizedEntry.lastGeneratedAssignments?.map(cloneAssignment),
          }
        : undefined);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.assignments.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.people.all }),
      ]);

      return true;
    } catch (errorValue) {
      showErrorToast(errorValue, { title: "Could not save schedule changes." });
      return false;
    } finally {
      setIsPersisting(false);
    }
  }, [activeGroupId, getEntry, queryClient, rooms, syncDirtyEntry]);

  const persistSlotPatch = useCallback(async (slotId: string, patch: Partial<Omit<Slot, "id">>) => {
    const currentSlot = slots.find((slot) => slot.id === slotId);
    if (!currentSlot) {
      return;
    }

    try {
      setIsPersisting(true);

      await unwrapServiceResponse(await timeSlotsService.updateTimeSlot(slotId, {
        scheduleGroupId: activeGroupId ?? undefined,
        label: currentSlot.label,
        startTime: normalizeTimeValue((patch.startTime ?? currentSlot.startTime) as string),
        endTime: normalizeTimeValue((patch.endTime ?? currentSlot.endTime) as string),
        sortOrder: currentSlot.sortOrder,
      }));

      await queryClient.invalidateQueries({ queryKey: queryKeys.timeSlots.all });
    } catch (errorValue) {
      showErrorToast(errorValue, { title: "Could not update the time slot." });
    } finally {
      setIsPersisting(false);
    }
  }, [activeGroupId, queryClient, slots]);

  const applySchedule = useCallback((
    updater: (prev: ScheduleEntry[]) => ScheduleEntry[],
    persistTarget?: { date: string; slotId: string },
  ) => {
    let nextEntry: ScheduleEntry | undefined;

    setSchedule((prev) => {
      pushHistory(prev);
      const next = updater(prev);
      if (persistTarget) {
        nextEntry = next.find((entry) => entry.date === persistTarget.date && entry.slotId === persistTarget.slotId);
      }
      recomputeStaffCounts(next);
      return next;
    });

    if (persistTarget) {
      syncDirtyEntry({ date: persistTarget.date, slotId: persistTarget.slotId }, nextEntry);
    }
  }, [pushHistory, recomputeStaffCounts, syncDirtyEntry]);

  const generate: Ctx["generate"] = ({ date, slotId, roomIds, partial }) => {
    const day = dayOfDate(date);
    const currentEntry = getEntry(date, slotId);
    const existing = currentEntry?.assignments ?? [];
    const slot = slots.find((s) => s.id === slotId);
    const overlappingAssignments = overlappingAssignmentsForSlot(
      schedule.filter((entry) => entry.date === date && entry.slotId !== slotId).flatMap((entry) => entry.assignments),
      slots,
      slotId,
    );
    const { assignments, conflicts } = generateSchedule({
      roomIds,
      rooms,
      staff,
      day,
      slotId,
      existing: partial ? existing : [],
      overlappingAssignments,
      defaultSubject: { subjectName: slot?.subjectName, subjectCode: slot?.subjectCode },
      regenerateUnlocked: !!partial,
    });
    const nextAssignments = partial
      ? withSharedFlags(mergeAssignmentsForPartialRegeneration(existing, assignments))
      : assignments.map(cloneAssignment);
    applySchedule((prev) => {
      const filtered = prev.filter((e) => !(e.date === date && e.slotId === slotId));
      const generatedSnapshot = nextAssignments.map(cloneAssignment);
      return [...filtered, { date, slotId, day, assignments: nextAssignments, lastGeneratedAssignments: generatedSnapshot }];
    }, { date, slotId });
    return { conflicts };
  };

  const toggleLock: Ctx["toggleLock"] = (date, slotId, roomId) => {
    applySchedule((prev) => prev.map((e) => e.date === date && e.slotId === slotId ? { ...e, assignments: e.assignments.map((a) => a.roomId === roomId ? { ...a, locked: !a.locked } : a) } : e), { date, slotId });
  };

  const manualAssign: Ctx["manualAssign"] = (date, slotId, roomId, kind, index, staffId) => {
    const entry = getEntry(date, slotId);
    if (!entry) return { ok: false, message: "Generate this slot before assigning staff." };
    const candidateAssignments = entry.assignments.map((a) => {
      if (a.roomId !== roomId) return cloneAssignment(a);
      if (kind === "chief") return { ...a, chiefInvigilatorId: staffId };
      const invigilatorIds = [...a.invigilatorIds];
      invigilatorIds[index] = staffId;
      return { ...a, invigilatorIds };
    });
    const overlappingAssignments = overlappingAssignmentsForSlot(
      schedule.filter((item) => item.date === date && item.slotId !== slotId).flatMap((item) => item.assignments),
      slots,
      slotId,
    );
    const validation = validateSlotAssignments({
      assignments: candidateAssignments,
      rooms,
      staff,
      day: entry.day,
      overlappingAssignments,
    });
    const blockingIssue = validation.issues.find((issue) => staffId && issue.staffId === staffId && issue.type !== "capacity");
    if (blockingIssue) return { ok: false, message: blockingIssue.message };
    applySchedule((prev) => prev.map((e) => e.date === date && e.slotId === slotId ? { ...e, assignments: withSharedFlags(candidateAssignments) } : e), { date, slotId });
    return { ok: true };
  };

  const addInvigilatorSlot: Ctx["addInvigilatorSlot"] = (date, slotId, roomId) => {
    applySchedule((prev) => prev.map((e) => e.date === date && e.slotId === slotId ? { ...e, assignments: e.assignments.map((a) => a.roomId === roomId ? { ...a, invigilatorIds: [...a.invigilatorIds, null] } : a) } : e), { date, slotId });
  };

  const removeInvigilatorSlot: Ctx["removeInvigilatorSlot"] = (date, slotId, roomId, index) => {
    applySchedule((prev) => prev.map((e) => e.date === date && e.slotId === slotId ? { ...e, assignments: e.assignments.map((a) => a.roomId === roomId ? { ...a, invigilatorIds: a.invigilatorIds.filter((_, i) => i !== index) } : a) } : e), { date, slotId });
  };

  const updateAssignmentSubject: Ctx["updateAssignmentSubject"] = (date, slotId, roomId, patch) => {
    applySchedule((prev) => prev.map((e) => e.date === date && e.slotId === slotId ? { ...e, assignments: e.assignments.map((a) => a.roomId === roomId ? { ...a, ...patch } : a) } : e), { date, slotId });
  };

  const addRoomToSlot: Ctx["addRoomToSlot"] = (date, slotId, roomId) => {
    const day = dayOfDate(date);
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return;
    applySchedule((prev) => {
      const existing = prev.find((e) => e.date === date && e.slotId === slotId);
      const newAssignment: Assignment = { roomId, slotId, chiefInvigilatorId: null, invigilatorIds: Array.from({ length: room.minInvigilators }, () => null), locked: false };
      if (!existing) return [...prev, { date, slotId, day, assignments: [newAssignment] }];
      if (existing.assignments.some((a) => a.roomId === roomId)) return prev;
      return prev.map((e) => e === existing ? { ...e, assignments: [...e.assignments, newAssignment] } : e);
    }, { date, slotId });
  };

  const swapInvigilators: Ctx["swapInvigilators"] = (date, slotId, fromRoomId, fromIdx, toRoomId, toIdx) => {
    applySchedule((prev) => prev.map((e) => {
      if (e.date !== date || e.slotId !== slotId) return e;
      const assignments = e.assignments.map(cloneAssignment);
      const from = assignments.find((a) => a.roomId === fromRoomId);
      const to = assignments.find((a) => a.roomId === toRoomId);
      if (!from || !to) return e;
      const tmp = from.invigilatorIds[fromIdx];
      from.invigilatorIds[fromIdx] = to.invigilatorIds[toIdx];
      to.invigilatorIds[toIdx] = tmp;
      return { ...e, assignments };
    }), { date, slotId });
  };

  const undoLastChange = () => {
    const last = history[history.length - 1];
    if (!last) return false;
    const changedKeys = new Set([
      ...schedule.map((entry) => entryKey(entry.date, entry.slotId)),
      ...last.map((entry) => entryKey(entry.date, entry.slotId)),
    ]);
    setHistory((prev) => prev.slice(0, -1));
    setSchedule(cloneSchedule(last));
    recomputeStaffCounts(last);

    changedKeys.forEach((key) => {
      const [date, slotId] = key.split("::");
      const entry = last.find((item) => item.date === date && item.slotId === slotId);
      syncDirtyEntry({ date, slotId }, entry);
    });

    return true;
  };

  const resetSlotToGenerated: Ctx["resetSlotToGenerated"] = (date, slotId) => {
    const entry = getEntry(date, slotId);
    if (!entry?.lastGeneratedAssignments) return false;
    applySchedule((prev) => prev.map((e) => e.date === date && e.slotId === slotId ? { ...e, assignments: entry.lastGeneratedAssignments!.map(cloneAssignment) } : e), { date, slotId });
    return true;
  };

  const updateSlot: Ctx["updateSlot"] = (slotId, patch) => {
    setSlots((prev) => prev.map((slot) => slot.id === slotId ? { ...slot, ...patch } : slot));
    void persistSlotPatch(slotId, patch);
  };
  const overlappingForEntry = (entry: ScheduleEntry) => overlappingAssignmentsForSlot(
    schedule.filter((item) => item.date === entry.date && item.slotId !== entry.slotId).flatMap((item) => item.assignments),
    slots,
    entry.slotId,
  );
  const validateEntry: Ctx["validateEntry"] = (entry) => validateSlotAssignments({
    assignments: entry.assignments,
    rooms,
    staff,
    day: entry.day,
    overlappingAssignments: overlappingForEntry(entry),
  });
  const validateOne: Ctx["validateOne"] = (entry, assignment) => validateAssignment(
    assignment,
    entry.assignments,
    rooms,
    staff,
    entry.day,
    overlappingForEntry(entry),
  );
  const setStaffWorkingDays: Ctx["setStaffWorkingDays"] = (id, days) => setStaff((prev) => prev.map((s) => s.id === id ? { ...s, workingDays: days } : s));
  const addStaff: Ctx["addStaff"] = (s) => setStaff((prev) => [...prev, { ...s, id: `${s.role === "CHIEF_INVIGILATOR" ? "C" : "I"}${Date.now()}`, totalAssignments: 0 }]);
  const removeStaff: Ctx["removeStaff"] = (id) => setStaff((prev) => prev.filter((s) => s.id !== id));
  const addRoom: Ctx["addRoom"] = (r) => setRooms((prev) => [...prev, { ...r, id: `R${Date.now()}`, minInvigilators: r.minInvigilators ?? minInvigilatorsForCapacity(r.capacity) }]);
  const removeRoom: Ctx["removeRoom"] = (id) => setRooms((prev) => prev.filter((r) => r.id !== id));

  const value = useMemo<Ctx>(() => ({
    staff, rooms, slots, schedule, isLoading, isPersisting, error, isEntryDirty, setStaffWorkingDays, addStaff, removeStaff, addRoom, removeRoom, updateSlot, generate, toggleLock, manualAssign,
    addInvigilatorSlot, removeInvigilatorSlot, updateAssignmentSubject, addRoomToSlot, swapInvigilators, saveEntry, undoLastChange, resetSlotToGenerated, getEntry, validateEntry, validateOne,
  }), [
    addInvigilatorSlot,
    addRoom,
    addRoomToSlot,
    addStaff,
    error,
    generate,
    getEntry,
    isLoading,
    isEntryDirty,
    isPersisting,
    manualAssign,
    removeInvigilatorSlot,
    removeRoom,
    removeStaff,
    resetSlotToGenerated,
    rooms,
    saveEntry,
    schedule,
    setStaffWorkingDays,
    slots,
    staff,
    swapInvigilators,
    toggleLock,
    undoLastChange,
    updateAssignmentSubject,
    updateSlot,
    validateEntry,
    validateOne,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUniGuard() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useUniGuard must be used within UniGuardProvider");
  return ctx;
}
