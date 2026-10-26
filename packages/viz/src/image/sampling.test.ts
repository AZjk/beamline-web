// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import { expect, test } from "vitest";

import { finiteRange, sampledExtent, sampledIndex, valueAt } from "./sampling";

test("a factor-3 image covers the detector from half a sent pixel before its first center", () => {
  const sampling = { factor: 3, x0: 1, y0: 1, rows: 720, cols: 689 };
  expect(sampledExtent(sampling)).toEqual({ xmin: -0.5, xmax: 2066.5, ymin: -0.5, ymax: 2159.5 });
  expect(sampledIndex(sampling, 0, 0)).toEqual([0, 0]);
  expect(sampledIndex(sampling, 2066, 2159)).toEqual([719, 688]);
  expect(sampledIndex(sampling, 2068, 0)).toBeNull();
  expect(sampledIndex(sampling, 4, 7)).toEqual([2, 1]);
});

test("a region at full resolution starts at its own offset", () => {
  const sampling = { factor: 1, x0: 10, y0: 20, rows: 50, cols: 100 };
  expect(sampledExtent(sampling)).toEqual({ xmin: 9.5, xmax: 109.5, ymin: 19.5, ymax: 69.5 });
  expect(sampledIndex(sampling, 9, 20)).toBeNull();
  expect(sampledIndex(sampling, 10, 20)).toEqual([0, 0]);
});

test("values and ranges", () => {
  const data = new Float32Array([1, 2, Number.NaN, 4]);
  expect(valueAt(data, 2, 1, 1)).toBe(4);
  expect(finiteRange(data)).toEqual([1, 4]);
  expect(finiteRange(new Float32Array([Number.NaN]))).toBeUndefined();
});
