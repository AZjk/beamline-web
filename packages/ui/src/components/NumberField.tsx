// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import { useEffect, useState } from "react";

import { cn } from "../cn";

export interface NumberFieldProps {
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number | "any";
  placeholder?: string;
  title?: string;
  size?: "sm" | "md";
  width?: string;
  className?: string;
  "aria-label"?: string;
  disabled?: boolean;
}

/**
 * A number input that reports a number, or null when blank, once the value is committed (on
 * change or Enter), clamped to its bounds; what is typed stays as typed meanwhile.
 */
export function NumberField({
  value,
  onChange,
  min,
  max,
  step = "any",
  placeholder,
  title,
  size = "md",
  width,
  className,
  disabled,
  ...aria
}: NumberFieldProps) {
  const [text, setText] = useState(value === null ? "" : String(value));
  useEffect(() => {
    setText(value === null ? "" : String(value));
  }, [value]);
  const commit = () => {
    if (text.trim() === "") {
      onChange(null);
      return;
    }
    let number = Number(text);
    if (Number.isNaN(number)) {
      setText(value === null ? "" : String(value));
      return;
    }
    if (min !== undefined && number < min) number = min;
    if (max !== undefined && number > max) number = max;
    setText(String(number));
    if (number !== value) onChange(number);
  };
  return (
    <input
      type="number"
      inputMode="decimal"
      value={text}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      title={title}
      disabled={disabled}
      aria-label={aria["aria-label"]}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
      }}
      style={width ? { width } : undefined}
      className={cn(
        "rounded-md border border-line-2 bg-surface px-1.5 text-ink tabular-nums outline-none focus:border-accent",
        size === "sm" ? "h-6 text-xs" : "h-7 text-[13px]",
        !width && "w-20",
        className,
      )}
    />
  );
}
