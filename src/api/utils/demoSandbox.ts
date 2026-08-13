import * as XLSX from "xlsx";

import { isDemoUser } from "../../lib/demoMode";
import type {
    Assignment,
    AssignmentInvigilator,
    AssignmentRequest,
    AssignmentsQuery,
    BulkAssignmentRequest,
    BulkUploadError,
    BulkUploadResult,
    CurrentSession,
    NormalizedPaginatedResponse,
    PeopleQuery,
    Person,
    PersonRequest,
    Room,
    RoomRequest,
    RoomsQuery,
    Settings,
    SettingsRequest,
    SortDirection,
    TimeSlot,
    TimeSlotRequest,
    TimeSlotsQuery,
    UUID,
    WeekDay,
} from "../types";
import { createSuccessResponse } from "./serviceResponse";

type DemoMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type DemoParams = PeopleQuery | RoomsQuery | TimeSlotsQuery | AssignmentsQuery | undefined;
type DemoCollectionKey = "people" | "rooms" | "timeSlots" | "assignments";

interface DemoCollectionStore<TItem extends { id: UUID }> {
  complete: boolean;
  createdIds: Set<UUID>;
  deletedIds: Set<UUID>;
  hasFetched: boolean;
  knownTotalItems: number;
  mutatedIds: Set<UUID>;
  records: Map<UUID, TItem>;
}

interface DemoSettingsStore {
  hasFetched: boolean;
  isDirty: boolean;
  value: Settings | null;
}

interface DemoCacheableRequest {
  data?: unknown;
  method?: string;
  params?: unknown;
  url?: string;
}

const DEFAULT_WEEK_DAYS: WeekDay[] = ["Sun", "Mon", "Tue", "Wed", "Thu"];
const PERSON_MAX_NAME_LENGTH = 160;
const ROOM_MAX_NAME_LENGTH = 120;
const PERSON_TYPE_OPTIONS = new Set(["CHIEF_INVIGILATOR", "INVIGILATOR"]);

const demoRuntime = {
  enabled: false,
  assignments: createCollectionStore<Assignment>(),
  people: createCollectionStore<Person>(),
  rooms: createCollectionStore<Room>(),
  settings: createSettingsStore(),
  timeSlots: createCollectionStore<TimeSlot>(),
};

function createCollectionStore<TItem extends { id: UUID }>(): DemoCollectionStore<TItem> {
  return {
    complete: false,
    createdIds: new Set<UUID>(),
    deletedIds: new Set<UUID>(),
    hasFetched: false,
    knownTotalItems: 0,
    mutatedIds: new Set<UUID>(),
    records: new Map<UUID, TItem>(),
  };
}

function createSettingsStore(): DemoSettingsStore {
  return {
    hasFetched: false,
    isDirty: false,
    value: null,
  };
}

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeForComparison(value: string): string {
  return normalizeWhitespace(value).toLowerCase();
}

function normalizeEnumToken(value: string): string {
  return normalizeWhitespace(value).replace(/[\s-]+/g, "_").toUpperCase();
}

function normalizeText(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function toPositiveInteger(value: unknown, fallback: number): number {
  const parsed = Math.trunc(toNumber(value, fallback));
  return parsed > 0 ? parsed : fallback;
}

function compareNullable<T extends string | number | boolean | null | undefined>(left: T, right: T): number {
  if (left == null && right == null) {
    return 0;
  }

  if (left == null) {
    return 1;
  }

  if (right == null) {
    return -1;
  }

  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }

  if (typeof left === "boolean" && typeof right === "boolean") {
    return Number(left) - Number(right);
  }

  return String(left).localeCompare(String(right), undefined, { sensitivity: "base" });
}

function applyDirection(result: number, direction: SortDirection | undefined): number {
  return direction === "DESC" ? -result : result;
}

function getRequestMethod(method?: string): DemoMethod {
  const normalizedMethod = method?.toUpperCase();

  switch (normalizedMethod) {
    case "POST":
    case "PUT":
    case "PATCH":
    case "DELETE":
      return normalizedMethod;
    default:
      return "GET";
  }
}

function getRequestPath(url?: string): string {
  if (!url) {
    return "";
  }

  try {
    return new URL(url, "http://localhost").pathname;
  } catch {
    return url;
  }
}

function getRequestPage(params: { page?: number } | undefined): number {
  return Math.max(0, Math.trunc(params?.page ?? 0));
}

function getRequestSize(params: { size?: number } | undefined, totalItems: number): number {
  if (typeof params?.size === "number" && Number.isFinite(params.size) && params.size > 0) {
    return Math.trunc(params.size);
  }

  return Math.max(totalItems, 1);
}

