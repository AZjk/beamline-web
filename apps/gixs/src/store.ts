// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/**
 * The page's state: the shared slice of the kit plus what the gixsu tools exchange: the
 * processing settings every image and cut uses, the geometry overrides per file, the box ROIs
 * of the Cuts tool, the overlays the tools draw on the image, the last peak fit, the setup
 * file in use. What is small lives here (and in the URL); the setup file lives in the session
 * on the server.
 */

import { sharedSlice, type SharedState } from "@beamline-web/ui";
import { create } from "zustand";

import type { FileRow, FitCut, OverlayIn, Roi, SessionSetup } from "./api/client";

export interface Processing {
  level: string;
  /** -1 for the mean of the frames, else one frame. */
  frame: number;
  normalization: string;
  sample: Record<string, unknown>;
}

export const DEFAULT_PROCESSING: Processing = {
  level: "I2",
  frame: -1,
  normalization: "none",
  sample: {},
};

export interface AppState extends SharedState {
  files: FileRow[];
  total: number;
  setFiles: (files: FileRow[], total: number) => void;
  processing: Processing;
  setProcessing: (patch: Partial<Processing>) => void;
  /** Geometry overrides per file id, as the Setup and Calibrate tools set them. */
  fileOverrides: Record<string, Record<string, number>>;
  setFileOverrides: (overrides: Record<string, Record<string, number>>) => void;
  /** The box ROIs of the Cuts tool (the API's shape). */
  boxes: Roi[];
  setBoxes: (boxes: Roi[]) => void;
  selectedBox: string | null;
  setSelectedBox: (id: string | null) => void;
  /** The tools' overlays on the image, by source. */
  toolOverlays: Record<string, OverlayIn[]>;
  setToolOverlays: (source: string, items: OverlayIn[] | null) => void;
  /** The last peak fit on a cut (the Texture tool takes its q0 from it). */
  lastFit: FitCut | null;
  setLastFit: (fit: FitCut | null) => void;
  setup: SessionSetup | null;
  setSetup: (setup: SessionSetup | null) => void;
  /** A line for the message bar: a job's progress, a note. */
  message: string | null;
  setMessage: (message: string | null) => void;
}

export const useAppStore = create<AppState>()((...a) => ({
  ...sharedSlice(...a),
  tab: "cuts",
  files: [],
  total: 0,
  setFiles: (files, total) => a[0]({ files, total }),
  processing: DEFAULT_PROCESSING,
  setProcessing: (patch) => a[0]((s) => ({ processing: { ...s.processing, ...patch } })),
  fileOverrides: {},
  setFileOverrides: (fileOverrides) => a[0]({ fileOverrides }),
  boxes: [],
  setBoxes: (boxes) => a[0]({ boxes }),
  selectedBox: null,
  setSelectedBox: (selectedBox) => a[0]({ selectedBox }),
  toolOverlays: {},
  setToolOverlays: (source, items) =>
    a[0]((s) => {
      if (!(items && items.length) && !(source in s.toolOverlays)) return {};
      const next = { ...s.toolOverlays };
      if (items && items.length) next[source] = items;
      else delete next[source];
      return { toolOverlays: next };
    }),
  lastFit: null,
  setLastFit: (lastFit) => a[0]({ lastFit }),
  setup: null,
  setSetup: (setup) => a[0]({ setup }),
  message: null,
  setMessage: (message) => a[0]({ message }),
}));

export const fileRow = (state: Pick<AppState, "files">, id: string | null) =>
  id ? (state.files.find((f) => f.id === id) ?? null) : null;
export const labelOf = (state: Pick<AppState, "files">, id: string) =>
  fileRow(state, id)?.label ?? id;

/** The file shown followed by the checked files (each once): what the analyses work on. */
export function selectedFiles(state: Pick<AppState, "active" | "selection">): string[] {
  const out = state.active ? [state.active] : [];
  for (const id of state.selection) if (id !== state.active) out.push(id);
  return out;
}

/** The frames setting as the API spells it. */
export const framesOf = (frame: number) => (frame < 0 ? "mean" : String(Math.round(frame)));

/** Every overlay of every tool. */
export function flatOverlays(overlays: Record<string, OverlayIn[]>): OverlayIn[] {
  return Object.values(overlays).flat();
}
