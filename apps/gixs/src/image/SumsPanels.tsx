// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/**
 * The sum of each column of the image below it and of each row at its left, from the array the
 * page holds (no request). They carry the image's axes: their ranges follow the image's pan and
 * zoom, their plot areas are aligned with the canvas, and the image shows no axes of its own.
 */

import {
  INK,
  Plot,
  axis,
  baseLayout,
  logAxis,
  type PlotData,
  type PlotLayout,
} from "@beamline-web/viz";
import { useMemo } from "react";

import type { Axis } from "../api/client";

function values(a: Axis): number[] {
  return Array.from({ length: a.n }, (_, i) => a.start + i * a.step);
}

/** Sums over the valid (finite) values along each axis; NaN for a column or row without any. */
export function imageSums(data: Float32Array, rows: number, cols: number, binning: number) {
  const alongY = new Float64Array(cols);
  const alongX = new Float64Array(rows);
  const anyY = new Uint8Array(cols);
  const anyX = new Uint8Array(rows);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const v = data[r * cols + c]!;
      if (!Number.isFinite(v)) continue;
      alongY[c]! += v;
      alongX[r]! += v;
      anyY[c] = 1;
      anyX[r] = 1;
    }
  }
  return {
    columns: Array.from(alongY, (v, i) => (anyY[i] ? v * binning : Number.NaN)),
    rows: Array.from(alongX, (v, i) => (anyX[i] ? v * binning : Number.NaN)),
  };
}

/** Where the image's canvas sits inside its cell: the plots' areas line up with it. */
export interface Offsets {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface SumsProps {
  data: Float32Array;
  x: Axis;
  y: Axis;
  binning: number;
  log: boolean;
  flipX: boolean;
  flipY: boolean;
  xLabel: string;
  yLabel: string;
  /** The image's visible ranges (ascending); the whole axis without them. */
  xRange: [number, number] | null;
  yRange: [number, number] | null;
  offsets: Offsets;
}

const line = (x: number[], y: number[], hover: string): Partial<PlotData> => ({
  type: "scatter",
  mode: "lines",
  x,
  y,
  line: { color: INK, width: 1.25 },
  connectgaps: false,
  hovertemplate: hover,
});

const intensity = (log: boolean) =>
  log
    ? logAxis({ showticklabels: false, ticks: "", automargin: false })
    : axis({ showticklabels: false, ticks: "", automargin: false });

const ranged = (range: [number, number] | null, flipped: boolean) =>
  range
    ? { range: flipped ? [range[1], range[0]] : range, autorange: false as const }
    : { autorange: flipped ? ("reversed" as const) : true };

/** The sum of each column, below the image, with the image's x axis. */
export function ColumnSums({
  data,
  x,
  y,
  binning,
  log,
  flipX,
  xLabel,
  xRange,
  offsets,
}: SumsProps) {
  const sums = useMemo(() => imageSums(data, y.n, x.n, binning), [data, x.n, y.n, binning]);
  const ys = sums.columns.map((v) => (log && !(v > 0) ? Number.NaN : v));
  const layout: Partial<PlotLayout> = baseLayout({
    showlegend: false,
    margin: { l: offsets.left, r: offsets.right, t: 2, b: 40 },
    xaxis: { ...axis({ title: xLabel, automargin: false }), ...ranged(xRange, flipX) },
    yaxis: intensity(log),
  });
  return (
    <div className="h-full min-h-0" aria-label="column sums">
      <Plot
        data={[line(values(x), ys, "%{x:.5g}<br>Σ I %{y:.4g}<extra>column sum</extra>")]}
        layout={layout}
      />
    </div>
  );
}

/** The sum of each row, at the image's left, with the image's y axis. */
export function RowSums({ data, x, y, binning, log, flipY, yLabel, yRange, offsets }: SumsProps) {
  const sums = useMemo(() => imageSums(data, y.n, x.n, binning), [data, x.n, y.n, binning]);
  const xs = sums.rows.map((v) => (log && !(v > 0) ? Number.NaN : v));
  const layout: Partial<PlotLayout> = baseLayout({
    showlegend: false,
    margin: { l: 56, r: 2, t: offsets.top, b: offsets.bottom },
    xaxis: intensity(log),
    yaxis: { ...axis({ title: yLabel, automargin: false }), ...ranged(yRange, flipY) },
  });
  return (
    <div className="h-full min-w-0" aria-label="row sums">
      <Plot
        data={[line(xs, values(y), "%{y:.5g}<br>Σ I %{x:.4g}<extra>row sum</extra>")]}
        layout={layout}
      />
    </div>
  );
}
