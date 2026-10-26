// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Class names, merged so a later Tailwind utility wins over an earlier one. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
