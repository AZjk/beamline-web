// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/**
 * The τ(q) tab: the relaxation times from the page's g2 fits of the checked files, a power law
 * τ = a·q^b fitted through them, and every g2 fit parameter against q.
 */

import { unwrap } from "@beamline-web/client";
import {
  Button,
  Busy,
  Field,
  Hint,
  NumberField,
  Placeholder,
  Toggle,
  fmt,
  range,
  toast,
  useLocalState,
  type PluginProps,
} from "@beamline-web/ui";
import {
  INK2,
  Plot,
  axis,
  baseLayout,
  errorBars,
  heightFor,
  logTicks,
  markers,
  positiveExtent,
  seriesColor,
  symbol,
  type PlotData,
  type PlotLayout,
  type AxisAnchor,
} from "@beamline-web/viz";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { api, type Tauq } from "../api/client";
import { multitauFiles, useAppStore } from "../store";

interface TauqSettings {
  logx: boolean;
  logy: boolean;
  offset: number;
  qmin: number | null;
  qmax: number | null;
  params: boolean;
  bounds: {
    a: { min: number; max: number; fit: boolean };
    b: { min: number; max: number; fit: boolean };
  };
}

const DEFAULTS: TauqSettings = {
  logx: true,
  logy: true,
  offset: 0,
  qmin: null,
  qmax: null,
  params: true,
  bounds: { a: { min: 1e-12, max: 1e-3, fit: true }, b: { min: -2.5, max: -0.5, fit: true } },
};
const PANEL_H = 190;

function requestOf(s: TauqSettings, fit: boolean) {
  return {
    q_range: range(s.qmin, s.qmax),
    bounds: [
      [s.bounds.a.min, s.bounds.b.min],
      [s.bounds.a.max, s.bounds.b.max],
    ],
    fit_flag: [s.bounds.a.fit, s.bounds.b.fit],
    fit,
  };
}

