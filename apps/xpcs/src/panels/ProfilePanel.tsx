// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/**
 * The I(q) panel under the image, one of three views: the I(q) of each time segment of the file
 * shown (its stability), the g2 of each segment (when the file stores them), or the SAXS 1D of
 * the checked files.
 */

import { unpackFlat, unpackNumbers, unpackRows, unwrap } from "@beamline-web/client";
import {
  Busy,
  Field,
  NumberField,
  Placeholder,
  Segmented,
  Toggle,
  useLocalState,
  type PluginProps,
} from "@beamline-web/ui";
import {
  Plot,
  axis,
  baseLayout,
  g2Figure,
  heightFor,
  logAxis,
  logTicks,
  orderedColor,
  positiveExtent,
  seriesColor,
  symbol,
  type G2SeriesInput,
  type PlotData,
  type PlotLayout,
} from "@beamline-web/viz";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { api, type G2Stability, type Saxs1d, type Stability } from "../api/client";
import { useColormaps } from "../api/queries";
import { analysisFiles, useAppStore } from "../store";

type Mode = "saxs1d" | "saxs" | "g2";

interface ProfileSettings {
  mode: Mode;
  logx: boolean;
  logy: boolean;
  allphi: boolean;
  absolute: boolean;
  marker: number;
  layout: "q" | "file" | "combined";
  cols: number;
}

const DEFAULTS: ProfileSettings = {
  mode: "saxs",
  logx: true,
  logy: true,
  allphi: false,
  absolute: false,
  marker: 4,
  layout: "q",
  cols: 2,
};
const EMPTY = "Click a file, or check several, to show it here.";

type Answer =
  | { mode: "saxs1d"; result: Saxs1d }
  | { mode: "saxs"; result: Stability }
  | { mode: "g2"; result: G2Stability };

function profileAxes(
  s: ProfileSettings,
  xlabel: string,
  ylabel: string,
  xs: [number, number],
  ys: [number, number],
) {
  return {
    xaxis: (s.logx ? logAxis : axis)({ title: xlabel, ...(s.logx ? logTicks(xs[0], xs[1]) : {}) }),
    yaxis: (s.logy ? logAxis : axis)({ title: ylabel, ...(s.logy ? logTicks(ys[0], ys[1]) : {}) }),
  };
}

const nanToNull = (values: ArrayLike<number>) =>
  Array.from(values, (v) => (Number.isNaN(v) ? null : v)) as number[];

