// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import { expect, it } from "vitest";

import { levelsAt, percentile, positivePart, sortedFinite } from "./levels";

it("sorts the finite values and interpolates percentiles", () => {
  const sorted = sortedFinite(
    new Float32Array([3, Number.NaN, -1, 0, 2, Number.POSITIVE_INFINITY, 1]),
  );
  expect(Array.from(sorted)).toEqual([-1, 0, 1, 2, 3]);
  expect(percentile(sorted, 0)).toBe(-1);
  expect(percentile(sorted, 100)).toBe(3);
  expect(percentile(sorted, 50)).toBe(1);
  expect(percentile(sorted, 62.5)).toBeCloseTo(1.5);
  expect(Array.from(positivePart(sorted))).toEqual([1, 2, 3]);
  expect(levelsAt(sorted, 1, 99.8)).toEqual([expect.closeTo(-0.96, 5), expect.closeTo(2.992, 5)]);
  expect(levelsAt(sorted, 0, 100, true)).toEqual([1, 3]);
  expect(levelsAt(new Float64Array(0), 1, 99)).toBeNull();
  expect(levelsAt(sortedFinite([5, 5, 5]), 1, 99)).toEqual([5, 6]);
});
