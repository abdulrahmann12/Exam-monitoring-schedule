import type {
    CurrentSession,
    NormalizedPaginatedResponse,
    Person,
    TimeSlot,
} from "../types";

import {
    clearDemoSandbox,
    resolveDemoSandboxRequest,
    syncDemoSandboxUser,
    trackDemoSandboxResponse,
} from "./demoSandbox";

const demoUser: CurrentSession = {
  email: "demo@uniguard.com",
  roles: ["DEMO_ADMIN"],
};

function expectSuccess<T>(value: Awaited<ReturnType<typeof resolveDemoSandboxRequest<T>>>) {
  expect(value).not.toBeNull();
  expect(value?.success).toBe(true);
  return value as { data: T; error: null; success: true };
}

describe("demoSandbox", () => {
  beforeEach(() => {
    clearDemoSandbox();
  });

  it("serves created people from the in-memory sandbox after an unfiltered seed", async () => {
    syncDemoSandboxUser(demoUser);

    trackDemoSandboxResponse<NormalizedPaginatedResponse<Person>>(
      {
        method: "GET",
        params: { direction: "ASC", page: 0, size: 100, sortBy: "name" },
        url: "/api/people",
      },
      {
        items: [{
          id: "person-1",
          name: "Existing Person",
          department: "Admin",
          role: "INVIGILATOR",
          availableDays: ["Sun", "Mon"],
          totalAssignments: 0,
          active: true,
          maxParallelRooms: 1,
          createdAt: "2026-05-28T00:00:00.000Z",
          updatedAt: "2026-05-28T00:00:00.000Z",
        }],
        page: 0,
        size: 100,
        totalItems: 1,
        totalPages: 1,
      },
    );

    const createResponse = expectSuccess<Person>(await resolveDemoSandboxRequest<Person>({
      method: "POST",
      url: "/api/people",
      data: {
        name: "Demo Chief",
        department: "Demo",
        role: "CHIEF_INVIGILATOR",
        availableDays: ["Sun", "Tue", "Thu"],
      },
    }));

    expect(createResponse.data.name).toBe("Demo Chief");
    expect(createResponse.data.id.startsWith("demo_person_")).toBe(true);

    const listResponse = expectSuccess<NormalizedPaginatedResponse<Person>>(await resolveDemoSandboxRequest({
      method: "GET",
      params: { direction: "ASC", page: 0, size: 100, sortBy: "name" },
      url: "/api/people",
    }));

    expect(listResponse.data.totalItems).toBe(2);
    expect(listResponse.data.items.map((person) => person.name)).toEqual(["Demo Chief", "Existing Person"]);
  });

  it("does not treat a filtered time-slot seed as a complete sandbox snapshot", async () => {
    syncDemoSandboxUser(demoUser);

    trackDemoSandboxResponse<NormalizedPaginatedResponse<TimeSlot>>(
      {
        method: "GET",
        params: { activeOnly: true, direction: "ASC", page: 0, size: 20, sortBy: "sortOrder" },
        url: "/api/slots",
      },
      {
        items: [{
          id: "slot-1",
          label: "Morning Session",
          startTime: "08:00:00",
          endTime: "10:00:00",
          sortOrder: 1,
          active: true,
          createdAt: "2026-05-28T00:00:00.000Z",
          updatedAt: "2026-05-28T00:00:00.000Z",
        }],
        page: 0,
        size: 20,
        totalItems: 1,
        totalPages: 1,
      },
    );

    const response = await resolveDemoSandboxRequest<NormalizedPaginatedResponse<TimeSlot>>({
      method: "GET",
      params: { direction: "ASC", page: 0, size: 100, sortBy: "sortOrder" },
      url: "/api/slots",
    });

    expect(response).toBeNull();
  });

  it("keeps scheduler bulk saves local and readable through subsequent assignment queries", async () => {
    syncDemoSandboxUser(demoUser);

    trackDemoSandboxResponse({
      method: "GET",
      params: { direction: "ASC", page: 0, size: 100, sortBy: "name" },
      url: "/api/people",
    }, {
      items: [{
        id: "chief-1",
        name: "Dr. Chief",
        department: "Ops",
        role: "CHIEF_INVIGILATOR",
        availableDays: ["Sun", "Mon"],
        totalAssignments: 0,
        active: true,
        maxParallelRooms: 2,
        createdAt: "2026-05-28T00:00:00.000Z",
        updatedAt: "2026-05-28T00:00:00.000Z",
      }, {
        id: "inv-1",
        name: "Invigilator One",
        department: "Ops",
        role: "INVIGILATOR",
        availableDays: ["Sun", "Mon"],
        totalAssignments: 0,
        active: true,
        maxParallelRooms: 1,
        createdAt: "2026-05-28T00:00:00.000Z",
        updatedAt: "2026-05-28T00:00:00.000Z",
      }],
      page: 0,
      size: 100,
      totalItems: 2,
      totalPages: 1,
    });

    trackDemoSandboxResponse({
      method: "GET",
      params: { direction: "ASC", page: 0, size: 100, sortBy: "name" },
      url: "/api/rooms",
    }, {
      items: [{
        id: "room-1",
        name: "H101",
        capacity: 45,
        type: "MEDIUM",
        minInvigilators: 2,
        active: true,
        createdAt: "2026-05-28T00:00:00.000Z",
        updatedAt: "2026-05-28T00:00:00.000Z",
      }],
      page: 0,
      size: 100,
      totalItems: 1,
      totalPages: 1,
    });

    trackDemoSandboxResponse({
      method: "GET",
      params: { direction: "ASC", page: 0, size: 100, sortBy: "sortOrder" },
      url: "/api/slots",
    }, {
      items: [{
        id: "slot-1",
        label: "Morning Session",
        startTime: "08:00:00",
        endTime: "11:00:00",
        sortOrder: 1,
        active: true,
        createdAt: "2026-05-28T00:00:00.000Z",
        updatedAt: "2026-05-28T00:00:00.000Z",
      }],
      page: 0,
      size: 100,
      totalItems: 1,
      totalPages: 1,
    });

    trackDemoSandboxResponse({
      method: "GET",
      params: { direction: "ASC", page: 0, size: 100, sortBy: "examDate" },
      url: "/api/assignments",
    }, {
      items: [],
      page: 0,
      size: 100,
      totalItems: 0,
      totalPages: 0,
    });

    const saveResponse = expectSuccess(await resolveDemoSandboxRequest({
      method: "POST",
      url: "/api/assignments/bulk",
      data: [{
        examDate: "2026-05-28",
        roomId: "room-1",
        slotId: "slot-1",
        subjectName: "Algorithms",
        subjectCode: "CS401",
        chiefInvigilatorId: "chief-1",
        isLocked: false,
        invigilatorIds: ["inv-1", null],
      }],
    }));

    expect(saveResponse.data).toHaveLength(1);
    expect(saveResponse.data[0].roomName).toBe("H101");
    expect(saveResponse.data[0].slotLabel).toBe("Morning Session");

    const assignmentsResponse = expectSuccess(await resolveDemoSandboxRequest({
      method: "GET",
      params: { direction: "ASC", page: 0, size: 100, sortBy: "examDate" },
      url: "/api/assignments",
    }));

    expect(assignmentsResponse.data.totalItems).toBe(1);
    expect(assignmentsResponse.data.items[0].chiefInvigilatorName).toBe("Dr. Chief");
    expect(assignmentsResponse.data.items[0].invigilators[0].invigilatorName).toBe("Invigilator One");
  });
});