function figure(
  last: Tauq,
  s: TauqSettings,
  boxHeight: number,
): { data: Partial<PlotData>[]; layout: Partial<PlotLayout>; height: number } {
  const showParams = s.params && Boolean(last.files[0]?.params_vs_q);
  const data: Partial<PlotData>[] = [];
  const layout = baseLayout({
    margin: { l: 58, r: 14, t: 20, b: 42 },
    annotations: [],
  }) as Partial<PlotLayout> & Record<string, unknown>;
  const mainBottom = showParams ? 0.54 : 0;
  const qs = positiveExtent(last.files.map((f) => f.q)) ?? [1e-3, 1e-1];
  const ts = positiveExtent(last.files.map((f) => f.tau)) ?? [1e-4, 1e2];
  layout.xaxis = axis({
    title: "q (Å⁻¹)",
    domain: [0, 1],
    anchor: "y",
    ...(s.logx ? { type: "log", ...logTicks(qs[0], qs[1]) } : {}),
  });
  layout.yaxis = axis({
    title: "τ (s)",
    domain: [mainBottom, 1],
    anchor: "x",
    ...(s.logy ? { type: "log", ...logTicks(ts[0], ts[1]) } : {}),
  });
  last.files.forEach((f, m) => {
    const color = seriesColor(m);
    const scale = 10 ** ((s.offset || 0) * m);
    data.push({
      type: "scatter",
      mode: "markers",
      x: f.q,
      y: f.tau.map((v) => v / scale),
      name: f.label,
      legendgroup: `f${m}`,
      marker: markers(color, 7, symbol(m)),
      error_y: errorBars(
        f.tau_err.map((v) => v / scale),
        color,
      ),
      hovertemplate: `${f.label}<br>q %{x:.5g} Å⁻¹<br>τ %{y:.4g} s<extra></extra>`,
    });
    if (f.fit) {
      data.push({
        type: "scatter",
        mode: "lines",
        x: f.fit.x,
        y: f.fit.y.map((v) => v / scale),
        legendgroup: `f${m}`,
        showlegend: false,
        line: { color, width: 2 },
        hoverinfo: "skip",
      });
    }
  });
  if (showParams) {
    const p = last.files[0]!.params_vs_q;
    const count = Math.min(4, p.names.length);
    const gapX = 0.09;
    const gapY = 0.14;
    const w = (1 - gapX) / 2;
    const top = 0.42;
    const h = (top - gapY) / 2;
    const bounds = last.files[last.files.length - 1]!.params_vs_q.bounds;
    for (let i = 0; i < count; i += 1) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const n = i + 2;
      const xdomain: [number, number] = [col * (w + gapX), col * (w + gapX) + w];
      const ydomain: [number, number] = [top - row * (h + gapY) - h, top - row * (h + gapY)];
      const log = p.names[i] === "b" || p.names[i] === "b2";
      let r: [number, number] | undefined;
      if (bounds) {
        const lo = bounds[0]![i]!;
        const hi = bounds[1]![i]!;
        r = log
          ? [Math.log10(Math.max(lo, 1e-300) * 0.5), Math.log10(hi * 2)]
          : [lo - 0.15 * (hi - lo), hi + 0.15 * (hi - lo)];
      }
      layout[`xaxis${n}`] = axis({
        domain: xdomain,
        anchor: `y${n}` as AxisAnchor,
        ...(row === 1 ? { title: "q (Å⁻¹)" } : {}),
      });
      const decades = log && r ? r[1] - r[0] : 0;
      layout[`yaxis${n}`] = axis({
        domain: ydomain,
        anchor: `x${n}` as AxisAnchor,
        ...(log ? { type: "log", dtick: decades > 4 ? 2 : 1 } : {}),
        ...(r ? { range: r } : {}),
      });
      (layout.annotations as Partial<PlotLayout["annotations"][number]>[]).push({
        text: p.titles[i],
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
      last.files.forEach((f, m) => {
        const q = f.params_vs_q;
        const color = seriesColor(m);
        data.push({
          type: "scatter",
          mode: "markers",
          x: q.q,
          y: (q.values[i] ?? []).map((v) => v ?? Number.NaN),
          legendgroup: `f${m}`,
          showlegend: false,
          marker: markers(color, 5, symbol(m)),
          error_y: errorBars(
            (q.errors[i] ?? []).map((v) => v ?? Number.NaN),
            color,
          ),
          xaxis: `x${n}`,
          yaxis: `y${n}`,
          hovertemplate: `${f.label}<br>q %{x:.5g}<br>${p.titles[i]} %{y:.4g}<extra></extra>`,
        });
      });
      if (bounds) {
        const qq = last.files[last.files.length - 1]!.params_vs_q.q;
        const xr = [Math.min(...qq), Math.max(...qq)];
        for (const [v, which] of [
          [bounds[0]![i]!, "lower"],
          [bounds[1]![i]!, "upper"],
        ] as const) {
          data.push({
            type: "scatter",
            mode: "lines",
            x: xr,
            y: [v, v],
            showlegend: false,
            hoverinfo: "skip",
            line: { color: "#b8b6ae", width: 1, dash: "dot" },
            xaxis: `x${n}`,
            yaxis: `y${n}`,
            name: `${which} bound`,
          });
        }
      }
    }
  }
  return { data, layout, height: heightFor(boxHeight, showParams ? 3 : 1, PANEL_H) };
}

export function TauqTab({ visible }: PluginProps) {
  const [s, setS] = useLocalState<TauqSettings>("xpcs:tauq", DEFAULTS);
  const set = <K extends keyof TauqSettings>(key: K, value: TauqSettings[K]) =>
    setS((prev) => ({ ...prev, [key]: value }));
  const files = useAppStore((st) => st.files);
  const active = useAppStore((st) => st.active);
  const selection = useAppStore((st) => st.selection);
  const fitVersion = useAppStore((st) => st.fitVersion);
  const names = useMemo(
    () => multitauFiles({ files, active, selection }),
    [files, active, selection],
  );
  const body = useMemo(() => requestOf(s, false), [s]);
  const query = useQuery<Tauq, Error>({
    queryKey: ["tauq", names, body, fitVersion],
    queryFn: async () => unwrap(await api.POST("/api/tauq", { body: { names, ...body } })),
    enabled: visible && names.length > 0,
  });
  // a fit's answer replaces the query's until the inputs change
  const [fitted, setFitted] = useState<{ key: string; result: Tauq } | null>(null);
  const key = JSON.stringify([names, body, fitVersion]);
  const last = fitted?.key === key ? fitted.result : (query.data ?? null);
  const [fitting, setFitting] = useState(false);
  const fit = async () => {
    setFitting(true);
    try {
      const result = unwrap(
        await api.POST("/api/tauq", { body: { names, ...requestOf(s, true) } }),
      );
      setFitted({ key, result });
    } catch (e) {
      toast("τ(q) fit failed", {
        kind: "error",
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setFitting(false);
    }
  };

  const box = useRef<HTMLDivElement>(null);
  const [boxHeight, setBoxHeight] = useState(300);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setBoxHeight(el.clientHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const fig = useMemo(
    () => (last && last.files.length ? figure(last, s, boxHeight) : null),
    [last, s, boxHeight],
  );
  const notes = last ? last.skipped.map((x) => x.reason) : [];
  const lines = last
    ? last.files
        .filter((f) => f.fit)
        .map(
          (f) =>
            `${f.label}:  τ = a·q^b   a = ${fmt(f.fit!.a, 4)} ± ${fmt(f.fit!.a_err, 2)}   b = ${fmt(f.fit!.b, 4)} ± ${fmt(f.fit!.b_err, 2)}`,
        )
    : [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={box}
        className="relative min-h-0 flex-1 overflow-auto border-b border-line bg-surface"
      >
        <Busy active={query.isFetching || fitting} />
        {!names.length ? (
          <Placeholder>Fit the g2 of a multi-tau file first (g2 tab).</Placeholder>
        ) : query.error ? (
          <Placeholder error>{query.error.message}</Placeholder>
        ) : last && !last.files.length ? (
          <Placeholder>
            {last.skipped[0]?.reason ?? "Fit the g2 of a multi-tau file first (g2 tab)."}
          </Placeholder>
        ) : fig ? (
          <Plot
            data={fig.data}
            layout={fig.layout}
            height={fig.height}
            aria-label="tau(q) figure"
          />
        ) : null}
        {notes.length ? (
          <div className="absolute top-1 left-2 text-2xs text-muted">{notes.join(" · ")}</div>
        ) : null}
      </div>
      <div className="max-h-[45%] shrink-0 space-y-2 overflow-auto p-2 text-xs">
        <Hint>
          τ of every q-bin from the g2 fits (g2 tab), and a power law τ = a·q^b through them.
        </Hint>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Toggle checked={s.logx} onChange={(v) => set("logx", v)}>
            log q
          </Toggle>
          <Toggle checked={s.logy} onChange={(v) => set("logy", v)}>
            log τ
          </Toggle>
          <Field label="offset per file" unit="dec">
            <NumberField
              size="sm"
              width="4rem"
              value={s.offset}
              step={0.1}
              onChange={(v) => set("offset", v ?? 0)}
            />
          </Field>
          <Field label="fit q" unit="Å⁻¹">
            <NumberField
              size="sm"
              width="5rem"
              value={s.qmin}
              placeholder="min (all)"
              onChange={(v) => set("qmin", v)}
            />
            <NumberField
              size="sm"
              width="5rem"
              value={s.qmax}
              placeholder="max (all)"
              onChange={(v) => set("qmax", v)}
            />
          </Field>
          <Toggle checked={s.params} onChange={(v) => set("params", v)}>
            fit parameters vs q
          </Toggle>
        </div>
        <table className="text-2xs">
          <thead className="text-left text-muted">
            <tr>
              <th className="pr-2 font-medium">parameter</th>
              <th className="pr-2 font-medium">lower</th>
              <th className="pr-2 font-medium">upper</th>
              <th className="font-medium">fit</th>
            </tr>
          </thead>
          <tbody>
            {(["a", "b"] as const).map((name) => (
              <tr key={name}>
                <td className="pr-2">{name === "a" ? "a · prefactor" : "b · exponent"}</td>
                <td className="pr-2">
                  <NumberField
                    size="sm"
                    width="5.5rem"
                    value={s.bounds[name].min}
                    onChange={(v) =>
                      setS((p) => ({
                        ...p,
                        bounds: {
                          ...p.bounds,
                          [name]: { ...p.bounds[name], min: v ?? p.bounds[name].min },
                        },
                      }))
                    }
                  />
                </td>
                <td className="pr-2">
                  <NumberField
                    size="sm"
                    width="5.5rem"
                    value={s.bounds[name].max}
                    onChange={(v) =>
                      setS((p) => ({
                        ...p,
                        bounds: {
                          ...p.bounds,
                          [name]: { ...p.bounds[name], max: v ?? p.bounds[name].max },
                        },
                      }))
                    }
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={s.bounds[name].fit}
                    onChange={(e) =>
                      setS((p) => ({
                        ...p,
                        bounds: {
                          ...p.bounds,
                          [name]: { ...p.bounds[name], fit: e.target.checked },
                        },
                      }))
                    }
                    className="accent-accent"
                    aria-label={`fit ${name}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Button variant="primary" size="sm" onClick={fit} disabled={fitting || !names.length}>
          {fitting ? "Fitting…" : "Fit τ(q)"}
        </Button>
        {lines.length ? (
          <pre className="font-mono text-2xs whitespace-pre-wrap text-ink-2">
            {lines.join("\n")}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
