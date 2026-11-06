import { Day, Room, Slot, Staff, minInvigilatorsForCapacity } from "./types";

const allDays: Day[] = ["Sun", "Mon", "Tue", "Wed", "Thu"];

const chiefNames = [
  "Dr. Amir Hassan", "Dr. Layla Mansour", "Dr. Omar Khalil", "Dr. Nadia Saleh",
  "Dr. Yusuf Rahman", "Dr. Mariam Farouk", "Dr. Karim Adel", "Dr. Hala Ibrahim",
  "Dr. Tarek Nour", "Dr. Salma Hosny",
];

const invigilatorNames = [
  "Ahmed Sami", "Mona Adel", "Hossam Ali", "Reem Tarek", "Khaled Wael",
  "Yara Magdy", "Mostafa Sherif", "Dina Ezzat", "Ziad Hany", "Farah Nabil",
  "Bassel Hisham", "Nour Galal", "Adham Ramy", "Habiba Shawky", "Seif Maged",
  "Malak Ashraf", "Karim Saad", "Aya Mohsen", "Omar Talaat", "Lina Sabry",
];

const departments = ["Computer Science", "Engineering", "Mathematics", "Physics", "Business"];

export const seedStaff = (): Staff[] => [
  ...chiefNames.map((name, i): Staff => ({
    id: `C${i + 1}`,
    name,
    role: "CHIEF_INVIGILATOR",
    maxParallelRooms: 2,
    department: departments[i % departments.length],
    workingDays: i % 4 === 0 ? ["Sun", "Mon", "Wed"] : i % 3 === 0 ? ["Mon", "Tue", "Thu"] : allDays,
    totalAssignments: 0,
  })),
  ...invigilatorNames.map((name, i): Staff => ({
    id: `I${i + 1}`,
    name,
    role: "INVIGILATOR",
    maxParallelRooms: 1,
    department: departments[i % departments.length],
    workingDays: i % 5 === 0 ? ["Sun", "Tue", "Thu"] : i % 4 === 0 ? ["Mon", "Wed", "Thu"] : i % 3 === 0 ? ["Sun", "Mon", "Tue", "Wed"] : allDays,
    totalAssignments: 0,
  })),
];

const room = (id: string, name: string, capacity: number): Room => ({ id, name, capacity, minInvigilators: minInvigilatorsForCapacity(capacity) });

export const seedRooms = (): Room[] => [
  room("R1", "Hall A", 80), room("R2", "Hall B", 60), room("R3", "Hall C", 45), room("R4", "Room 101", 30), room("R5", "Room 102", 35),
  room("R6", "Room 201", 25), room("R7", "Room 202", 38), room("R8", "Lab 1", 20), room("R9", "Lab 2", 22), room("R10", "Auditorium", 120),
];

export const SLOTS: Slot[] = [
  { id: "S1", startTime: "09:00", endTime: "11:00", subjectName: "Algorithms", subjectCode: "CS301" },
  { id: "S2", startTime: "11:30", endTime: "13:30", subjectName: "Data Structures", subjectCode: "CS202" },
  { id: "S3", startTime: "14:00", endTime: "16:00", subjectName: "Operating Systems", subjectCode: "CS340" },
  { id: "S4", startTime: "16:30", endTime: "18:30", subjectName: "Database Systems", subjectCode: "CS360" },
];
