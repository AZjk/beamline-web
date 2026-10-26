// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/**
 * The page's URL names the file shown, the files checked and the tab (`?file=&check=&tab=`),
 * so a view can be shared; the store writes it back as it changes.
 */

import { useEffect } from "react";

import { useAppStore } from "./store";

export interface UrlState {
  file: string | null;
  check: string[];
  tab: string | null;
}

export function readUrlState(search = window.location.search): UrlState {
  const query = new URLSearchParams(search);
  return {
    file: query.get("file"),
    check: (query.get("check") ?? "").split(",").filter(Boolean),
    tab: query.get("tab"),
  };
}

export function writeUrlState(state: {
  active: string | null;
  selection: string[];
  tab: string;
}): void {
  const next = new URLSearchParams();
  if (state.active) next.set("file", state.active);
  if (state.selection.length) next.set("check", state.selection.join(","));
  if (state.tab) next.set("tab", state.tab);
  const text = next.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${text ? `?${text}` : ""}`);
}

/** Apply the URL once the files are known (a file not in the folder is ignored), then follow the store. */
export function useUrlState(ready: boolean): void {
  useEffect(() => {
    if (!ready) return;
    const { file, check, tab } = readUrlState();
    const state = useAppStore.getState();
    const known = new Set(state.files.map((f) => f.id));
    if (file && known.has(file)) state.setActive(file);
    const checked = check.filter((id) => known.has(id));
    if (checked.length) state.setSelection(checked);
    if (tab) state.setTab(tab);
    const stop = useAppStore.subscribe((s, previous) => {
      if (
        s.active !== previous.active ||
        s.selection !== previous.selection ||
        s.tab !== previous.tab
      ) {
        writeUrlState(s);
      }
    });
    writeUrlState(useAppStore.getState());
    return stop;
  }, [ready]);
}
