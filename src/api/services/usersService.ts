import type { AppUser, CreateUserRequest, ServiceResponse, UpdateUserRequest, UUID } from "../types";
import { performRequest } from "../utils/request";

const USERS_ENDPOINT = "/api/users";

async function getUsers(): Promise<ServiceResponse<AppUser[]>> {
  return performRequest<AppUser[]>({ url: USERS_ENDPOINT, method: "GET" });
}

async function createUser(payload: CreateUserRequest): Promise<ServiceResponse<AppUser>> {
  return performRequest<AppUser>({ url: USERS_ENDPOINT, method: "POST", data: payload });
}

async function updateUser(id: UUID, payload: UpdateUserRequest): Promise<ServiceResponse<AppUser>> {
  return performRequest<AppUser>({ url: `${USERS_ENDPOINT}/${id}`, method: "PUT", data: payload });
}

async function unlockUser(id: UUID): Promise<ServiceResponse<AppUser>> {
  return performRequest<AppUser>({ url: `${USERS_ENDPOINT}/${id}/unlock`, method: "POST" });
}

async function resetPassword(id: UUID, temporaryPassword: string): Promise<ServiceResponse<AppUser>> {
  return performRequest<AppUser>({
    url: `${USERS_ENDPOINT}/${id}/reset-password`,
    method: "POST",
    data: { temporaryPassword },
  });
}

async function deleteUser(id: UUID): Promise<ServiceResponse<null>> {
  return performRequest<unknown, null>({ url: `${USERS_ENDPOINT}/${id}`, method: "DELETE" }, () => null);
}

export const usersService = {
  getUsers,
  createUser,
  updateUser,
  unlockUser,
  resetPassword,
  deleteUser,
};
