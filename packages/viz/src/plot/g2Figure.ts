// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/**
 * The g2 figure: curves with error bars in a grid of panels, one per q-bin, one per file, or all
 * together, with the fits when asked for. Shared by the g2 tab and the stability panel.
 */

import type { Layout, PlotData } from "plotly.js";

import { orderedColor, seriesColor, type ColorStop } from "../colormaps";
import {
  baseLayout,
  errorBars,
  grid,
  logTicks,
  markers,
  outerLegend,
  positiveExtent,
  symbol,
} from "./theme";

export interface G2FitInput {
  /** The fitted curve's abscissa (`nx` points). */
  fitX: ArrayLike<number>;
  /** The fitted curves, q-bins × nx, row-major; NaN rows for bins without a fit. */
  fitY: ArrayLike<number>;
  nx: number;
  success: boolean[];
  /** Per q-bin, the parameters (the 4th, `d`, is the baseline). */
  params: (Array<number | null> | null)[];
}

export interface G2SeriesInput {
  label: string;
  q: number[];
  labels: string[];
  /** The delays. */
  t: ArrayLike<number>;
  /** The g2 values, delays × q-bins, row-major. */
  g2: ArrayLike<number>;
  err: ArrayLike<number>;
  fit?: G2FitInput | null;
}

export interface G2FigureOptions {
  mode?: "q" | "file" | "combined";
  cols?: number;
  /** Decades of vertical offset per file. */
  offset?: number;
  showFit?: boolean;
  subtractBaseline?: boolean;
  markerSize?: number;
  legend?: boolean;
  tRange?: [number, number] | null;
  yRange?: [number, number] | null;
  /** The color scale ordered series (q-bins of one file) are colored from. */
  scale?: ColorStop[];
}

/** Column `n` of a delays × q-bins array. */
export function column(flat: ArrayLike<number>, nt: number, nq: number, n: number): number[] {
  const out = new Array<number>(nt);
  for (let i = 0; i < nt; i += 1) out[i] = flat[i * nq + n]!;
  return out;
}

const shortLabel = (label: string): string => {
  const m = /^qbin=(\d+),\s*(.*)$/.exec(label || "");
  return m ? `${m[2]}  ·  bin ${m[1]}` : label;
};

const DEFAULT_SCALE: ColorStop[] = [
  [0, "rgb(68,1,84)"],
  [0.25, "rgb(59,82,139)"],
  [0.5, "rgb(33,145,140)"],
  [0.75, "rgb(94,201,98)"],
  [1, "rgb(253,231,37)"],
];

export function g2Figure(
  files: G2SeriesInput[],
  options: G2FigureOptions = {},
): { data: Partial<PlotData>[]; layout: Partial<Layout>; rows: number } {
  const {
    mode = "q",
    cols = 2,
    offset = 0,
    showFit = false,
    subtractBaseline = true,
    markerSize = 6,
    legend = true,
    tRange = null,
    yRange = null,
    scale = DEFAULT_SCALE,
  } = options;
  if (!files.length) return { data: [], layout: baseLayout(), rows: 1 };
  const nq = Math.min(...files.map((f) => f.q.length));
  const nf = files.length;
  const count = mode === "q" ? nq : mode === "file" ? nf : 1;
  const titles =
    mode === "q"
      ? files[0]!.labels.slice(0, nq).map(shortLabel)
      : mode === "file"
        ? files.map((f) => f.label)
        : [];
  const span = tRange ?? positiveExtent(files.map((f) => f.t)) ?? [1e-6, 1e3];
  const xaxis = {
    type: "log" as const,
    ...logTicks(span[0], span[1]),
    ...(tRange ? { range: tRange } : {}),
  };
  const yaxis = yRange ? { range: yRange } : {};
  const g = grid(count, cols, { titles, xaxis, yaxis });
  const data: Partial<PlotData>[] = [];
  files.forEach((f, m) => {
    const nt = f.t.length;
    for (let n = 0; n < nq; n += 1) {
      const panel = g.panels[mode === "q" ? n : mode === "file" ? m : 0]!;
      const color = mode === "file" ? orderedColor(n, nq, scale) : seriesColor(m);
      const qName = (f.labels[n] ?? "").replace(/^qbin=\d+,\s*/, "");
      const name = mode === "q" ? f.label : mode === "file" ? qName : `${f.label} · ${qName}`;
      const group = mode === "q" ? `f${m}` : mode === "file" ? `q${n}` : `f${m}q${n}`;
      const first = mode === "q" ? n === 0 : mode === "file" ? m === 0 : true;
      const fitted = Boolean(showFit && f.fit && f.fit.success[n]);
      const baseline = fitted ? (f.fit?.params[n]?.[3] ?? null) : null;
      const shift =
        (fitted && subtractBaseline && baseline !== null ? 1 - baseline : 0) + m * offset;
      const x: number[] = [];
      const y: number[] = [];
      const e: number[] = [];
      const g2 = column(f.g2, nt, nq, n);
      const err = column(f.err, nt, nq, n);
      for (let i = 0; i < nt; i += 1) {
        const t = f.t[i]!;
        if (t > 0) {
          x.push(t);
          y.push(g2[i]! + shift);
          e.push(err[i]!);
        }
      }
      data.push({
        type: "scatter",
        mode: "markers",
        x,
        y,
        name,
        legendgroup: group,
        showlegend: legend && first,
        xaxis: panel.x,
        yaxis: panel.y,
        marker: markers(color, markerSize, symbol(mode === "file" ? 0 : m)),
        error_y: errorBars(e, color),
        hovertemplate: `${name}<br>τ %{x:.4g} s<br>g2 %{y:.4f}<extra></extra>`,
      });
      if (fitted && f.fit) {
        const { fitX, fitY, nx } = f.fit;
        data.push({
          type: "scatter",
          mode: "lines",
          x: Array.from(fitX as ArrayLike<number>),
          y: Array.from({ length: nx }, (_, i) => fitY[n * nx + i]! + shift),
          line: { color, width: 2 },
          legendgroup: group,
          showlegend: false,
          hoverinfo: "skip",
          xaxis: panel.x,
          yaxis: panel.y,
        });
      }
    }
  });
  const entries = mode === "q" ? nf : mode === "file" ? nq : nf * nq;
  const outer = legend ? outerLegend(entries) : { legend: {}, marginTop: 24, marginRight: 12 };
  const layout = baseLayout({
    ...(g.layout as Partial<Layout>),
    margin: { l: 46, r: outer.marginRight, t: outer.marginTop, b: 38 },
    showlegend: legend,
    legend: outer.legend,
  });
  const record = layout as unknown as Record<string, { title?: { text?: string } }>;
  g.panels.forEach((panel) => {
    const bottomRow = panel.row === g.rows - 1 || panel.row === Math.floor((count - 1) / g.cols);
    if (bottomRow) record[panel.xaxis]!.title = { ...record[panel.xaxis]!.title, text: "τ (s)" };
    if (panel.col === 0) record[panel.yaxis]!.title = { ...record[panel.yaxis]!.title, text: "g2" };
  });
  return { data, layout, rows: g.rows };
}
