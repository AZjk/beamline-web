// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/**
 * The page's URL names the file shown, the files checked, the tab and the correction level
 * (`?file=&check=&tab=&level=`), so a view can be shared; the store writes it back as it changes.
 */

import { useEffect } from "react";

import { useAppStore } from "./store";

export interface UrlState {
  file: string | null;
  check: string[];
  tab: string | null;
  level: string | null;
}

export function readUrlState(search = window.location.search): UrlState {
  const query = new URLSearchParams(search);
  return {
    file: query.get("file"),
    check: (query.get("check") ?? "").split(",").filter(Boolean),
    tab: query.get("tab"),
    level: query.get("level"),
  };
}

export function writeUrlState(state: {
  active: string | null;
  selection: string[];
  tab: string;
  level: string;
}): void {
  const next = new URLSearchParams();
  if (state.active) next.set("file", state.active);
  if (state.selection.length) next.set("check", state.selection.join(","));
  if (state.tab) next.set("tab", state.tab);
  if (state.level && state.level !== "I2") next.set("level", state.level);
  const text = next.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${text ? `?${text}` : ""}`);
}

/** Apply the URL once the files are known (a file not in the folder is ignored), then follow the store. */
export function useUrlState(ready: boolean): void {
  useEffect(() => {
    if (!ready) return;
    const { file, check, tab, level } = readUrlState();
    const state = useAppStore.getState();
    const known = new Set(state.files.map((f) => f.id));
    if (file && known.has(file)) state.setActive(file);
    const checked = check.filter((id) => known.has(id));
    if (checked.length) state.setSelection(checked);
    if (tab) state.setTab(tab);
    if (level) state.setProcessing({ level });
    const stop = useAppStore.subscribe((s, previous) => {
      if (
        s.active !== previous.active ||
        s.selection !== previous.selection ||
        s.tab !== previous.tab ||
        s.processing.level !== previous.processing.level
      ) {
        writeUrlState({ ...s, level: s.processing.level });
      }
    });
    const s = useAppStore.getState();
    writeUrlState({ ...s, level: s.processing.level });
    return stop;
  }, [ready]);
}
