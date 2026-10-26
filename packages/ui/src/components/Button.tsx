// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import type { ButtonHTMLAttributes } from "react";

import { cn } from "../cn";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "link";
  size?: "sm" | "md";
}

export function Button({
  variant = "default",
  size = "md",
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border font-medium whitespace-nowrap transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-6 px-2 text-xs" : "h-7 px-2.5 text-[13px]",
        variant === "default" && "border-line-2 bg-surface text-ink hover:bg-surface-3",
        variant === "primary" && "border-accent bg-accent text-white hover:bg-accent/90",
        variant === "link" && "h-auto border-0 px-0 text-accent underline-offset-2 hover:underline",
        className,
      )}
      {...rest}
    />
  );
}
