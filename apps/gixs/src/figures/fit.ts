// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/** The cut (points), the fitted total, each peak on the background, the background, and the
 * residuals below. */

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

import type { FitCut } from "../api/client";

const DATA = "#3b3a36";
const num = (values: unknown): number[] =>
  Array.isArray(values)
    ? values.map((v) => (v === null || v === undefined ? Number.NaN : Number(v)))
    : [];

export interface Preview {
  x: (number | null)[];
  y: (number | null)[];
  sigma: (number | null)[] | null;
  x_label: string;
  y_label: string;
  title: string;
}

export function fitFigure(
  fit: FitCut | null,
  preview: Preview | null,
  logY: boolean,
): { data: Partial<PlotData>[]; layout: Partial<PlotLayout> } | null {
  const source = fit
    ? {
        x: num(fit.data.x),
        y: num(fit.data.y),
        sigma: fit.data.sigma ? num(fit.data.sigma) : null,
        x_label: fit.x_label,
        y_label: fit.y_label,
        title: `${fit.file_label} · ${fit.roi_name}`,
      }
    : preview
      ? {
          x: num(preview.x),
          y: num(preview.y),
          sigma: preview.sigma ? num(preview.sigma) : null,
          x_label: preview.x_label,
          y_label: preview.y_label,
          title: preview.title,
        }
      : null;
  if (!source) return null;
  const y = logY ? source.y.map((v) => (v > 0 ? v : Number.NaN)) : source.y;
  const data: Partial<PlotData>[] = [
    {
      type: "scatter",
      mode: "markers",
      x: source.x,
      y,
      name: "data",
      marker: { size: 5, color: DATA },
      error_y: source.sigma
        ? { ...errorBars(source.sigma, "#9a9994"), thickness: 1, width: 0 }
        : undefined,
      hovertemplate: "%{x:.5g}, %{y:.4g}<extra>data</extra>",
    },
  ];
  const ya = logY ? logAxis({ title: source.y_label }) : axis({ title: source.y_label });
  const layout: Partial<PlotLayout> = baseLayout({
    title: { text: source.title, font: { size: 12, color: MUTED }, x: 0, xanchor: "left" },
    legend: {
      orientation: "h",
      yanchor: "bottom",
      y: 1.02,
      x: 1,
      xanchor: "right",
      font: { size: 11 },
    },
    margin: { l: 64, r: 16, t: 40, b: 44 },
    hovermode: "closest",
    dragmode: "zoom",
    xaxis: axis({ title: fit ? undefined : source.x_label }),
    yaxis: { ...ya, domain: fit ? [0.3, 1] : [0, 1] },
  });
  if (fit) {
    const x = num(fit.model.x);
    (fit.model.peaks as unknown[]).forEach((peak, i) =>
      data.push({
        type: "scatter",
        mode: "lines",
        x,
        y: num(peak),
        name: `peak ${i + 1}`,
        line: { color: seriesColor(i + 1), width: 1.5, dash: "dash" },
      }),
    );
    data.push({
      type: "scatter",
      mode: "lines",
      x,
      y: num(fit.model.background),
      name: "background",
      line: { color: MUTED, width: 1, dash: "dot" },
    });
    data.push({
      type: "scatter",
      mode: "lines",
      x,
      y: num(fit.model.total),
      name: "fit",
      line: { color: SERIES[0], width: 2 },
    });
    data.push({
      type: "scatter",
      mode: "markers",
      x: num(fit.residual.x),
      y: num(fit.residual.r),
      name: "residual",
      marker: { size: 4, color: DATA },
      showlegend: false,
      xaxis: "x",
      yaxis: "y2",
    });
    const [lo, hi] = fit.window as [number, number];
    layout.yaxis2 = {
      ...axis({ title: fit.residual.normalized ? "(I − fit)/σ" : "I − fit", nticks: 3 }),
      domain: [0, 0.24],
      anchor: "x",
      zeroline: true,
      zerolinecolor: MUTED,
    };
    layout.xaxis = axis({
      title: source.x_label,
      range: [lo - 0.5 * (hi - lo), hi + 0.5 * (hi - lo)],
    });
    layout.shapes = [
      {
        type: "rect",
        xref: "x",
        yref: "paper",
        x0: lo,
        x1: hi,
        y0: 0.3,
        y1: 1,
        fillcolor: "#2a78d6",
        opacity: 0.05,
        line: { width: 0 },
      },
    ];
  }
  return { data, layout };
}
