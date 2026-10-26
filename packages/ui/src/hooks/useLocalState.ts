// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import { useCallback, useState } from "react";

/**
 * State kept in localStorage under `key` (a form's settings for the next visit). Storage that is
 * missing or blocked is tolerated: the state then lives for the page.
 */
export function useLocalState<T>(
  key: string,
  initial: T,
): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? initial : { ...initial, ...(JSON.parse(raw) as Partial<T>) };
    } catch {
      return initial;
    }
  });
  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          /* private window */
        }
        return resolved;
      });
    },
    [key],
  );
  return [value, update];
}
