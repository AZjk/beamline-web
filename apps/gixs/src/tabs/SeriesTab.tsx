// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/** The Series tool: a cut of the Cuts tool in every frame of the stack shown, its ROI total per
 * frame, and a peak followed from frame to frame; run as a job. */

import { unwrap } from "@beamline-web/client";
import {
  Button,
  NumberField,
  Placeholder,
  SelectField,
  Toggle,
  Toolbar,
  useLocalState,
} from "@beamline-web/ui";
import { Plot } from "@beamline-web/viz";
import { useMemo, useState } from "react";

import { api, type FrameSeries } from "../api/client";
import { contextOf } from "../api/context";
import { useInfo } from "../api/queries";
import { seriesFigure } from "../figures/series";
import { useAppStore } from "../store";
import {
  Fields,
  Message,
  ResultAndControls,
  Row,
  downloadPost,
  messageOf,
  parsePeaks,
  roiChoices,
  useJob,
} from "./common";

interface SeriesSettings {
  roi: string | null;
  frames: string;
  track: boolean;
  lo: number | null;
  hi: number | null;
  count: string;
  shape: string;
  log: boolean;
}

const DEFAULTS: SeriesSettings = {
  roi: null,
  frames: "all",
  track: false,
  lo: null,
  hi: null,
  count: "1",
  shape: "pv",
  log: true,
};

export function SeriesTab() {
  const [s, setS] = useLocalState<SeriesSettings>("gixs:series", DEFAULTS);
  const set = <K extends keyof SeriesSettings>(key: K, value: SeriesSettings[K]) =>
    setS((p) => ({ ...p, [key]: value }));
  const active = useAppStore((st) => st.active);
  const boxes = useAppStore((st) => st.boxes);
  const processing = useAppStore((st) => st.processing);
  const fileOverrides = useAppStore((st) => st.fileOverrides);
  const info = useInfo();
  const mapLabel = (name: string) =>
    info.data?.views
      .flatMap((v) => [
        [v.x_map, v.x_label],
        [v.y_map, v.y_label],
      ])
      .find(([m]) => m === name)?.[1]
      ?.split(" (")[0] ?? name;
  const choices = useMemo(() => roiChoices(boxes, mapLabel), [boxes]); // eslint-disable-line react-hooks/exhaustive-deps
  const chosen = choices.some((c) => c.value === s.roi) ? s.roi : (choices[0]?.value ?? null);
  const roi = boxes.find((r) => r.id === chosen) ?? null;
  const [result, setResult] = useState<FrameSeries | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { run, running } = useJob();
  const setMessage = useAppStore((st) => st.setMessage);

  const compute = async () => {
    if (!active || !roi) {
      setError("Show a stack and add a cut in the Cuts tab first.");
      return;
    }
    setError(null);
    try {
      const track = s.track
        ? { window: [s.lo, s.hi], peaks: parsePeaks(s.count), shape: s.shape }
        : null;
      const out = await run<FrameSeries>("Frame series", async () =>
        unwrap(
          await api.POST("/api/jobs/frame-series", {
            body: {
              file: active,
              roi,
              context: contextOf({ processing, fileOverrides }),
              frames: s.frames,
              track,
            },
          }),
        ),
      );
      if (out) setResult(out);
    } catch (e) {
      setError(messageOf(e));
    }
  };
  const figure = useMemo(() => (result ? seriesFigure(result, s.log) : null), [result, s.log]);

  return (
    <ResultAndControls
      id="series"
      result={
        <div className="flex h-full min-h-0 flex-col">
          <Toolbar className="shrink-0 border-b border-line">
            <Toggle checked={s.log} onChange={(v) => set("log", v)}>
              log I
            </Toggle>
          </Toolbar>
          <div className="relative min-h-0 flex-1">
            {figure ? (
              <Plot data={figure.data} layout={figure.layout} aria-label="series figure" />
            ) : (
              <Placeholder>Choose a cut of a stack and run.</Placeholder>
            )}
          </div>
        </div>
      }
      controls={
        <div className="space-y-2">
          <p className="text-muted">
            A cut in every frame of the stack shown: the cut against frame, the ROI total per frame
            and, optionally, a peak followed from frame to frame.
          </p>
          <Fields>
            <Row label="Cut">
              <SelectField
                size="sm"
                className="w-full"
                value={chosen ?? ""}
                onChange={(v) => set("roi", v)}
                options={choices.length ? choices : [{ value: "", label: "add a cut first" }]}
                aria-label="cut"
              />
            </Row>
            <Row label="Frames" title="all frames, or a range like 0:100 or 0:100:5">
              <input
                className="h-6 w-full rounded-md border border-line-2 bg-surface px-1 text-xs"
                value={s.frames}
                onChange={(e) => set("frames", e.target.value)}
                aria-label="frames"
              />
            </Row>
          </Fields>
          <Toggle checked={s.track} onChange={(v) => set("track", v)}>
            follow a peak
          </Toggle>
          {s.track ? (
            <Fields>
              <Row label="Window from">
                <NumberField size="sm" width="100%" value={s.lo} onChange={(v) => set("lo", v)} />
              </Row>
              <Row label="Window to">
                <NumberField size="sm" width="100%" value={s.hi} onChange={(v) => set("hi", v)} />
              </Row>
              <Row label="Peaks">
                <input
                  className="h-6 w-full rounded-md border border-line-2 bg-surface px-1 text-xs"
                  value={s.count}
                  onChange={(e) => set("count", e.target.value)}
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
            </Fields>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => void compute()}
              disabled={running || !roi || !active}
            >
              {running ? "Running…" : "Run"}
            </Button>
            <Button
              size="sm"
              disabled={!result}
              onClick={() =>
                result &&
                downloadPost("/api/exports/series-table", { result }, "gixsu_series.txt").catch(
                  (e) => setMessage(messageOf(e)),
                )
              }
              title="ROI totals and peak parameters per frame (text)"
            >
              Download
            </Button>
          </div>
          <Message text={error} error />
        </div>
      }
    />
  );
}
