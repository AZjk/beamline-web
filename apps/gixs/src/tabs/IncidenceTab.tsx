// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/** The αi tool: an incidence-angle series (the file shown and the checked files at several αi,
 * or one αi-scan stack): a cut at every angle, its intensity against αi and the penetration depth. */

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

import { api, type Incidence } from "../api/client";
import { contextOf } from "../api/context";
import { useInfo } from "../api/queries";
import { incidenceFigure } from "../figures/series";
import { selectedFiles, useAppStore } from "../store";
import { Fields, Message, ResultAndControls, Row, Summary, roiChoices, useJob } from "./common";

interface IncidenceSettings {
  roi: string | null;
  lo: number | null;
  hi: number | null;
  alphaF: number | null;
  layer: "film" | "substrate";
  log: boolean;
}

const DEFAULTS: IncidenceSettings = {
  roi: null,
  lo: null,
  hi: null,
  alphaF: null,
  layer: "film",
  log: true,
};

export function IncidenceTab() {
  const [s, setS] = useLocalState<IncidenceSettings>("gixs:incidence", DEFAULTS);
  const set = <K extends keyof IncidenceSettings>(key: K, value: IncidenceSettings[K]) =>
    setS((p) => ({ ...p, [key]: value }));
  const active = useAppStore((st) => st.active);
  const selection = useAppStore((st) => st.selection);
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
  const files = useMemo(() => selectedFiles({ active, selection }), [active, selection]);
  const [result, setResult] = useState<Incidence | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { run, running } = useJob();

  const compute = async () => {
    if (!files.length || !roi) {
      setError("Show a file and add a cut in the Cuts tab first.");
      return;
    }
    setError(null);
    const out = await run<Incidence>("Incidence-angle series", async () =>
      unwrap(
        await api.POST("/api/jobs/incidence", {
          body: {
            files,
            roi,
            context: contextOf({ processing, fileOverrides }),
            x_range: [s.lo, s.hi],
            alpha_f_deg: s.alphaF,
            layer: s.layer,
          },
        }),
      ),
    );
    if (out) setResult(out);
  };
  const figure = useMemo(() => (result ? incidenceFigure(result, s.log) : null), [result, s.log]);
  const peak = result?.peak_alpha_i;

  return (
    <ResultAndControls
      id="incidence"
      result={
        <div className="flex h-full min-h-0 flex-col">
          <Toolbar className="shrink-0 border-b border-line">
            <Toggle checked={s.log} onChange={(v) => set("log", v)}>
              log I
            </Toggle>
          </Toolbar>
          <div className="relative min-h-0 flex-1">
            {figure ? (
              <Plot data={figure.data} layout={figure.layout} aria-label="incidence figure" />
            ) : (
              <Placeholder>
                Check files at several αi (or show an αi-scan stack), choose a cut and compute.
              </Placeholder>
            )}
          </div>
        </div>
      }
      controls={
        <div className="space-y-2">
          <p className="text-muted">
            A cut of the Cuts tab at every incidence angle, on the same bins; the intensity over a
            range of the cut against αi (at level I2 it peaks near the critical angle) and the
            penetration depth of the film or substrate optics set in Setup.
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
            <Row
              label="Range from"
              title="Part of the cut summed against αi (e.g. a peak); blank: all"
            >
              <NumberField size="sm" width="100%" value={s.lo} onChange={(v) => set("lo", v)} />
            </Row>
            <Row label="Range to">
              <NumberField size="sm" width="100%" value={s.hi} onChange={(v) => set("hi", v)} />
            </Row>
            <Row
              label="Exit angle α_f"
              unit="deg"
              title="Include the exit path in the depth (optional)"
            >
              <NumberField
                size="sm"
                width="100%"
                value={s.alphaF}
                onChange={(v) => set("alphaF", v)}
                placeholder="none"
              />
            </Row>
            <Row label="Optics of">
              <SelectField
                size="sm"
                className="w-full"
                value={s.layer}
                onChange={(v) => set("layer", v)}
                options={[
                  { value: "film", label: "film" },
                  { value: "substrate", label: "substrate" },
                ]}
                aria-label="optics of"
              />
            </Row>
          </Fields>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void compute()}
            disabled={running || !roi || !files.length}
          >
            {running ? "Computing…" : "Compute"}
          </Button>
          <Message text={error} error />
          <Message
            text={
              peak !== null && peak !== undefined
                ? `Intensity maximum at αi = ${peak.toFixed(4)}°.`
                : null
            }
          />
          <Summary text={result?.summary ?? null} />
        </div>
      }
    />
  );
}
