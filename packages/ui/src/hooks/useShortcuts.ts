// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import { useEffect } from "react";

export type ShortcutMap = Record<string, (event: KeyboardEvent) => void>;

/**
 * Keyboard shortcuts on the page, by key (`"1"`, `"]"`, `"ArrowRight"`), ignored while an input
 * has the focus or a modifier is held.
 */
export function useShortcuts(map: ShortcutMap, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.matches?.("input, select, textarea, [contenteditable]") ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      const action = map[event.key];
      if (action) {
        event.preventDefault();
        action(event);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [map, enabled]);
}
