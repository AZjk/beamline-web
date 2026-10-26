// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { App } from "./App";
import { useAppStore } from "./store";
import { fakeFetch } from "./test/fakeServer";

afterEach(() => {
  vi.unstubAllGlobals();
  useAppStore.setState({ active: null, selection: [], files: [], total: 0 });
  window.history.replaceState(null, "", "/");
});

const info = {
  root: "/data/run42",
  version: "1.2.0",
  schema_version: "0.4.0",
  label_style: null,
  colormaps: ["viridis"],
  defaults: { g2_bounds: {}, tauq_bounds: [] },
};
const files = {
  files: [
    {
      id: "a.hdf",
      label: "a",
      modified: "2026-10-26 10:00",
      mtime: 1,
      size: 1,
      atype: ["Multitau"],
    },
    {
      id: "b.hdf",
      label: "b",
      modified: "2026-10-26 11:00",
      mtime: 2,
      size: 1,
      atype: ["Twotime"],
    },
  ],
  total: 2,
  version: 1,
};

test("lists the folder, shows a file's metadata and writes the URL", async () => {
  vi.stubGlobal(
    "fetch",
    fakeFetch({
      "/api/info": info,
      "/api/files": files,
      "/api/files/a.hdf/summary": {
        file: "a.hdf",
        label: "a",
        rows: [
          ["File", "a.hdf"],
          ["Analysis", "Multitau"],
        ],
        geometry: {
          shape: [10, 10],
          beam_center: [5, 5],
          extent_q: [0, 1, 0, 1],
          pixel_size: 1,
          det_dist: 1,
          energy: 1,
        },
      },
    }),
  );
  render(<App />);
  expect(await screen.findByText("/data/run42")).toBeTruthy();
  expect(await screen.findByText("a")).toBeTruthy();
  screen.getByText("a").click();
  expect(await screen.findByText("Multitau")).toBeTruthy();
  await waitFor(() => expect(window.location.search).toContain("file=a.hdf"));
  expect(document.title).toContain("a —");
});

test("reports a missing service", async () => {
  vi.stubGlobal("fetch", fakeFetch({}));
  render(<App />);
  expect(await screen.findByText(/Could not reach the service/)).toBeTruthy();
});
