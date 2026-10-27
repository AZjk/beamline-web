// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/**
 * The look of every Plotly figure of the stack (the kit's tokens), and the pieces a figure is
 * built from: axes, a panel grid, legends, markers and error bars.
 */

import type {
  Annotations,
  Config,
  DataTitle,
  ErrorBar,
  Layout,
  LayoutAxis,
  Legend,
  PlotMarker,
} from "plotly.js";

/** An axis spec whose title may be plain text. */
export type AxisOptions = Partial<Omit<LayoutAxis, "title">> & {
  title?: string | Partial<DataTitle>;
};

import { SERIES } from "../colormaps";

export const SYMBOLS = [
  "circle-open",
  "square-open",
  "diamond-open",
  "triangle-up-open",
  "triangle-down-open",
  "pentagon-open",
  "hexagon-open",
  "star-open",
] as const;
export const INK = "#1f1f1d";
export const INK2 = "#4b4a46";
export const MUTED = "#62615d";
export const GRID = "#ecebe7";
export const SURFACE = "#ffffff";
export const ACCENT = "#2a78d6";
export const FONT = {
  family: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
  size: 10.5,
  color: INK,
};

export const CONFIG: Partial<Config> = {
  responsive: false,
  displaylogo: false,
  scrollZoom: false,
  modeBarButtonsToRemove: [
    "lasso2d",
    "select2d",
    "autoScale2d",
    "toggleSpikelines",
    "hoverCompareCartesian",
    "hoverClosestCartesian",
  ],
  toImageButtonOptions: {
    scale: 2,
    format: "png",
    filename: "figure",
    width: null as unknown as number,
    height: null as unknown as number,
  },
};

export const symbol = (i: number): string =>
  SYMBOLS[((i % SYMBOLS.length) + SYMBOLS.length) % SYMBOLS.length]!;

export function withAlpha(color: string, alpha: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (m)
    return `rgba(${parseInt(m[1]!, 16)},${parseInt(m[2]!, 16)},${parseInt(m[3]!, 16)},${alpha})`;
  const rgb = /rgba?\(([^)]+)\)/.exec(color);
  if (rgb) {
    const [r, g, b] = rgb[1]!.split(",").map((v) => parseFloat(v));
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}

/** An axis in the kit's style; `extra` overrides. */
export function axis(extra: AxisOptions = {}): Partial<LayoutAxis> {
  const { title, ...rest } = extra;
  return {
    showline: true,
    linecolor: MUTED,
    linewidth: 1,
    ticks: "outside",
    tickcolor: MUTED,
    ticklen: 4,
    gridcolor: GRID,
    zeroline: false,
    exponentformat: "power",
    automargin: true,
    tickfont: { size: 10 },
    ...rest,
    title: {
      standoff: 5,
      font: { size: 10.5, color: INK2 },
      ...(typeof title === "object" ? title : title ? { text: title } : {}),
    },
  };
}

/** A log axis; a range given in data units is written as its log10. */
export function logAxis(extra: AxisOptions = {}): Partial<LayoutAxis> {
  const out = axis({ type: "log", ...extra });
  if (extra.range)
    out.range = [Math.log10(Number(extra.range[0])), Math.log10(Number(extra.range[1]))];
  return out;
}

/** Tick settings of a log axis spanning `lo` … `hi`: one per decade when there are a few, else 2 and 5 as well. */
export function logTicks(lo: number, hi: number): Partial<LayoutAxis> {
  if (!(lo > 0) || !(hi > 0)) return {};
  const decades = Math.abs(Math.log10(hi) - Math.log10(lo));
  return decades >= 2.5 ? { dtick: 1 } : { dtick: "D2" };
}

/** The finite positive extent [min, max] of some arrays (for log axes), or null. */
export function positiveExtent(arrays: ArrayLike<number>[]): [number, number] | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (const a of arrays) {
    for (let i = 0; i < a.length; i += 1) {
      const v = a[i]!;
      if (v > 0 && Number.isFinite(v)) {
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
  }
  return lo <= hi ? [lo, hi] : null;
}

export function baseLayout(extra: Partial<Layout> = {}): Partial<Layout> {
  return {
    font: FONT,
    paper_bgcolor: SURFACE,
    plot_bgcolor: SURFACE,
    margin: { l: 50, r: 12, t: 22, b: 38 },
    hovermode: "closest",
    hoverlabel: {
      bgcolor: INK,
      bordercolor: INK,
      font: { ...FONT, color: "#fff", size: 10.5 },
      align: "left",
    },
    legend: {
      bgcolor: "rgba(255,255,255,0.8)",
      borderwidth: 0,
      font: { size: 10 },
      x: 1,
      xanchor: "right",
      y: 1,
      yanchor: "top",
      itemsizing: "constant",
      tracegroupgap: 2,
    },
    autosize: true,
    ...extra,
  };
}

export interface Panel {
  x: string;
  y: string;
  xaxis: string;
  yaxis: string;
  xdomain: [number, number];
  ydomain: [number, number];
  row: number;
  col: number;
}

export interface GridOptions {
  titles?: string[];
  gapX?: number;
  gapY?: number;
  xaxis?: AxisOptions;
  yaxis?: AxisOptions;
}

/**
 * `count` panels in `cols` columns, top-left first: the axis objects to merge into a layout and,
 * per panel, the axis names its traces use. Titles become small annotations above each panel.
 */
export function grid(
  count: number,
  cols: number,
  { titles = [], gapX = 0.12, gapY = 0.22, xaxis = {}, yaxis = {} }: GridOptions = {},
) {
  const n = Math.max(1, count);
  const c = Math.max(1, Math.min(cols, n));
  const rows = Math.max(1, Math.ceil(n / c));
  const layout: Record<string, unknown> & { annotations: Partial<Annotations>[] } = {
    annotations: [],
  };
  const panels: Panel[] = [];
  // gaps are a share of a panel's size, so any number of rows fits
  const w = 1 / (c + gapX * (c - 1));
  const h = 1 / (rows + gapY * (rows - 1));
  for (let i = 0; i < n; i += 1) {
    const col = i % c;
    const row = Math.floor(i / c);
    const suffix = i === 0 ? "" : String(i + 1);
    const xdomain: [number, number] = [col * w * (1 + gapX), col * w * (1 + gapX) + w];
    const ydomain: [number, number] = [1 - row * h * (1 + gapY) - h, 1 - row * h * (1 + gapY)];
    const xa = axis({ ...xaxis, domain: xdomain, anchor: `y${suffix}` as LayoutAxis["anchor"] });
    const ya = axis({ ...yaxis, domain: ydomain, anchor: `x${suffix}` as LayoutAxis["anchor"] });
    if (xaxis.type === "log" && xaxis.range)
      xa.range = [Math.log10(Number(xaxis.range[0])), Math.log10(Number(xaxis.range[1]))];
    if (yaxis.type === "log" && yaxis.range)
      ya.range = [Math.log10(Number(yaxis.range[0])), Math.log10(Number(yaxis.range[1]))];
    layout[`xaxis${suffix}`] = xa;
    layout[`yaxis${suffix}`] = ya;
    const title = titles[i];
    if (title) {
      layout.annotations.push({
        text: title,
        showarrow: false,
        xref: "paper",
        yref: "paper",
        x: xdomain[0],
        y: ydomain[1],
        xanchor: "left",
        yanchor: "bottom",
        font: { size: 10.5, color: INK2 },
        yshift: 2,
      });
    }
    panels.push({
      x: `x${suffix}`,
      y: `y${suffix}`,
      xaxis: `xaxis${suffix}`,
      yaxis: `yaxis${suffix}`,
      xdomain,
      ydomain,
      row,
      col,
    });
  }
  return { layout, panels, rows, cols: c };
}

/** A legend outside the panels: along the top for a few entries, down the right side for many. */
export function outerLegend(series = 1): {
  legend: Partial<Legend>;
  marginTop: number;
  marginRight: number;
} {
  if (series > 8) {
    return {
      legend: {
        orientation: "v",
        x: 1.01,
        xanchor: "left",
        y: 1,
        yanchor: "top",
        bgcolor: "rgba(255,255,255,0)",
        font: { size: 9.5 },
        itemsizing: "constant",
        itemwidth: 22,
        tracegroupgap: 0,
      },
      marginTop: 20,
      marginRight: 135,
    };
  }
  const rows = Math.max(1, Math.ceil(series / 3));
  return {
    legend: {
      orientation: "h",
      x: 0,
      xanchor: "left",
      y: 1,
      yanchor: "top",
      yref: "container",
      bgcolor: "rgba(255,255,255,0)",
      font: { size: 10 },
      itemsizing: "constant",
      itemwidth: 28,
    } as Partial<Legend>,
    marginTop: 20 + 16 * rows,
    marginRight: 12,
  };
}

/** The marker style of a measured curve. */
export function markers(color: string, size = 6, sym = "circle-open"): Partial<PlotMarker> {
  return { symbol: sym, size, color, line: { width: 1.3, color } };
}

export function errorBars(values: number[], color: string): ErrorBar {
  return { type: "data", array: values, visible: true, color, thickness: 1, width: 0 } as ErrorBar;
}

/** The height a figure of `rows` panel rows takes in a scrolling box of `available` pixels: the box, or more when the panels need it. */
export function heightFor(available: number, rows = 1, panelHeight = 220): number {
  const box = Math.max(160, available - 4);
  if (rows <= 1) return box;
  return Math.max(box, rows * panelHeight + 60);
}

export { SERIES };
