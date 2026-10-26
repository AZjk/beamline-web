// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import { cn } from "../cn";

export interface SegmentedOption<V extends string> {
  value: V;
  label: string;
  title?: string;
}

export interface SegmentedProps<V extends string> {
  options: SegmentedOption<V>[];
  value: V;
  onChange: (value: V) => void;
  size?: "sm" | "md";
  title?: string;
  "aria-label"?: string;
}

/** One choice among a few, as a row of buttons (a radio group). */
export function Segmented<V extends string>({
  options,
  value,
  onChange,
  size = "md",
  title,
  ...aria
}: SegmentedProps<V>) {
  return (
    <div
      role="radiogroup"
      title={title}
      aria-label={aria["aria-label"]}
      className={cn(
        "inline-flex overflow-hidden rounded-md border border-line-2 bg-surface",
        size === "sm" ? "h-6" : "h-7",
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          title={option.title}
          onClick={() => onChange(option.value)}
          className={cn(
            "px-2 whitespace-nowrap transition-colors first:rounded-l-md last:rounded-r-md",
            size === "sm" ? "text-xs" : "text-[13px]",
            option.value === value ? "bg-accent text-white" : "text-ink-2 hover:bg-surface-3",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
