import {
    useMutation,
    type MutationFunction,
    type UseMutationOptions,
    type UseMutationResult,
} from "@tanstack/react-query";
import {
    useCallback,
    useMemo,
    useSyncExternalStore,
} from "react";

import type {
    RequestDeduplicationOptions,
    RequestFingerprintInput,
    RequestLockState,
} from "@/api";
import {
    createRequestFingerprint,
    getRequestLockState,
    getRequestRegistryVersion,
    subscribeToRequestRegistry,
} from "@/api/utils";

type FingerprintFactory<TVariables> = (variables: TVariables) => RequestFingerprintInput;

interface UseSafeRequestOptions<TVariables, TResult> {
  dedupe?: RequestDeduplicationOptions;
  getFingerprint: FingerprintFactory<TVariables>;
  request?: (variables: TVariables) => Promise<TResult>;
}

interface SafeMutationOptions<TData, TError, TVariables, TContext>
  extends Omit<UseMutationOptions<TData, TError, TVariables, TContext>, "mutationFn"> {
  dedupe?: RequestDeduplicationOptions;
  getFingerprint: FingerprintFactory<TVariables>;
  mutationFn: MutationFunction<TData, TVariables>;
}

// UseMutationResult is a union (idle | pending | error | success), which an interface cannot
// extend — doing so silently dropped every mutation property (mutateAsync, isPending, ...).
type SafeMutationResult<TData, TError, TVariables, TContext> =
  UseMutationResult<TData, TError, TVariables, TContext> & {
    getIsLocked: (variables: TVariables) => boolean;
    getIsPending: (variables: TVariables) => boolean;
    getRequestFingerprint: (variables: TVariables) => string;
    getRequestState: (variables: TVariables) => RequestLockState;
    runSafely: (variables: TVariables) => Promise<TData>;
  };

export function useSafeRequest<TVariables, TResult = void>(options: UseSafeRequestOptions<TVariables, TResult>) {
  const { dedupe, getFingerprint, request } = options;
  const registryVersion = useSyncExternalStore(
    subscribeToRequestRegistry,
    getRequestRegistryVersion,
    getRequestRegistryVersion,
  );

  void registryVersion;

  const getRequestFingerprint = useCallback(
    (variables: TVariables) => {
      const fingerprint = getFingerprint(variables);

      return createRequestFingerprint({
        ...fingerprint,
        key: dedupe?.key ?? fingerprint.key,
      });
    },
    [dedupe?.key, getFingerprint],
  );

  const getRequestState = useCallback(
    (variables: TVariables): RequestLockState => getRequestLockState(getRequestFingerprint(variables)),
    [getRequestFingerprint],
  );

  const getIsPending = useCallback(
    (variables: TVariables) => getRequestState(variables) === "pending",
    [getRequestState],
  );

  const getIsLocked = useCallback(
    (variables: TVariables) => getRequestState(variables) !== "idle",
    [getRequestState],
  );

  const run = useCallback(
    async (variables: TVariables) => {
      if (!request) {
        throw new Error("useSafeRequest.run requires a request handler.");
      }

      return request(variables);
    },
    [request],
  );

  return useMemo(
    () => ({
      getFingerprint: getRequestFingerprint,
      getIsLocked,
      getIsPending,
      getRequestState,
      run,
    }),
    [getIsLocked, getIsPending, getRequestFingerprint, getRequestState, run],
  );
}

export function useSafeMutation<TData, TError = Error, TVariables = void, TContext = unknown>(
  options: SafeMutationOptions<TData, TError, TVariables, TContext>,
): SafeMutationResult<TData, TError, TVariables, TContext> {
  const { dedupe, getFingerprint, mutationFn, ...mutationOptions } = options;
  const mutation = useMutation<TData, TError, TVariables, TContext>({
    ...mutationOptions,
    mutationFn,
  });
  const safeRequest = useSafeRequest<TVariables, TData>({
    dedupe,
    getFingerprint,
    request: mutation.mutateAsync,
  });

  return {
    ...mutation,
    getIsLocked: safeRequest.getIsLocked,
    getIsPending: safeRequest.getIsPending,
    getRequestFingerprint: safeRequest.getFingerprint,
    getRequestState: safeRequest.getRequestState,
    runSafely: safeRequest.run,
  };
}