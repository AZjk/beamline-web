// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/** The I(t) panel under the image: the intensity per frame of the checked files (averaged down
 * to at most 16k points by the server) and its Fourier spectrum. */

import { unpackFlat, unwrap } from "@beamline-web/client";
import { Busy, Placeholder, Segmented, useLocalState, type PluginProps } from "@beamline-web/ui";
import { Plot, axis, baseLayout, heightFor, seriesColor, type PlotData } from "@beamline-web/viz";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { api, type Intt } from "../api/client";
import { analysisFiles, useAppStore } from "../store";

const EMPTY = "Click a file, or check several, to show it here.";

export function InttPanel({ visible }: PluginProps) {
  const [xunit, setXunit] = useLocalState<"time" | "frame">("xpcs:intt:xunit", "time");
  const active = useAppStore((st) => st.active);
  const selection = useAppStore((st) => st.selection);
  const names = useMemo(() => analysisFiles({ active, selection }), [active, selection]);
  const query = useQuery<Intt, Error>({
    queryKey: ["intt", names],
    queryFn: async () =>
      unwrap(await api.POST("/api/intt", { body: { names, max_points: 16000 } })),
    enabled: visible && names.length > 0,
  });
  const box = useRef<HTMLDivElement>(null);
  const [boxHeight, setBoxHeight] = useState(200);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setBoxHeight(el.clientHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fig = useMemo(() => {
    const last = query.data;
    if (!last || !last.files.length) return null;
    const seconds = xunit === "time";
    const data: Partial<PlotData>[] = [];
    last.files.forEach((f, m) => {
      const color = seriesColor(m);
      const frames = unpackFlat(f.x) as Float32Array;
      const x = seconds ? Array.from(frames, (v) => v * f.frame_time) : Array.from(frames);
      data.push({
        type: "scatter",
        mode: "lines",
        x,
        y: Array.from(unpackFlat(f.y) as Float32Array),
        name: f.label,
        legendgroup: `f${m}`,
        line: { color, width: 1 },
        hovertemplate: `${f.label}<br>${seconds ? "t %{x:.4g} s" : "frame %{x:.0f}"}<br>I %{y:.4g}<extra></extra>`,
      });
      data.push({
        type: "scatter",
        mode: "lines",
        x: Array.from(unpackFlat(f.fft_x) as Float32Array),
        y: Array.from(unpackFlat(f.fft_y) as Float32Array),
        name: f.label,
        legendgroup: `f${m}`,
        showlegend: false,
        line: { color, width: 1 },
        xaxis: "x2",
        yaxis: "y2",
        hovertemplate: `${f.label}<br>%{x:.4g} Hz<br>%{y:.4g}<extra></extra>`,
      });
    });
    const layout = baseLayout({
      margin: { l: 50, r: 10, t: 10, b: 34 },
      showlegend: false,
      xaxis: axis({ title: seconds ? "t (s)" : "frame", domain: [0, 1], anchor: "y" }),
      yaxis: axis({ title: "I (cts / pixel)", domain: [0.54, 1], anchor: "x" }),
      xaxis2: axis({ title: "frequency (Hz)", domain: [0, 1], anchor: "y2" }),
      yaxis2: axis({ title: "|FFT|", domain: [0, 0.38], anchor: "x2" }),
    });
    const averaged = last.files.filter((f) => f.points < f.frames);
    const note = averaged.length
      ? `${averaged[0]!.frames.toLocaleString()} frames averaged to ${averaged[0]!.points.toLocaleString()} points`
      : "";
    return {
      data,
      layout,
      height: heightFor(boxHeight),
      note: [...last.skipped.map((x) => x.reason), note].filter(Boolean).join(" · "),
    };
  }, [query.data, xunit, boxHeight]);

  return (
    <section
      className="flex h-full min-h-0 flex-col rounded-md border border-line bg-surface"
      aria-label="I(t) panel"
    >
      <div className="flex shrink-0 items-center gap-3 border-b border-line px-2 py-1 text-xs">
        <span className="font-semibold text-ink-2">I(t)</span>
        <Segmented
          size="sm"
          value={xunit}
          onChange={setXunit}
          options={[
            { value: "time", label: "time" },
            { value: "frame", label: "frame" },
          ]}
        />
        {fig?.note ? <span className="truncate text-2xs text-muted">{fig.note}</span> : null}
      </div>
      <div ref={box} className="relative min-h-0 flex-1">
        <Busy active={query.isFetching} />
        {!names.length ? (
          <Placeholder>{EMPTY}</Placeholder>
        ) : query.error ? (
          <Placeholder error>{query.error.message}</Placeholder>
        ) : fig ? (
          <Plot data={fig.data} layout={fig.layout} height={fig.height} aria-label="I(t) figure" />
        ) : query.data ? (
          <Placeholder>{query.data.skipped[0]?.reason ?? EMPTY}</Placeholder>
        ) : null}
      </div>
    </section>
  );
}
