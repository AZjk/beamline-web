// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import type { SelectHTMLAttributes } from "react";

import { cn } from "../cn";

export interface SelectOption<V extends string> {
  value: V;
  label: string;
  /** Shown on hover over the option (where the browser supports it). */
  title?: string;
}

export interface SelectFieldProps<V extends string> extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "value" | "onChange" | "size"
> {
  options: SelectOption<V>[];
  value: V;
  onChange: (value: V) => void;
  size?: "sm" | "md";
}

/** A native select in the kit's style (accessible, keyboard-friendly, no extra code). */
export function SelectField<V extends string>({
  options,
  value,
  onChange,
  size = "md",
  className,
  ...rest
}: SelectFieldProps<V>) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as V)}
      className={cn(
        "rounded-md border border-line-2 bg-surface px-1 text-ink outline-none focus:border-accent",
        size === "sm" ? "h-6 text-xs" : "h-7 text-[13px]",
        className,
      )}
      {...rest}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value} title={option.title}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
