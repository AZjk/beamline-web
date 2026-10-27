// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/** I(χ) on the ring of each file with the model fill, and the pole figure as the pole density,
 * the population, a polar plot or 2-D maps of the upper hemisphere. */

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

import type { PoleMap, Texture, TextureFile } from "../api/client";

export type PoleView = "chi" | "density" | "population" | "polar" | "map";
export const POLE_VIEWS: { value: PoleView; label: string }[] = [
  { value: "chi", label: "I(χ)" },
  { value: "density", label: "Pole density" },
  { value: "population", label: "Population" },
  { value: "polar", label: "Polar" },
  { value: "map", label: "2-D pole figure" },
];
const DATA = "#3b3a36";
const LOG_DECADES = 2.5;
const num = (values: unknown): number[] =>
  Array.isArray(values)
    ? values.map((v) => (v === null || v === undefined ? Number.NaN : Number(v)))
    : [];
const positive = (values: number[]) => values.map((v) => (v > 0 ? v : Number.NaN));

type Figure = { data: Partial<PlotData>[]; layout: Partial<PlotLayout> };

/** (first, last) of every run of consecutive true flags, in x. */
function runs(x: number[], flags: boolean[]): [number, number][] {
  const out: [number, number][] = [];
  let start: number | null = null;
  flags.forEach((flag, i) => {
    if (flag && start === null) start = i;
    if (start !== null && (!flag || i === flags.length - 1)) {
      out.push([x[start]!, x[flag ? i : i - 1]!]);
      start = null;
    }
  });
  return out;
}

function orientation(f: TextureFile): Record<string, unknown> | null {
  return (f.orientation as Record<string, unknown> | null) ?? null;
}

function measuredAndModel(y: number[], accessible: boolean[]): [number[], number[]] {
  const model = accessible.map((a) => !a);
  const joined = model.map((m, i) => m || model[i - 1] === true || model[i + 1] === true);
  const any = model.some(Boolean);
  return [
    y.map((v, i) => (accessible[i] ? v : Number.NaN)),
    y.map((v, i) => (joined[i] && any ? v : Number.NaN)),
  ];
}

export function textureFigure(result: Texture, log: boolean): Figure {
  const files = result.files;
  const many = files.length > 1;
  const data: Partial<PlotData>[] = [];
  files.forEach((f, i) => {
    const chi = num(f.chi);
    const color = many ? seriesColor(i) : DATA;
    const label = f.file_label || "ring − background";
    const y = log ? positive(num(f.intensity)) : num(f.intensity);
    data.push({
      type: "scatter",
      mode: "markers",
      x: chi,
      y,
      name: many ? label : "ring − background",
      legendgroup: String(i),
      marker: { size: many ? 4 : 5, color },
      error_y: f.sigma
        ? { ...errorBars(num(f.sigma), many ? color : "#9a9994"), thickness: 1, width: 0 }
        : undefined,
      hovertemplate: `${label}<br>χ %{x:.1f}°<br>I %{y:.4g}<extra></extra>`,
    });
    const o = orientation(f);
    if (o) {
      const filled = log ? positive(num(o.filled)) : num(o.filled);
      data.push({
        type: "scatter",
        mode: "lines",
        x: chi,
        y: filled,
        name: "with the model filled in",
        showlegend: !many,
        legendgroup: String(i),
        line: { color: many ? color : SERIES[0], width: many ? 1.5 : 2 },
        hoverinfo: "skip",
      });
    }
  });
  const first = files[0];
  const shapes: NonNullable<PlotLayout["shapes"]> = [];
  const annotations: NonNullable<PlotLayout["annotations"]> = [];
  if (first) {
    const o = orientation(first);
    if (o)
      shapes.push({
        type: "line",
        xref: "x",
        yref: "paper",
        x0: Number(o.split ?? 45),
        x1: Number(o.split ?? 45),
        y0: 0,
        y1: 1,
        line: { color: MUTED, width: 1, dash: "dot" },
      });
    const chi = num(first.chi);
    const accessible = (first.accessible ?? []).map(Boolean);
    const step = chi.length > 1 ? Math.abs(chi[1]! - chi[0]!) : 1;
    if (accessible.length === chi.length)
      runs(
        chi,
        accessible.map((a) => !a),
      ).forEach(([lo, hi], n) => {
        shapes.push({
          type: "rect",
          xref: "x",
          yref: "paper",
          x0: lo - step / 2,
          x1: hi + step / 2,
          y0: 0,
          y1: 1,
          fillcolor: "#e9e8e4",
          opacity: 0.7,
          line: { width: 0 },
          layer: "below",
        });
        if (n === 0)
          annotations.push({
            xref: "x",
            yref: "paper",
            x: lo - step / 2,
            y: 1,
            text: "not reached",
            showarrow: false,
            xanchor: "left",
            yanchor: "top",
            font: { size: 10, color: MUTED },
          });
      });
  }
  const layout = baseLayout({
    xaxis: axis({ title: "χ (deg)" }),
    yaxis: log ? logAxis({ title: "I" }) : axis({ title: "I" }),
    hovermode: "closest",
    legend: { orientation: "h", yanchor: "bottom", y: 1.02, x: 0, font: { size: 11 } },
    margin: { l: 64, r: 16, t: 36, b: 44 },
    shapes,
    annotations,
  });
  return { data, layout };
}

