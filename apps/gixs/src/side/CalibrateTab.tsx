// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/** The Calibrate tool: the direct-beam center, the distance and αi offset from specular spots
 * at several angles (and the αi of one file from its specular spot), and the geometry from
 * calibrant rings. The last result can be put to use: its values become overrides of the files
 * it came from. */

import { unwrap } from "@beamline-web/client";
import { Button, NumberField, SelectField, Toggle } from "@beamline-web/ui";
import { useMemo, useState } from "react";

import { api, type Calibration } from "../api/client";
import { contextOf } from "../api/context";
import { useInfo } from "../api/queries";
import { selectedFiles, useAppStore } from "../store";
import {
  ControlsOnly,
  Fields,
  Message,
  Row,
  Section,
  Summary,
  messageOf,
  useJob,
} from "../tabs/common";

export function CalibrateTab() {
  const info = useInfo();
  const active = useAppStore((s) => s.active);
  const selection = useAppStore((s) => s.selection);
  const processing = useAppStore((s) => s.processing);
  const fileOverrides = useAppStore((s) => s.fileOverrides);
  const setFileOverrides = useAppStore((s) => s.setFileOverrides);
  const setToolOverlays = useAppStore((s) => s.setToolOverlays);
  const files = useMemo(() => selectedFiles({ active, selection }), [active, selection]);
  const context = useMemo(
    () => contextOf({ processing, fileOverrides }),
    [processing, fileOverrides],
  );
  const [box, setBox] = useState(256);
  const [band, setBand] = useState(10);
  const [fitDistance, setFitDistance] = useState(true);
  const [fitOffset, setFitOffset] = useState(true);
  const [calibrant, setCalibrant] = useState("AgBeh");
  const [rings, setRings] = useState<number | null>(null);
  const [tilt, setTilt] = useState(true);
  const [last, setLast] = useState<Calibration | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { run, running } = useJob();

  const take = (out: Calibration | null) => {
    if (!out) return;
    setLast(out);
    setToolOverlays("calibrate", out.overlays);
    setNote(
      out.kind === "specular" && (out as Record<string, unknown>).stack
        ? "A stack: only the distance can be set (the angles differ per frame)."
        : null,
    );
  };
  const sync = async (work: () => Promise<Calibration>) => {
    if (!active) {
      setError("Show a file first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      take(await work());
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  const findBeam = () =>
    sync(async () =>
      unwrap(
        await api.POST("/api/calibrate/beam-center", {
          body: { file: active!, context, box_size: box },
        }),
      ),
    );
  const check = () =>
    sync(async () =>
      unwrap(
        await api.POST("/api/calibrate/check", { body: { file: active!, context, band_px: band } }),
      ),
    );
  const fitSpots = async () => {
    if (!active) return setError("Show a file first.");
    setError(null);
    take(
      await run<Calibration>("Specular spots", async () =>
        unwrap(
          await api.POST("/api/jobs/calibrate/specular", {
            body: {
              files,
              context,
              band_px: band,
              fit_distance: fitDistance,
              fit_offset: fitOffset,
            },
          }),
        ),
      ),
    );
  };
  const fitRings = async () => {
    if (!active) return setError("Show a file first.");
    setError(null);
    take(
      await run<Calibration>("Calibrant rings", async () =>
        unwrap(
          await api.POST("/api/jobs/calibrate/rings", {
            body: { file: active!, context, calibrant, n_rings: rings, fit_tilt: tilt },
          }),
        ),
      ),
    );
  };
  const use = () => {
    if (!last) return;
    const next = { ...fileOverrides };
    for (const [file, values] of Object.entries(last.apply))
      next[file] = { ...(next[file] ?? {}), ...values };
    setFileOverrides(next);
    const n = Object.keys(last.apply).length;
    setNote(`Set on ${n} file${n === 1 ? "" : "s"} (see Setup).`);
  };
  const disabled = busy || running;

  return (
    <ControlsOnly>
      <div className="space-y-3">
        <Section
          title="Beam center"
          hint="The brightest spot within the box around the current beam center, refined by its background-free centroid: use an image of the attenuated direct beam."
        >
          <Fields>
            <Row label="Box size" unit="px">
              <NumberField
                size="sm"
                width="100%"
                value={box}
                step={1}
                onChange={(v) => setBox(v ?? 256)}
              />
            </Row>
          </Fields>
          <Button size="sm" onClick={() => void findBeam()} disabled={disabled || !active}>
            Find the beam center
          </Button>
        </Section>
        <Section
          title="Specular spots"
          hint="Files at several αi (the file shown and the checked files) or one αi-scan stack; the specular direction comes from the file's specular position."
        >
          <Fields>
            <Row
              label="Search band"
              unit="px"
              title="Half width of the search band around the specular line"
            >
              <NumberField size="sm" width="100%" value={band} onChange={(v) => setBand(v ?? 10)} />
            </Row>
          </Fields>
          <div className="flex flex-wrap gap-2">
            <Toggle checked={fitDistance} onChange={setFitDistance}>
              distance
            </Toggle>
            <Toggle checked={fitOffset} onChange={setFitOffset}>
              αi offset
            </Toggle>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void fitSpots()} disabled={disabled || !active}>
              Fit the spots
            </Button>
            <Button size="sm" onClick={() => void check()} disabled={disabled || !active}>
              Check this file's αi
            </Button>
          </div>
        </Section>
        <Section
          title="Calibrant rings"
          hint="Beam center, distance and tilt from the powder rings of the file shown, starting from its geometry."
        >
          <Fields>
            <Row label="Calibrant">
              <SelectField
                size="sm"
                className="w-full"
                value={calibrant}
                onChange={setCalibrant}
                options={(info.data?.calibrants ?? ["AgBeh"]).map((c) => ({ value: c, label: c }))}
                aria-label="calibrant"
              />
            </Row>
            <Row label="Rings">
              <NumberField
                size="sm"
                width="100%"
                value={rings}
                step={1}
                onChange={setRings}
                placeholder="all"
              />
            </Row>
          </Fields>
          <Toggle checked={tilt} onChange={setTilt}>
            fit the detector tilt
          </Toggle>
          <Button size="sm" onClick={() => void fitRings()} disabled={disabled || !active}>
            Fit the rings
          </Button>
        </Section>
        <Message text={error} error />
        <Message text={note} />
        <Summary text={last?.text ?? null} />
        <Button
          variant="primary"
          size="sm"
          onClick={use}
          disabled={!last || !Object.keys(last.apply).length}
          title="Set the fitted values as the geometry of the files they came from"
        >
          Use these values
        </Button>
      </div>
    </ControlsOnly>
  );
}
