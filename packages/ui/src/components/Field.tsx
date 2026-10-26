// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import type { ReactNode } from "react";

import { cn } from "../cn";

export interface FieldProps {
  label: ReactNode;
  children: ReactNode;
  unit?: ReactNode;
  title?: string;
  className?: string;
}

/** A labeled control in a toolbar: the label, the control, an optional unit. */
export function Field({ label, children, unit, title, className }: FieldProps) {
  return (
    <label
      title={title}
      className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", className)}
    >
      <span className="text-xs text-muted">{label}</span>
      {children}
      {unit ? <span className="text-xs text-muted">{unit}</span> : null}
    </label>
  );
}

/** A row of controls. */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1.5 px-2 py-1.5", className)}>
      {children}
    </div>
  );
}

/** A small heading inside a tool panel. */
export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h4 className={cn("text-xs font-semibold tracking-wide text-ink-2 uppercase", className)}>
      {children}
    </h4>
  );
}

/** A hint line under a control. */
export function Hint({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-xs leading-snug text-muted", className)}>{children}</p>;
}

/** A keyboard key. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-line-2 bg-surface-3 px-1 font-mono text-[10px] text-ink-2">
      {children}
    </kbd>
  );
}
