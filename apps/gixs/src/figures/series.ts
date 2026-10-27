// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/** Frame series: the cut in every frame as a heatmap, beside it the ROI total and the tracked
 * peak per frame. Incidence series: the cut at every angle, the intensity against αi, the depth. */

import {
  MUTED,
  SERIES,
  axis,
  baseLayout,
  errorBars,
  logAxis,
  seriesColor,
  type PlotData,
  type PlotLayout,
} from "@beamline-web/viz";

import type { FrameSeries, Incidence } from "../api/client";

const num = (values: unknown): number[] =>
  Array.isArray(values)
    ? values.map((v) => (v === null || v === undefined ? Number.NaN : Number(v)))
    : [];
const matrix = (rows: unknown): number[][] => (Array.isArray(rows) ? rows.map((r) => num(r)) : []);

function logMatrix(z: number[][], log: boolean): { z: number[][]; zmin: number; zmax: number } {
  const out = log ? z.map((row) => row.map((v) => (v > 0 ? Math.log10(v) : Number.NaN))) : z;
  const finite = out
    .flat()
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b);
  const at = (p: number) =>
    finite[Math.min(finite.length - 1, Math.floor((p / 100) * (finite.length - 1)))] ?? 0;
  return { z: out, zmin: finite.length ? at(1) : 0, zmax: finite.length ? at(99.5) : 1 };
}

export function seriesFigure(
  result: FrameSeries,
  log: boolean,
): { data: Partial<PlotData>[]; layout: Partial<PlotLayout> } {
  const tracked = (result.tracked ?? {}) as Record<string, (number | null)[]>;
  const sides: [string, string][] = [["total", "ROI total"]];
  if ("center_0" in tracked) sides.push(["center", "center"], ["fwhm", "FWHM"]);
  const frames = num(result.frames);
  const { z, zmin, zmax } = logMatrix(matrix(result.intensity), log);
  const data: Partial<PlotData>[] = [
    {
      type: "heatmap",
      x: num(result.x),
      y: frames,
      z,
      colorscale: "Viridis",
      zmin,
      zmax,
      colorbar: {
        title: { text: log ? "log₁₀ I" : "I", side: "right" },
        thickness: 8,
        len: 0.3,
        orientation: "h",
        x: 0,
        xanchor: "left",
        y: 1.03,
        yanchor: "bottom",
      },
      hovertemplate: "%{x:.5g}, frame %{y}<br>%{z:.4g}<extra></extra>",
    },
  ];
  const main = 0.55;
  const side = 0.45 / sides.length;
  const layout: Partial<PlotLayout> = baseLayout({
    showlegend: false,
    margin: { l: 64, r: 16, t: 48, b: 44 },
    title: {
      text: `${result.file_label} · ${result.roi_name} · ${result.level}`,
      font: { size: 12, color: MUTED },
      x: 0.55,
      xanchor: "left",
      y: 0.98,
    },
    xaxis: { ...axis({ title: result.x_label }), domain: [0, main - 0.02] },
    yaxis: axis({ title: "frame" }),
  });
  sides.forEach(([key, title], k) => {
    const n = k + 2;
    const traces: [number[], number[], string][] = [];
    if (key === "total") traces.push([num(result.total), num(result.total_sigma), SERIES[0]!]);
    else {
      let i = 0;
      while (`center_${i}` in tracked) {
        traces.push([
          num(tracked[`${key}_${i}`]),
          num(tracked[`${key}_${i}_error`]),
          seriesColor(i + 1),
        ]);
        i += 1;
      }
    }
    for (const [values, errors, color] of traces)
      data.push({
        type: "scatter",
        mode: "lines+markers",
        x: values,
        y: frames,
        name: title,
        line: { color, width: 2 },
        marker: { size: 5 },
        error_x: errors.some((v) => Number.isFinite(v))
          ? { ...errorBars(errors, color), thickness: 1, width: 0 }
          : undefined,
        xaxis: `x${n}`,
        yaxis: "y",
        hovertemplate: `${title} %{x:.5g}<br>frame %{y}<extra></extra>`,
      });
    const left = main + k * side + 0.02;
    (layout as Record<string, unknown>)[`xaxis${n}`] = {
      ...axis({ title, nticks: 4 }),
      domain: [left, Math.min(1, left + side - 0.025)],
      anchor: "y",
    };
  });
  return { data, layout };
}

