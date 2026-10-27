// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/** The g2 tab's settings, kept for the next visit, and the request bodies built from them. */

import { range } from "@beamline-web/ui";

export const PARAMS = {
  single: ["a", "b", "c", "d"],
  double: ["a", "b", "c", "d", "b2", "c2", "f"],
} as const;
export type FitFunc = keyof typeof PARAMS;
export type ParamName = (typeof PARAMS.double)[number];

export const PARAM_TITLES: Record<ParamName, string> = {
  a: "a · contrast",
  b: "b · τ (s)",
  c: "c · stretch",
  d: "d · baseline",
  b2: "b₂ · τ₂ (s)",
  c2: "c₂ · stretch₂",
  f: "f · fraction",
};

export interface Bound {
  min: number;
  max: number;
  fit: boolean;
}

export interface G2Settings {
  layout: "q" | "file" | "combined";
  cols: number;
  marker: number;
  legend: boolean;
  baseline: boolean;
  qmin: number | null;
  qmax: number | null;
  qauto: boolean;
  tmin: number | null;
  tmax: number | null;
  tauto: boolean;
  ymin: number | null;
  ymax: number | null;
  yauto: boolean;
  func: FitFunc;
  showfit: boolean;
  bounds: Record<ParamName, Bound>;
}

export const G2_DEFAULTS: G2Settings = {
  layout: "q",
  cols: 2,
  marker: 6,
  legend: true,
  baseline: true,
  qmin: 0,
  qmax: 0.01,
  qauto: true,
  tmin: 1e-6,
  tmax: 1000,
  tauto: true,
  ymin: 1,
  ymax: 1.8,
  yauto: true,
  func: "single",
  showfit: false,
  bounds: {
    a: { min: 0.04, max: 0.8, fit: true },
    b: { min: 1e-5, max: 100, fit: true },
    c: { min: 0.5, max: 2, fit: true },
    d: { min: 0.95, max: 1.05, fit: true },
    b2: { min: 1e-5, max: 1, fit: true },
    c2: { min: 0.5, max: 2, fit: true },
    f: { min: 0, max: 1, fit: true },
  },
};

/** The q and τ ranges of the data fetched: null for all. */
export function g2Ranges(s: G2Settings) {
  const q = s.qauto ? null : range(s.qmin, s.qmax);
  const t = s.tauto ? null : range(s.tmin, s.tmax);
  return {
    q_range: q,
    t_range: t,
    query: { q_min: q?.[0], q_max: q?.[1], t_min: t?.[0], t_max: t?.[1] },
  };
}

/** The fit request of the settings: function, bounds and flags. */
export function fitSettings(s: G2Settings) {
  const keys = PARAMS[s.func];
  return {
    fit_func: s.func,
    bounds: [keys.map((k) => s.bounds[k].min), keys.map((k) => s.bounds[k].max)],
    fit_flag: keys.map((k) => s.bounds[k].fit),
  };
}