function createDemoId(prefix: string): UUID {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function createIsoTimestamp(): string {
  return new Date().toISOString();
}

function getRoomTypeFromCapacity(capacity: number): Room["type"] {
  if (capacity >= 60) {
    return "LARGE";
  }

  if (capacity >= 40) {
    return "MEDIUM";
  }

  return "SMALL";
}

function getMinInvigilatorsForCapacity(capacity: number): number {
  return capacity >= 40 ? 2 : 1;
}

function resolveUniqueName(baseName: string, reservedNames: Set<string>, maxLength: number) {
  const normalizedBaseName = normalizeForComparison(baseName);

  if (!reservedNames.has(normalizedBaseName)) {
    reservedNames.add(normalizedBaseName);
    return { duplicate: false, resolvedName: baseName };
  }

  let suffix = 1;
  while (true) {
    const suffixText = ` (${suffix})`;
    const truncatedBaseName =
      baseName.length + suffixText.length > maxLength
        ? baseName.slice(0, Math.max(0, maxLength - suffixText.length)).trim()
        : baseName;
    const candidateName = `${truncatedBaseName}${suffixText}`;
    const normalizedCandidateName = normalizeForComparison(candidateName);

    if (!reservedNames.has(normalizedCandidateName)) {
      reservedNames.add(normalizedCandidateName);
      return { duplicate: true, resolvedName: candidateName };
    }

    suffix += 1;
  }
}

function comparePeople(left: Person, right: Person, params?: PeopleQuery): number {
  const result = (() => {
    switch (params?.sortBy) {
      case "id":
        return compareNullable(left.id, right.id);
      case "department":
        return compareNullable(left.department, right.department) || compareNullable(left.name, right.name);
      case "role":
        return compareNullable(left.role, right.role) || compareNullable(left.name, right.name);
      case "totalAssignments":
        if (params?.scheduleGroupId) {
          const counts = countAssignmentsForGroup(params.scheduleGroupId);
          return compareNullable(counts.get(left.id) ?? 0, counts.get(right.id) ?? 0) || compareNullable(left.name, right.name);
        }
        return compareNullable(left.totalAssignments, right.totalAssignments) || compareNullable(left.name, right.name);
      case "name":
      default:
        return compareNullable(left.name, right.name);
    }
  })();

  return applyDirection(result, params?.direction);
}

function compareRooms(left: Room, right: Room, params?: RoomsQuery): number {
  const result = (() => {
    switch (params?.sortBy) {
      case "id":
        return compareNullable(left.id, right.id);
      case "capacity":
        return compareNullable(left.capacity, right.capacity) || compareNullable(left.name, right.name);
      case "type":
        return compareNullable(left.type, right.type) || compareNullable(left.name, right.name);
      case "minInvigilators":
        return compareNullable(left.minInvigilators, right.minInvigilators) || compareNullable(left.name, right.name);
      case "name":
      default:
        return compareNullable(left.name, right.name);
    }
  })();

  return applyDirection(result, params?.direction);
}

function compareTimeSlots(left: TimeSlot, right: TimeSlot, params?: TimeSlotsQuery): number {
  const result = (() => {
    switch (params?.sortBy) {
      case "id":
        return compareNullable(left.id, right.id);
      case "label":
        return compareNullable(left.label, right.label) || compareNullable(left.sortOrder, right.sortOrder);
      case "startTime":
        return compareNullable(left.startTime, right.startTime) || compareNullable(left.sortOrder, right.sortOrder);
      case "endTime":
        return compareNullable(left.endTime, right.endTime) || compareNullable(left.sortOrder, right.sortOrder);
      case "sortOrder":
      default:
        return compareNullable(left.sortOrder, right.sortOrder) || compareNullable(left.label, right.label);
    }
  })();

  return applyDirection(result, params?.direction);
}

function compareAssignments(left: Assignment, right: Assignment, params?: AssignmentsQuery): number {
  const result = (() => {
    switch (params?.sortBy) {
      case "id":
        return compareNullable(left.id, right.id);
      case "subjectName":
        return compareNullable(left.subjectName ?? "", right.subjectName ?? "") || compareNullable(left.examDate, right.examDate);
      case "subjectCode":
        return compareNullable(left.subjectCode ?? "", right.subjectCode ?? "") || compareNullable(left.examDate, right.examDate);
      case "locked":
        return compareNullable(left.locked, right.locked) || compareNullable(left.examDate, right.examDate);
      case "source":
        return compareNullable(left.source, right.source) || compareNullable(left.examDate, right.examDate);
      case "generationVersion":
        return compareNullable(left.generationVersion, right.generationVersion) || compareNullable(left.examDate, right.examDate);
      case "timeSlot.startTime":
        return compareNullable(left.startTime, right.startTime) || compareNullable(left.examDate, right.examDate);
      case "room.name":
        return compareNullable(left.roomName, right.roomName) || compareNullable(left.examDate, right.examDate);
      case "examDate":
      default:
        return compareNullable(left.examDate, right.examDate)
          || compareNullable(left.startTime, right.startTime)
          || compareNullable(left.roomName, right.roomName);
    }
  })();

  return applyDirection(result, params?.direction);
}

function matchesPeopleQuery(person: Person, params?: PeopleQuery): boolean {
  if (params?.role && person.role !== params.role) {
    return false;
  }

  if (params?.department && !normalizeForComparison(person.department).includes(normalizeForComparison(params.department))) {
    return false;
  }

  if (params?.name && !normalizeForComparison(person.name).includes(normalizeForComparison(params.name))) {
    return false;
  }

  return true;
}

function matchesRoomsQuery(room: Room, params?: RoomsQuery): boolean {
  if (params?.type && room.type !== params.type) {
    return false;
  }

  if (params?.name && !normalizeForComparison(room.name).includes(normalizeForComparison(params.name))) {
    return false;
  }

  if (typeof params?.minCapacity === "number" && room.capacity < params.minCapacity) {
    return false;
  }

  if (typeof params?.maxCapacity === "number" && room.capacity > params.maxCapacity) {
    return false;
  }

  return true;
}

function matchesTimeSlotsQuery(timeSlot: TimeSlot, params?: TimeSlotsQuery): boolean {
  if (params?.scheduleGroupId && timeSlot.scheduleGroupId !== params.scheduleGroupId) {
    return false;
  }

  if (params?.activeOnly && !timeSlot.active) {
    return false;
  }

  if (params?.label && !normalizeForComparison(timeSlot.label).includes(normalizeForComparison(params.label))) {
    return false;
  }

  return true;
}

function matchesAssignmentsQuery(assignment: Assignment, params?: AssignmentsQuery): boolean {
  if (params?.scheduleGroupId && assignment.scheduleGroupId !== params.scheduleGroupId) {
    return false;
  }

  if (params?.slotId && assignment.timeSlotId !== params.slotId) {
    return false;
  }

  if (params?.roomId && assignment.roomId !== params.roomId) {
    return false;
  }

  if (typeof params?.locked === "boolean" && assignment.locked !== params.locked) {
    return false;
  }

  if (params?.fromDate && assignment.examDate < params.fromDate) {
    return false;
  }

  if (params?.toDate && assignment.examDate > params.toDate) {
    return false;
  }

  return true;
}

function isPeopleQueryFiltered(params?: PeopleQuery): boolean {
  return Boolean(params?.role || params?.department || params?.name);
}

function isRoomsQueryFiltered(params?: RoomsQuery): boolean {
  return Boolean(
    params?.type
    || params?.name
    || typeof params?.minCapacity === "number"
    || typeof params?.maxCapacity === "number",
  );
}

function isTimeSlotsQueryFiltered(params?: TimeSlotsQuery): boolean {
  return Boolean(params?.scheduleGroupId || params?.activeOnly || params?.label);
}

function isAssignmentsQueryFiltered(params?: AssignmentsQuery): boolean {
  return Boolean(
    params?.scheduleGroupId
    || params?.slotId
    || params?.roomId
    || typeof params?.locked === "boolean"
    || params?.fromDate
    || params?.toDate,
  );
}

function deriveCollectionResponse<TItem extends { id: UUID }, TParams extends { page?: number; size?: number }>(
  store: DemoCollectionStore<TItem>,
  params: TParams | undefined,
  matches: (item: TItem, params: TParams | undefined) => boolean,
  compare: (left: TItem, right: TItem, params: TParams | undefined) => number,
): NormalizedPaginatedResponse<TItem> {
  const page = getRequestPage(params);
  const filteredItems = [...store.records.values()]
    .filter((item) => matches(item, params))
    .sort((left, right) => compare(left, right, params));
  const size = getRequestSize(params, filteredItems.length);
  const startIndex = page * size;
  const items = filteredItems.slice(startIndex, startIndex + size).map((item) => cloneValue(item));

  return {
    items,
    page,
    size,
    totalItems: filteredItems.length,
    totalPages: filteredItems.length === 0 ? 0 : Math.ceil(filteredItems.length / size),
  };
}

function mergeCollectionResponse<TItem extends { id: UUID }>(
  store: DemoCollectionStore<TItem>,
  response: NormalizedPaginatedResponse<TItem>,
  canMarkComplete: boolean,
): void {
  response.items.forEach((item) => {
    if (store.deletedIds.has(item.id)) {
      return;
    }

    if (store.createdIds.has(item.id) || store.mutatedIds.has(item.id)) {
      return;
    }

    store.records.set(item.id, cloneValue(item));
  });

  store.hasFetched = true;
  store.knownTotalItems = Math.max(store.knownTotalItems, response.totalItems);

  if (canMarkComplete && (response.totalPages <= 1 || response.totalItems <= response.items.length)) {
    store.complete = true;
  }

  if (canMarkComplete && store.knownTotalItems >= 0 && store.records.size >= store.knownTotalItems) {
    store.complete = true;
  }
}

function getPeopleStore() {
  return demoRuntime.people;
}

function getRoomsStore() {
  return demoRuntime.rooms;
}

function getTimeSlotsStore() {
  return demoRuntime.timeSlots;
}

function getAssignmentsStore() {
  return demoRuntime.assignments;
}

function getPersonName(personId: UUID | null | undefined): string | null {
  if (!personId) {
    return null;
  }

  return getPeopleStore().records.get(personId)?.name ?? null;
}

function getRoomSnapshot(roomId: UUID): Room | null {
  return getRoomsStore().records.get(roomId) ?? null;
}

function getTimeSlotSnapshot(slotId: UUID): TimeSlot | null {
  return getTimeSlotsStore().records.get(slotId) ?? null;
}

function getNextGenerationVersion(): number {
  const existingVersions = [...getAssignmentsStore().records.values()].map((assignment) => assignment.generationVersion);
  const currentMax = existingVersions.length > 0 ? Math.max(...existingVersions) : 0;
  return currentMax + 1;
}

function createInvigilators(invigilatorIds: Array<UUID | null>, timestamp: string): AssignmentInvigilator[] {
  return invigilatorIds.map((invigilatorId, index) => ({
    id: createDemoId("demo_invigilator"),
    invigilatorId,
    invigilatorName: getPersonName(invigilatorId),
    positionIndex: index,
    required: true,
    createdAt: timestamp,
  }));
}

function createAssignmentRecord(
  payload: AssignmentRequest,
  options?: {
    createdAt?: string;
    generationVersion?: number;
    id?: UUID;
    source?: Assignment["source"];
  },
): Assignment {
  const room = getRoomSnapshot(payload.roomId);
  const timeSlot = getTimeSlotSnapshot(payload.timeSlotId);
  const timestamp = options?.createdAt ?? createIsoTimestamp();

  return {
    id: options?.id ?? createDemoId("demo_assignment"),
    scheduleGroupId: payload.scheduleGroupId,
    examDate: payload.examDate,
    roomId: payload.roomId,
    roomName: room?.name ?? "Unknown room",
    timeSlotId: payload.timeSlotId,
    slotLabel: timeSlot?.label ?? "Time slot",
    startTime: timeSlot?.startTime ?? "08:00:00",
    endTime: timeSlot?.endTime ?? "10:00:00",
    subjectName: normalizeText(payload.subjectName),
    subjectCode: normalizeText(payload.subjectCode),
    chiefInvigilatorId: payload.chiefInvigilatorId ?? null,
    chiefInvigilatorName: getPersonName(payload.chiefInvigilatorId),
    locked: payload.locked,
    generationVersion: options?.generationVersion ?? getNextGenerationVersion(),
    source: options?.source ?? payload.source ?? "MANUAL",
    invigilators: createInvigilators(payload.invigilatorIds, timestamp),
    createdAt: timestamp,
    updatedAt: createIsoTimestamp(),
  };
}

function updateAssignmentRecord(existing: Assignment, payload: AssignmentRequest): Assignment {
  const nextAssignment = createAssignmentRecord(payload, {
    createdAt: existing.createdAt,
    generationVersion: existing.generationVersion,
    id: existing.id,
    source: payload.source ?? existing.source,
  });

  return {
    ...nextAssignment,
    createdAt: existing.createdAt,
  };
}

function rebuildAssignmentsFromRelatedData(): void {
  const assignmentsStore = getAssignmentsStore();

  assignmentsStore.records.forEach((assignment, id) => {
    const room = getRoomSnapshot(assignment.roomId);
    const timeSlot = getTimeSlotSnapshot(assignment.timeSlotId);

    assignmentsStore.records.set(id, {
      ...assignment,
      roomName: room?.name ?? assignment.roomName,
      slotLabel: timeSlot?.label ?? assignment.slotLabel,
      startTime: timeSlot?.startTime ?? assignment.startTime,
      endTime: timeSlot?.endTime ?? assignment.endTime,
      chiefInvigilatorName: getPersonName(assignment.chiefInvigilatorId),
      invigilators: assignment.invigilators.map((invigilator) => ({
        ...invigilator,
        invigilatorName: getPersonName(invigilator.invigilatorId),
      })),
      updatedAt: createIsoTimestamp(),
    });
  });
}

function countAssignmentsForGroup(scheduleGroupId: UUID): Map<UUID, number> {
  const counts = new Map<UUID, number>();

  getAssignmentsStore().records.forEach((assignment) => {
    if (assignment.scheduleGroupId && assignment.scheduleGroupId !== scheduleGroupId) {
      return;
    }

    if (assignment.chiefInvigilatorId) {
      counts.set(assignment.chiefInvigilatorId, (counts.get(assignment.chiefInvigilatorId) ?? 0) + 1);
    }

    assignment.invigilators.forEach((invigilator) => {
      if (invigilator.invigilatorId) {
        counts.set(invigilator.invigilatorId, (counts.get(invigilator.invigilatorId) ?? 0) + 1);
      }
    });
  });

  return counts;
}

function overlayPeopleGroupWorkload(
  response: NormalizedPaginatedResponse<Person>,
  scheduleGroupId?: UUID,
): NormalizedPaginatedResponse<Person> {
  if (!scheduleGroupId) {
    return response;
  }

  const counts = countAssignmentsForGroup(scheduleGroupId);
  return {
    ...response,
    items: response.items.map((person) => ({
      ...person,
      totalAssignments: counts.get(person.id) ?? 0,
    })),
  };
}

function recalculatePersonAssignmentTotals(): void {
  const peopleStore = getPeopleStore();

  if (!peopleStore.hasFetched && peopleStore.records.size === 0) {
    return;
  }

  const counts = new Map<UUID, number>();

  getAssignmentsStore().records.forEach((assignment) => {
    if (assignment.chiefInvigilatorId) {
      counts.set(assignment.chiefInvigilatorId, (counts.get(assignment.chiefInvigilatorId) ?? 0) + 1);
    }

    assignment.invigilators.forEach((invigilator) => {
      if (invigilator.invigilatorId) {
        counts.set(invigilator.invigilatorId, (counts.get(invigilator.invigilatorId) ?? 0) + 1);
      }
    });
  });

  peopleStore.records.forEach((person, id) => {
    peopleStore.records.set(id, {
      ...person,
      totalAssignments: counts.get(id) ?? 0,
    });
  });
}

function createPersonRecord(payload: PersonRequest, options?: { createdAt?: string; id?: UUID }): Person {
  const timestamp = options?.createdAt ?? createIsoTimestamp();

  return {
    id: options?.id ?? createDemoId("demo_person"),
    name: normalizeWhitespace(payload.name),
    department: normalizeWhitespace(payload.department),
    email: normalizeText(payload.email)?.toLowerCase() ?? null,
    role: payload.role,
    availableDays: payload.availableDays.length > 0 ? [...payload.availableDays] : DEFAULT_WEEK_DAYS,
    totalAssignments: 0,
    active: true,
    maxParallelRooms: payload.role === "CHIEF_INVIGILATOR" ? 2 : 1,
    createdAt: timestamp,
    updatedAt: createIsoTimestamp(),
  };
}

function updatePersonRecord(existing: Person, payload: PersonRequest): Person {
  return {
    ...existing,
    name: normalizeWhitespace(payload.name),
    department: normalizeWhitespace(payload.department),
    email: normalizeText(payload.email)?.toLowerCase() ?? null,
    role: payload.role,
    availableDays: payload.availableDays.length > 0 ? [...payload.availableDays] : DEFAULT_WEEK_DAYS,
    updatedAt: createIsoTimestamp(),
  };
}

function createRoomRecord(payload: RoomRequest, options?: { createdAt?: string; id?: UUID }): Room {
  const timestamp = options?.createdAt ?? createIsoTimestamp();

  return {
    id: options?.id ?? createDemoId("demo_room"),
    name: normalizeWhitespace(payload.name),
    capacity: toPositiveInteger(payload.capacity, 40),
    type: payload.type,
    minInvigilators: toPositiveInteger(payload.minInvigilators, getMinInvigilatorsForCapacity(payload.capacity)),
    active: true,
    createdAt: timestamp,
    updatedAt: createIsoTimestamp(),
  };
}

function updateRoomRecord(existing: Room, payload: RoomRequest): Room {
  return {
    ...existing,
    name: normalizeWhitespace(payload.name),
    capacity: toPositiveInteger(payload.capacity, existing.capacity),
    type: payload.type,
    minInvigilators: toPositiveInteger(payload.minInvigilators, existing.minInvigilators),
    updatedAt: createIsoTimestamp(),
  };
}

function createTimeSlotRecord(payload: TimeSlotRequest, options?: { createdAt?: string; id?: UUID }): TimeSlot {
  const timestamp = options?.createdAt ?? createIsoTimestamp();

  return {
    id: options?.id ?? createDemoId("demo_slot"),
    scheduleGroupId: payload.scheduleGroupId,
    label: normalizeWhitespace(payload.label ?? "New time slot") || "New time slot",
    startTime: payload.startTime,
    endTime: payload.endTime,
    sortOrder: typeof payload.sortOrder === "number"
      ? payload.sortOrder
      : Math.max(1, ...[...getTimeSlotsStore().records.values()].map((slot) => slot.sortOrder + 1)),
    active: true,
    createdAt: timestamp,
    updatedAt: createIsoTimestamp(),
  };
}

function updateTimeSlotRecord(existing: TimeSlot, payload: TimeSlotRequest): TimeSlot {
  return {
    ...existing,
    label: normalizeWhitespace(payload.label ?? existing.label) || existing.label,
    startTime: payload.startTime,
    endTime: payload.endTime,
    sortOrder: typeof payload.sortOrder === "number" ? payload.sortOrder : existing.sortOrder,
    updatedAt: createIsoTimestamp(),
  };
}

function upsertCollectionRecord<TItem extends { id: UUID }>(
  store: DemoCollectionStore<TItem>,
  item: TItem,
  mode: "create" | "update",
): TItem {
  store.records.set(item.id, cloneValue(item));

  if (mode === "create") {
    store.createdIds.add(item.id);
    store.deletedIds.delete(item.id);
    return item;
  }

  if (!store.createdIds.has(item.id)) {
    store.mutatedIds.add(item.id);
  }

  store.deletedIds.delete(item.id);
  return item;
}

function deleteCollectionRecord<TItem extends { id: UUID }>(store: DemoCollectionStore<TItem>, id: UUID): void {
  const wasCreatedInSandbox = store.createdIds.has(id);
  store.records.delete(id);
  store.mutatedIds.delete(id);

  if (wasCreatedInSandbox) {
    store.createdIds.delete(id);
    return;
  }

  store.deletedIds.add(id);
}

function updateAssignmentsForDeletedPerson(personId: UUID): void {
  const assignmentsStore = getAssignmentsStore();

  assignmentsStore.records.forEach((assignment, id) => {
    const nextAssignment = {
      ...assignment,
      chiefInvigilatorId: assignment.chiefInvigilatorId === personId ? null : assignment.chiefInvigilatorId,
      chiefInvigilatorName: assignment.chiefInvigilatorId === personId ? null : assignment.chiefInvigilatorName,
      invigilators: assignment.invigilators.map((invigilator) => (
        invigilator.invigilatorId === personId
          ? {
              ...invigilator,
              invigilatorId: null,
              invigilatorName: null,
            }
          : invigilator
      )),
      updatedAt: createIsoTimestamp(),
    };

    assignmentsStore.records.set(id, nextAssignment);
  });
}

function deleteAssignmentsByField(field: "roomId" | "timeSlotId", id: UUID): void {
  const assignmentsStore = getAssignmentsStore();

  [...assignmentsStore.records.values()]
    .filter((assignment) => assignment[field] === id)
    .forEach((assignment) => {
      deleteCollectionRecord(assignmentsStore, assignment.id);
    });
}

function parseWorkbookRows(file: File): Promise<Array<{ row: number; values: string[] }>> {
  return file.arrayBuffer().then((buffer) => {
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      return [];
    }

    const sheet = workbook.Sheets[firstSheetName];
    const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      raw: false,
      defval: "",
    });

    return matrix
      .slice(1)
      .map((values, index) => ({
        row: index + 2,
        values: values.map((value) => (typeof value === "string" ? normalizeWhitespace(value) : String(value ?? ""))),
      }))
      .filter((row) => row.values.some((value) => value.length > 0));
  });
}

