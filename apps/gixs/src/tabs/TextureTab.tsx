// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/** The Texture tool: I(χ) on a ring (background from side bands) of the file shown and the
 * checked files, the sin χ-weighted orientation analysis, the pole figure and the relative
 * degree of crystallinity; the profiles run as a job. */

import { unwrap } from "@beamline-web/client";
import {
  Button,
  DataTable,
  NumberField,
  Placeholder,
  Segmented,
  SelectField,
  Toggle,
  Toolbar,
  useLocalState,
  type Column,
} from "@beamline-web/ui";
import { Plot } from "@beamline-web/viz";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { api, type PoleMap, type Texture } from "../api/client";
import { contextOf } from "../api/context";
import {
  POLE_VIEWS,
  poleFigure,
  poleMapFigure,
  polePolar,
  textureFigure,
  type PoleView,
} from "../figures/texture";
import { selectedFiles, useAppStore } from "../store";
import {
  Fields,
  Message,
  ResultAndControls,
  Row,
  Section,
  Summary,
  downloadPost,
  messageOf,
  useJob,
} from "./common";

interface TextureSettings {
  q0: number | null;
  half: number;
  split: number;
  fold: boolean;
  background: boolean;
  refraction: boolean;
  view: PoleView;
  log: boolean;
}

const DEFAULTS: TextureSettings = {
  q0: null,
  half: 0.01,
  split: 45,
  fold: true,
  background: true,
  refraction: false,
  view: "chi",
  log: false,
};
const MODEL_WARNING = 30;

type CrystalRow = Record<string, unknown> & {
  id: string;
  file: string;
  label: string;
  thickness?: number | null;
  rdoc?: number | null;
  model_share?: number;
};

function orientationText(out: Texture): string {
  return out.files
    .map((f) => {
      const o = f.orientation as Record<string, unknown> | null;
      const text =
        (o?.summary as string | undefined) ?? f.orientation_error ?? "profile not folded";
      return out.files.length === 1 ? text : `${f.file_label}\n  ${text}`;
    })
    .join("\n");
}

