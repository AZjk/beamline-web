// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/**
 * The image column: the file shown in one of three views (detector pixels, q_r–q_z, χ–q) at a
 * correction level and frame, with color map, log or linear scale and percentile levels applied
 * on the GPU; the beam center, the specular reflection, the horizon and the normal drawn over
 * it; the tools' overlays; the Cuts tool's boxes, drawn and edited in place; and a readout of
 * q and the angles under the cursor.
 */

import { ApiError, unwrap } from "@beamline-web/client";
import {
  Busy,
  Field,
  NumberField,
  Placeholder,
  Segmented,
  SelectField,
  Toggle,
  Toolbar,
  fmt,
  useLocalState,
} from "@beamline-web/ui";
import {
  ArrayImage,
  COLORMAPS,
  DataOverlays,
  ShapeEditor,
  editorInteractions,
  h5webColorMap,
  levelsAt,
  sortedFinite,
  type OverlayItem,
  type RectShape,
  type Shape,
} from "@beamline-web/viz";
import { DomainWidget, ScaleType, type CustomDomain, type Domain } from "@h5web/lib";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api, type Axis, type PixelInfo } from "../api/client";
import { contextOf, queryOf } from "../api/context";
import { useImageArray, useInfo, useOverlayTraces, useSummary } from "../api/queries";
import { flatOverlays, useAppStore } from "../store";
import { roiWithShape, sameRect, shapesOf, type Extent } from "./roiShapes";
import { ColumnSums, RowSums } from "./SumsPanels";

interface ImageSettings {
  view: string;
  scale: "log" | "linear";
  cmap: string;
  low: number;
  high: number;
  autoLevels: boolean;
  alignment: boolean;
  sums: boolean;
}

const DEFAULTS: ImageSettings = {
  view: "detector",
  scale: "log",
  cmap: "viridis",
  low: 1,
  high: 99.8,
  autoLevels: true,
  alignment: true,
  sums: false,
};
const HINT =
  "Hover over the image for q and the angles. Scroll to zoom, drag to pan, double-click to reset; with the box tool, drag to add a cut.";

function extentOf(x: Axis, y: Axis): Extent {
  const half = (a: Axis) => (a.n > 1 ? Math.abs(a.step) / 2 : 0.5);
  return {
    xmin: x.start - half(x),
    xmax: x.start + (x.n - 1) * x.step + half(x),
    ymin: y.start - half(y),
    ymax: y.start + (y.n - 1) * y.step + half(y),
  };
}

function indexOf(a: Axis, value: number): number | null {
  if (a.n < 1) return null;
  const i = a.n === 1 ? 0 : Math.round((value - a.start) / a.step);
  return i >= 0 && i < a.n ? i : null;
}

function Readout({
  pixel,
  value,
  hint,
}: {
  pixel: PixelInfo | null;
  value: number | null;
  hint: string;
}) {
  if (!pixel) return <span className="text-muted">{hint}</span>;
  if (!pixel.on_detector)
    return (
      <span className="text-muted">
        Not seen by the detector (missing wedge, below the horizon or off the detector).
      </span>
    );
  const sep = <span className="px-1 text-line-2">·</span>;
  return (
    <span className="tabular-nums">
      <b>
        row {fmt(pixel.row, 1)}, col {fmt(pixel.col, 1)}
      </b>
      {sep}q {fmt(pixel.q ?? null, 5)} Å⁻¹{sep}q_r {fmt(pixel.qr ?? null, 5)}
      {sep}q_z {fmt(pixel.qz ?? null, 5)}
      {sep}α_f {fmt(pixel.alpha_f ?? null, 4)}°{sep}2θ_f {fmt(pixel.two_theta_f ?? null, 4)}°{sep}χ{" "}
      {fmt(pixel.chi ?? null, 2)}°
      {value !== null ? (
        <>
          {sep}I {fmt(value, 4)}
        </>
      ) : null}
    </span>
  );
}