export function incidenceFigure(
  result: Incidence,
  log: boolean,
): { data: Partial<PlotData>[]; layout: Partial<PlotLayout> } {
  const depth = num(result.depth ?? []);
  const hasDepth = depth.some((v) => Number.isFinite(v));
  const alpha = num(result.alpha_i);
  const { z, zmin, zmax } = logMatrix(matrix(result.intensity), log);
  const versus = result.versus as Record<string, unknown>;
  const data: Partial<PlotData>[] = [
    {
      type: "heatmap",
      x: num(result.x),
      y: alpha,
      z,
      colorscale: "Viridis",
      zmin,
      zmax,
      colorbar: {
        title: { text: log ? "log₁₀ I" : "I" },
        thickness: 10,
        len: 0.5,
        y: 1,
        yanchor: "top",
      },
      hovertemplate: "%{x:.5g}, αi %{y:.4f}°<br>%{z:.4g}<extra></extra>",
    },
    {
      type: "scatter",
      mode: "lines+markers",
      x: num(versus.alpha_i),
      y: num(versus.intensity),
      name: "intensity",
      line: { color: SERIES[0], width: 2 },
      marker: { size: 6 },
      error_y: versus.sigma
        ? { ...errorBars(num(versus.sigma), SERIES[0]!), thickness: 1, width: 0 }
        : undefined,
      xaxis: "x2",
      yaxis: "y2",
    },
  ];
  const rows = hasDepth ? [0.5, 0.25, 0.25] : [0.58, 0.42];
  const gap = 0.07;
  const tops: number[] = [];
  let top = 1;
  for (const h of rows) {
    tops.push(top);
    top -= h + gap;
  }
  const span = (i: number): [number, number] => [tops[i]! - rows[i]!, tops[i]!];
  const layout: Partial<PlotLayout> = baseLayout({
    showlegend: false,
    margin: { l: 64, r: 16, t: 52, b: 44 },
    xaxis: { ...axis({ title: result.x_label, side: "top" }), anchor: "y" },
    yaxis: { ...axis({ title: "α_i (deg)" }), domain: span(0) },
    xaxis2: { ...axis({ title: hasDepth ? undefined : "α_i (deg)" }), anchor: "y2" },
    yaxis2: { ...axis({ title: "I in range" }), domain: span(1) },
  });
  const marks: NonNullable<PlotLayout["shapes"]> = [];
  const notes: NonNullable<PlotLayout["annotations"]> = [];
  for (const [value, label] of [
    [result.peak_alpha_i, "maximum"],
    [result.alpha_c, "α_c"],
  ] as [number | null | undefined, string][]) {
    if (value === null || value === undefined) continue;
    marks.push({
      type: "line",
      xref: "x2",
      yref: "paper",
      x0: value,
      x1: value,
      y0: span(1)[0],
      y1: span(1)[1],
      line: { color: MUTED, width: 1, dash: "dot" },
    });
    notes.push({
      xref: "x2",
      yref: "paper",
      x: value,
      y: span(1)[1],
      text: label,
      showarrow: false,
      yanchor: "bottom",
      font: { size: 10, color: MUTED },
    });
  }
  layout.shapes = marks;
  layout.annotations = notes;
  if (hasDepth) {
    data.push({
      type: "scatter",
      mode: "lines+markers",
      x: alpha,
      y: depth.map((v) => (v > 0 ? v : Number.NaN)),
      name: "depth",
      line: { color: SERIES[2], width: 2 },
      marker: { size: 6 },
      xaxis: "x3",
      yaxis: "y3",
    });
    layout.xaxis3 = { ...axis({ title: "α_i (deg)" }), anchor: "y3" };
    layout.yaxis3 = { ...logAxis({ title: "Λ (Å)" }), domain: span(2) };
  }
  return { data, layout };
}
