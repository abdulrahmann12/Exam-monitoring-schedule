import { ApiError } from "@/api";
import { isDemoRestrictionError } from "@/lib/demoMode";
import { toast } from "sonner";

interface ErrorToastOptions {
  title?: string;
  fallbackMessage?: string;
}

export function getErrorMessage(error: unknown, fallbackMessage = "An unexpected error occurred."): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallbackMessage;
}

export function showErrorToast(error: unknown, options?: ErrorToastOptions): void {
  if (error instanceof ApiError && isDemoRestrictionError(error)) {
    return;
  }

  const message = getErrorMessage(error, options?.fallbackMessage);

  if (options?.title) {
    toast.error(options.title, { description: message });
    return;
  }

  toast.error(message);
}