function buildBulkErrors(row: number, messages: string[]): BulkUploadError[] {
  return messages.map((message) => ({ message, row }));
}

async function readUploadFile(data: unknown): Promise<File | null> {
  if (!(data instanceof FormData)) {
    return null;
  }

  const file = data.get("file");
  return file instanceof File ? file : null;
}

async function handlePeopleBulkUpload(data: unknown, duplicateStrategy: "AUTO_RENAME" | "SKIP_DUPLICATES"): Promise<BulkUploadResult> {
  const file = await readUploadFile(data);

  if (!file) {
    return {
      successCount: 0,
      failedCount: 1,
      errors: [{ row: 0, message: "No file was provided." }],
    };
  }

  const rows = await parseWorkbookRows(file);
  const reservedNames = new Set(
    [...getPeopleStore().records.values()].map((person) => normalizeForComparison(person.name)),
  );
  const errors: BulkUploadError[] = [];
  let successCount = 0;

  for (const row of rows) {
    const [rawName = "", rawType = ""] = row.values;
    const name = normalizeWhitespace(rawName);
    const roleToken = normalizeEnumToken(rawType);
    const rowIssues: string[] = [];

    if (!name) {
      rowIssues.push("Name is empty.");
    } else if (name.length > PERSON_MAX_NAME_LENGTH) {
      rowIssues.push(`Name must be at most ${PERSON_MAX_NAME_LENGTH} characters.`);
    }

    if (!rawType) {
      rowIssues.push("Type is required.");
    } else if (!PERSON_TYPE_OPTIONS.has(roleToken)) {
      rowIssues.push("Type must be CHIEF_INVIGILATOR or INVIGILATOR.");
    }

    if (rowIssues.length > 0) {
      errors.push(...buildBulkErrors(row.row, rowIssues));
      continue;
    }

    if (duplicateStrategy === "SKIP_DUPLICATES" && reservedNames.has(normalizeForComparison(name))) {
      continue;
    }

    const { resolvedName } = resolveUniqueName(name, reservedNames, PERSON_MAX_NAME_LENGTH);
    upsertCollectionRecord(getPeopleStore(), createPersonRecord({
      name: resolvedName,
      department: "",
      role: roleToken as PersonRequest["role"],
      availableDays: DEFAULT_WEEK_DAYS,
    }), "create");
    successCount += 1;
  }

  rebuildAssignmentsFromRelatedData();
  recalculatePersonAssignmentTotals();

  return {
    successCount,
    failedCount: errors.length,
    errors,
  };
}

