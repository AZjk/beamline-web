// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/** The processing and overrides of the store as the API takes them: a request body's `context`
 * and a GET route's query. */

import type { Context } from "./client";
import { framesOf, type AppState } from "../store";

type Settings = Pick<AppState, "processing" | "fileOverrides">;

export function contextOf(state: Settings): Context {
  return {
    processing: {
      level: state.processing.level,
      frames: framesOf(state.processing.frame),
      normalization: state.processing.normalization,
      sample: state.processing.sample,
    },
    overrides: state.fileOverrides,
  };
}

export interface ContextQuery {
  level: string;
  frames: string;
  normalization: string;
  sample?: string;
  overrides?: string;
}

/** The query of a file's GET route (image, summary, pixel). */
export function queryOf(state: Settings, id: string | null): ContextQuery {
  const own = id ? state.fileOverrides[id] : undefined;
  return {
    level: state.processing.level,
    frames: framesOf(state.processing.frame),
    normalization: state.processing.normalization,
    sample: Object.keys(state.processing.sample).length
      ? JSON.stringify(state.processing.sample)
      : undefined,
    overrides: own && Object.keys(own).length ? JSON.stringify(own) : undefined,
  };
}
