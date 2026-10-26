// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import { useEffect, useState } from "react";

import { cn } from "../cn";

/** True once `active` has been true for `delay` ms: a loading indicator that never flashes. */
export function useDelayed(active: boolean, delay = 400): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!active) {
      setShown(false);
      return;
    }
    const timer = window.setTimeout(() => setShown(true), delay);
    return () => window.clearTimeout(timer);
  }, [active, delay]);
  return shown;
}

/** A translucent veil with a spinner over a loading area, after a delay. */
export function Busy({
  active,
  delay = 400,
  className,
}: {
  active: boolean;
  delay?: number;
  className?: string;
}) {
  const shown = useDelayed(active, delay);
  if (!shown) return null;
  return (
    <div
      role="status"
      aria-label="loading"
      className={cn(
        "absolute inset-0 z-10 flex items-center justify-center bg-surface/60",
        className,
      )}
    >
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-line-2 border-t-accent" />
    </div>
  );
}

/** A message in the middle of an empty or failed area. */
export function Placeholder({
  children,
  error,
  className,
}: {
  children: React.ReactNode;
  error?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-24 items-center justify-center p-4 text-center text-[13px]",
        error ? "text-danger" : "text-muted",
        className,
      )}
    >
      {children}
    </div>
  );
}