async function handleRoomsBulkUpload(data: unknown, duplicateStrategy: "AUTO_RENAME" | "SKIP_DUPLICATES"): Promise<BulkUploadResult> {
  const file = await readUploadFile(data);

  if (!file) {
    return {
      successCount: 0,
      failedCount: 1,
      errors: [{ row: 0, message: "No file was provided." }],
    };
  }

  const rows = await parseWorkbookRows(file);
  const reservedNames = new Set(
    [...getRoomsStore().records.values()].map((room) => normalizeForComparison(room.name)),
  );
  const errors: BulkUploadError[] = [];
  let successCount = 0;

  for (const row of rows) {
    const [rawName = "", rawCapacity = ""] = row.values;
    const name = normalizeWhitespace(rawName);
    const rowIssues: string[] = [];

    if (!name) {
      rowIssues.push("Name is empty.");
    } else if (name.length > ROOM_MAX_NAME_LENGTH) {
      rowIssues.push(`Name must be at most ${ROOM_MAX_NAME_LENGTH} characters.`);
    }

    if (rowIssues.length > 0) {
      errors.push(...buildBulkErrors(row.row, rowIssues));
      continue;
    }

    if (duplicateStrategy === "SKIP_DUPLICATES" && reservedNames.has(normalizeForComparison(name))) {
      continue;
    }

    const { resolvedName } = resolveUniqueName(name, reservedNames, ROOM_MAX_NAME_LENGTH);
    const capacity = Math.max(10, toPositiveInteger(rawCapacity, 40));
    upsertCollectionRecord(getRoomsStore(), createRoomRecord({
      name: resolvedName,
      capacity,
      type: getRoomTypeFromCapacity(capacity),
      minInvigilators: getMinInvigilatorsForCapacity(capacity),
    }), "create");
    successCount += 1;
  }

  rebuildAssignmentsFromRelatedData();

  return {
    successCount,
    failedCount: errors.length,
    errors,
  };
}

