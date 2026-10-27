// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/** The Index tool: peaks found on the image (optionally fitted by 2-D Gaussians), the predicted
 * positions of a lattice's reflections in the film drawn on the image, and the lattice refined
 * to the peaks found. */

import { unwrap } from "@beamline-web/client";
import {
  Button,
  DataTable,
  NumberField,
  Segmented,
  SelectField,
  Toggle,
  fmt,
  useLocalState,
  type Column,
} from "@beamline-web/ui";
import { useMemo, useState } from "react";

import { api, type Indexed, type Peak2d } from "../api/client";
import { contextOf } from "../api/context";
import { useInfo } from "../api/queries";
import { useAppStore } from "../store";
import {
  Fields,
  Message,
  ResultAndControls,
  Row,
  Section,
  Summary,
  messageOf,
  parseVector,
} from "./common";

interface IndexSettings {
  snr: number | null;
  max: number;
  fit2d: boolean;
  a: number | null;
  b: number | null;
  c: number | null;
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
  normalKind: "uvw" | "plane";
  normal: string;
  centering: string;
  spaceGroup: string;
  qMax: number | null;
  branches: string[];
  delta: number | null;
  betaOptics: number | null;
  free: string[];
  system: string;
  onlyDetector: boolean;
}

const DEFAULTS: IndexSettings = {
  snr: 5,
  max: 30,
  fit2d: false,
  a: 100,
  b: 100,
  c: null,
  alpha: 90,
  beta: 90,
  gamma: 90,
  normalKind: "uvw",
  normal: "0 0 1",
  centering: "P",
  spaceGroup: "",
  qMax: null,
  branches: ["BA", "T", "R"],
  delta: null,
  betaOptics: null,
  free: ["a"],
  system: "auto",
  onlyDetector: true,
};
const SYSTEMS = [
  "auto",
  "triclinic",
  "monoclinic",
  "orthorhombic",
  "tetragonal",
  "hexagonal",
  "trigonal",
  "rhombohedral",
  "cubic",
];
const GREEK: Record<string, string> = { alpha: "α", beta: "β", gamma: "γ" };

