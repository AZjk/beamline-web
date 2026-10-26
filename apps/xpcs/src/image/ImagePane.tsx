// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/**
 * The image column's top: the detector map of the file shown (intensity, q-bins, static bins,
 * mask) with its color settings, the beam center, the q-bins as an overlay with the two-time
 * bin shown highlighted, and a readout of the pixel under the cursor; a click picks the
 * two-time bin. Color map, scale, levels, zoom and pan never ask the server.
 */

import { ApiError, unwrap } from "@beamline-web/client";
import {
  Busy,
  Field,
  Placeholder,
  Segmented,
  SelectField,
  Toggle,
  Toolbar,
  fmt,
  useLocalState,
} from "@beamline-web/ui";
import { DetectorImage, finiteRange, sampledIndex, valueAt } from "@beamline-web/viz";
import { DomainWidget, type CustomDomain, type Domain, ScaleType } from "@h5web/lib";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api, type ImageKind, type ImageScale, type Pixel } from "../api/client";
import { useImageArray, useInfo, useSummary, useTwotimeBins } from "../api/queries";
import { isTwotime, useAppStore } from "../store";

interface ImageSettings {
  kind: ImageKind;
  scale: ImageScale;
  cmap: string;
  center: boolean;
  bins: boolean;
  size: "512" | "1024" | "0";
  autoLevels: boolean;
}

const DEFAULTS: ImageSettings = {
  kind: "saxs",
  scale: "log",
  cmap: "viridis",
  center: true,
  bins: false,
  size: "1024",
  autoLevels: true,
};
const HINT =
  "Hover over the image for q and φ. Scroll to zoom, drag to pan, double-click to reset; click a q-bin to show its two-time correlation.";

function ReadoutLine({
  pixel,
  value,
  hint,
}: {
  pixel: Pixel | null;
  value: number | null;
  hint: string;
}) {
  if (!pixel) return <span className="text-muted">{hint}</span>;
  if (!pixel.on_detector) return <span className="text-muted">Outside the detector.</span>;
  const sep = <span className="px-1 text-line-2">·</span>;
  return (
    <span className="tabular-nums">
      <b>
        x {pixel.x}, y {pixel.y}
      </b>
      {sep}I {fmt(pixel.intensity)}
      {value !== null ? <span className="text-muted"> (sent {fmt(value)})</span> : null}
      {sep}q {fmt(pixel.q, 5)} Å⁻¹{sep}φ {fmt(pixel.phi, 4)}°{sep}qx {fmt(pixel.qx, 4)}, qy{" "}
      {fmt(pixel.qy, 4)}
      {pixel.masked ? (
        <>
          {sep}
          <span className="text-muted">masked</span>
        </>
      ) : null}
      {pixel.dq_bin ? (
        <>
          {sep}bin {pixel.dq_bin} ({pixel.dq_label})
        </>
      ) : null}
      {pixel.sq_bin ? (
        <>
          {sep}static bin {pixel.sq_bin}
        </>
      ) : null}
    </span>
  );
}

