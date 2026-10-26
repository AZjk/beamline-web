// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/**
 * The shared store every plugin reads and writes: the file shown, the files checked, the tab,
 * and slots for what the plugins exchange (processing options, overrides, ROIs, a fit result,
 * overlays). An app extends it with its own state.
 */

import { create, type StateCreator } from "zustand";

export interface Roi {
  id: string;
  kind: "box" | "ellipse" | "polygon" | "line" | "pixel";
  /** Coordinates in data units, as the ROI JSON format of the stack. */
  coordinates: number[][];
  inclusive: boolean;
  group?: number;
  mirror?: boolean;
  enabled: boolean;
  label?: string;
}

export interface SharedState {
  /** The file shown (its id). */
  active: string | null;
  /** The files checked, in list order. */
  selection: string[];
  /** The analysis tab shown. */
  tab: string;
  options: Record<string, unknown>;
  overrides: Record<string, unknown>;
  rois: Roi[];
  fit: unknown;
  overlays: Record<string, unknown>;
  setActive: (id: string | null) => void;
  setSelection: (ids: string[]) => void;
  setTab: (id: string) => void;
  setOption: (key: string, value: unknown) => void;
  setOverride: (key: string, value: unknown) => void;
  setRois: (rois: Roi[]) => void;
  setFit: (fit: unknown) => void;
  setOverlay: (key: string, value: unknown) => void;
}

/** The slice an app composes into its store: `create<AppState>()((...a) => ({ ...sharedSlice(...a), ...own }))`. */
export const sharedSlice: StateCreator<SharedState, [], [], SharedState> = (set) => ({
  active: null,
  selection: [],
  tab: "",
  options: {},
  overrides: {},
  rois: [],
  fit: null,
  overlays: {},
  setActive: (active) => set({ active }),
  setSelection: (selection) => set({ selection }),
  setTab: (tab) => set({ tab }),
  setOption: (key, value) => set((s) => ({ options: { ...s.options, [key]: value } })),
  setOverride: (key, value) => set((s) => ({ overrides: { ...s.overrides, [key]: value } })),
  setRois: (rois) => set({ rois }),
  setFit: (fit) => set({ fit }),
  setOverlay: (key, value) => set((s) => ({ overlays: { ...s.overlays, [key]: value } })),
});

/** A store with only the shared slice (an app with nothing of its own, or a story). */
export const createSharedStore = () => create<SharedState>()(sharedSlice);

/** The files an analysis of several files works on: the checked ones, else the one shown. */
export function filesForAnalysis(state: Pick<SharedState, "active" | "selection">): string[] {
  if (state.selection.length) return state.selection;
  return state.active ? [state.active] : [];
}
