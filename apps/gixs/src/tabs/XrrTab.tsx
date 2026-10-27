// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/** The XRR tool: specular reflectivity R(q_z) from images at several incident angles (the file
 * shown and the checked files, or one αi-scan stack), as a job. */

import { unwrap } from "@beamline-web/client";
import {
  Button,
  NumberField,
  Placeholder,
  SelectField,
  Toggle,
  useLocalState,
} from "@beamline-web/ui";
import { Plot } from "@beamline-web/viz";
import { useMemo, useState } from "react";

import { api, type Reflectivity } from "../api/client";
import { contextOf } from "../api/context";
import { reflectivityFigure } from "../figures/reflectivity";
import { selectedFiles, useAppStore } from "../store";
import { Fields, Message, ResultAndControls, Row, Summary, saveText, useJob } from "./common";

interface XrrSettings {
  level: string;
  along: number;
  across: number;
  offset: number | null;
  angle: number;
  direct: number | null;
  coverage: number;
  match: boolean;
}

const DEFAULTS: XrrSettings = {
  level: "raw",
  along: 4,
  across: 4,
  offset: null,
  angle: 0,
  direct: null,
  coverage: 1,
  match: false,
};

export function XrrTab() {
  const [s, setS] = useLocalState<XrrSettings>("gixs:xrr", DEFAULTS);
  const set = <K extends keyof XrrSettings>(key: K, value: XrrSettings[K]) =>
    setS((p) => ({ ...p, [key]: value }));
  const active = useAppStore((st) => st.active);
  const selection = useAppStore((st) => st.selection);
  const processing = useAppStore((st) => st.processing);
  const fileOverrides = useAppStore((st) => st.fileOverrides);
  const setToolOverlays = useAppStore((st) => st.setToolOverlays);
  const files = useMemo(() => selectedFiles({ active, selection }), [active, selection]);
  const [result, setResult] = useState<Reflectivity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { run, running } = useJob();

  const compute = async () => {
    if (!files.length) {
      setError("Show a file first.");
      return;
    }
    setError(null);
    const out = await run<Reflectivity>("Reflectivity", async () =>
      unwrap(
        await api.POST("/api/jobs/reflectivity", {
          body: {
            files,
            context: contextOf({ processing, fileOverrides }),
            level: s.level,
            half_width_px: [s.along, s.across],
            background_offset_px: s.offset,
            angle_offset_deg: s.angle,
            direct_beam: s.direct,
            match: s.match,
            min_coverage: s.coverage,
          },
        }),
      ),
    );
    if (out) {
      setResult(out);
      setToolOverlays("xrr", out.overlays);
    }
  };
  const figure = useMemo(() => (result ? reflectivityFigure(result) : null), [result]);

  return (
    <ResultAndControls
      id="xrr"
      result={
        <div className="relative h-full min-h-0">
          {figure ? (
            <Plot data={figure.data} layout={figure.layout} aria-label="reflectivity figure" />
          ) : (
            <Placeholder>
              Check files at several αi (or show an αi-scan stack) and compute.
            </Placeholder>
          )}
        </div>
      }
      controls={
        <div className="space-y-2">
          <p className="text-muted">
            The specular spot of every image (the file shown and the checked files at several αi, or
            one αi-scan stack) in a box on the specular line, minus boxes beside it. The footprint
            correction uses the beam height and sample length of the Setup tab.
          </p>
          <Fields>
            <Row label="Level" title="raw: dose-normalized counts (no solver needed, fastest)">
              <SelectField
                size="sm"
                className="w-full"
                value={s.level}
                onChange={(v) => set("level", v)}
                options={["raw", "I1", "I2"].map((lv) => ({ value: lv, label: lv }))}
                aria-label="level"
              />
            </Row>
            <Row label="Box half length" unit="px" title="Along the specular line">
              <NumberField
                size="sm"
                width="100%"
                value={s.along}
                onChange={(v) => set("along", v ?? 4)}
              />
            </Row>
            <Row label="Box half width" unit="px" title="Across the specular line">
              <NumberField
                size="sm"
                width="100%"
                value={s.across}
                onChange={(v) => set("across", v ?? 4)}
              />
            </Row>
            <Row
              label="Background offset"
              unit="px"
              title="Distance of the background boxes from the line; 0 for no background"
            >
              <NumberField
                size="sm"
                width="100%"
                value={s.offset}
                onChange={(v) => set("offset", v)}
                placeholder="3 × width"
              />
            </Row>
            <Row label="αi offset" unit="deg" title="Added to every angle reading">
              <NumberField
                size="sm"
                width="100%"
                value={s.angle}
                onChange={(v) => set("angle", v ?? 0)}
              />
            </Row>
            <Row
              label="Direct beam I₀"
              title="Direct-beam intensity in the units of the images, for an absolute R"
            >
              <NumberField
                size="sm"
                width="100%"
                value={s.direct}
                onChange={(v) => set("direct", v)}
                placeholder="none"
              />
            </Row>
            <Row label="Minimum coverage" title="Fraction of valid pixels a box needs">
              <NumberField
                size="sm"
                width="100%"
                value={s.coverage}
                onChange={(v) => set("coverage", v ?? 1)}
              />
            </Row>
          </Fields>
          <Toggle checked={s.match} onChange={(v) => set("match", v)}>
            scale segments (attenuators) to each other
          </Toggle>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => void compute()}
              disabled={running || !files.length}
            >
              {running ? "Computing…" : "Compute"}
            </Button>
            <Button
              size="sm"
              disabled={!result}
              onClick={() => result && saveText(result.table, "gixsu_reflectivity.txt")}
              title="R(q_z) with what went into every point (text)"
            >
              Download
            </Button>
          </div>
          <Message text={error} error />
          <Summary text={result?.summary ?? null} />
        </div>
      }
    />
  );
}