export function ImagePane() {
  const [settings, setSettings] = useLocalState<ImageSettings>("xpcs:image", DEFAULTS);
  const set = <K extends keyof ImageSettings>(key: K, value: ImageSettings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));
  const active = useAppStore((s) => s.active);
  const files = useAppStore((s) => s.files);
  const tab = useAppStore((s) => s.tab);
  const setTab = useAppStore((s) => s.setTab);
  const twotimeSelection = useAppStore((s) => s.twotimeSelection);
  const setTwotimeSelection = useAppStore((s) => s.setTwotimeSelection);
  const info = useInfo();
  const colormaps = info.data?.colormaps ?? ["viridis"];
  const maxSize = Number(settings.size);
  const twotimeFile = active !== null && isTwotime({ files }, active);

  // the two-time tab wants the bins shown, as the old page did
  useEffect(() => {
    if (tab === "twotime" && !settings.bins) set("bins", true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const image = useImageArray(active, {
    kind: settings.kind,
    scale: settings.kind === "saxs" ? settings.scale : "linear",
    max_size: maxSize,
  });
  const overlay = useImageArray(
    active,
    { kind: "dqmap", scale: "linear", max_size: maxSize },
    settings.bins && settings.kind === "saxs",
  );
  const bins = useTwotimeBins(active, twotimeFile);
  const summary = useSummary(active);
  const beamCenter = summary.data?.geometry.beam_center ?? null;
  const selectedQbin = twotimeFile ? (bins.data?.bins[twotimeSelection]?.qbin ?? null) : null;

  // levels: the server's first guess per image, then the user's
  const [custom, setCustom] = useState<CustomDomain>([null, null]);
  const meta = image.data?.meta;
  useEffect(() => setCustom([null, null]), [active, settings.kind, settings.scale]);
  const dataDomain = useMemo<Domain>(
    () => (image.data ? (finiteRange(image.data.data) ?? [0, 1]) : [0, 1]),
    [image.data],
  );
  const serverDomain = useMemo<Domain | undefined>(
    () => (meta && meta.zmax > meta.zmin ? [meta.zmin, meta.zmax] : undefined),
    [meta],
  );
  const domain = useMemo<Domain | undefined>(() => {
    const base = serverDomain ?? dataDomain;
    if (settings.autoLevels) return base;
    return [custom[0] ?? base[0], custom[1] ?? base[1]];
  }, [serverDomain, dataDomain, settings.autoLevels, custom]);

  // the readout: the sent value from the array at once, q and φ from the server, a little later
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [pixel, setPixel] = useState<Pixel | null>(null);
  const pending = useRef(0);
  const onHover = useCallback(
    (x: number, y: number) => setHover({ x: Math.round(x), y: Math.round(y) }),
    [],
  );
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
            params: { path: { name: active }, query: { x: hover.x, y: hover.y } },
          }),
        );
        if (request === pending.current) setPixel(answer);
      } catch {
        /* the next hover asks again */
      }
    }, 40);
    return () => window.clearTimeout(timer);
  }, [hover, active]);
  const sentValue = useMemo(() => {
    if (!hover || !image.data || !meta) return null;
    const sampling = {
      factor: meta.factor,
      x0: meta.x0,
      y0: meta.y0,
      rows: image.data.shape[0]!,
      cols: image.data.shape[1]!,
    };
    const index = sampledIndex(sampling, hover.x, hover.y);
    return index ? valueAt(image.data.data, sampling.cols, index[0], index[1]) : null;
  }, [hover, image.data, meta]);

  const onClick = useCallback(
    async (x: number, y: number) => {
      if (!active || !twotimeFile) return;
      try {
        const hit = unwrap(
          await api.GET("/api/files/{name}/twotime/bin_at", {
            params: { path: { name: active }, query: { x: Math.round(x), y: Math.round(y) } },
          }),
        );
        if (hit.selection !== null && hit.selection !== undefined) {
          setTwotimeSelection(hit.selection);
          if (tab !== "twotime") setTab("twotime");
        }
      } catch {
        /* not a two-time file */
      }
    },
    [active, twotimeFile, setTwotimeSelection, setTab, tab],
  );

  const error = image.error
    ? image.error instanceof ApiError
      ? image.error.message
      : String(image.error)
    : null;

  return (
    <section
      className="flex h-full min-h-0 flex-col rounded-md border border-line bg-surface"
      aria-label="detector image"
    >
      <Toolbar className="shrink-0 border-b border-line">
        <Segmented
          size="sm"
          aria-label="what the image shows"
          value={settings.kind}
          onChange={(kind) => set("kind", kind)}
          options={[
            { value: "saxs", label: "Intensity" },
            { value: "dqmap", label: "q-bins" },
            { value: "sqmap", label: "static bins" },
            { value: "mask", label: "Mask" },
          ]}
        />
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
            options={colormaps.map((name) => ({ value: name, label: name }))}
            aria-label="color map"
          />
        </Field>
        <Toggle
          checked={settings.center}
          onChange={(v) => set("center", v)}
          title="The beam center"
        >
          beam center
        </Toggle>
        <Toggle
          checked={settings.bins}
          onChange={(v) => set("bins", v)}
          title="The dynamic q-bins over the intensity; the two-time bin shown in white"
        >
          q-bins
        </Toggle>
        <Field label="detail" title="Pixels sent to the browser (longest side)">
          <SelectField
            size="sm"
            value={settings.size}
            onChange={(size) => set("size", size)}
            options={[
              { value: "512", label: "512" },
              { value: "1024", label: "1024" },
              { value: "0", label: "full" },
            ]}
            aria-label="detail"
          />
        </Field>
        <Toggle
          checked={settings.autoLevels}
          onChange={(v) => set("autoLevels", v)}
          title="Levels from the 1st to the 99.9th percentile"
        >
          auto levels
        </Toggle>
      </Toolbar>
      <div className="relative min-h-0 flex-1">
        <Busy active={image.isFetching} />
        {!active ? (
          <Placeholder>Click a file to show its detector image.</Placeholder>
        ) : error ? (
          <Placeholder error>{error}</Placeholder>
        ) : image.data && meta ? (
          <div className="flex h-full min-h-0">
            <DetectorImage
              data={image.data.data as Float32Array | Uint8Array}
              sampling={{
                factor: meta.factor,
                x0: meta.x0,
                y0: meta.y0,
                rows: image.data.shape[0]!,
                cols: image.data.shape[1]!,
              }}
              fullShape={meta.shape_full}
              colormap={settings.kind === "mask" ? "gray" : settings.cmap}
              scale="linear"
              domain={domain}
              beamCenter={settings.center ? beamCenter : null}
              overlay={
                settings.bins && settings.kind === "saxs" && overlay.data && overlay.data.meta
                  ? {
                      data: overlay.data.data as Float32Array,
                      sampling: {
                        factor: overlay.data.meta.factor,
                        x0: overlay.data.meta.x0,
                        y0: overlay.data.meta.y0,
                        rows: overlay.data.shape[0]!,
                        cols: overlay.data.shape[1]!,
                      },
                      highlighted: selectedQbin,
                    }
                  : null
              }
              colorBarLabel={
                meta.kind === "saxs"
                  ? meta.scale === "log"
                    ? "log₁₀ I"
                    : "I"
                  : meta.kind === "mask"
                    ? "mask"
                    : "bin"
              }
              onHover={onHover}
              onLeave={onLeave}
              onClick={onClick}
            />
            {!settings.autoLevels ? (
              <div className="w-56 shrink-0 overflow-auto border-l border-line p-2 text-xs">
                <DomainWidget
                  dataDomain={dataDomain}
                  customDomain={custom}
                  scaleType={ScaleType.Linear}
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
        <ReadoutLine pixel={pixel} value={sentValue} hint={HINT} />
      </div>
    </section>
  );
}
