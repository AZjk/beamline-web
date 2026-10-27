// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/**
 * The two-time tab: the C2 correlation map of one q-bin of the file shown (picked here, by a
 * click on the image, or with [ and ]), its color levels, and the g2 computed from it over the
 * whole run and per time segment.
 */

import { unpackFlat, unpackRows, unwrap } from "@beamline-web/client";
import {
  Button,
  Busy,
  Field,
  Hint,
  Kbd,
  NumberField,
  Placeholder,
  SelectField,
  Toggle,
  fmt,
  useLocalState,
  useShortcuts,
  type PluginProps,
} from "@beamline-web/ui";
import {
  ArrayImage,
  INK,
  Plot,
  axis,
  baseLayout,
  finiteRange,
  h5webColorMap,
  logAxis,
  logTicks,
  orderedColor,
  type PlotData,
} from "@beamline-web/viz";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { api, type TwotimeC2 } from "../api/client";
import { useC2Array, useColormaps, useInfo, useTwotimeBins } from "../api/queries";
import { isTwotime, useAppStore } from "../store";

interface TwotimeSettings {
  diag: boolean;
  maxsize: "256" | "512" | "1024" | "2048";
  cmap: string;
  autolevel: boolean;
  vmin: number | null;
  vmax: number | null;
  g2log: boolean;
}

const DEFAULTS: TwotimeSettings = {
  diag: true,
  maxsize: "512",
  cmap: "viridis",
  autolevel: true,
  vmin: null,
  vmax: null,
  g2log: true,
};
const EMPTY = "Click a two-time file (TT) to show its correlation map.";

