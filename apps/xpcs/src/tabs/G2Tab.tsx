// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/**
 * The g2 tab: the multi-tau g2 of the checked files from the binary route, the page's fits
 * (single or double exponential, bounds and fixed parameters) run as a job with progress, and
 * the fit parameters in a table.
 */

import { JobError, runJob, unpackFlat, unwrap } from "@beamline-web/client";
import {
  Button,
  Busy,
  Field,
  Hint,
  NumberField,
  Placeholder,
  SectionTitle,
  Segmented,
  Toggle,
  fmt,
  range,
  toast,
  useLocalState,
  type PluginProps,
} from "@beamline-web/ui";
import { Plot, g2Figure, heightFor, type G2SeriesInput } from "@beamline-web/viz";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { type JobState } from "@beamline-web/client";

import { api, type G2Fit } from "../api/client";
import { fetchG2Array, fetchG2Fit } from "../api/queries";
import { labelOf, multitauFiles, useAppStore } from "../store";
import {
  G2_DEFAULTS,
  PARAMS,
  PARAM_TITLES,
  fitSettings,
  g2Ranges,
  type G2Settings,
  type ParamName,
} from "./g2Settings";

const EMPTY = "Check or click a multi-tau file (MT) to show its g2.";

function sameSettings(a: G2Fit, b: G2Fit) {
  return (
    JSON.stringify([a.bounds, a.fit_flag, a.func]) ===
    JSON.stringify([b.bounds, b.fit_flag, b.func])
  );
}