export function ImagePane() {
  const [settings, setSettings] = useLocalState<ImageSettings>("gixs:image", DEFAULTS);
  const set = <K extends keyof ImageSettings>(key: K, value: ImageSettings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));
  const [tool, setTool] = useState<"pan" | "box">("pan");
  const active = useAppStore((s) => s.active);
  const processing = useAppStore((s) => s.processing);
  const setProcessing = useAppStore((s) => s.setProcessing);
  const fileOverrides = useAppStore((s) => s.fileOverrides);
  const boxes = useAppStore((s) => s.boxes);
  const setBoxes = useAppStore((s) => s.setBoxes);
  const selectedBox = useAppStore((s) => s.selectedBox);
  const setSelectedBox = useAppStore((s) => s.setSelectedBox);
  const toolOverlays = useAppStore((s) => s.toolOverlays);
  const setMessage = useAppStore((s) => s.setMessage);
  const info = useInfo();
  const views = info.data?.views ?? [];
  const view = views.find((v) => v.name === settings.view) ?? views[0] ?? null;
  const levels = info.data?.levels ?? ["raw", "I1", "I2", "I3", "I4"];
  const query = useMemo(
    () => queryOf({ processing, fileOverrides }, active),
    [processing, fileOverrides, active],
  );
  const context = useMemo(
    () => contextOf({ processing, fileOverrides }),
    [processing, fileOverrides],
  );

  const image = useImageArray(active, settings.view, query);
  const summary = useSummary(active, query);
  const frames = summary.data?.frames ?? 1;
  useEffect(() => {
    // the frames box goes up to the last frame of the file shown
    if (processing.frame > frames - 1) setProcessing({ frame: frames - 1 });
  }, [frames, processing.frame, setProcessing]);

  const meta = image.data?.meta;
  const data = image.data?.data;
  const extent = useMemo(() => (meta ? extentOf(meta.x, meta.y) : null), [meta]);
  const sorted = useMemo(() => (data ? sortedFinite(data) : null), [data]);
  const logScale = settings.scale === "log";
  const [custom, setCustom] = useState<CustomDomain>([null, null]);
  useEffect(() => setCustom([null, null]), [active, settings.view, settings.scale]);
  const dataDomain = useMemo<Domain>(() => {
    if (!sorted || !sorted.length) return [0, 1];
    const all = levelsAt(sorted, 0, 100, logScale);
    return all ?? [0, 1];
  }, [sorted, logScale]);
  const domain = useMemo<Domain | undefined>(() => {
    if (!sorted) return undefined;
    if (settings.autoLevels)
      return levelsAt(sorted, settings.low, settings.high, logScale) ?? undefined;
    const base = levelsAt(sorted, 0, 100, logScale) ?? [0, 1];
    return [custom[0] ?? base[0], custom[1] ?? base[1]];
  }, [sorted, settings.autoLevels, settings.low, settings.high, logScale, custom]);

  // the alignment marks and the tools' overlays, in this view's coordinates
  const traces = useOverlayTraces(active, settings.view, flatOverlays(toolOverlays), context);
  const overlayItems = useMemo<OverlayItem[]>(() => {
    const items: OverlayItem[] = [];
    if (settings.alignment && meta) {
      const symbols = ["circle-open", "diamond-open", "square-open"];
      meta.markers.forEach((m, i) =>
        items.push({
          name: m.name,
          x: [m.x],
          y: [m.y],
          symbol: symbols[i] ?? "circle-open",
          size: 14,
          color: "#ffffff",
        }),
      );
      for (const line of meta.lines)
        items.push({
          name: line.name,
          x: line.x,
          y: line.y,
          mode: "lines",
          dash: line.dash,
          color: "#ffffff",
        });
    }
    for (const t of traces.data ?? [])
      items.push({
        name: t.name,
        x: t.x,
        y: t.y,
        mode: t.mode,
        symbol: t.symbol,
        color: t.color,
        size: t.size,
        dash: t.dash,
        text: t.text ?? null,
      });
    return items;
  }, [settings.alignment, meta, traces.data]);

  // the Cuts tool's boxes of this view, as shapes
  const shaped = useMemo(
    () =>
      view && extent ? shapesOf(boxes, view, extent) : { shapes: [] as RectShape[], styles: {} },
    [boxes, view, extent],
  );
  const onShapes = useCallback(
    (next: Shape[]) => {
      if (!extent) return;
      const byId = new Map(shaped.shapes.map((s) => [s.id, s]));
      const changed = new Map<string, RectShape>();
      for (const s of next) {
        const before = byId.get(s.id);
        if (s.kind === "rect" && before && !sameRect(before, s)) changed.set(s.id, s);
      }
      const gone = new Set(byId.keys());
      for (const s of next) gone.delete(s.id);
      if (!changed.size && !gone.size) return;
      setBoxes(
        useAppStore
          .getState()
          .boxes.filter((roi) => !gone.has(roi.id))
          .map((roi) =>
            changed.has(roi.id) ? roiWithShape(roi, changed.get(roi.id)!, extent) : roi,
          ),
      );
    },
    [extent, shaped.shapes, setBoxes],
  );
  const onDrawn = useCallback(
    async (shape: Shape) => {
      if (shape.kind !== "rect" || !view || !extent) return;
      try {
        const roi = unwrap(
          await api.POST("/api/rois/from-box", {
            body: {
              view: view.name,
              x0: shape.x0,
              x1: shape.x1,
              y0: shape.y0,
              y1: shape.y1,
              x_span: extent.xmax - extent.xmin,
              y_span: extent.ymax - extent.ymin,
              existing: useAppStore.getState().boxes,
            },
          }),
        );
        setBoxes([...useAppStore.getState().boxes, roi]);
        setSelectedBox(roi.id);
        setMessage(`Added the cut ${roi.name}.`);
      } catch (e) {
        setMessage(e instanceof ApiError ? e.message : String(e));
      } finally {
        setTool("pan");
      }
    },
    [view, extent, setBoxes, setSelectedBox, setMessage],
  );
  // the editor's shape list is derived: a shape it added is replaced by the ROI the server made
  const editorShapes = useMemo(() => shaped.shapes as Shape[], [shaped.shapes]);

  // the readout: q and the angles from the server, the value from the array at once
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [pixel, setPixel] = useState<PixelInfo | null>(null);
  const pending = useRef(0);
  const onHover = useCallback((x: number, y: number) => setHover({ x, y }), []);
  const onLeave = useCallback(() => setHover(null), []);
  useEffect(() => {
    if (!hover || !active) {
      setPixel(null);
      return;
    }
    const request = ++pending.current;
    const timer = window.setTimeout(async () => {
      try {
        const answer = unwrap(
          await api.GET("/api/files/{name}/pixel", {
            params: {
              path: { name: active },
              query: { x: hover.x, y: hover.y, view: settings.view, ...query },
            },
          }),
        );
        if (request === pending.current) setPixel(answer);
      } catch {
        /* the next hover asks again */
      }
    }, 40);
    return () => window.clearTimeout(timer);
  }, [hover, active, settings.view, query]);
  const value = useMemo(() => {
    if (!hover || !data || !meta) return null;
    const col = indexOf(meta.x, hover.x);
    const row = indexOf(meta.y, hover.y);
    if (col === null || row === null) return null;
    const v = data[row * meta.x.n + col];
    return v === undefined || !Number.isFinite(v) ? null : v;
  }, [hover, data, meta]);

  const error = image.error
    ? image.error instanceof ApiError
      ? image.error.message
      : String(image.error)
    : null;
  const { colorMap, invert } = h5webColorMap(settings.cmap);

  return (
    <section
      className="flex h-full min-h-0 flex-col rounded-md border border-line bg-surface"
      aria-label="detector image"
    >
      <Toolbar className="shrink-0 flex-wrap border-b border-line">
        <Segmented
          size="sm"
          aria-label="view"
          value={settings.view}
          onChange={(v) => set("view", v)}
          options={views.map((v) => ({ value: v.name, label: v.label }))}
        />
        <Field label="level" title={info.data?.level_tooltip}>
          <SelectField
            size="sm"
            value={processing.level}
            onChange={(level) => setProcessing({ level })}
            options={levels.map((lv) => ({
              value: lv,
              label: lv,
              title: `${lv}: ${info.data?.level_help[lv] ?? ""}`,
            }))}
            aria-label="correction level"
          />
        </Field>
        <Field label="frames" title="-1: the mean of all frames; 0, 1, …: one frame">
          <NumberField
            size="sm"
            width="3.5rem"
            value={processing.frame}
            min={-1}
            max={Math.max(frames - 1, 0)}
            step={1}
            onChange={(v) => setProcessing({ frame: v === null ? -1 : v })}
            aria-label="frames"
          />
        </Field>
        <Segmented
          size="sm"
          aria-label="intensity scale"
          value={settings.scale}
          onChange={(scale) => set("scale", scale)}
          options={[
            { value: "log", label: "log" },
            { value: "linear", label: "linear" },
          ]}
        />
        <Field label="colors">
          <SelectField
            size="sm"
            value={settings.cmap}
            onChange={(cmap) => set("cmap", cmap)}
            options={COLORMAPS.map((name) => ({ value: name, label: name }))}
            aria-label="color map"
          />
        </Field>
        <Field label="contrast" title="Levels at these percentiles of the shown values">
          <NumberField
            size="sm"
            width="3.5rem"
            value={settings.low}
            min={0}
            max={100}
            onChange={(v) => set("low", v ?? 1)}
            aria-label="low percentile"
            disabled={!settings.autoLevels}
          />
          <NumberField
            size="sm"
            width="3.5rem"
            value={settings.high}
            min={0}
            max={100}
            onChange={(v) => set("high", v ?? 99.8)}
            aria-label="high percentile"
            disabled={!settings.autoLevels}
          />
        </Field>
        <Toggle
          checked={settings.autoLevels}
          onChange={(v) => set("autoLevels", v)}
          title="Levels from the percentiles; untick to set them by hand"
        >
          auto levels
        </Toggle>
        <Toggle
          checked={settings.sums}
          onChange={(v) => set("sums", v)}
          title="The sum of each column below the image and of each row at its left"
        >
          sums
        </Toggle>
        <Toggle
          checked={settings.alignment}
          onChange={(v) => set("alignment", v)}
          title="The direct beam, the specular reflection (αf = αi), the sample horizon (αf = 0) and the sample normal (2θf = 0)"
        >
          show alignment
        </Toggle>
        <Segmented
          size="sm"
          aria-label="pointer tool"
          value={tool}
          onChange={setTool}
          options={[
            { value: "pan", label: "pan", title: "Drag to pan, scroll to zoom" },
            {
              value: "box",
              label: "draw a cut",
              title:
                "Drag a box: a tall box gives a vertical profile, a wide one a horizontal profile",
            },
          ]}
        />
      </Toolbar>
      <div className="relative min-h-0 flex-1">
        <Busy active={image.isFetching} />
        {!active ? (
          <Placeholder>Click a file to show its image.</Placeholder>
        ) : error ? (
          <Placeholder error>{error}</Placeholder>
        ) : data && meta && extent && view ? (
          <div className="flex h-full min-h-0">
            <div
              className="grid min-h-0 min-w-0 flex-1"
              style={{
                gridTemplateColumns: settings.sums ? "7rem minmax(0, 1fr)" : "minmax(0, 1fr)",
                gridTemplateRows: settings.sums ? "minmax(0, 1fr) 6rem" : "minmax(0, 1fr)",
              }}
            >
              {settings.sums ? (
                <RowSums
                  data={data}
                  x={meta.x}
                  y={meta.y}
                  binning={meta.binning}
                  log={logScale}
                  flipX={meta.x_reversed}
                  flipY={meta.y_reversed}
                />
              ) : null}
              <ArrayImage
                data={data}
                rows={meta.y.n}
                cols={meta.x.n}
                extent={extent}
                xLabel={meta.x_label}
                yLabel={meta.y_label}
                domain={domain}
                scale={logScale ? "log" : "linear"}
                colorMap={colorMap}
                invertColorMap={invert}
                aspect={view.equal_aspect ? "equal" : "auto"}
                colorBarLabel={logScale ? "I (log)" : "I"}
                flipX={meta.x_reversed}
                flipY={meta.y_reversed}
                interactions={editorInteractions(tool === "box" ? "rect" : "select", selectedBox)}
                onHover={onHover}
                onLeave={onLeave}
              >
                <DataOverlays items={overlayItems} />
                <ShapeEditor
                  tool={tool === "box" ? "rect" : "select"}
                  shapes={editorShapes}
                  onChange={onShapes}
                  selectedId={selectedBox}
                  onSelect={setSelectedBox}
                  onDrawn={(shape) => void onDrawn(shape)}
                  styles={shaped.styles}
                />
              </ArrayImage>
              {settings.sums ? (
                <div style={{ gridColumn: 2 }} className="min-h-0">
                  <ColumnSums
                    data={data}
                    x={meta.x}
                    y={meta.y}
                    binning={meta.binning}
                    log={logScale}
                    flipX={meta.x_reversed}
                    flipY={meta.y_reversed}
                  />
                </div>
              ) : null}
            </div>
            {!settings.autoLevels ? (
              <div className="w-56 shrink-0 overflow-auto border-l border-line p-2 text-xs">
                <DomainWidget
                  dataDomain={dataDomain}
                  customDomain={custom}
                  scaleType={logScale ? ScaleType.Log : ScaleType.Linear}
                  onCustomDomainChange={setCustom}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div
        className="shrink-0 truncate border-t border-line px-2 py-1 text-xs"
        aria-label="readout"
      >
        <Readout pixel={pixel} value={value} hint={HINT} />
      </div>
    </section>
  );
}
