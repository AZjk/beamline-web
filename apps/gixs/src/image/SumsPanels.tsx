// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/** The sum of each column of the image below it and of each row at its left, from the array
 * the page holds (no request), over the whole image. */

import {
  INK,
  axis,
  baseLayout,
  logAxis,
  Plot,
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

const tiny = (extra: Partial<PlotLayout> = {}): Partial<PlotLayout> =>
  baseLayout({ margin: { l: 44, r: 8, t: 4, b: 22 }, showlegend: false, ...extra });

interface SumsProps {
  data: Float32Array;
  x: Axis;
  y: Axis;
  binning: number;
  log: boolean;
  flipX: boolean;
  flipY: boolean;
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
  log ? logAxis({ showticklabels: false }) : axis({ showticklabels: false });

/** The sum of each column, below the image. */
export function ColumnSums({ data, x, y, binning, log, flipX }: SumsProps) {
  const sums = useMemo(() => imageSums(data, y.n, x.n, binning), [data, x.n, y.n, binning]);
  const ys = sums.columns.map((v) => (log && !(v > 0) ? Number.NaN : v));
  return (
    <div className="min-h-0 border-t border-line" aria-label="column sums">
      <Plot
        data={[line(values(x), ys, "%{x:.5g}<br>Σ I %{y:.4g}<extra>column sum</extra>")]}
        layout={tiny({
          xaxis: axis({ autorange: flipX ? "reversed" : true }),
          yaxis: intensity(log),
        })}
      />
    </div>
  );
}

/** The sum of each row, at the image's left. */
export function RowSums({ data, x, y, binning, log, flipY }: SumsProps) {
  const sums = useMemo(() => imageSums(data, y.n, x.n, binning), [data, x.n, y.n, binning]);
  const xs = sums.rows.map((v) => (log && !(v > 0) ? Number.NaN : v));
  return (
    <div className="min-w-0 border-r border-line" aria-label="row sums">
      <Plot
        data={[line(xs, values(y), "%{y:.5g}<br>Σ I %{x:.4g}<extra>row sum</extra>")]}
        layout={tiny({
          margin: { l: 8, r: 4, t: 4, b: 22 },
          xaxis: intensity(log),
          yaxis: axis({ autorange: flipY ? "reversed" : true, showticklabels: false }),
        })}
      />
    </div>
  );
}
