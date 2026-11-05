import type { AxiosRequestConfig } from "axios";

import type {
    RequestDeduplicationOptions,
    RequestFingerprintInput,
    RequestLockState,
} from "../types";

type ActiveRequestState = Exclude<RequestLockState, "idle">;

interface RequestLockEntry<T = unknown> {
  controller?: AbortController;
  promise: Promise<T>;
  state: ActiveRequestState;
  cleanupTimer?: ReturnType<typeof setTimeout>;
}

const DEFAULT_MUTATION_COOLDOWN_MS = 400;
const inFlightRequests = new Map<string, RequestLockEntry>();
const subscribers = new Set<() => void>();

let requestRegistryVersion = 0;

function emitRegistryUpdate(): void {
  requestRegistryVersion += 1;
  subscribers.forEach((subscriber) => subscriber());
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function normalizeFingerprintValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof URLSearchParams !== "undefined" && value instanceof URLSearchParams) {
    return Array.from(value.entries()).sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      const left = `${leftKey}:${leftValue}`;
      const right = `${rightKey}:${rightValue}`;
      return left.localeCompare(right);
    });
  }

  if (typeof FormData !== "undefined" && value instanceof FormData) {
    return Array.from(value.entries())
      .map(([key, entry]) => [key, normalizeFingerprintValue(entry)] as const)
      .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
        const left = `${leftKey}:${stableSerialize(leftValue)}`;
        const right = `${rightKey}:${stableSerialize(rightValue)}`;
        return left.localeCompare(right);
      });
  }

  if (typeof File !== "undefined" && value instanceof File) {
    return {
      __type: "File",
      lastModified: value.lastModified,
      name: value.name,
      size: value.size,
      type: value.type,
    };
  }

  if (typeof Blob !== "undefined" && value instanceof Blob) {
    return {
      __type: "Blob",
      size: value.size,
      type: value.type,
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeFingerprintValue(item));
  }

  if (isPlainObject(value)) {
    return Object.entries(value)
      .filter(([, item]) => item !== undefined && typeof item !== "function")
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .reduce<Record<string, unknown>>((normalizedValue, [key, item]) => {
        normalizedValue[key] = normalizeFingerprintValue(item);
        return normalizedValue;
      }, {});
  }

  return value;
}

function stableSerialize(value: unknown): string {
  return JSON.stringify(normalizeFingerprintValue(value));
}

function normalizeMethod(method?: string): string {
  return (method ?? "GET").toUpperCase();
}

function resolveRequestUrl(baseURL?: string, url?: string): string {
  if (!url) {
    return baseURL?.replace(/\/+$/, "") ?? "";
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  const normalizedBaseUrl = baseURL?.replace(/\/+$/, "") ?? "";
  const normalizedUrl = url.replace(/^\/+/, "");

  return normalizedBaseUrl ? `${normalizedBaseUrl}/${normalizedUrl}` : `/${normalizedUrl}`;
}

function isMutationMethod(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(method);
}

function createMergedAbortSignal(...signals: Array<AbortSignal | undefined>): {
  dispose: () => void;
  signal?: AbortSignal;
} {
  const activeSignals = signals.filter((signal): signal is AbortSignal => Boolean(signal));

  if (activeSignals.length === 0) {
    return { dispose: () => undefined };
  }

  if (activeSignals.length === 1) {
    return { dispose: () => undefined, signal: activeSignals[0] };
  }

  const controller = new AbortController();
  const listeners: Array<() => void> = [];

  const abort = () => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
  };

  activeSignals.forEach((signal) => {
    if (signal.aborted) {
      abort();
      return;
    }

    const abortListener = () => abort();
    signal.addEventListener("abort", abortListener, { once: true });
    listeners.push(() => signal.removeEventListener("abort", abortListener));
  });

  return {
    dispose: () => listeners.forEach((listener) => listener()),
    signal: controller.signal,
  };
}

function clearRequestEntry(fingerprint: string, entry: RequestLockEntry): void {
  if (entry.cleanupTimer) {
    clearTimeout(entry.cleanupTimer);
  }

  if (inFlightRequests.get(fingerprint) === entry) {
    inFlightRequests.delete(fingerprint);
    emitRegistryUpdate();
  }
}