export function ProfilePanel({ visible }: PluginProps) {
  const [s, setS] = useLocalState<ProfileSettings>("xpcs:profile", DEFAULTS);
  const set = <K extends keyof ProfileSettings>(key: K, value: ProfileSettings[K]) =>
    setS((prev) => ({ ...prev, [key]: value }));
  const active = useAppStore((st) => st.active);
  const selection = useAppStore((st) => st.selection);
  const names = useMemo(
    () => (s.mode === "saxs1d" ? analysisFiles({ active, selection }) : active ? [active] : []),
    [s.mode, active, selection],
  );
  const colormaps = useColormaps();
  const scale = colormaps.data?.viridis ?? [];
  const query = useQuery<Answer, Error>({
    queryKey: ["profile", s.mode, names, s.allphi, s.absolute],
    queryFn: async () => {
      if (s.mode === "saxs1d")
        return {
          mode: "saxs1d",
          result: unwrap(
            await api.POST("/api/saxs1d", {
              body: { names, all_phi: s.allphi, absolute: s.absolute },
            }),
          ),
        };
      if (s.mode === "g2")
        return {
          mode: "g2",
          result: unwrap(
            await api.GET("/api/files/{name}/g2_stability", {
              params: { path: { name: names[0]! } },
            }),
          ),
        };
      return {
        mode: "saxs",
        result: unwrap(
          await api.GET("/api/files/{name}/stability", { params: { path: { name: names[0]! } } }),
        ),
      };
    },
    enabled: visible && names.length > 0,
  });

  const box = useRef<HTMLDivElement>(null);
  const [boxHeight, setBoxHeight] = useState(240);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setBoxHeight(el.clientHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fig = useMemo<{
    data: Partial<PlotData>[];
    layout: Partial<PlotLayout>;
    height: number;
    note: string;
  } | null>(() => {
    const last = query.data;
    if (!last) return null;
    if (last.mode === "saxs1d") {
      const r = last.result;
      if (!r.files.length) return null;
      const data: Partial<PlotData>[] = [];
      let index = 0;
      for (const f of r.files) {
        const q = unpackNumbers(f.q);
        unpackRows(f.I).forEach((line, k) => {
          const color = seriesColor(index);
          const name = f.labels[k] ?? f.label;
          data.push({
            type: "scatter",
            mode: s.marker > 0 ? "lines+markers" : "lines",
            x: q,
            y: nanToNull(line as ArrayLike<number>),
            name,
            line: { color, width: 1.4 },
            marker: {
              symbol: symbol(index),
              size: s.marker || 4,
              color,
              line: { width: 1, color },
            },
            hovertemplate: `${name}<br>q %{x:.5g} Å⁻¹<br>I %{y:.4g}<extra></extra>`,
          });
          index += 1;
        });
      }
      const first = r.files[0]!;
      const qs = positiveExtent(data.map((t) => t.x as number[])) ?? [1e-3, 1];
      const is = positiveExtent(
        data.map((t) => (t.y as (number | null)[]).filter((v): v is number => v !== null)),
      ) ?? [1e-3, 1];
      return {
        data,
        layout: baseLayout({
          margin: { l: 50, r: 10, t: 10, b: 36 },
          ...profileAxes(s, first.xlabel, first.ylabel, qs, is),
        }),
        height: heightFor(boxHeight),
        note: r.skipped.map((x) => x.reason).join(" · "),
      };
    }
    if (last.mode === "g2") {
      const r = last.result;
      const g2 = unpackFlat(r.g2) as Float32Array;
      const err = unpackFlat(r.err) as Float32Array;
      const [ns = 0, nt = 0, nq = 0] = r.g2.shape;
      const segments: G2SeriesInput[] = Array.from({ length: ns }, (_, k) => ({
        label: `segment ${r.segments[k]}`,
        q: r.q,
        labels: r.labels,
        t: unpackNumbers(r.t),
        g2: g2.subarray(k * nt * nq, (k + 1) * nt * nq),
        err: err.subarray(k * nt * nq, (k + 1) * nt * nq),
        fit: null,
      }));
      const f = g2Figure(segments, {
        mode: s.layout,
        cols: s.cols,
        markerSize: 4,
        legend: true,
        scale,
      });
      return {
        data: f.data,
        layout: f.layout,
        height: heightFor(boxHeight, f.rows, 220),
        note: `${r.label} — g2 of ${segments.length} time segments`,
      };
    }
    const r = last.result;
    const q = unpackNumbers(r.q);
    const lines = unpackRows(r.I);
    const data: Partial<PlotData>[] = lines.map((line, k) => ({
      type: "scatter",
      mode: "lines",
      x: q,
      y: nanToNull(line as ArrayLike<number>),
      name: r.labels[k],
      line: { color: orderedColor(k, lines.length, scale), width: 1.3 },
      hovertemplate: `${r.labels[k]}<br>q %{x:.5g} Å⁻¹<br>I %{y:.4g}<extra></extra>`,
    }));
    const qs = positiveExtent([q]) ?? [1e-3, 1];
    const is = positiveExtent(
      data.map((t) => (t.y as (number | null)[]).filter((v): v is number => v !== null)),
    ) ?? [1e-3, 1];
    return {
      data,
      layout: baseLayout({
        margin: { l: 50, r: 10, t: 10, b: 36 },
        legend: { font: { size: 9.5 } },
        ...profileAxes(s, r.xlabel, r.ylabel, qs, is),
      }),
      height: heightFor(boxHeight),
      note: `${r.label} — I(q) of ${lines.length} time segments, dark first`,
    };
  }, [query.data, s, boxHeight, scale]);

  const empty =
    query.data && query.data.mode === "saxs1d" && !query.data.result.files.length
      ? (query.data.result.skipped[0]?.reason ?? EMPTY)
      : EMPTY;

  return (
    <section
      className="flex h-full min-h-0 flex-col rounded-md border border-line bg-surface"
      aria-label="I(q) panel"
    >
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-2 py-1 text-xs">
        <Segmented
          size="sm"
          value={s.mode}
          onChange={(v) => set("mode", v)}
          options={[
            { value: "saxs1d", label: "SAXS 1D", title: "I(q) of the checked files" },
            {
              value: "saxs",
              label: "I(q) segments",
              title: "I(q) of each time segment of the file shown",
            },
            {
              value: "g2",
              label: "g2 segments",
              title: "g2 of each time segment of the file shown, when the file stores them",
            },
          ]}
        />
        {s.mode !== "g2" ? (
          <>
            <Toggle checked={s.logx} onChange={(v) => set("logx", v)}>
              log q
            </Toggle>
            <Toggle checked={s.logy} onChange={(v) => set("logy", v)}>
              log I
            </Toggle>
          </>
        ) : null}
        {s.mode === "saxs1d" ? (
          <>
            <Toggle
              checked={s.allphi}
              onChange={(v) => set("allphi", v)}
              title="Every φ slice of the file, not only the average"
            >
              φ slices
            </Toggle>
            <Toggle
              checked={s.absolute}
              onChange={(v) => set("absolute", v)}
              title="Absolute cross-section"
            >
              1/cm
            </Toggle>
            <Field label="marker">
              <NumberField
                size="sm"
                width="3.5rem"
                value={s.marker}
                min={0}
                max={12}
                step={1}
                onChange={(v) => set("marker", v ?? 4)}
              />
            </Field>
          </>
        ) : null}
        {s.mode === "g2" ? (
          <>
            <Segmented
              size="sm"
              value={s.layout}
              onChange={(v) => set("layout", v)}
              options={[
                { value: "q", label: "by q" },
                { value: "file", label: "by segment" },
                { value: "combined", label: "one" },
              ]}
            />
            <Field label="columns">
              <NumberField
                size="sm"
                width="3.5rem"
                value={s.cols}
                min={1}
                max={6}
                step={1}
                onChange={(v) => set("cols", v ?? 2)}
              />
            </Field>
          </>
        ) : null}
        {fig?.note ? <span className="truncate text-2xs text-muted">{fig.note}</span> : null}
      </div>
      <div ref={box} className="relative min-h-0 flex-1 overflow-auto">
        <Busy active={query.isFetching} />
        {!names.length ? (
          <Placeholder>{EMPTY}</Placeholder>
        ) : query.error ? (
          <Placeholder error>{query.error.message}</Placeholder>
        ) : fig ? (
          <Plot data={fig.data} layout={fig.layout} height={fig.height} aria-label="I(q) figure" />
        ) : query.data ? (
          <Placeholder>{empty}</Placeholder>
        ) : null}
      </div>
    </section>
  );
}
