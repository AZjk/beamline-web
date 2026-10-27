// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import { createQueryClient } from "@beamline-web/client";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { App } from "./App";
import { useAppStore } from "./store";
import { fakeFetch } from "./test/fakeServer";

afterEach(() => {
  vi.unstubAllGlobals();
  useAppStore.setState({ active: null, selection: [], files: [], total: 0, boxes: [] });
  window.history.replaceState(null, "", "/");
});

const info = {
  name: "gixsu",
  title: "gixsu web",
  version: "0.3.0",
  schema_version: "0.1.0",
  root: "/data/run42",
  views: [
    {
      name: "detector",
      label: "Detector",
      x_map: "x",
      y_map: "y",
      x_label: "column (px)",
      y_label: "row (px)",
      equal_aspect: true,
    },
    {
      name: "qr-qz",
      label: "q_r – q_z",
      x_map: "qr",
      y_map: "qz",
      x_label: "q_r (Å⁻¹)",
      y_label: "q_z (Å⁻¹)",
      equal_aspect: true,
    },
  ],
  levels: ["raw", "I1", "I2", "I3", "I4"],
  level_help: { I2: "detector corrections" },
  level_tooltip: "Correction level",
  normalizations: { none: "none (counts)" },
  geometry_fields: [{ key: "energy", label: "Energy", unit: "keV" }],
  sample_fields: [],
  peak_shapes: { pv: "pseudo-Voigt" },
  calibrants: ["AgBeh"],
  branch_styles: { BA: ["#fff", "circle-open"] },
  presets: { "I(q), all directions": { x_map: "chi", y_map: "q" } },
  max_image_px: 1000,
  device: "auto",
  setup: null,
};
const files = {
  files: [
    { id: "a.h5", label: "a.h5", name: "a.h5", folder: "", modified: "10-26 10:00", mtime: 1 },
    {
      id: "sub/b.h5",
      label: "sub/b.h5",
      name: "b.h5",
      folder: "sub",
      modified: "10-26 11:00",
      mtime: 2,
    },
  ],
  total: 2,
  version: 1,
};

test("lists the folder, shows a file's metadata and status, and writes the URL", async () => {
  vi.stubGlobal(
    "fetch",
    fakeFetch({
      "/api/info": info,
      "/api/session/setup": { setup: null, description: "No setup file.", own: false },
      "/api/files": files,
      "/api/files/a.h5/summary": {
        id: "a.h5",
        label: "a.h5",
        rows: [
          { label: "Detector", value: "Pilatus", changed: false },
          { label: "Distance", value: "0.31 m", changed: true },
        ],
        frames: 3,
        geometry: { energy: 12 },
        original_geometry: { energy: 12 },
        status: [{ key: "level", text: "level I2", state: "ok", title: "" }],
      },
    }),
  );
  render(<App client={createQueryClient()} />);
  await waitFor(() => expect(screen.getByText("sub/b.h5")).toBeTruthy());
  screen.getByText("a.h5").click();
  await waitFor(() => expect(screen.getByText("Pilatus")).toBeTruthy());
  expect(screen.getByText("0.31 m *")).toBeTruthy();
  expect(screen.getByText("level I2")).toBeTruthy();
  expect(window.location.search).toContain("file=a.h5");
  expect(useAppStore.getState().active).toBe("a.h5");
});

test("reports a service that cannot be reached", async () => {
  vi.stubGlobal("fetch", fakeFetch({}));
  render(<App client={createQueryClient()} />);
  await waitFor(() => expect(screen.getByText(/Could not reach the service/)).toBeTruthy());
});