function handlePeopleMutation(path: string, method: DemoMethod, data: unknown) {
  if (path === "/api/people" && method === "POST") {
    const nextPerson = createPersonRecord(data as PersonRequest);
    upsertCollectionRecord(getPeopleStore(), nextPerson, "create");
    rebuildAssignmentsFromRelatedData();
    recalculatePersonAssignmentTotals();
    return createSuccessResponse(nextPerson);
  }

  const match = path.match(/^\/api\/people\/([^/]+)$/);
  if (!match) {
    return null;
  }

  const id = match[1] as UUID;
  const existing = getPeopleStore().records.get(id);

  if (!existing) {
    return null;
  }

  if (method === "PUT") {
    const nextPerson = updatePersonRecord(existing, data as PersonRequest);
    upsertCollectionRecord(getPeopleStore(), nextPerson, "update");
    rebuildAssignmentsFromRelatedData();
    recalculatePersonAssignmentTotals();
    return createSuccessResponse(nextPerson);
  }

  if (method === "DELETE") {
    deleteCollectionRecord(getPeopleStore(), id);
    updateAssignmentsForDeletedPerson(id);
    recalculatePersonAssignmentTotals();
    return createSuccessResponse(null);
  }

  return null;
}

function handleRoomsMutation(path: string, method: DemoMethod, data: unknown) {
  if (path === "/api/rooms" && method === "POST") {
    const nextRoom = createRoomRecord(data as RoomRequest);
    upsertCollectionRecord(getRoomsStore(), nextRoom, "create");
    rebuildAssignmentsFromRelatedData();
    return createSuccessResponse(nextRoom);
  }

  const match = path.match(/^\/api\/rooms\/([^/]+)$/);
  if (!match) {
    return null;
  }

  const id = match[1] as UUID;
  const existing = getRoomsStore().records.get(id);

  if (!existing) {
    return null;
  }

  if (method === "PUT") {
    const nextRoom = updateRoomRecord(existing, data as RoomRequest);
    upsertCollectionRecord(getRoomsStore(), nextRoom, "update");
    rebuildAssignmentsFromRelatedData();
    return createSuccessResponse(nextRoom);
  }

  if (method === "DELETE") {
    deleteCollectionRecord(getRoomsStore(), id);
    deleteAssignmentsByField("roomId", id);
    recalculatePersonAssignmentTotals();
    return createSuccessResponse(null);
  }

  return null;
}

