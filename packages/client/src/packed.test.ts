// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import { expect, test } from "vitest";

import { unpackFlat, unpackNumbers, unpackRows } from "./packed";

function pack(values: number[], dtype: "f4" | "i4", shape: number[]) {
  const typed = dtype === "f4" ? new Float32Array(values) : new Int32Array(values);
  return { dtype, bdata: btoa(String.fromCharCode(...new Uint8Array(typed.buffer))), shape };
}

test("a packed float32 array unpacks flat, as rows and as numbers", () => {
  const packed = pack([1, 2, 3, 4, 5, 6], "f4", [2, 3]);
  expect(Array.from(unpackFlat(packed) as Float32Array)).toEqual([1, 2, 3, 4, 5, 6]);
  const rows = unpackRows(packed);
  expect(rows).toHaveLength(2);
  expect(Array.from(rows[1] as Float32Array)).toEqual([4, 5, 6]);
  expect(unpackNumbers(packed)).toEqual([1, 2, 3, 4, 5, 6]);
  expect(unpackFlat(pack([7, -8], "i4", [2]))).toBeInstanceOf(Int32Array);
  expect(() => unpackFlat({ dtype: "c8", bdata: "", shape: [0] })).toThrow(/unknown packed dtype/);
});