function BoundsRows({ fit, names }: { fit: G2Fit; names: string[] }) {
  const lower = fit.bounds?.[0] ?? [];
  const upper = fit.bounds?.[1] ?? [];
  const flags = fit.fit_flag ?? [];
  return (
    <>
      {[
        ["lower", names.map((_, i) => fmt(lower[i], 4))],
        ["upper", names.map((_, i) => fmt(upper[i], 4))],
        ["fit", names.map((_, i) => (flags[i] === false ? "fixed" : "✓"))],
      ].map(([title, cells]) => (
        <tr key={title as string} className="text-muted">
          <td className="px-1">{title as string}</td>
          {(cells as string[]).map((c, i) => (
            <td key={i} className="px-1 tabular-nums">
              {c}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** The fit results as a table: the bounds and flags on top, then every q-bin of every file. */
function FitInfo({ fitted }: { fitted: { label: string; q: number[]; fit: G2Fit }[] }) {
  if (!fitted.length) return null;
  const first = fitted[0]!.fit;
  const names = first.param_names;
  return (
    <div className="max-h-64 overflow-auto rounded-md border border-line">
      <table className="w-full text-2xs">
        <thead className="sticky top-0 bg-surface-2 text-left text-muted">
          <tr>
            <th className="px-1 py-0.5 font-medium">q (Å⁻¹)</th>
            {names.map((n) => (
              <th key={n} className="px-1 py-0.5 font-medium">
                {PARAM_TITLES[n as ParamName] ?? n}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <BoundsRows fit={first} names={names} />
          {fitted.map(({ label, q, fit }) => {
            const own = fit.param_names.length === names.length ? fit : null;
            return [
              <tr key={`${label}-head`} className="bg-surface-3 font-medium">
                <td colSpan={names.length + 1} className="px-1 py-0.5">
                  {label}
                </td>
              </tr>,
              ...(own
                ? sameSettings(own, first)
                  ? []
                  : [<BoundsRows key={`${label}-bounds`} fit={own} names={names} />]
                : [
                    <tr key={`${label}-func`}>
                      <td colSpan={names.length + 1} className="px-1 text-danger">
                        fitted with the {fit.func} exponential
                      </td>
                    </tr>,
                  ]),
              ...(own
                ? q.map((qv, n) => (
                    <tr key={`${label}-${n}`} className="border-t border-line">
                      <td className="px-1 tabular-nums">{fmt(qv, 5)}</td>
                      {!own.success[n] ? (
                        <td colSpan={names.length} className="px-1 text-danger">
                          fit failed
                        </td>
                      ) : (
                        names.map((_, i) => (
                          <td key={i} className="px-1 tabular-nums">
                            {fmt(own.params[n]?.[i] ?? null, 4)}{" "}
                            <span className="text-muted">
                              ± {fmt(own.errors[n]?.[i] ?? null, 2)}
                            </span>
                          </td>
                        ))
                      )}
                    </tr>
                  ))
                : []),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

export function G2Tab({ visible }: PluginProps) {
  const [s, setS] = useLocalState<G2Settings>("xpcs:g2", G2_DEFAULTS);
  const set = <K extends keyof G2Settings>(key: K, value: G2Settings[K]) =>
    setS((prev) => ({ ...prev, [key]: value }));
  const setBound = (name: ParamName, patch: Partial<G2Settings["bounds"][ParamName]>) =>
    setS((prev) => ({
      ...prev,
      bounds: { ...prev.bounds, [name]: { ...prev.bounds[name], ...patch } },
    }));
  const files = useAppStore((st) => st.files);
  const active = useAppStore((st) => st.active);
  const selection = useAppStore((st) => st.selection);
  const fitVersion = useAppStore((st) => st.fitVersion);
  const bumpFitVersion = useAppStore((st) => st.bumpFitVersion);
  const setMessage = useAppStore((st) => st.setMessage);
  const names = useMemo(
    () => multitauFiles({ files, active, selection }),
    [files, active, selection],
  );
  const ranges = useMemo(() => g2Ranges(s), [s]);
  const queryClient = useQueryClient();

  const arrays = useQueries({
    queries: names.map((name) => ({
      queryKey: ["g2-array", name, ranges.query],
      queryFn: () => fetchG2Array(name, ranges.query),
      enabled: visible,
      staleTime: 5 * 60_000,
    })),
  });
  const fits = useQueries({
    queries: names.map((name) => ({
      queryKey: ["g2-fit", name, ranges.query, fitVersion],
      queryFn: () => fetchG2Fit(name, ranges.query),
      enabled: visible,
    })),
  });
  const loading = arrays.some((q) => q.isFetching) || fits.some((q) => q.isFetching);
  const error = arrays.find((q) => q.error)?.error ?? null;

  const series = useMemo<{
    inputs: G2SeriesInput[];
    fitted: { label: string; q: number[]; fit: G2Fit }[];
  }>(() => {
    const inputs: G2SeriesInput[] = [];
    const fitted: { label: string; q: number[]; fit: G2Fit }[] = [];
    names.forEach((name, i) => {
      const a = arrays[i]?.data;
      if (!a || !a.meta) return;
      const [, nt, nq] = a.shape as [number, number, number];
      const g2 = a.data.subarray(0, nt * nq);
      const err = a.data.subarray(nt * nq, 2 * nt * nq);
      const fit = fits[i]?.data ?? null;
      let fitInput: G2SeriesInput["fit"] = null;
      if (fit) {
        const fitX = unpackFlat(fit.fit_x) as Float32Array;
        const fitY = unpackFlat(fit.fit_y) as Float32Array;
        fitInput = {
          fitX,
          fitY,
          nx: fit.fit_x.shape[0] ?? fitX.length,
          success: fit.success,
          params: fit.params,
        };
        fitted.push({ label: a.meta.label, q: a.meta.q, fit });
      }
      inputs.push({
        label: a.meta.label,
        q: a.meta.q,
        labels: a.meta.labels,
        t: a.meta.t,
        g2,
        err,
        fit: fitInput,
      });
    });
    return { inputs, fitted };
  }, [names, arrays, fits]);

  const figure = useMemo(() => {
    if (!series.inputs.length) return null;
    return g2Figure(series.inputs, {
      mode: s.layout,
      cols: s.cols,
      showFit: s.showfit,
      subtractBaseline: s.baseline,
      markerSize: s.marker,
      legend: s.legend,
      tRange: s.tauto ? null : range(s.tmin, s.tmax),
      yRange: s.yauto ? null : range(s.ymin, s.ymax),
    });
  }, [
    series,
    s.layout,
    s.cols,
    s.showfit,
    s.baseline,
    s.marker,
    s.legend,
    s.tauto,
    s.tmin,
    s.tmax,
    s.yauto,
    s.ymin,
    s.ymax,
  ]);

  const box = useRef<HTMLDivElement>(null);
  const [boxHeight, setBoxHeight] = useState(300);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setBoxHeight(el.clientHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const [fitting, setFitting] = useState(false);
  const fit = async () => {
    if (!names.length) {
      setMessage(EMPTY);
      return;
    }
    setFitting(true);
    try {
      await runJob<{
        fitted: string[];
        failed: string[];
        skipped: { file: string; reason: string }[];
      }>(
        async () =>
          unwrap(
            await api.POST("/api/jobs/g2-fit", {
              body: { names, q_range: ranges.q_range, t_range: ranges.t_range, ...fitSettings(s) },
            }),
          ) as unknown as JobState<{
            fitted: string[];
            failed: string[];
            skipped: { file: string; reason: string }[];
          }>,
        {
          onProgress: (state) =>
            setMessage(
              state.total ? `Fitting g2 … ${state.done} / ${state.total}` : "Fitting g2 …",
            ),
        },
      ).then((result) => {
        const notes = [
          ...result.failed.map((f) => `${labelOf({ files }, f)}: fit failed`),
          ...result.skipped.map((x) => x.reason),
        ];
        setMessage(
          notes.length
            ? notes.join(" · ")
            : `Fitted ${result.fitted.length} file${result.fitted.length === 1 ? "" : "s"}`,
        );
        if (result.failed.length)
          toast("Some fits failed", { kind: "error", description: notes.join("\n") });
      });
      bumpFitVersion();
      void queryClient.invalidateQueries({ queryKey: ["tauq"] });
      if (!s.showfit) set("showfit", true);
    } catch (e) {
      const text = e instanceof JobError ? e.message : e instanceof Error ? e.message : String(e);
      setMessage(null);
      toast("g2 fit failed", { kind: "error", description: text });
    } finally {
      setFitting(false);
    }
  };

  const notes: string[] = [];
  if (s.showfit && series.inputs.length && !series.fitted.length)
    notes.push("No fit yet: press Fit g2.");
  const paramNames = PARAMS[s.func];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={box}
        className="relative min-h-0 flex-1 overflow-auto border-b border-line bg-surface"
      >
        <Busy active={loading} />
        {!names.length ? (
          <Placeholder>{EMPTY}</Placeholder>
        ) : error ? (
          <Placeholder error>{error.message}</Placeholder>
        ) : figure ? (
          <Plot
            data={figure.data}
            layout={figure.layout}
            height={heightFor(boxHeight, figure.rows, 230)}
            aria-label="g2 figure"
          />
        ) : null}
        {notes.length ? (
          <div className="absolute top-1 left-2 text-2xs text-muted">{notes.join(" · ")}</div>
        ) : null}
      </div>
      <div className="max-h-[45%] shrink-0 space-y-2 overflow-auto p-2 text-xs">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Field label="panels">
            <Segmented
              size="sm"
              value={s.layout}
              onChange={(v) => set("layout", v)}
              options={[
                { value: "q", label: "by q", title: "One panel per q-bin, files overlaid" },
                { value: "file", label: "by file", title: "One panel per file, q-bins overlaid" },
                { value: "combined", label: "one", title: "Everything in one panel" },
              ]}
            />
          </Field>
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
          <Field label="marker">
            <NumberField
              size="sm"
              width="3.5rem"
              value={s.marker}
              min={2}
              max={14}
              step={1}
              onChange={(v) => set("marker", v ?? 6)}
            />
          </Field>
          <Toggle checked={s.legend} onChange={(v) => set("legend", v)}>
            legend
          </Toggle>
          <Toggle
            checked={s.baseline}
            onChange={(v) => set("baseline", v)}
            title="Shift each curve so its fitted baseline d sits at 1"
          >
            subtract fitted baseline
          </Toggle>
        </div>
        <div className="grid grid-cols-[auto_1fr_1fr_auto_auto] items-center gap-x-2 gap-y-1">
          {(
            [
              ["q", "qmin", "qmax", "qauto", "Å⁻¹"],
              ["τ", "tmin", "tmax", "tauto", "s"],
              ["g2", "ymin", "ymax", "yauto", ""],
            ] as const
          ).map(([label, lo, hi, auto, unit]) => (
            <div key={label} className="contents">
              <span className="text-muted">{label}</span>
              <NumberField
                size="sm"
                width="100%"
                value={s[lo]}
                placeholder="min"
                onChange={(v) => set(lo, v)}
                disabled={s[auto]}
              />
              <NumberField
                size="sm"
                width="100%"
                value={s[hi]}
                placeholder="max"
                onChange={(v) => set(hi, v)}
                disabled={s[auto]}
              />
              <span className="text-muted">{unit}</span>
              <Toggle checked={s[auto]} onChange={(v) => set(auto, v)}>
                all
              </Toggle>
            </div>
          ))}
        </div>
        <div className="space-y-1.5 border-t border-line pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <SectionTitle>Fit</SectionTitle>
            <Segmented
              size="sm"
              value={s.func}
              onChange={(v) => set("func", v)}
              options={[
                { value: "single", label: "single exp" },
                { value: "double", label: "double exp" },
              ]}
            />
            <Button variant="primary" size="sm" onClick={fit} disabled={fitting || !names.length}>
              {fitting ? "Fitting…" : "Fit g2"}
            </Button>
            <Toggle checked={s.showfit} onChange={(v) => set("showfit", v)}>
              show fit
            </Toggle>
          </div>
          <Hint>
            g2 = a·exp(−2(t/b)^c) + d, or a·[f·exp(−(t/b)^c) + (1−f)·exp(−(t/b₂)^c₂)]² + d. Fit
            between the bounds; untick to hold a parameter at its lower bound.
          </Hint>
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
              {paramNames.map((name) => (
                <tr key={name}>
                  <td className="pr-2">{PARAM_TITLES[name]}</td>
                  <td className="pr-2">
                    <NumberField
                      size="sm"
                      width="5.5rem"
                      value={s.bounds[name].min}
                      onChange={(v) => setBound(name, { min: v ?? s.bounds[name].min })}
                    />
                  </td>
                  <td className="pr-2">
                    <NumberField
                      size="sm"
                      width="5.5rem"
                      value={s.bounds[name].max}
                      onChange={(v) => setBound(name, { max: v ?? s.bounds[name].max })}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={s.bounds[name].fit}
                      onChange={(e) => setBound(name, { fit: e.target.checked })}
                      className="accent-accent"
                      aria-label={`fit ${name}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {s.showfit ? <FitInfo fitted={series.fitted} /> : null}
        </div>
      </div>
    </div>
  );
}