function handleTimeSlotsMutation(path: string, method: DemoMethod, data: unknown) {
  if (path === "/api/slots" && method === "POST") {
    const nextTimeSlot = createTimeSlotRecord(data as TimeSlotRequest);
    upsertCollectionRecord(getTimeSlotsStore(), nextTimeSlot, "create");
    rebuildAssignmentsFromRelatedData();
    return createSuccessResponse(nextTimeSlot);
  }

  const deactivateMatch = path.match(/^\/api\/slots\/([^/]+)\/deactivate$/);
  if (deactivateMatch && method === "PATCH") {
    const id = deactivateMatch[1] as UUID;
    const existing = getTimeSlotsStore().records.get(id);

    if (!existing) {
      return null;
    }

    const nextTimeSlot = {
      ...existing,
      active: false,
      updatedAt: createIsoTimestamp(),
    } satisfies TimeSlot;
    upsertCollectionRecord(getTimeSlotsStore(), nextTimeSlot, "update");
    rebuildAssignmentsFromRelatedData();
    return createSuccessResponse(nextTimeSlot);
  }

  const match = path.match(/^\/api\/slots\/([^/]+)$/);
  if (!match) {
    return null;
  }

  const id = match[1] as UUID;
  const existing = getTimeSlotsStore().records.get(id);

  if (!existing) {
    return null;
  }

  if (method === "PUT") {
    const nextTimeSlot = updateTimeSlotRecord(existing, data as TimeSlotRequest);
    upsertCollectionRecord(getTimeSlotsStore(), nextTimeSlot, "update");
    rebuildAssignmentsFromRelatedData();
    return createSuccessResponse(nextTimeSlot);
  }

  if (method === "DELETE") {
    deleteCollectionRecord(getTimeSlotsStore(), id);
    deleteAssignmentsByField("timeSlotId", id);
    recalculatePersonAssignmentTotals();
    return createSuccessResponse(null);
  }

  return null;
}

