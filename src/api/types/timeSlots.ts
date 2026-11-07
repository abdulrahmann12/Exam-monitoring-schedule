import type { ISOInstant, ISOTime, SortDirection, UUID } from "./api";

export interface TimeSlotsQuery {
  page?: number;
  size?: number;
  sortBy?: "id" | "label" | "startTime" | "endTime" | "sortOrder";
  direction?: SortDirection;
  label?: string;
  activeOnly?: boolean;
}

/** Time slots are shared by every exam period, like people and rooms. */
export interface TimeSlotRequest {
  label?: string;
  startTime: ISOTime;
  endTime: ISOTime;
  sortOrder?: number;
}

export interface TimeSlot {
  id: UUID;
  label: string;
  startTime: ISOTime;
  endTime: ISOTime;
  sortOrder: number;
  active: boolean;
  createdAt: ISOInstant;
  updatedAt: ISOInstant;
}