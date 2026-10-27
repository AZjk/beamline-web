// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import { expect, it } from "vitest";

import { oriented } from "./ArrayImage";

it("reverses rows and columns for flipped axes, and keeps the array otherwise", () => {
  const data = new Float32Array([1, 2, 3, 4, 5, 6]); // 2 rows × 3 columns
  expect(oriented(data, 2, 3, false, false)).toBe(data);
  expect(Array.from(oriented(data, 2, 3, false, true))).toEqual([4, 5, 6, 1, 2, 3]);
  expect(Array.from(oriented(data, 2, 3, true, false))).toEqual([3, 2, 1, 6, 5, 4]);
  expect(Array.from(oriented(data, 2, 3, true, true))).toEqual([6, 5, 4, 3, 2, 1]);
  expect(oriented(new Uint8Array([1, 2]), 1, 2, true, false)).toBeInstanceOf(Uint8Array);
});
