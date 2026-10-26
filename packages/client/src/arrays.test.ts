// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import { describe, expect, test } from "vitest";

import { DTYPE_HEADER, SHAPE_HEADER, decodeArray, parseShape } from "./arrays";

function body(values: number[]): ArrayBuffer {
  return new Float32Array(values).buffer;
}

describe("decodeArray", () => {
  test("reads a 2-d float32 array from a plain header record", () => {
    const out = decodeArray(body([1, 2, 3, 4, 5, 6]), {
      [SHAPE_HEADER]: "2,3",
      [DTYPE_HEADER]: "f4",
    });
    expect(out.shape).toEqual([2, 3]);
    expect(out.dtype).toBe("f4");
    expect(out.data).toBeInstanceOf(Float32Array);
    expect(out.data[4]).toBe(5);
  });

  test("accepts Headers and canonical header spelling", () => {
    const headers = new Headers({ "X-Array-Shape": "3", "X-Array-Dtype": "f4" });
    expect(decodeArray(body([7, 8, 9]), headers).shape).toEqual([3]);
    expect(
      decodeArray(body([7, 8, 9]), { "X-Array-Shape": "3", "X-Array-Dtype": "f4" }).shape,
    ).toEqual([3]);
  });

  test("a scalar has an empty shape and one element", () => {
    const out = decodeArray(new Float64Array([2.5]).buffer, {
      [SHAPE_HEADER]: "",
      [DTYPE_HEADER]: "f8",
    });
    expect(out.shape).toEqual([]);
    expect(out.data[0]).toBe(2.5);
  });

  test("64-bit integers become BigInt arrays", () => {
    const out = decodeArray(new BigInt64Array([1n, -2n]).buffer, {
      [SHAPE_HEADER]: "2",
      [DTYPE_HEADER]: "i8",
    });
    expect(out.data).toBeInstanceOf(BigInt64Array);
    expect(out.data[1]).toBe(-2n);
  });

  test("rejects a body of the wrong size, a bad dtype and missing headers", () => {
    expect(() => decodeArray(body([1, 2]), { [SHAPE_HEADER]: "3", [DTYPE_HEADER]: "f4" })).toThrow(
      /expected 12/,
    );
    expect(() => decodeArray(body([1]), { [SHAPE_HEADER]: "1", [DTYPE_HEADER]: "c8" })).toThrow(
      /unknown array dtype/,
    );
    expect(() => decodeArray(body([1]), {})).toThrow(/not an array response/);
  });
});

test("the meta header is parsed, and absent when the response has none", () => {
  const headers = new Headers({
    "X-Array-Shape": "2",
    "X-Array-Dtype": "f4",
    "X-Array-Meta": '{"factor":3,"x0":1.0}',
  });
  const out = decodeArray<{ factor: number; x0: number }>(body([1, 2]), headers);
  expect(out.meta).toEqual({ factor: 3, x0: 1 });
  expect(decodeArray(body([1, 2]), { [SHAPE_HEADER]: "2", [DTYPE_HEADER]: "f4" }).meta).toBeNull();
});

test("parseShape", () => {
  expect(parseShape("2162,2068")).toEqual([2162, 2068]);
  expect(parseShape(" 4 ")).toEqual([4]);
  expect(parseShape("")).toEqual([]);
  expect(() => parseShape("2,x")).toThrow(/bad array shape/);
});
