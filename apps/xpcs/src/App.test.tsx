// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import { render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { App } from "./App";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("renders the shell and reports a missing service", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not here", { status: 404 })));
  render(<App />);
  expect(screen.getByRole("heading", { name: "pyXPCSViewer web" })).toBeTruthy();
  expect(await screen.findByText(/No service at api\/info/)).toBeTruthy();
});

test("shows the folder of a connected service", async () => {
  const info = {
    root: "/data/run42",
    version: "1.2.0",
    label_style: null,
    colormaps: ["viridis"],
    defaults: {},
  };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(info)));
  render(<App />);
  expect(await screen.findByText("Connected to /data/run42")).toBeTruthy();
  expect(screen.getByText("1.2.0")).toBeTruthy();
});
