import type { ISOInstant, SortDirection, UUID } from "./api";

export type RoomType = "SMALL" | "MEDIUM" | "LARGE";
/** MIXED = anyone; MALE/FEMALE = gender-separated hall. */
export type HallGender = "MIXED" | "MALE" | "FEMALE";

export interface RoomsQuery {
  page?: number;
  size?: number;
  sortBy?: "id" | "name" | "capacity" | "type" | "minInvigilators";
  direction?: SortDirection;
  type?: RoomType;
  name?: string;
  minCapacity?: number;
  maxCapacity?: number;
}

export interface RoomRequest {
  name: string;
  capacity: number;
  type: RoomType;
  minInvigilators: number;
  hallGender?: HallGender;
  /** Room type. Left out: guessed from the name (new room: "Lab 2" → Lab, else Classroom) or unchanged (edit). */
  roomCategoryId?: UUID;
  /** false = out of service. Left out: in service (new room) or unchanged (edit). */
  active?: boolean;
  /** Building ("H"). Left out: guessed from the name (new room) or unchanged (edit). "" = no building. */
  building?: string;
}

export interface Room {
  id: UUID;
  name: string;
  capacity: number;
  type: RoomType;
  minInvigilators: number;
  hallGender?: HallGender;
  /** false = out of service: never offered for new exams. */
  active: boolean;
  /** Room type; null = none (a normal room). */
  roomCategoryId: UUID | null;
  roomCategoryName: string | null;
  /** Special type (lab, studio): only for exams that ask for exactly this type. */
  roomCategorySpecial: boolean;
  /** Building, or null when not known. Split exams stay in one building; a chief covers rooms of one building. */
  building: string | null;
  createdAt: ISOInstant;
  updatedAt: ISOInstant;
}
/** A room type of the university ("Classroom", "Computer Lab", ...). */
export interface RoomCategory {
  id: UUID;
  name: string;
  /** true = only for exams that ask for exactly this type; normal exams never get these rooms. */
  special: boolean;
  sortOrder: number;
  /** How many rooms have this type. */
  rooms: number;
}

export interface RoomCategoryRequest {
  name: string;
  special: boolean;
}