export function IndexTab() {
  const [s, setS] = useLocalState<IndexSettings>("gixs:index", DEFAULTS);
  const set = <K extends keyof IndexSettings>(key: K, value: IndexSettings[K]) =>
    setS((p) => ({ ...p, [key]: value }));
  const active = useAppStore((st) => st.active);
  const processing = useAppStore((st) => st.processing);
  const fileOverrides = useAppStore((st) => st.fileOverrides);
  const setToolOverlays = useAppStore((st) => st.setToolOverlays);
  const info = useInfo();
  const [found, setFound] = useState<{ file: string; peaks: Peak2d[] } | null>(null);
  const [indexed, setIndexed] = useState<Indexed | null>(null);
  const [summary, setSummary] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const context = useMemo(
    () => contextOf({ processing, fileOverrides }),
    [processing, fileOverrides],
  );
  const lattice = () => {
    if (s.a === null) throw new Error("give at least the lattice parameter a");
    return [s.a, s.b ?? s.a, s.c, s.alpha ?? 90, s.beta ?? 90, s.gamma ?? 90];
  };
  const common = () => {
    const vec = parseVector(s.normal);
    return {
      uvw: s.normalKind === "uvw" ? vec : null,
      plane: vec && s.normalKind === "plane" ? vec.map((v) => Math.round(v)) : null,
      centering: s.spaceGroup ? null : s.centering || null,
      space_group: s.spaceGroup || null,
      branches: s.branches.length ? s.branches : ["BA"],
      delta: s.delta,
      beta: s.betaOptics,
    };
  };
  const guard = async (work: () => Promise<void>) => {
    if (!active) {
      setError("Show a file first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  const find = () =>
    guard(async () => {
      const out = unwrap(
        await api.POST("/api/peaks-2d", {
          body: { file: active!, context, min_snr: s.snr, max_peaks: s.max, fit: s.fit2d },
        }),
      );
      setFound({ file: out.file, peaks: out.peaks });
      setToolOverlays("index-peaks", out.overlays);
      setMessage(`${out.peaks.length} peaks found.`);
    });
  const predict = () =>
    guard(async () => {
      const out = unwrap(
        await api.POST("/api/index", {
          body: { file: active!, context, lattice: lattice(), q_max: s.qMax, ...common() },
        }),
      );
      setIndexed(out);
      setSummary("");
      setToolOverlays("index", out.overlays);
      setMessage(
        `${out.rows.length} positions, ${out.rows.filter((r) => r.on_detector).length} on the detector.`,
      );
    });
  const refine = () =>
    guard(async () => {
      if (!found || found.file !== active) throw new Error("find peaks on the file shown first");
      const out = unwrap(
        await api.POST("/api/refine", {
          body: {
            file: active!,
            context,
            lattice: lattice(),
            peaks: found.peaks,
            free: s.free.length ? s.free : ["a"],
            system: s.system,
            q_max: s.qMax,
            ...common(),
          },
        }),
      );
      setIndexed(out.index);
      setSummary(out.summary);
      setToolOverlays("index", out.index.overlays);
      setMessage(
        `${out.index.rows.length} positions, ${out.index.rows.filter((r) => r.on_detector).length} on the detector.`,
      );
    });
  const clear = () => {
    setIndexed(null);
    setFound(null);
    setSummary("");
    setMessage(null);
    setToolOverlays("index", null);
    setToolOverlays("index-peaks", null);
  };
  const f = (v: unknown) => (typeof v === "number" ? fmt(v, 5) : "");
  const peakColumns: Column<Peak2d & { id: string }>[] = [
    { key: "peak", label: "#" },
    { key: "qr", label: "q_r", align: "right", format: f },
    { key: "qz", label: "q_z", align: "right", format: f },
    { key: "q", label: "q", align: "right", format: f },
    { key: "chi", label: "χ°", align: "right", format: f },
    { key: "height", label: "height", align: "right", format: f },
    { key: "row", label: "row", align: "right", format: f },
    { key: "col", label: "col", align: "right", format: f },
  ];
  const reflColumns: Column<Record<string, unknown> & { id: string }>[] = [
    { key: "hkl", label: "hkl" },
    { key: "branch", label: "channel" },
    { key: "qr", label: "q_r", align: "right", format: f },
    { key: "qz", label: "q_z", align: "right", format: f },
    { key: "alpha_f", label: "α_f°", align: "right", format: f },
    { key: "two_theta_f", label: "2θ_f°", align: "right", format: f },
    { key: "d", label: "d (Å)", align: "right", format: f },
  ];
  const reflections = (indexed?.rows ?? [])
    .filter((r) => !s.onlyDetector || r.on_detector)
    .map((r, i) => ({ ...r, id: String(i) }));

  return (
    <ResultAndControls
      id="index"
      result={
        <div className="flex h-full min-h-0 flex-col gap-1 p-1">
          <span className="text-2xs text-muted">Peaks found</span>
          <DataTable
            columns={peakColumns}
            rows={(found?.peaks ?? []).map((p) => ({ ...p, id: String(p.peak) }))}
            className="max-h-[40%]"
            emptyText="No peaks found yet."
            aria-label="peaks found"
          />
          <div className="flex items-center gap-2">
            <span className="text-2xs text-muted">Predicted reflections</span>
            <Toggle checked={s.onlyDetector} onChange={(v) => set("onlyDetector", v)}>
              on the detector only
            </Toggle>
          </div>
          <DataTable
            columns={reflColumns}
            rows={reflections}
            className="min-h-0 flex-1"
            emptyText="No positions yet."
            aria-label="reflections"
          />
        </div>
      }
      controls={
        <div className="space-y-2">
          <Section
            title="Peaks on the image"
            hint="Local maxima above the smooth background of the image shown, with their q."
          >
            <Fields>
              <Row
                label="Minimum SNR"
                title="Signal to noise on the summed counts; blank: all maxima above 5 % of the highest"
              >
                <NumberField
                  size="sm"
                  width="100%"
                  value={s.snr}
                  onChange={(v) => set("snr", v)}
                  placeholder="none"
                />
              </Row>
              <Row label="At most">
                <NumberField
                  size="sm"
                  width="100%"
                  value={s.max}
                  step={1}
                  onChange={(v) => set("max", v ?? 30)}
                />
              </Row>
            </Fields>
            <Toggle checked={s.fit2d} onChange={(v) => set("fit2d", v)}>
              fit each by a 2-D Gaussian
            </Toggle>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void find()}
              disabled={busy || !active}
            >
              Find peaks
            </Button>
          </Section>
          <Section
            title="Lattice"
            hint="Channels: BA the Born approximation, T transmitted, R reflected (DWBA)."
          >
            <Fields>
              {(["a", "b", "c"] as const).map((k) => (
                <Row key={k} label={k} unit="Å">
                  <NumberField
                    size="sm"
                    width="100%"
                    value={s[k]}
                    onChange={(v) => set(k, v)}
                    placeholder={k === "c" ? "2-D" : undefined}
                  />
                </Row>
              ))}
              {(["alpha", "beta", "gamma"] as const).map((k) => (
                <Row key={k} label={GREEK[k]} unit="deg">
                  <NumberField size="sm" width="100%" value={s[k]} onChange={(v) => set(k, v)} />
                </Row>
              ))}
              <Row label="Normal">
                <span className="flex items-center gap-1">
                  <Segmented
                    size="sm"
                    value={s.normalKind}
                    onChange={(v) => set("normalKind", v)}
                    options={[
                      { value: "uvw", label: "[uvw]" },
                      { value: "plane", label: "(hkl)" },
                    ]}
                    aria-label="normal kind"
                  />
                  <input
                    className="h-6 w-full rounded-md border border-line-2 bg-surface px-1 text-xs"
                    value={s.normal}
                    onChange={(e) => set("normal", e.target.value)}
                    aria-label="normal"
                  />
                </span>
              </Row>
              <Row label="Centering">
                <SelectField
                  size="sm"
                  className="w-full"
                  value={s.centering}
                  onChange={(v) => set("centering", v)}
                  options={["P", "I", "F", "C", "A", "B", "R"].map((c) => ({ value: c, label: c }))}
                  aria-label="centering"
                />
              </Row>
              <Row
                label="Space group"
                title="Systematic absences from the space group (overrides the centering)"
              >
                <input
                  className="h-6 w-full rounded-md border border-line-2 bg-surface px-1 text-xs"
                  value={s.spaceGroup}
                  onChange={(e) => set("spaceGroup", e.target.value)}
                  placeholder="e.g. 229 or Im-3m"
                  aria-label="space group"
                />
              </Row>
              <Row label="q max" unit="Å⁻¹">
                <NumberField
                  size="sm"
                  width="100%"
                  value={s.qMax}
                  onChange={(v) => set("qMax", v)}
                  placeholder="detector"
                />
              </Row>
              <Row label="Film δ" title="Blank: the Setup sample settings">
                <NumberField
                  size="sm"
                  width="100%"
                  value={s.delta}
                  onChange={(v) => set("delta", v)}
                  placeholder="sample"
                />
              </Row>
              <Row label="Film β">
                <NumberField
                  size="sm"
                  width="100%"
                  value={s.betaOptics}
                  onChange={(v) => set("betaOptics", v)}
                  placeholder="sample"
                />
              </Row>
            </Fields>
            <div className="flex flex-wrap gap-2">
              {Object.keys(info.data?.branch_styles ?? { BA: 1, T: 1, R: 1 }).map((b) => (
                <Toggle
                  key={b}
                  checked={s.branches.includes(b)}
                  onChange={(on) =>
                    set("branches", on ? [...s.branches, b] : s.branches.filter((x) => x !== b))
                  }
                >
                  {b.replace("_", " ")}
                </Toggle>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => void predict()}
                disabled={busy || !active}
              >
                Show positions
              </Button>
              <Button size="sm" onClick={clear}>
                Clear
              </Button>
            </div>
          </Section>
          <Section
            title="Refine"
            hint="Each peak found is assigned the nearest predicted position."
          >
            <div className="flex flex-wrap gap-2">
              {["a", "b", "c", "alpha", "beta", "gamma"].map((k) => (
                <Toggle
                  key={k}
                  checked={s.free.includes(k)}
                  onChange={(on) =>
                    set("free", on ? [...s.free, k] : s.free.filter((x) => x !== k))
                  }
                >
                  {GREEK[k] ?? k}
                </Toggle>
              ))}
            </div>
            <Fields>
              <Row label="System">
                <SelectField
                  size="sm"
                  className="w-full"
                  value={s.system}
                  onChange={(v) => set("system", v)}
                  options={SYSTEMS.map((x) => ({ value: x, label: x }))}
                  aria-label="system"
                />
              </Row>
            </Fields>
            <Button size="sm" onClick={() => void refine()} disabled={busy || !found}>
              Refine to the peaks
            </Button>
          </Section>
          <Message text={error} error />
          <Message text={message} />
          <Summary text={summary || null} />
        </div>
      }
    />
  );
}
