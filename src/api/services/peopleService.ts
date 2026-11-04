import type {
  BackendPaginatedResponse,
  NormalizedPaginatedResponse,
  PeopleQuery,
  Person,
  PersonRequest,
  ServiceResponse,
  Unavailability,
  UnavailabilityRequest,
  UUID,
} from "../types";
import { normalizePaginatedResponse } from "../utils/pagination";
import { performRequest } from "../utils/request";

const PEOPLE_ENDPOINT = "/api/people";

async function getPeople(
  params?: PeopleQuery,
): Promise<ServiceResponse<NormalizedPaginatedResponse<Person>>> {
  return performRequest<BackendPaginatedResponse<Person>, NormalizedPaginatedResponse<Person>>(
    {
      url: PEOPLE_ENDPOINT,
      method: "GET",
      params,
    },
    normalizePaginatedResponse,
  );
}

async function createPerson(payload: PersonRequest): Promise<ServiceResponse<Person>> {
  return performRequest<Person>({
    url: PEOPLE_ENDPOINT,
    method: "POST",
    data: payload,
  });
}

async function updatePerson(id: UUID, payload: PersonRequest): Promise<ServiceResponse<Person>> {
  return performRequest<Person>({
    url: `${PEOPLE_ENDPOINT}/${id}`,
    method: "PUT",
    data: payload,
  });
}

async function deletePerson(id: UUID): Promise<ServiceResponse<null>> {
  return performRequest<unknown, null>(
    {
      url: `${PEOPLE_ENDPOINT}/${id}`,
      method: "DELETE",
    },
    () => null,
  );
}

async function getUnavailability(personId: UUID): Promise<ServiceResponse<Unavailability[]>> {
  return performRequest<Unavailability[]>({
    url: `${PEOPLE_ENDPOINT}/${personId}/unavailability`,
    method: "GET",
  });
}

async function addUnavailability(
  personId: UUID,
  payload: UnavailabilityRequest,
): Promise<ServiceResponse<Unavailability>> {
  return performRequest<Unavailability>({
    url: `${PEOPLE_ENDPOINT}/${personId}/unavailability`,
    method: "POST",
    data: payload,
  });
}

async function deleteUnavailability(personId: UUID, unavailabilityId: UUID): Promise<ServiceResponse<null>> {
  return performRequest<unknown, null>(
    {
      url: `${PEOPLE_ENDPOINT}/${personId}/unavailability/${unavailabilityId}`,
      method: "DELETE",
    },
    () => null,
  );
}

export const peopleService = {
  getPeople,
  createPerson,
  updatePerson,
  deletePerson,
  getUnavailability,
  addUnavailability,
  deleteUnavailability,
};