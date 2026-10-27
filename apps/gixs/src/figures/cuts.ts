// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/** The cuts as lines, one panel per cut axis; colors follow the ROI (one file) or the file. */

import {
  MUTED,
  axis,
  baseLayout,
  errorBars,
  logAxis,
  seriesColor,
  type PlotData,
  type PlotLayout,
} from "@beamline-web/viz";

import type { Curve } from "../api/client";

const DASHES = ["solid", "dash", "dot", "dashdot", "longdash", "longdashdot"] as const;

export interface CutsOptions {
  roiOrder: string[];
  logX: boolean;
  logY: boolean;
  errors: boolean;
  legend: boolean;
}

export const CUT_PANEL_PX = 220;

const finite = (values: (number | null)[]) => values.map((v) => (v === null ? Number.NaN : v));

export function cutsFigure(
  curves: Curve[],
  o: CutsOptions,
): { data: Partial<PlotData>[]; layout: Partial<PlotLayout>; rows: number } | null {
  if (!curves.length) return null;
  const groups = [...new Set(curves.map((c) => c.x_label))];
  const files = [...new Set(curves.map((c) => c.file))];
  const order = new Map(o.roiOrder.map((id, i) => [id, i]));
  const data: Partial<PlotData>[] = [];
  for (const curve of curves) {
    const roiIndex = order.get(curve.roi_id) ?? 0;
    const color =
      files.length <= 1 ? seriesColor(roiIndex) : seriesColor(files.indexOf(curve.file));
    const dash = files.length <= 1 ? "solid" : DASHES[roiIndex % DASHES.length]!;
    const panel = groups.indexOf(curve.x_label);
    const y = finite(curve.y).map((v) => (o.logY && !(v > 0) ? Number.NaN : v));
    const name = `${curve.file_label} · ${curve.roi_name}`;
    data.push({
      type: "scatter",
      mode: "lines",
      x: finite(curve.x),
      y,
      name,
      line: { color, width: 2, dash },
      connectgaps: false,
      xaxis: panel ? `x${panel + 1}` : "x",
      yaxis: panel ? `y${panel + 1}` : "y",
      error_y: o.errors && curve.sigma ? errorBars(finite(curve.sigma), color) : undefined,
      hovertemplate: `${name}<br>%{x:.5g}, %{y:.4g}<extra></extra>`,
    });
  }
  const layout: Partial<PlotLayout> = baseLayout({
    showlegend: o.legend && curves.length > 1,
    legend: {
      orientation: "v",
      yanchor: "bottom",
      y: 1.0,
      x: 0,
      xanchor: "left",
      font: { size: 11 },
    },
    margin: {
      l: 64,
      r: 16,
      t: o.legend && curves.length > 1 ? 12 + 19 * curves.length : 28,
      b: 48,
    },
    hovermode: "closest",
  });
  const gap = groups.length > 1 ? 0.12 : 0;
  const height = (1 - gap * (groups.length - 1)) / groups.length;
  groups.forEach((label, i) => {
    const top = 1 - i * (height + gap);
    const xKey = i ? `xaxis${i + 1}` : "xaxis";
    const yKey = i ? `yaxis${i + 1}` : "yaxis";
    const xa = o.logX ? logAxis({ title: label }) : axis({ title: label });
    const ya = o.logY
      ? logAxis({ title: `I (${curves[0]!.level})` })
      : axis({ title: `I (${curves[0]!.level})` });
    (layout as Record<string, unknown>)[xKey] = { ...xa, anchor: i ? `y${i + 1}` : "y" };
    (layout as Record<string, unknown>)[yKey] = {
      ...ya,
      domain: [top - height, top],
      anchor: i ? `x${i + 1}` : "x",
    };
  });
  if (o.legend && curves.length === 1)
    layout.title = {
      text: `${curves[0]!.file_label} · ${curves[0]!.roi_name}`,
      font: { size: 12, color: MUTED },
      x: 0,
      xanchor: "left",
    };
  return { data, layout, rows: groups.length };
}