export function poleFigure(
  result: Texture,
  mode: "density" | "population",
  log: boolean,
): Figure | null {
  const files = result.files.filter((f) => orientation(f));
  if (!files.length) return null;
  const key = mode === "density" ? "pole_density" : "pole_figure";
  const unit = mode === "density" ? "m.r.d." : "/deg";
  const data: Partial<PlotData>[] = [];
  files.forEach((f, i) => {
    const chi = num(f.chi);
    const o = orientation(f)!;
    let y = num(o[key]);
    if (log) y = positive(y);
    const [measured, model] = measuredAndModel(y, (f.accessible ?? []).map(Boolean));
    const color = seriesColor(i);
    const label = f.file_label || `file ${i + 1}`;
    data.push({
      type: "scatter",
      mode: "lines",
      x: chi,
      y: measured,
      name: label,
      legendgroup: String(i),
      line: { color, width: 2 },
      hovertemplate: `${label}<br>χ %{x:.1f}°<br>%{y:.4g} ${unit}<extra></extra>`,
    });
    data.push({
      type: "scatter",
      mode: "lines",
      x: chi,
      y: model,
      name: `${label} (model)`,
      showlegend: false,
      legendgroup: String(i),
      line: { color, width: 2, dash: "dot" },
      hovertemplate: `${label}, model<br>χ %{x:.1f}°<br>%{y:.4g} ${unit}<extra></extra>`,
    });
  });
  data.push({
    type: "scatter",
    mode: "lines",
    x: [Number.NaN],
    y: [Number.NaN],
    name: "model fill",
    line: { color: MUTED, dash: "dot" },
  });
  const shapes: NonNullable<PlotLayout["shapes"]> = [];
  const annotations: NonNullable<PlotLayout["annotations"]> = [];
  if (mode === "density") {
    shapes.push({
      type: "line",
      xref: "paper",
      yref: "y",
      x0: 0,
      x1: 1,
      y0: 1,
      y1: 1,
      line: { color: MUTED, width: 1, dash: "dash" },
    });
    annotations.push({
      xref: "paper",
      yref: "y",
      x: 1,
      y: 1,
      text: "random",
      showarrow: false,
      xanchor: "right",
      yanchor: "bottom",
      font: { size: 11, color: MUTED },
    });
  } else {
    const split = Number(orientation(files[0]!)!.split ?? 45);
    shapes.push({
      type: "line",
      xref: "x",
      yref: "paper",
      x0: split,
      x1: split,
      y0: 0,
      y1: 1,
      line: { color: MUTED, width: 1, dash: "dot" },
    });
  }
  const yTitle =
    mode === "density" ? "pole density f(χ) (m.r.d.)" : "population f(χ) sin χ (1/deg)";
  const layout = baseLayout({
    xaxis: axis({ title: "χ (deg) · 0 = film normal", range: [0, 90], dtick: 15 }),
    yaxis: log ? logAxis({ title: yTitle }) : axis({ title: yTitle }),
    hovermode: "closest",
    legend: { orientation: "h", yanchor: "bottom", y: 1.02, x: 0, font: { size: 11 } },
    margin: { l: 64, r: 16, t: 36, b: 44 },
    shapes,
    annotations,
  });
  return { data, layout };
}