function moveEntryToCooldown(fingerprint: string, entry: RequestLockEntry, cooldownMs: number): void {
  if (inFlightRequests.get(fingerprint) !== entry) {
    return;
  }

  if (entry.cleanupTimer) {
    clearTimeout(entry.cleanupTimer);
  }

  if (cooldownMs <= 0) {
    inFlightRequests.delete(fingerprint);
    emitRegistryUpdate();
    return;
  }

  entry.state = "cooldown";
  entry.cleanupTimer = setTimeout(() => {
    if (inFlightRequests.get(fingerprint) === entry) {
      inFlightRequests.delete(fingerprint);
      emitRegistryUpdate();
    }
  }, cooldownMs);

  emitRegistryUpdate();
}

export function resolveRequestDeduplicationOptions(
  config: AxiosRequestConfig,
  dedupe?: RequestDeduplicationOptions,
): Required<RequestDeduplicationOptions> {
  const method = normalizeMethod(config.method);

  return {
    cooldownMs: dedupe?.cooldownMs ?? (isMutationMethod(method) ? DEFAULT_MUTATION_COOLDOWN_MS : 0),
    enabled: dedupe?.enabled ?? true,
    key: dedupe?.key ?? "",
    mode: dedupe?.mode ?? "join",
  };
}

export function createRequestFingerprint(input: RequestFingerprintInput): string {
  if (input.key) {
    return input.key;
  }

  const method = normalizeMethod(input.method);
  const url = resolveRequestUrl(input.baseURL, input.url);
  const resourceIdSegment = input.resourceId !== undefined && input.resourceId !== null
    ? `resource:${String(input.resourceId)}`
    : "resource:";

  return [
    method,
    url,
    resourceIdSegment,
    `params:${stableSerialize(input.params ?? null)}`,
    `data:${stableSerialize(input.data ?? null)}`,
  ].join("|");
}

export function getRequestFingerprint(
  config: AxiosRequestConfig,
  dedupe?: RequestDeduplicationOptions,
): string {
  return createRequestFingerprint({
    baseURL: config.baseURL,
    data: config.data,
    key: dedupe?.key,
    method: config.method,
    params: config.params,
    url: config.url,
  });
}

export function executeWithRequestDeduplication<T>(options: {
  config: AxiosRequestConfig;
  dedupe: Required<RequestDeduplicationOptions>;
  execute: (signal?: AbortSignal) => Promise<T>;
}): Promise<T> {
  const { config, dedupe, execute } = options;

  if (!dedupe.enabled || dedupe.mode === "none") {
    return execute(config.signal as AbortSignal | undefined);
  }

  const fingerprint = getRequestFingerprint(config, dedupe);
  const existingEntry = inFlightRequests.get(fingerprint) as RequestLockEntry<T> | undefined;

  if (existingEntry) {
    if (dedupe.mode !== "cancel-previous" || existingEntry.state === "cooldown") {
      return existingEntry.promise;
    }

    existingEntry.controller?.abort();
    clearRequestEntry(fingerprint, existingEntry);
  }

  const controller = typeof AbortController !== "undefined" ? new AbortController() : undefined;
  const { dispose, signal } = createMergedAbortSignal(config.signal as AbortSignal | undefined, controller?.signal);

  // Declared before the promise callbacks that reference it, assigned exactly once below.
  // eslint-disable-next-line prefer-const
  let entry!: RequestLockEntry<T>;

  const promise = execute(signal)
    .then((result) => {
      dispose();
      moveEntryToCooldown(fingerprint, entry, dedupe.cooldownMs);
      return result;
    })
    .catch((error) => {
      dispose();
      moveEntryToCooldown(fingerprint, entry, dedupe.cooldownMs);
      throw error;
    });

  entry = {
    controller,
    promise,
    state: "pending",
  };

  inFlightRequests.set(fingerprint, entry);
  emitRegistryUpdate();

  return promise;
}

export function getRequestLockState(fingerprint: string): RequestLockState {
  return inFlightRequests.get(fingerprint)?.state ?? "idle";
}

export function isRequestFingerprintLocked(fingerprint: string): boolean {
  return getRequestLockState(fingerprint) !== "idle";
}

export function subscribeToRequestRegistry(listener: () => void): () => void {
  subscribers.add(listener);

  return () => {
    subscribers.delete(listener);
  };
}

export function getRequestRegistryVersion(): number {
  return requestRegistryVersion;
}

export function resetRequestDeduplicationState(): void {
  inFlightRequests.forEach((entry, fingerprint) => clearRequestEntry(fingerprint, entry));
  inFlightRequests.clear();
  emitRegistryUpdate();
}