function upsertAssignment(assignment: Assignment, mode: "create" | "update"): Assignment {
  const result = upsertCollectionRecord(getAssignmentsStore(), assignment, mode);
  recalculatePersonAssignmentTotals();
  return result;
}

function handleAssignmentsBulkSave(data: unknown) {
  const payload = Array.isArray(data) ? data as BulkAssignmentRequest[] : [];

  if (payload.length === 0) {
    return createSuccessResponse<Assignment[]>([]);
  }

  const examDate = payload[0]?.examDate;
  const slotId = payload[0]?.slotId;
  const scheduleGroupId = payload[0]?.scheduleGroupId;

  if (!examDate || !slotId) {
    return createSuccessResponse<Assignment[]>([]);
  }

  [...getAssignmentsStore().records.values()]
    .filter((assignment) => (
      assignment.examDate === examDate
      && assignment.timeSlotId === slotId
      && (!scheduleGroupId || assignment.scheduleGroupId === scheduleGroupId)
    ))
    .forEach((assignment) => deleteCollectionRecord(getAssignmentsStore(), assignment.id));

  const generationVersion = getNextGenerationVersion();
  const savedAssignments = payload.map((entry) => {
    const existing = [...getAssignmentsStore().records.values()].find((assignment) => (
      assignment.examDate === entry.examDate
      && assignment.roomId === entry.roomId
      && assignment.timeSlotId === entry.slotId
    ));

    const nextAssignment = createAssignmentRecord({
      scheduleGroupId: entry.scheduleGroupId,
      examDate: entry.examDate,
      roomId: entry.roomId,
      timeSlotId: entry.slotId,
      subjectName: entry.subjectName,
      subjectCode: entry.subjectCode,
      chiefInvigilatorId: entry.chiefInvigilatorId,
      locked: entry.isLocked,
      source: "GENERATED",
      invigilatorIds: entry.invigilatorIds,
    }, {
      createdAt: existing?.createdAt,
      generationVersion,
      id: existing?.id,
      source: "GENERATED",
    });

    return upsertAssignment(nextAssignment, existing ? "update" : "create");
  });

  rebuildAssignmentsFromRelatedData();
  recalculatePersonAssignmentTotals();

  return createSuccessResponse(savedAssignments);
}

function handleAssignmentsMutation(path: string, method: DemoMethod, data: unknown) {
  if (path === "/api/assignments" && method === "POST") {
    const nextAssignment = createAssignmentRecord(data as AssignmentRequest);
    return createSuccessResponse(upsertAssignment(nextAssignment, "create"));
  }

  if (path === "/api/assignments/bulk" && method === "POST") {
    return handleAssignmentsBulkSave(data);
  }

  const match = path.match(/^\/api\/assignments\/([^/]+)$/);
  if (!match) {
    return null;
  }

  const id = match[1] as UUID;
  const existing = getAssignmentsStore().records.get(id);

  if (!existing) {
    return null;
  }

  if (method === "PUT") {
    const nextAssignment = updateAssignmentRecord(existing, data as AssignmentRequest);
    return createSuccessResponse(upsertAssignment(nextAssignment, "update"));
  }

  if (method === "DELETE") {
    deleteCollectionRecord(getAssignmentsStore(), id);
    recalculatePersonAssignmentTotals();
    return createSuccessResponse(null);
  }

  return null;
}

function handleSettingsMutation(path: string, method: DemoMethod, data: unknown) {
  if (path !== "/api/settings" || method !== "PUT") {
    return null;
  }

  const existing = demoRuntime.settings.value;
  const payload = data as SettingsRequest;
  const nextSettings: Settings = {
    id: existing?.id ?? "demo-settings",
    systemName: payload.systemName,
    appTagline: payload.appTagline ?? "",
    logoUrl: payload.logoUrl ?? null,
    theme: payload.theme,
    universityName: payload.universityName,
    department: payload.department ?? null,
    examPeriod: payload.examPeriod,
  };

  demoRuntime.settings.value = nextSettings;
  demoRuntime.settings.hasFetched = true;
  demoRuntime.settings.isDirty = true;

  return createSuccessResponse(nextSettings);
}

async function handleBulkMutation(path: string, params: unknown, data: unknown) {
  const duplicateStrategy = ((params as { duplicateStrategy?: string } | undefined)?.duplicateStrategy ?? "AUTO_RENAME") as "AUTO_RENAME" | "SKIP_DUPLICATES";

  if (path === "/api/bulk/persons/upload") {
    return createSuccessResponse(await handlePeopleBulkUpload(data, duplicateStrategy));
  }

  if (path === "/api/bulk/rooms/upload") {
    return createSuccessResponse(await handleRoomsBulkUpload(data, duplicateStrategy));
  }

  return null;
}

