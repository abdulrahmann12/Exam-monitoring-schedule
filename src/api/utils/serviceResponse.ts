import { type ApiError, type ServiceResponse } from "../types";

export function createSuccessResponse<T>(data: T): ServiceResponse<T> {
  return {
    data,
    error: null,
    success: true,
  };
}

export function createErrorResponse<T>(error: ApiError): ServiceResponse<T> {
  return {
    data: null,
    error,
    success: false,
  };
}

/** The data of a successful response; throws the ApiError of a failed one. */
export function unwrapServiceResponse<T>(response: ServiceResponse<T>): T {
  if (response.success) {
    return response.data;
  }

  throw response.error;
}

export function isApiError(error: unknown): error is ApiError {
  return Boolean(error && typeof error === "object" && (error as ApiError).name === "ApiError");
}
