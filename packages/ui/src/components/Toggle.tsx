// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import type { ReactNode } from "react";

import { cn } from "../cn";

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  title?: string;
  disabled?: boolean;
  className?: string;
}

/** A labeled check box. */
export function Toggle({ checked, onChange, children, title, disabled, className }: ToggleProps) {
  return (
    <label
      title={title}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 text-[13px] whitespace-nowrap select-none",
        disabled && "opacity-50",
        className,
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-3.5 w-3.5 accent-accent"
      />
      {children}
    </label>
  );
}
