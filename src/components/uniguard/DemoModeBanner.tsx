import { FlaskConical, X } from "lucide-react";
import { useState } from "react";

import { useDemoUser } from "@/hooks";
import { DEMO_MODE_BANNER_MESSAGE } from "@/lib/demoMode";

import { Button } from "../ui/button";

export function DemoModeBanner() {
  const isDemoUser = useDemoUser();
  const [isDismissed, setIsDismissed] = useState(false);

  if (!isDemoUser || isDismissed) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4">
      <div
        aria-live="polite"
        className="pointer-events-auto flex w-full max-w-2xl items-center gap-3 rounded-full border border-amber-300/70 bg-amber-50/95 px-4 py-3 text-sm text-amber-950 shadow-lg backdrop-blur dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100"
        role="status"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-200">
          <FlaskConical className="h-4 w-4" />
        </div>
        <p className="flex-1 font-medium">{DEMO_MODE_BANNER_MESSAGE}</p>
        <Button
          aria-label="Dismiss demo mode banner"
          className="h-8 w-8 rounded-full text-current hover:bg-amber-500/10"
          onClick={() => setIsDismissed(true)}
          size="icon"
          type="button"
          variant="ghost"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}