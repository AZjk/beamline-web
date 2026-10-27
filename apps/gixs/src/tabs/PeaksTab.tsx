// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/** The Peaks tool: fit one or more peaks on a cut of the Cuts tool (profile, background, the
 * window from a zoom on the plot), with center, FWHM, area, d-spacing and coherence length. */

import { unwrap } from "@beamline-web/client";
import {
  Button,
  Busy,
  DataTable,
  NumberField,
  Placeholder,
  SelectField,
  Toggle,
  Toolbar,
  fmt,
  useLocalState,
  type Column,
  type PluginProps,
} from "@beamline-web/ui";
import { Plot, type PlotRelayoutEvent } from "@beamline-web/viz";
import { useEffect, useMemo, useState } from "react";

import { api, type FitCut, type PeakRow } from "../api/client";
import { contextOf } from "../api/context";
import { useCuts, useInfo } from "../api/queries";
import { fitFigure, type Preview } from "../figures/fit";
import { selectedFiles, useAppStore } from "../store";
import {
  Fields,
  Message,
  ResultAndControls,
  Row,
  Summary,
  cutChoices,
  messageOf,
  parsePeaks,
  saveText,
  splitChoice,
} from "./common";

interface PeaksSettings {
  cut: string | null;
  lo: number | null;
  hi: number | null;
  count: string;
  shape: string;
  background: string;
  shared: boolean;
  log: boolean;
}

const DEFAULTS: PeaksSettings = {
  cut: null,
  lo: null,
  hi: null,
  count: "1",
  shape: "pv",
  background: "2",
  shared: false,
  log: false,
};
const BACKGROUNDS = [
  { value: "0", label: "none" },
  { value: "1", label: "constant" },
  { value: "2", label: "linear" },
  { value: "3", label: "quadratic" },
  { value: "power", label: "power law" },
];