export function TextureTab() {
  const [s, setS] = useLocalState<TextureSettings>("gixs:texture", DEFAULTS);
  const set = <K extends keyof TextureSettings>(key: K, value: TextureSettings[K]) =>
    setS((p) => ({ ...p, [key]: value }));
  const active = useAppStore((st) => st.active);
  const selection = useAppStore((st) => st.selection);
  const processing = useAppStore((st) => st.processing);
  const fileOverrides = useAppStore((st) => st.fileOverrides);
  const lastFit = useAppStore((st) => st.lastFit);
  const setToolOverlays = useAppStore((st) => st.setToolOverlays);
  const setMessage = useAppStore((st) => st.setMessage);
  const files = useMemo(() => selectedFiles({ active, selection }), [active, selection]);
  const [result, setResult] = useState<Texture | null>(null);
  const [rows, setRows] = useState<CrystalRow[]>([]);
  const [reference, setReference] = useState<string | null>(null);
  const [crystalError, setCrystalError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { run, running } = useJob();

  const compute = async () => {
    if (!files.length || s.q0 === null) {
      setError("Show a file and give the ring position q₀.");
      return;
    }
    setError(null);
    const thickness = Object.fromEntries(rows.map((r) => [r.file, r.thickness ?? null]));
    const out = await run<Texture>("Texture", async () =>
      unwrap(
        await api.POST("/api/jobs/texture", {
          body: {
            files,
            context: contextOf({ processing, fileOverrides }),
            q0: s.q0!,
            half_width: s.half,
            fold: s.fold,
            background: s.background,
            split: s.split,
            refraction: s.refraction,
            thickness,
            reference,
          },
        }),
      ),
    );
    if (!out) return;
    setResult(out);
    setToolOverlays("texture", out.overlays);
    const skipped = out.errors.map((e) => `${e.file_label}: ${e.error}`).join("; ");
    setError(skipped ? `Skipped ${skipped}` : null);
    const typed = new Map(rows.map((r) => [r.file, r.thickness]));
    const crystal = out.crystallinity as {
      rows: Record<string, unknown>[];
      reference: string | null;
      error: string | null;
    };
    setRows(
      crystal.rows.map((r) => ({
        ...r,
        id: String(r.file),
        file: String(r.file),
        label: String(r.label),
        thickness: typed.get(String(r.file)) ?? (r.thickness as number | null),
      })),
    );
    setReference(crystal.reference);
    setCrystalError(crystal.error);
  };
  // the crystallinity follows the typed thicknesses and the reference
  const recompute = async (next: CrystalRow[], ref: string | null) => {
    try {
      const out = unwrap(
        await api.POST("/api/texture/crystallinity", { body: { rows: next, reference: ref } }),
      );
      setRows(
        out.rows.map((r) => ({
          ...r,
          id: String(r.file),
          file: String(r.file),
          label: String(r.label),
        })) as CrystalRow[],
      );
      setReference(out.reference);
      setCrystalError(out.error);
    } catch (e) {
      setCrystalError(messageOf(e));
    }
  };
  const fromFit = () => {
    if (!lastFit || !lastFit.peaks.length) {
      setError("No peak fit yet (Peaks tab).");
      return;
    }
    if (lastFit.axis !== "q" && lastFit.axis !== "q_film") {
      setError("The last fit is not on a q cut (a ring position needs |q|).");
      return;
    }
    const center = lastFit.peaks[0]!.center;
    if (typeof center === "number") set("q0", Number(center.toPrecision(6)));
    setError(null);
  };
  const maps = useQuery<PoleMap[], Error>({
    queryKey: ["pole-maps", result],
    queryFn: async () =>
      unwrap(
        await api.POST("/api/texture/pole-maps", {
          body: { result: result as unknown as Record<string, never>, n: 151 },
        }),
      ),
    enabled: result !== null && s.view === "map",
    staleTime: Infinity,
  });
  const figure = useMemo(() => {
    if (!result) return null;
    if (s.view === "chi") return textureFigure(result, s.log);
    if (s.view === "polar") return polePolar(result, s.log);
    if (s.view === "map") return maps.data ? poleMapFigure(result, maps.data, s.log) : null;
    return poleFigure(result, s.view, s.log);
  }, [result, s.view, s.log, maps.data]);
  useEffect(() => {
    setResult(null);
    setToolOverlays("texture", null);
  }, [processing, fileOverrides, setToolOverlays]);

  const fixed = (v: unknown) => (typeof v === "number" ? v.toFixed(3) : "");
  const columns: Column<CrystalRow>[] = [
    { key: "label", label: "file", width: "9rem" },
    {
      key: "fraction_low",
      label: "χ<split",
      align: "right",
      format: fixed,
      title: "Population (sin χ weighted) below the split angle",
    },
    {
      key: "hermans",
      label: "Herm.",
      align: "right",
      format: fixed,
      title: "Hermans orientation factor",
    },
    {
      key: "model_share",
      label: "model%",
      align: "right",
      format: (v) => (typeof v === "number" ? v.toFixed(1) : ""),
      title: `Share of ∫ I sin χ dχ in the angles the model filled; above ${MODEL_WARNING}% the numbers rest mostly on the model`,
    },
    {
      key: "thickness",
      label: "t ✎",
      kind: "number",
      editable: true,
      align: "right",
      title: "Type a thickness per file (any unit, the same for all) to divide by it",
    },
    {
      key: "rdoc",
      label: "rDoC",
      align: "right",
      format: fixed,
      title: "Relative degree of crystallinity",
    },
  ];
  const oriented = result && result.files.some((f) => f.orientation);

  return (
    <ResultAndControls
      id="texture"
      result={
        <div className="flex h-full min-h-0 flex-col">
          <Toolbar className="shrink-0 border-b border-line">
            <Segmented
              size="sm"
              value={s.view}
              onChange={(v) => set("view", v)}
              options={POLE_VIEWS}
              aria-label="texture view"
            />
            <Toggle checked={s.log} onChange={(v) => set("log", v)}>
              log
            </Toggle>
          </Toolbar>
          <div className="relative min-h-0 flex-1">
            {!result ? (
              <Placeholder>Give the ring position q₀ and make the profiles.</Placeholder>
            ) : s.view !== "chi" && !oriented ? (
              <Placeholder>
                The pole figure needs the orientation analysis: fold ±χ and make the profiles.
              </Placeholder>
            ) : figure ? (
              <Plot data={figure.data} layout={figure.layout} aria-label="texture figure" />
            ) : maps.error ? (
              <Placeholder error>{maps.error.message}</Placeholder>
            ) : null}
          </div>
        </div>
      }
      controls={
        <div className="space-y-2">
          <p className="text-muted">
            The intensity around a ring against χ (0° along the film normal), minus the side bands,
            for the file shown and the checked files. Folded, it gives the orientation analysis and
            the pole figure, with the angles the detector cannot reach filled by a two-lobe model.
          </p>
          <Fields>
            <Row label="Ring q₀" unit="Å⁻¹">
              <NumberField size="sm" width="100%" value={s.q0} onChange={(v) => set("q0", v)} />
            </Row>
            <Row label="Half width" unit="Å⁻¹">
              <NumberField
                size="sm"
                width="100%"
                value={s.half}
                onChange={(v) => set("half", v ?? 0.01)}
              />
            </Row>
            <Row
              label="Split"
              unit="deg"
              title="Fractions below and above this χ (edge-on / face-on for a lamellar (h00) ring)"
            >
              <NumberField
                size="sm"
                width="100%"
                value={s.split}
                onChange={(v) => set("split", v ?? 45)}
              />
            </Row>
          </Fields>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <Toggle checked={s.fold} onChange={(v) => set("fold", v)}>
              fold ±χ (orientation, pole figure)
            </Toggle>
            <Toggle checked={s.background} onChange={(v) => set("background", v)}>
              subtract the side bands
            </Toggle>
            <Toggle checked={s.refraction} onChange={(v) => set("refraction", v)}>
              refraction-corrected q, χ (film optics of Setup)
            </Toggle>
          </div>
          <p className="text-2xs text-muted">
            Near the horizon the film transmission shapes I(χ): for accurate fractions use level I4
            with the film optics set in Setup and the refraction correction on.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => void compute()}
              disabled={running || !files.length}
            >
              {running ? "Computing…" : "Make the profiles"}
            </Button>
            <Button
              size="sm"
              onClick={fromFit}
              title="The center of the first peak of the last fit on a q cut"
            >
              q₀ from the peak fit
            </Button>
            <Button
              size="sm"
              disabled={!result}
              onClick={() =>
                result &&
                downloadPost(
                  "/api/exports/texture-text",
                  { result, rows, reference },
                  "gixsu_texture.txt",
                ).catch((e) => setMessage(messageOf(e)))
              }
              title="Profiles, pole densities and the numbers per file (text)"
            >
              Download
            </Button>
          </div>
          <Message text={error} error />
          <Section
            title="Relative crystallinity"
            hint="∫ I sin χ dχ of each file over that of the reference, divided by the thickness when every file has one. Compare files reduced alike: the same ring, level I3 or I4, normalization and αi relative to α_c."
          >
            <Fields>
              <Row label="Reference">
                <SelectField
                  size="sm"
                  className="w-full"
                  value={reference ?? ""}
                  onChange={(v) => void recompute(rows, v)}
                  options={
                    rows.length
                      ? rows.map((r) => ({ value: r.file, label: r.label }))
                      : [{ value: "", label: "—" }]
                  }
                  aria-label="reference"
                />
              </Row>
            </Fields>
            <DataTable
              columns={columns}
              rows={rows}
              onChange={(row, key, value) =>
                void recompute(
                  rows.map((r) => (r.id === row.id ? { ...r, [key]: value } : r)),
                  reference,
                )
              }
              rowClassName={(r) =>
                typeof r.model_share === "number" && r.model_share > MODEL_WARNING
                  ? "text-danger"
                  : undefined
              }
              emptyText="No file has an orientation analysis yet."
              aria-label="crystallinity"
            />
            <Message text={crystalError} error />
          </Section>
          <Summary text={result ? orientationText(result) : null} />
        </div>
      }
    />
  );
}
