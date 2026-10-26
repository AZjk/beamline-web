// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import { expect, test } from "vitest";

import { COLORMAPS, h5webColorMap, orderedColor, sampleScale, seriesColor } from "./colormaps";

test("every named map has an H5Web map, and an unknown name falls back to viridis", () => {
  for (const name of COLORMAPS) expect(h5webColorMap(name).colorMap).toBeTruthy();
  expect(h5webColorMap("nope").colorMap).toBe("Viridis");
  expect(h5webColorMap("gray")).toEqual({ colorMap: "Greys", invert: true });
});

test("color scales sample and series colors cycle", () => {
  const scale: [number, string][] = [
    [0, "rgb(0,0,0)"],
    [1, "rgb(200,100,0)"],
  ];
  expect(sampleScale(scale, 0.5)).toBe("rgb(100,50,0)");
  expect(orderedColor(0, 1, scale)).toBe("rgb(100,50,0)");
  expect(seriesColor(8)).toBe(seriesColor(0));
  expect(seriesColor(-1)).toBe(seriesColor(7));
});
