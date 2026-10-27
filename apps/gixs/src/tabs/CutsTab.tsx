// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/** The Cuts tool: box ROIs drawn on the image or picked from the standard cuts, edited in a
 * table, and their linecuts on the file shown and the checked files. */

import { unwrap } from "@beamline-web/client";
import {
  Button,
  Busy,
  DataTable,
  Placeholder,
  Toggle,
  Toolbar,
  toast,
  useLocalState,
  type Column,
  type PluginProps,
} from "@beamline-web/ui";
import { Plot, heightFor } from "@beamline-web/viz";
import { useMemo } from "react";

import { api, type Roi } from "../api/client";
import { contextOf } from "../api/context";
import { useCuts, useInfo } from "../api/queries";
import { cutsFigure, CUT_PANEL_PX } from "../figures/cuts";
import { selectedFiles, useAppStore } from "../store";
import {
  Fields,
  ResultAndControls,
  downloadPost,
  mapName,
  messageOf,
  useBoxHeight,
} from "./common";

interface CutsSettings {
  logX: boolean;
  logY: boolean;
  errors: boolean;
  legend: boolean;
}

const DEFAULTS: CutsSettings = { logX: false, logY: true, errors: false, legend: true };

export function CutsTab({ visible }: PluginProps) {
  const [s, setS] = useLocalState<CutsSettings>("gixs:cuts", DEFAULTS);
  const set = <K extends keyof CutsSettings>(key: K, value: CutsSettings[K]) =>
    setS((p) => ({ ...p, [key]: value }));
  const active = useAppStore((st) => st.active);
  const selection = useAppStore((st) => st.selection);
  const boxes = useAppStore((st) => st.boxes);
  const setBoxes = useAppStore((st) => st.setBoxes);
  const selectedBox = useAppStore((st) => st.selectedBox);
  const setSelectedBox = useAppStore((st) => st.setSelectedBox);
  const processing = useAppStore((st) => st.processing);
  const fileOverrides = useAppStore((st) => st.fileOverrides);
  const setMessage = useAppStore((st) => st.setMessage);
  const info = useInfo();
  const files = useMemo(() => selectedFiles({ active, selection }), [active, selection]);
  const context = useMemo(
    () => contextOf({ processing, fileOverrides }),
    [processing, fileOverrides],
  );
  const cuts = useCuts(files, boxes, context, visible);
  const [box, boxHeight] = useBoxHeight();
  const figure = useMemo(
    () =>
      cuts.data ? cutsFigure(cuts.data.curves, { roiOrder: boxes.map((r) => r.id), ...s }) : null,
    [cuts.data, boxes, s],
  );

  const edit = async (roi: Roi, key: string, value: unknown) => {
    try {
      const fixed = unwrap(
        await api.POST("/api/rois/normalize", { body: { ...roi, [key]: value } as Roi }),
      );
      setBoxes(useAppStore.getState().boxes.map((r) => (r.id === roi.id ? fixed : r)));
    } catch (e) {
      toast("Could not change the cut", { kind: "error", description: messageOf(e) });
    }
  };
  const addPreset = async (label: string) => {
    try {
      const roi = unwrap(
        await api.POST("/api/rois/preset", {
          body: { label, existing: useAppStore.getState().boxes },
        }),
      );
      setBoxes([...useAppStore.getState().boxes, roi]);
      setSelectedBox(roi.id);
    } catch (e) {
      toast("Could not add the cut", { kind: "error", description: messageOf(e) });
    }
  };
  const columns: Column<Roi>[] = [
    { key: "enabled", label: "on", kind: "boolean", editable: true, width: "2rem" },
    { key: "name", label: "name", kind: "text", editable: true, width: "7rem" },
    {
      key: "along",
      label: "along",
      kind: "select",
      editable: true,
      options: (roi) => [roi.x_map, roi.y_map].map((m) => ({ value: m, label: mapName(m) })),
    },
    { key: "x0", label: "x0", kind: "number", editable: true, align: "right" },
    { key: "x1", label: "x1", kind: "number", editable: true, align: "right" },
    { key: "y0", label: "y0", kind: "number", editable: true, align: "right" },
    { key: "y1", label: "y1", kind: "number", editable: true, align: "right" },
    { key: "bins", label: "bins", kind: "number", editable: true, align: "right" },
    {
      key: "mirror",
      label: "± x",
      kind: "boolean",
      editable: true,
      title: "Both sides of the specular plane",
    },
    {
      key: "above_horizon",
      label: "α_f ≥ 0",
      kind: "boolean",
      editable: true,
      title: "Only pixels above the sample horizon",
    },
    {
      key: "x_map",
      label: "maps",
      format: (_v, roi) => `${mapName(roi.x_map)} × ${mapName(roi.y_map)}`,
    },
  ];
  const empty = !files.length
    ? "Select a file on the left."
    : !boxes.some((r) => r.enabled !== false)
      ? "Draw a box on the image or add a standard cut."
      : null;

  return (
    <ResultAndControls
      id="cuts"
      result={
        <div ref={box} className="flex h-full min-h-0 flex-col">
          <Toolbar className="shrink-0 border-b border-line">
            <Toggle checked={s.logY} onChange={(v) => set("logY", v)}>
              log I
            </Toggle>
            <Toggle checked={s.logX} onChange={(v) => set("logX", v)}>
              log x
            </Toggle>
            <Toggle checked={s.errors} onChange={(v) => set("errors", v)}>
              error bars
            </Toggle>
            <Toggle checked={s.legend} onChange={(v) => set("legend", v)}>
              legend
            </Toggle>
            <Button
              size="sm"
              disabled={!cuts.data?.curves.length}
              onClick={() =>
                downloadPost(
                  "/api/cuts/export",
                  { files, rois: boxes, context },
                  "gixsu_cuts.zip",
                ).catch((e) => setMessage(messageOf(e)))
              }
              title="The cuts as text files in a zip archive"
            >
              Download
            </Button>
          </Toolbar>
          <div className="relative min-h-0 flex-1 overflow-auto">
            <Busy active={cuts.isFetching} />
            {empty ? (
              <Placeholder>{empty}</Placeholder>
            ) : cuts.error ? (
              <Placeholder error>{cuts.error.message}</Placeholder>
            ) : figure ? (
              <Plot
                data={figure.data}
                layout={figure.layout}
                height={heightFor(boxHeight - 32, figure.rows, CUT_PANEL_PX)}
                aria-label="cuts figure"
              />
            ) : null}
            {cuts.data?.errors.length ? (
              <div className="absolute bottom-1 left-2 text-2xs text-danger">
                {cuts.data.errors.join("; ")}
              </div>
            ) : null}
          </div>
        </div>
      }
      controls={
        <div className="space-y-2">
          <p className="text-muted">
            Draw a box on the image (the box tool) to add a cut: a tall box gives a vertical
            profile, a wide one a horizontal profile. Ranges are in the units of the view it was
            drawn on (Å⁻¹, px, deg); leave a cell blank for an open end.
          </p>
          <Fields>
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-muted">Standard cuts</span>
              {Object.keys(info.data?.presets ?? {}).map((label) => (
                <Button key={label} size="sm" onClick={() => void addPreset(label)}>
                  {label}
                </Button>
              ))}
            </div>
          </Fields>
          <DataTable
            columns={columns}
            rows={boxes}
            onChange={(roi, key, value) => void edit(roi, key, value)}
            onDelete={(roi) => {
              setBoxes(boxes.filter((r) => r.id !== roi.id));
              if (selectedBox === roi.id) setSelectedBox(null);
            }}
            rowClassName={(roi) =>
              roi.id === selectedBox
                ? "bg-accent/10"
                : roi.enabled === false
                  ? "text-muted"
                  : undefined
            }
            rowTitle={(roi) => `${roi.id}: click a row's name to select its box on the image`}
            emptyText="No cuts yet."
            aria-label="cuts"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="link"
              onClick={() => {
                setBoxes([]);
                setSelectedBox(null);
              }}
              disabled={!boxes.length}
            >
              Remove all cuts
            </Button>
            <Button
              size="sm"
              variant="link"
              disabled={!boxes.length}
              onClick={() =>
                downloadPost(
                  "/api/exports/roi-json",
                  { rois: boxes, level: processing.level },
                  "gixsu_rois.json",
                ).catch((e) => setMessage(messageOf(e)))
              }
              title="The cuts as a gixsu linecut --roi-json file"
            >
              Download as --roi-json
            </Button>
          </div>
        </div>
      }
    />
  );
}