export function PeaksTab({ visible }: PluginProps) {
  const [s, setS] = useLocalState<PeaksSettings>("gixs:peaks", DEFAULTS);
  const set = <K extends keyof PeaksSettings>(key: K, value: PeaksSettings[K]) =>
    setS((p) => ({ ...p, [key]: value }));
  const active = useAppStore((st) => st.active);
  const selection = useAppStore((st) => st.selection);
  const files = useAppStore((st) => st.files);
  const boxes = useAppStore((st) => st.boxes);
  const processing = useAppStore((st) => st.processing);
  const fileOverrides = useAppStore((st) => st.fileOverrides);
  const setLastFit = useAppStore((st) => st.setLastFit);
  const info = useInfo();
  const targets = useMemo(() => selectedFiles({ active, selection }), [active, selection]);
  const choices = useMemo(
    () => cutChoices({ files, active, selection, boxes }, targets),
    [files, active, selection, boxes, targets],
  );
  const chosen = choices.some((c) => c.value === s.cut) ? s.cut : (choices[0]?.value ?? null);
  const pair = splitChoice(chosen);
  const roi = pair ? (boxes.find((r) => r.id === pair[0]) ?? null) : null;
  const file = pair ? pair[1] : null;
  const context = useMemo(
    () => contextOf({ processing, fileOverrides }),
    [processing, fileOverrides],
  );
  const preview = useCuts(file ? [file] : [], roi ? [roi] : [], context, visible && !!roi);
  const [fit, setFit] = useState<FitCut | null>(null);
  const [fitting, setFitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setFit(null), [chosen, processing, fileOverrides]);

  const run = async () => {
    if (!roi || !file) return;
    setFitting(true);
    setError(null);
    try {
      const peaks = parsePeaks(s.count);
      const out = unwrap(
        await api.POST("/api/fit-cut", {
          body: {
            file,
            roi,
            context,
            window: s.lo === null && s.hi === null ? null : [s.lo, s.hi],
            peaks,
            shape: s.shape,
            nbg: s.background === "power" ? "power" : Number(s.background),
            shared: s.shared ? ["fwhm"] : [],
          },
        }),
      );
      setFit(out);
      setLastFit(out);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setFitting(false);
    }
  };
  const previewCurve = preview.data?.curves[0];
  const previewInput: Preview | null = previewCurve
    ? {
        x: previewCurve.x,
        y: previewCurve.y,
        sigma: previewCurve.sigma ?? null,
        x_label: previewCurve.x_label,
        y_label: `I (${previewCurve.level})`,
        title: `${previewCurve.file_label} · ${previewCurve.roi_name}`,
      }
    : null;
  const figure = useMemo(() => fitFigure(fit, previewInput, s.log), [fit, previewInput, s.log]);
  const onRelayout = (event: PlotRelayoutEvent) => {
    const e = event as Record<string, unknown>;
    const lo = e["xaxis.range[0]"];
    const hi = e["xaxis.range[1]"];
    if (typeof lo === "number" && typeof hi === "number") {
      set("lo", Number(Math.min(lo, hi).toPrecision(6)));
      set("hi", Number(Math.max(lo, hi).toPrecision(6)));
    }
  };
  const f = (v: unknown) => (typeof v === "number" ? fmt(v, 5) : "");
  const columns: Column<PeakRow & { id: string }>[] = [
    { key: "peak", label: "#" },
    { key: "center", label: "center", align: "right", format: f },
    { key: "center_error", label: "±", align: "right", format: f },
    { key: "fwhm", label: "FWHM", align: "right", format: f },
    { key: "fwhm_error", label: "±", align: "right", format: f },
    { key: "area", label: "area", align: "right", format: f },
    { key: "area_error", label: "±", align: "right", format: f },
    { key: "d", label: "d (Å)", align: "right", format: f },
    { key: "coherence_length", label: "L (Å)", align: "right", format: f },
  ];
  const rows = (fit?.peaks ?? []).map((p) => ({ ...p, id: String(p.peak) }));

  return (
    <ResultAndControls
      id="peaks"
      result={
        <div className="flex h-full min-h-0 flex-col">
          <Toolbar className="shrink-0 border-b border-line">
            <Toggle checked={s.log} onChange={(v) => set("log", v)}>
              log I
            </Toggle>
            <span className="text-2xs text-muted">
              Zoom (drag) on the plot to set the fit window.
            </span>
          </Toolbar>
          <div className="relative min-h-0 flex-1">
            <Busy active={preview.isFetching || fitting} />
            {!choices.length ? (
              <Placeholder>Add a cut in the Cuts tab first.</Placeholder>
            ) : figure ? (
              <Plot
                data={figure.data}
                layout={figure.layout}
                onRelayout={onRelayout}
                aria-label="peak fit figure"
              />
            ) : preview.error ? (
              <Placeholder error>{preview.error.message}</Placeholder>
            ) : null}
          </div>
          {rows.length ? (
            <DataTable
              columns={columns}
              rows={rows}
              className="max-h-36 shrink-0 rounded-none border-x-0 border-b-0"
              aria-label="fitted peaks"
            />
          ) : null}
        </div>
      }
      controls={
        <div className="space-y-2">
          <Fields>
            <Row label="Cut">
              <SelectField
                size="sm"
                className="w-full"
                value={chosen ?? ""}
                onChange={(v) => set("cut", v)}
                options={choices.length ? choices : [{ value: "", label: "add a cut first" }]}
                aria-label="cut"
              />
            </Row>
            <Row label="Window from">
              <NumberField
                size="sm"
                width="100%"
                value={s.lo}
                onChange={(v) => set("lo", v)}
                placeholder="start"
              />
            </Row>
            <Row label="Window to">
              <NumberField
                size="sm"
                width="100%"
                value={s.hi}
                onChange={(v) => set("hi", v)}
                placeholder="end"
              />
            </Row>
            <Row label="Peaks" title="A number of peaks to find, or their starting positions">
              <input
                className="h-6 w-full rounded-md border border-line-2 bg-surface px-1 text-xs"
                value={s.count}
                onChange={(e) => set("count", e.target.value)}
                placeholder="2 or 0.021, 0.042"
                aria-label="peaks"
              />
            </Row>
            <Row label="Profile">
              <SelectField
                size="sm"
                className="w-full"
                value={s.shape}
                onChange={(v) => set("shape", v)}
                options={Object.entries(info.data?.peak_shapes ?? { pv: "pseudo-Voigt" }).map(
                  ([k, v]) => ({ value: k, label: v }),
                )}
                aria-label="profile"
              />
            </Row>
            <Row label="Background">
              <SelectField
                size="sm"
                className="w-full"
                value={s.background}
                onChange={(v) => set("background", v)}
                options={BACKGROUNDS}
                aria-label="background"
              />
            </Row>
          </Fields>
          <Toggle checked={s.shared} onChange={(v) => set("shared", v)}>
            one width for all peaks
          </Toggle>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => void run()}
              disabled={!roi || fitting}
            >
              {fitting ? "Fitting…" : "Fit"}
            </Button>
            <Button
              size="sm"
              disabled={!fit}
              onClick={() =>
                fit &&
                saveText(JSON.stringify(fit, null, 1), "gixsu_peak_fit.json", "application/json")
              }
              title="The fit as JSON: peaks with errors, model, settings"
            >
              Download
            </Button>
          </div>
          <Message text={error} error />
          <Summary text={fit?.summary ?? null} />
        </div>
      }
    />
  );
}
