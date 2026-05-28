import type { AxiosRequestConfig, AxiosResponse } from "axios";

import { apiClient } from "../client";
import { ApiError, type RequestDeduplicationOptions, type ServiceResponse } from "../types";
import { resolveDemoSandboxRequest, trackDemoSandboxResponse } from "./demoSandbox";
import { normalizeApiError } from "./errorHandler";
import { executeWithRequestDeduplication, resolveRequestDeduplicationOptions } from "./requestDeduplication";
import { createErrorResponse, createSuccessResponse } from "./serviceResponse";

type ResponseTransformer<TResponse, TResult> = (
  data: TResponse,
  response: AxiosResponse<TResponse>,
) => TResult;

export interface SafeRequestConfig extends AxiosRequestConfig {
  dedupe?: RequestDeduplicationOptions;
}

export async function performRequest<TResponse, TResult = TResponse>(
  config: SafeRequestConfig,
  transform?: ResponseTransformer<TResponse, TResult>,
): Promise<ServiceResponse<TResult>> {
  const { dedupe, ...axiosConfig } = config;

  const demoResponse = await resolveDemoSandboxRequest<TResult>(axiosConfig);

  if (demoResponse) {
    return demoResponse;
  }

  try {
    const response = await executeWithRequestDeduplication<AxiosResponse<TResponse>>({
      config: axiosConfig,
      dedupe: resolveRequestDeduplicationOptions(axiosConfig, dedupe),
      execute: (signal) => apiClient.request<TResponse>({
        ...axiosConfig,
        signal,
      }),
    });
    const transformedData = transform ? transform(response.data, response) : (response.data as TResult);
    const data = trackDemoSandboxResponse(axiosConfig, transformedData);

    return createSuccessResponse(data);
  } catch (error) {
    const apiError = error instanceof ApiError ? error : normalizeApiError(error);
    return createErrorResponse<TResult>(apiError);
  }
}