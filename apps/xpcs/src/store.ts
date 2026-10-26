// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/** The page's state: the shared slice of the kit plus what the xpcs tabs exchange. */

import { sharedSlice, type SharedState } from "@beamline-web/ui";
import { create } from "zustand";

import type { FileRow } from "./api/client";

export interface AppState extends SharedState {
  /** The folder's files as listed (filtered and sorted), for labels and analysis types. */
  files: FileRow[];
  total: number;
  setFiles: (files: FileRow[], total: number) => void;
  /** The C2 block shown on the two-time tab, shared with the image's bin overlay. */
  twotimeSelection: number;
  setTwotimeSelection: (index: number) => void;
}

export const useAppStore = create<AppState>()((...a) => ({
  ...sharedSlice(...a),
  tab: "g2",
  files: [],
  total: 0,
  setFiles: (files, total) => a[0]({ files, total }),
  twotimeSelection: 0,
  setTwotimeSelection: (twotimeSelection) => a[0]({ twotimeSelection }),
}));

export const fileRow = (state: Pick<AppState, "files">, id: string | null) =>
  id ? (state.files.find((f) => f.id === id) ?? null) : null;
export const labelOf = (state: Pick<AppState, "files">, id: string) =>
  fileRow(state, id)?.label ?? id;
export const atypeOf = (state: Pick<AppState, "files">, id: string) =>
  fileRow(state, id)?.atype ?? [];
export const isMultitau = (state: Pick<AppState, "files">, id: string) =>
  atypeOf(state, id).includes("Multitau");
export const isTwotime = (state: Pick<AppState, "files">, id: string) =>
  atypeOf(state, id).includes("Twotime");

/** The multi-tau files an analysis works on: the checked ones, else the one shown. */
export function multitauFiles(state: Pick<AppState, "files" | "active" | "selection">): string[] {
  const ids = state.selection.length ? state.selection : state.active ? [state.active] : [];
  return ids.filter((id) => isMultitau(state, id));
}

export function analysisFiles(state: Pick<AppState, "active" | "selection">): string[] {
  return state.selection.length ? state.selection : state.active ? [state.active] : [];
}