export function TwotimeTab({ visible }: PluginProps) {
  const [s, setS] = useLocalState<TwotimeSettings>("xpcs:twotime", DEFAULTS);
  const set = <K extends keyof TwotimeSettings>(key: K, value: TwotimeSettings[K]) =>
    setS((prev) => ({ ...prev, [key]: value }));
  const active = useAppStore((st) => st.active);
  const files = useAppStore((st) => st.files);
  const selection = useAppStore((st) => st.twotimeSelection);
  const setSelection = useAppStore((st) => st.setTwotimeSelection);
  const info = useInfo();
  const colormaps = useColormaps();
  const twotimeFile = active !== null && isTwotime({ files }, active);
  const bins = useTwotimeBins(active, twotimeFile);
  const count = bins.data?.bins.length ?? 0;
  const index = Math.min(selection, Math.max(0, count - 1));
  useEffect(() => {
    if (count && selection >= count) setSelection(0);
  }, [count, selection, setSelection]);
  const params = useMemo(
    () => ({ selection: index, correct_diag: s.diag, max_size: Number(s.maxsize) }),
    [index, s.diag, s.maxsize],
  );
  const c2 = useC2Array(active, params, visible && twotimeFile && count > 0);
  const curves = useQuery<TwotimeC2, Error>({
    queryKey: ["twotime-curves", active, params],
    queryFn: async () =>
      unwrap(
        await api.GET("/api/files/{name}/twotime/c2", {
          params: { path: { name: active! }, query: { ...params, include_c2: false } },
        }),
      ),
    enabled: visible && twotimeFile && count > 0,
  });

  const select = (i: number) => {
    if (!count) return;
    setSelection(Math.max(0, Math.min(count - 1, i)));
  };
  useShortcuts(
    useMemo(
      () => ({
        "]": () => select(index + 1),
        ArrowRight: () => select(index + 1),
        "[": () => select(index - 1),
        ArrowLeft: () => select(index - 1),
      }),
      [index, count],
    ), // eslint-disable-line react-hooks/exhaustive-deps
    visible,
  );

  const meta = c2.data?.meta;
  const levels = useMemo<[number, number] | undefined>(() => {
    if (!c2.data || !meta) return undefined;
    if (!s.autolevel && s.vmin !== null && s.vmax !== null && s.vmax > s.vmin)
      return [s.vmin, s.vmax];
    if (meta.zmax > meta.zmin) return [meta.zmin, meta.zmax];
    return finiteRange(c2.data.data);
  }, [c2.data, meta, s.autolevel, s.vmin, s.vmax]);

  const g2Figure = useMemo(() => {
    const last = curves.data;
    if (!last) return null;
    const scale = colormaps.data?.viridis ?? [];
    const full = unpackFlat(last.g2_full) as Float32Array;
    const partial = unpackRows(last.g2_partial);
    const period = last.acquire_period;
    const data: Partial<PlotData>[] = [];
    partial.forEach((row, n) => {
      const x: number[] = [];
      const y: number[] = [];
      for (let i = 1; i < row.length; i += 1) {
        x.push(i * period);
        y.push(Number(row[i]));
      }
      data.push({
        type: "scatter",
        mode: "lines",
        x,
        y,
        name: `segment ${n + 1}`,
        line: { color: orderedColor(n, partial.length, scale), width: 1 },
        hovertemplate: `segment ${n + 1}<br>t %{x:.4g} s<br>g2 %{y:.4f}<extra></extra>`,
      });
    });
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 1; i < full.length; i += 1) {
      x.push(i * period);
      y.push(full[i]!);
    }
    data.push({
      type: "scatter",
      mode: "lines",
      x,
      y,
      name: "whole run",
      line: { color: INK, width: 2.2 },
      hovertemplate: "whole run<br>t %{x:.4g} s<br>g2 %{y:.4f}<extra></extra>",
    });
    const layout = baseLayout({
      margin: { l: 46, r: 8, t: 8, b: 32 },
      legend: { font: { size: 9.5 } },
      xaxis: (s.g2log ? logAxis : axis)({
        title: "t (s)",
        ...(s.g2log ? logTicks(period, full.length * period) : {}),
      }),
      yaxis: axis({ title: "g2" }),
    });
    return { data, layout };
  }, [curves.data, s.g2log, colormaps.data]);

  const colormapNames = info.data?.colormaps ?? ["viridis"];
  const { colorMap, invert } = h5webColorMap(s.cmap);
  const extent = useMemo(() => {
    if (!c2.data || !meta) return null;
    const [rows, cols] = c2.data.shape as [number, number];
    const dt = meta.delta_t;
    return { xmin: 0, xmax: cols * dt, ymin: 0, ymax: rows * dt, rows, cols };
  }, [c2.data, meta]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative grid min-h-0 flex-1 grid-rows-[3fr_2fr] border-b border-line bg-surface">
        <Busy active={c2.isFetching || curves.isFetching || bins.isFetching} />
        {!twotimeFile ? (
          <Placeholder className="row-span-2">{EMPTY}</Placeholder>
        ) : c2.error || bins.error ? (
          <Placeholder error className="row-span-2">
            {(c2.error ?? bins.error)?.message}
          </Placeholder>
        ) : (
          <>
            <div className="min-h-0 border-b border-line" aria-label="C2 map">
              {c2.data && meta && extent && levels ? (
                <ArrayImage
                  data={c2.data.data}
                  rows={extent.rows}
                  cols={extent.cols}
                  extent={extent}
                  xLabel="t₁ (s)"
                  yLabel="t₂ (s)"
                  domain={levels}
                  scale="linear"
                  colorMap={colorMap}
                  invertColorMap={invert}
                  aspect="equal"
                  colorBarLabel="C2"
                />
              ) : null}
            </div>
            <div className="min-h-0" aria-label="two-time g2">
              {g2Figure ? (
                <Plot
                  data={g2Figure.data}
                  layout={g2Figure.layout}
                  aria-label="two-time g2 figure"
                />
              ) : null}
            </div>
          </>
        )}
        {meta ? (
          <div className="absolute top-1 left-2 text-2xs text-muted">{`${meta.label} — ${meta.bin_label} (bin ${meta.qbin})`}</div>
        ) : null}
      </div>
      <div className="max-h-[40%] shrink-0 space-y-2 overflow-auto p-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted">q-bin</span>
          <Button
            size="sm"
            onClick={() => select(index - 1)}
            disabled={!count}
            title="previous bin ( [ )"
            aria-label="previous bin"
          >
            ‹
          </Button>
          <SelectField
            size="sm"
            value={String(index)}
            onChange={(v) => select(Number(v))}
            disabled={!count}
            aria-label="two-time bin"
            options={(bins.data?.bins ?? []).map((b) => ({
              value: String(b.index),
              label: b.label,
            }))}
          />
          <Button
            size="sm"
            onClick={() => select(index + 1)}
            disabled={!count}
            title="next bin ( ] )"
            aria-label="next bin"
          >
            ›
          </Button>
        </div>
        <Hint>
          Click a q-bin on the image to pick it, or use <Kbd>[</Kbd> <Kbd>]</Kbd>.
        </Hint>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Toggle checked={s.diag} onChange={(v) => set("diag", v)}>
            correct diagonal
          </Toggle>
          <Field label="C2 size">
            <SelectField
              size="sm"
              value={s.maxsize}
              onChange={(v) => set("maxsize", v)}
              options={[
                { value: "256", label: "≤ 256" },
                { value: "512", label: "≤ 512" },
                { value: "1024", label: "≤ 1024" },
                { value: "2048", label: "≤ 2048" },
              ]}
            />
          </Field>
          <Field label="colors">
            <SelectField
              size="sm"
              value={s.cmap}
              onChange={(v) => set("cmap", v)}
              options={colormapNames.map((n) => ({ value: n, label: n }))}
            />
          </Field>
          <Toggle checked={s.autolevel} onChange={(v) => set("autolevel", v)}>
            auto levels (0.5–99.5 %)
          </Toggle>
          <Field label="C2 range">
            <NumberField
              size="sm"
              width="5rem"
              value={s.vmin}
              placeholder={meta ? fmt(meta.zmin, 4) : "min"}
              onChange={(v) => set("vmin", v)}
              disabled={s.autolevel}
            />
            <NumberField
              size="sm"
              width="5rem"
              value={s.vmax}
              placeholder={meta ? fmt(meta.zmax, 4) : "max"}
              onChange={(v) => set("vmax", v)}
              disabled={s.autolevel}
            />
          </Field>
          <Toggle checked={s.g2log} onChange={(v) => set("g2log", v)}>
            log g2 time axis
          </Toggle>
        </div>
      </div>
    </div>
  );
}
