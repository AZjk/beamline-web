// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/** The Setup tool: the session's setup file (a workflow whose setup and processing apply to
 * every file shown), the geometry the file shown is reduced with (override energy, distance,
 * incident angle and beam center for it or for the checked files), the dose normalization, and
 * the sample and beam settings every file uses. */

import { unwrap } from "@beamline-web/client";
import { Button, NumberField, SelectField } from "@beamline-web/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { api } from "../api/client";
import { queryOf } from "../api/context";
import { useInfo, useSummary } from "../api/queries";
import { useAppStore } from "../store";
import {
  ControlsOnly,
  Fields,
  Message,
  Row,
  Section,
  downloadPost,
  messageOf,
} from "../tabs/common";

const DIGITS = 8;
const shown = (v: number | null | undefined) =>
  v === null || v === undefined ? null : Number(v.toFixed(DIGITS));

export function SetupTab() {
  const info = useInfo();
  const queryClient = useQueryClient();
  const active = useAppStore((s) => s.active);
  const selection = useAppStore((s) => s.selection);
  const processing = useAppStore((s) => s.processing);
  const setProcessing = useAppStore((s) => s.setProcessing);
  const fileOverrides = useAppStore((s) => s.fileOverrides);
  const setFileOverrides = useAppStore((s) => s.setFileOverrides);
  const setup = useAppStore((s) => s.setup);
  const setSetup = useAppStore((s) => s.setSetup);
  const setMessage = useAppStore((s) => s.setMessage);
  const summary = useSummary(active, queryOf({ processing, fileOverrides }, active));
  // stable lists: a fresh [] on every render would re-run the effects below without end
  const geometryFields = useMemo(() => info.data?.geometry_fields ?? [], [info.data]);
  const sampleFields = useMemo(() => info.data?.sample_fields ?? [], [info.data]);

  // the setup file
  const [path, setPath] = useState("");
  const [setupNote, setSetupNote] = useState<string | null>(null);
  useEffect(() => {
    if (setup?.setup?.path && !path) setPath(setup.setup.path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup]);
  const applySetup = async (load: boolean) => {
    try {
      const out = load
        ? unwrap(await api.POST("/api/session/setup", { body: { path } }))
        : unwrap(await api.DELETE("/api/session/setup"));
      setSetup(out);
      setSetupNote(null);
      if (out.setup) {
        setProcessing({
          level: out.setup.level,
          frame: out.setup.frame,
          normalization: out.setup.normalization,
          sample: out.setup.sample,
        });
        setSample(
          sampleFields.map((f) =>
            fieldValue(out.setup!.sample[f.key], f.factor ?? 1, f.kind ?? "number"),
          ),
        );
      }
      void queryClient.invalidateQueries();
    } catch (e) {
      setSetupNote(`Could not load ${path}: ${messageOf(e)}`);
    }
  };

  // the geometry of the file shown
  const geometry = summary.data?.geometry ?? null;
  const [typed, setTyped] = useState<Record<string, number | null>>({});
  useEffect(() => {
    setTyped(Object.fromEntries(geometryFields.map((f) => [f.key, shown(geometry?.[f.key])])));
  }, [geometry, geometryFields]);
  const [geometryNote, setGeometryNote] = useState<string | null>(null);
  const edited = useMemo(() => {
    const out: Record<string, number> = {};
    for (const f of geometryFields) {
      const v = typed[f.key];
      if (v !== null && v !== undefined && v !== shown(geometry?.[f.key])) out[f.key] = v;
    }
    return out;
  }, [typed, geometry, geometryFields]);
  const applyGeometry = async (targets: string[]) => {
    if (!active) return;
    try {
      const out = unwrap(
        await api.POST("/api/setup/geometry", {
          body: { overrides: fileOverrides, targets, edited },
        }),
      );
      setFileOverrides(out.overrides);
      setGeometryNote(out.message);
    } catch (e) {
      setGeometryNote(messageOf(e));
    }
  };
  const resetGeometry = () => {
    if (!active) return;
    const next = { ...fileOverrides };
    delete next[active];
    setFileOverrides(next);
    setGeometryNote("Using the file's own geometry.");
  };

  // the sample and beam settings
  const fieldValue = (value: unknown, factor: number, kind: string): string | number | null =>
    value === null || value === undefined
      ? null
      : kind === "text"
        ? String(value)
        : Number((Number(value) / factor).toPrecision(10));
  const [sample, setSample] = useState<(string | number | null)[]>([]);
  useEffect(() => {
    if (sampleFields.length && !sample.length)
      setSample(
        sampleFields.map((f) =>
          fieldValue(processing.sample[f.key], f.factor ?? 1, f.kind ?? "number"),
        ),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sampleFields]);
  const [sampleNote, setSampleNote] = useState<string | null>(null);
  const applySample = async (clear: boolean) => {
    if (clear) {
      setProcessing({ sample: {} });
      setSample(sampleFields.map(() => null));
      setSampleNote("No sample settings.");
      return;
    }
    try {
      const out = unwrap(await api.POST("/api/setup/sample", { body: { values: sample } }));
      setProcessing({ sample: out.sample });
      setSampleNote(out.text);
    } catch (e) {
      setSampleNote(messageOf(e));
    }
  };

  return (
    <ControlsOnly>
      <div className="space-y-3">
        <Section
          title="Setup file"
          hint="A workflow file (gixsu workflow-template, gixsu run): its geometry, mask, dark and flat files, correction config, background, level, normalization and sample apply to every file shown, as gixsu run reduces them. Yours alone: other browsers keep theirs."
        >
          <Row label="File">
            <input
              className="h-6 w-full rounded-md border border-line-2 bg-surface px-1 text-xs"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="beamline.yaml (in the data folder)"
              aria-label="setup file"
            />
          </Row>
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => void applySetup(true)}
              disabled={!path.trim()}
            >
              Load
            </Button>
            <Button
              size="sm"
              onClick={() => void applySetup(false)}
              title="Back to the files' own geometry and the default corrections"
            >
              Clear
            </Button>
          </div>
          <Message text={setupNote} error />
          <p className="text-2xs text-muted">
            {setup?.description ??
              "No setup file: the files' own geometry and the default corrections."}
          </p>
        </Section>
        <Section
          title="Geometry"
          hint="Values the file shown is reduced with. Change them and apply the changed ones to this file or to the checked files (which keep their own other values); the file itself is not modified. Calibrations apply theirs here too."
        >
          <Fields>
            {geometryFields.map((f) => (
              <Row key={f.key} label={f.label} unit={f.unit}>
                <NumberField
                  size="sm"
                  width="100%"
                  value={typed[f.key] ?? null}
                  onChange={(v) => setTyped((t) => ({ ...t, [f.key]: v }))}
                  disabled={!active}
                  aria-label={f.label}
                />
              </Row>
            ))}
          </Fields>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="sm"
              disabled={!active || !Object.keys(edited).length}
              onClick={() => void applyGeometry([active!])}
            >
              Apply to this file
            </Button>
            <Button
              size="sm"
              disabled={!active || !Object.keys(edited).length}
              onClick={() => void applyGeometry([...new Set([active!, ...selection])])}
            >
              Apply to checked files
            </Button>
            <Button
              size="sm"
              disabled={!active}
              onClick={resetGeometry}
              title="Use the file's own values again (also drops calibrated tilts)"
            >
              Reset
            </Button>
            <Button
              size="sm"
              variant="link"
              disabled={!active}
              onClick={() =>
                downloadPost(
                  "/api/exports/metadata-json",
                  { overrides: active ? (fileOverrides[active] ?? {}) : {} },
                  "gixsu_metadata.json",
                ).catch((e) => setMessage(messageOf(e)))
              }
              title="The changed values of this file, for gixsu process, linecut and merge"
            >
              Download as --metadata-json
            </Button>
          </div>
          <Message text={geometryNote} />
        </Section>
        <Section title="Intensity">
          <Row label="Normalization">
            <SelectField
              size="sm"
              className="w-full"
              value={processing.normalization}
              onChange={(v) => setProcessing({ normalization: v })}
              options={Object.entries(info.data?.normalizations ?? { none: "none (counts)" }).map(
                ([k, v]) => ({ value: k, label: v }),
              )}
              aria-label="normalization"
            />
          </Row>
        </Section>
        <Section
          title="Sample and beam"
          hint="For every file: the film optics (a material and density, or δ and β) give the refraction-corrected maps and levels I3/I4; the thickness the film absorption; beam height and sample length the footprint (I3, reflectivity)."
        >
          <Fields>
            {sampleFields.map((f, i) => (
              <Row key={f.key} label={f.label} unit={f.unit}>
                {f.kind === "text" ? (
                  <input
                    className="h-6 w-full rounded-md border border-line-2 bg-surface px-1 text-xs"
                    value={(sample[i] as string | null) ?? ""}
                    onChange={(e) =>
                      setSample((v) => v.map((x, k) => (k === i ? e.target.value : x)))
                    }
                    placeholder={f.key === "film_material" ? "e.g. C8H8" : "e.g. Si"}
                    aria-label={f.label}
                  />
                ) : (
                  <NumberField
                    size="sm"
                    width="100%"
                    value={typeof sample[i] === "number" ? (sample[i] as number) : null}
                    onChange={(v) => setSample((s) => s.map((x, k) => (k === i ? v : x)))}
                    aria-label={f.label}
                  />
                )}
              </Row>
            ))}
          </Fields>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={() => void applySample(false)}>
              Apply
            </Button>
            <Button size="sm" onClick={() => void applySample(true)}>
              Clear
            </Button>
          </div>
          <Message text={sampleNote} />
        </Section>
      </div>
    </ControlsOnly>
  );
}