export function polePolar(result: Texture, log: boolean): Figure | null {
  const files = result.files.filter((f) => orientation(f));
  if (!files.length) return null;
  const data: Partial<PlotData>[] = [];
  files.forEach((f, i) => {
    const chi = num(f.chi);
    let y = num(orientation(f)!.pole_density);
    if (log) y = positive(y);
    const [measured, model] = measuredAndModel(y, (f.accessible ?? []).map(Boolean));
    const theta = [...chi.map((c) => -c).reverse(), ...chi];
    const color = seriesColor(i);
    const label = f.file_label || `file ${i + 1}`;
    for (const [part, dash, show] of [
      [measured, "solid", true],
      [model, "dot", false],
    ] as [number[], string, boolean][]) {
      data.push({
        type: "scatterpolar",
        theta,
        r: [...part.slice().reverse(), ...part],
        mode: "lines",
        name: label,
        showlegend: show,
        legendgroup: String(i),
        line: { color, width: 2, dash },
        hovertemplate: `${label}<br>χ %{theta:.1f}°<br>%{r:.4g} m.r.d.<extra></extra>`,
      } as Partial<PlotData>);
    }
  });
  const circle = Array.from({ length: 181 }, (_, i) => -90 + i);
  data.push({
    type: "scatterpolar",
    theta: circle,
    r: circle.map(() => 1),
    mode: "lines",
    name: "random (1 m.r.d.)",
    line: { color: MUTED, width: 1, dash: "dash" },
    hoverinfo: "skip",
  } as Partial<PlotData>);
  const ticks = [-90, -60, -30, 0, 30, 60, 90];
  const layout = baseLayout({
    polar: {
      sector: [0, 180],
      bgcolor: "#ffffff",
      angularaxis: {
        rotation: 90,
        direction: "clockwise",
        tickmode: "array",
        tickvals: ticks,
        ticktext: ticks.map((t) => `${Math.abs(t)}°`),
        linecolor: "#62615d",
        gridcolor: "#e6e5e1",
      },
      radialaxis: {
        type: log ? "log" : "linear",
        title: { text: "f (m.r.d.)" },
        angle: 0,
        tickangle: 0,
        linecolor: "#62615d",
        gridcolor: "#e6e5e1",
        ...(log ? { dtick: 1 } : {}),
      },
    },
    legend: { orientation: "h", yanchor: "bottom", y: 1.02, x: 0, font: { size: 11 } },
    margin: { l: 40, r: 40, t: 36, b: 20 },
    annotations: [
      {
        text: "film normal ↑ · film plane ↔",
        x: 1,
        y: 0,
        xref: "paper",
        yref: "paper",
        showarrow: false,
        xanchor: "right",
        font: { size: 11, color: MUTED },
      },
    ],
  } as Partial<PlotLayout>);
  return { data, layout };
}

/** Radius on the equal-area map (unit circle = film plane) of a polar angle χ. */
export const radiusOf = (chiDeg: number) =>
  Math.sin((chiDeg * Math.PI) / 360) / Math.sin(Math.PI / 4);

