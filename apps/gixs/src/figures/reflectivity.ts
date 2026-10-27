// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/** R against q_z on a log scale, one color per segment (attenuator setting) when matched. */

import {
  axis,
  baseLayout,
  errorBars,
  logAxis,
  seriesColor,
  type PlotData,
  type PlotLayout,
} from "@beamline-web/viz";

import type { Reflectivity } from "../api/client";

const num = (values: unknown): number[] =>
  Array.isArray(values)
    ? values.map((v) => (v === null || v === undefined ? Number.NaN : Number(v)))
    : [];

export function reflectivityFigure(result: Reflectivity): {
  data: Partial<PlotData>[];
  layout: Partial<PlotLayout>;
} {
  const qz = num(result.qz);
  const R = num(result.R).map((v) => (v > 0 ? v : Number.NaN));
  const sigma = num(result.sigma ?? []);
  const segments = result.segment ?? qz.map(() => 0);
  const data: Partial<PlotData>[] = [];
  [...new Set(segments)].forEach((seg, i) => {
    const sel = segments.map((s) => s === seg);
    const pick = (values: number[]) => values.filter((_, k) => sel[k]);
    data.push({
      type: "scatter",
      mode: "lines+markers",
      x: pick(qz),
      y: pick(R),
      name: `segment ${seg}`,
      marker: { size: 6, color: seriesColor(i) },
      line: { width: 1, color: seriesColor(i) },
      error_y: sigma.length
        ? { ...errorBars(pick(sigma), seriesColor(i)), thickness: 1, width: 0 }
        : undefined,
      hovertemplate: "q_z %{x:.5f}<br>R %{y:.4g}<extra></extra>",
    });
  });
  const layout = baseLayout({
    xaxis: axis({ title: "q_z (Å⁻¹)" }),
    yaxis: logAxis({ title: result.absolute ? "R" : "R (a.u.)" }),
    showlegend: new Set(segments).size > 1,
    margin: { l: 64, r: 16, t: 24, b: 44 },
  });
  return { data, layout };
}