function resolveCollectionGet(path: string, params: DemoParams) {
  if (path === "/api/people" && getPeopleStore().complete) {
    const peopleParams = params as PeopleQuery | undefined;
    return createSuccessResponse(overlayPeopleGroupWorkload(
      deriveCollectionResponse(getPeopleStore(), peopleParams, matchesPeopleQuery, comparePeople),
      peopleParams?.scheduleGroupId,
    ));
  }

  if (path === "/api/rooms" && getRoomsStore().complete) {
    return createSuccessResponse(deriveCollectionResponse(getRoomsStore(), params as RoomsQuery | undefined, matchesRoomsQuery, compareRooms));
  }

  if (path === "/api/slots" && getTimeSlotsStore().complete) {
    return createSuccessResponse(deriveCollectionResponse(getTimeSlotsStore(), params as TimeSlotsQuery | undefined, matchesTimeSlotsQuery, compareTimeSlots));
  }

  if (path === "/api/assignments" && getAssignmentsStore().complete) {
    return createSuccessResponse(deriveCollectionResponse(getAssignmentsStore(), params as AssignmentsQuery | undefined, matchesAssignmentsQuery, compareAssignments));
  }

  if (path === "/api/settings" && demoRuntime.settings.hasFetched && demoRuntime.settings.value) {
    return createSuccessResponse(cloneValue(demoRuntime.settings.value));
  }

  return null;
}

function trackCollectionGet(path: string, params: DemoParams, data: unknown): unknown {
  if (path === "/api/people") {
    mergeCollectionResponse(
      getPeopleStore(),
      data as NormalizedPaginatedResponse<Person>,
      !isPeopleQueryFiltered(params as PeopleQuery | undefined),
    );
    const peopleParams = params as PeopleQuery | undefined;
    return overlayPeopleGroupWorkload(
      deriveCollectionResponse(getPeopleStore(), peopleParams, matchesPeopleQuery, comparePeople),
      peopleParams?.scheduleGroupId,
    );
  }

  if (path === "/api/rooms") {
    mergeCollectionResponse(
      getRoomsStore(),
      data as NormalizedPaginatedResponse<Room>,
      !isRoomsQueryFiltered(params as RoomsQuery | undefined),
    );
    return deriveCollectionResponse(getRoomsStore(), params as RoomsQuery | undefined, matchesRoomsQuery, compareRooms);
  }

  if (path === "/api/slots") {
    mergeCollectionResponse(
      getTimeSlotsStore(),
      data as NormalizedPaginatedResponse<TimeSlot>,
      !isTimeSlotsQueryFiltered(params as TimeSlotsQuery | undefined),
    );
    return deriveCollectionResponse(getTimeSlotsStore(), params as TimeSlotsQuery | undefined, matchesTimeSlotsQuery, compareTimeSlots);
  }

  if (path === "/api/assignments") {
    mergeCollectionResponse(
      getAssignmentsStore(),
      data as NormalizedPaginatedResponse<Assignment>,
      !isAssignmentsQueryFiltered(params as AssignmentsQuery | undefined),
    );
    recalculatePersonAssignmentTotals();
    return deriveCollectionResponse(getAssignmentsStore(), params as AssignmentsQuery | undefined, matchesAssignmentsQuery, compareAssignments);
  }

  if (path === "/api/settings") {
    if (!demoRuntime.settings.isDirty) {
      demoRuntime.settings.value = cloneValue(data as Settings);
    }

    demoRuntime.settings.hasFetched = true;
    return cloneValue(demoRuntime.settings.value ?? (data as Settings));
  }

  return data;
}

export function clearDemoSandbox(): void {
  demoRuntime.enabled = false;
  demoRuntime.people = createCollectionStore<Person>();
  demoRuntime.rooms = createCollectionStore<Room>();
  demoRuntime.timeSlots = createCollectionStore<TimeSlot>();
  demoRuntime.assignments = createCollectionStore<Assignment>();
  demoRuntime.settings = createSettingsStore();
}

export function syncDemoSandboxUser(user: CurrentSession | null | undefined): void {
  const nextEnabled = isDemoUser(user);

  if (!nextEnabled) {
    clearDemoSandbox();
    return;
  }

  demoRuntime.enabled = true;
}

export function isDemoSandboxEnabled(): boolean {
  return demoRuntime.enabled;
}

export async function resolveDemoSandboxRequest<TResult>(config: DemoCacheableRequest) {
  if (!demoRuntime.enabled) {
    return null;
  }

  const method = getRequestMethod(config.method);
  const path = getRequestPath(config.url);

  if (method === "GET") {
    return resolveCollectionGet(path, config.params as DemoParams);
  }

  if (path.startsWith("/api/bulk/")) {
    return handleBulkMutation(path, config.params, config.data) as Promise<ReturnType<typeof createSuccessResponse<TResult>> | null>;
  }

  return (
    handlePeopleMutation(path, method, config.data)
    || handleRoomsMutation(path, method, config.data)
    || handleTimeSlotsMutation(path, method, config.data)
    || handleAssignmentsMutation(path, method, config.data)
    || handleSettingsMutation(path, method, config.data)
  ) as ReturnType<typeof createSuccessResponse<TResult>> | null;
}

export function trackDemoSandboxResponse<TResult>(config: DemoCacheableRequest, data: TResult): TResult {
  if (!demoRuntime.enabled) {
    return data;
  }

  if (getRequestMethod(config.method) !== "GET") {
    return data;
  }

  return trackCollectionGet(getRequestPath(config.url), config.params as DemoParams, data) as TResult;
}