export function poleMapFigure(result: Texture, maps: PoleMap[], log: boolean): Figure | null {
  if (!maps.length) return null;
  const shown = maps.slice(0, 4);
  const values = shown.flatMap((m) =>
    m.z.flat().filter((v): v is number => v !== null && Number.isFinite(v)),
  );
  const logged = log ? values.filter((v) => v > 0).map((v) => Math.log10(v)) : values;
  let zmin = logged.length ? Math.min(...logged) : 0;
  const zmax = logged.length ? Math.max(...logged) : 1;
  if (log) zmin = Math.max(zmin, zmax - LOG_DECADES);
  const data: Partial<PlotData>[] = [];
  const layout = baseLayout({ margin: { l: 16, r: 16, t: 40, b: 36 }, plot_bgcolor: "#ffffff" });
  const shapes: NonNullable<PlotLayout["shapes"]> = [];
  const annotations: NonNullable<PlotLayout["annotations"]> = [];
  const gap = 0.04;
  const width = (1 - gap * (shown.length - 1)) / shown.length;
  shown.forEach((m, k) => {
    const n = k + 1;
    const xa = n === 1 ? "x" : `x${n}`;
    const ya = n === 1 ? "y" : `y${n}`;
    const z = m.z.map((row) =>
      row.map((v) => (v === null ? Number.NaN : log ? (v > 0 ? Math.log10(v) : Number.NaN) : v)),
    );
    data.push({
      type: "heatmap",
      x: m.x,
      y: m.y,
      z,
      customdata: m.chi as unknown as number[][],
      colorscale: "Viridis",
      zmin,
      zmax,
      showscale: n === shown.length,
      colorbar: { title: { text: log ? "log₁₀ f" : "f (m.r.d.)" }, thickness: 10, len: 0.8 },
      hovertemplate: `χ %{customdata:.1f}°<br>${log ? "log₁₀ f %{z:.3g}" : "f %{z:.3g} m.r.d."}<extra></extra>`,
      xaxis: xa as PlotData["xaxis"],
      yaxis: ya as PlotData["yaxis"],
    } as Partial<PlotData>);
    const file = result.files.find((f) => f.file === m.file);
    const chi = num(file?.chi ?? []);
    const accessible = (file?.accessible ?? []).map(Boolean);
    const step = chi.length > 1 ? Math.abs(chi[1]! - chi[0]!) : 1;
    const edges = new Set<number>();
    for (const [lo, hi] of runs(
      chi,
      accessible.map((a) => !a),
    ))
      for (const v of [lo - step / 2, hi + step / 2])
        if (v > 0 && v < 90) edges.add(Number(v.toFixed(6)));
    const rings: [number, "solid" | "dash" | "dot", string][] = [
      [90, "solid", MUTED],
      [45, "dash", "#ffffff"],
      ...[...edges]
        .sort((a, b) => a - b)
        .map((v): [number, "dot", string] => [v, "dot", "#ffffff"]),
    ];
    for (const [chiEdge, dash, color] of rings) {
      const r = radiusOf(chiEdge);
      shapes.push({
        type: "circle",
        xref: xa as NonNullable<PlotLayout["shapes"]>[number]["xref"],
        yref: ya as NonNullable<PlotLayout["shapes"]>[number]["yref"],
        x0: -r,
        x1: r,
        y0: -r,
        y1: r,
        line: { color, width: 1.2, dash },
      });
    }
    const left = k * (width + gap);
    (layout as Record<string, unknown>)[n === 1 ? "xaxis" : `xaxis${n}`] = {
      visible: false,
      range: [-1.04, 1.04],
      domain: [left, left + width],
      anchor: ya,
    };
    (layout as Record<string, unknown>)[n === 1 ? "yaxis" : `yaxis${n}`] = {
      visible: false,
      range: [-1.04, 1.04],
      scaleanchor: xa,
      scaleratio: 1,
      anchor: xa,
    };
    annotations.push({
      xref: "paper",
      yref: "paper",
      x: left + width / 2,
      y: 1,
      text: m.file_label,
      showarrow: false,
      yanchor: "bottom",
      font: { size: 11 },
    });
  });
  let note =
    "equal-area projection · film normal at the center, film plane on the rim · dashed: χ = 45° · dotted: edge of the model fill";
  if (maps.length > shown.length) note += ` · first ${shown.length} of ${maps.length} files`;
  annotations.push({
    xref: "paper",
    yref: "paper",
    x: 0.5,
    y: -0.02,
    text: note,
    showarrow: false,
    yanchor: "top",
    font: { size: 11, color: MUTED },
  });
  layout.shapes = shapes;
  layout.annotations = annotations;
  return { data, layout };
}
