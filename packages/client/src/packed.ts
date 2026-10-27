// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/**
 * The packed arrays of the JSON routes: `{dtype, bdata, shape}` with the little-endian bytes in
 * base64 (the format the tools' JSON payloads use for arrays too small for a binary route).
 */

import type { DtypeCode, TypedArray } from "./arrays";

export interface PackedArray {
  dtype: DtypeCode | string;
  bdata: string;
  shape: number[];
}

const CONSTRUCTORS: Record<string, new (buffer: ArrayBuffer) => TypedArray> = {
  i1: Int8Array,
  u1: Uint8Array,
  i2: Int16Array,
  u2: Uint16Array,
  i4: Int32Array,
  u4: Uint32Array,
  i8: BigInt64Array,
  u8: BigUint64Array,
  f4: Float32Array,
  f8: Float64Array,
};

function bytesOf(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/** A packed array as one flat typed array. */
export function unpackFlat(packed: PackedArray): TypedArray {
  const ctor = CONSTRUCTORS[packed.dtype];
  if (!ctor) throw new Error(`unknown packed dtype "${packed.dtype}"`);
  return new ctor(bytesOf(packed.bdata));
}

/** A 2-D packed array as its rows (typed-array views, no copy). */
export function unpackRows(packed: PackedArray): TypedArray[] {
  const flat = unpackFlat(packed);
  const [rows = 1, cols = flat.length] = packed.shape;
  const out: TypedArray[] = [];
  for (let i = 0; i < rows; i += 1) out.push(flat.subarray(i * cols, (i + 1) * cols) as TypedArray);
  return out;
}

/** A packed array as plain numbers (NaN kept), for a Plotly trace. */
export function unpackNumbers(packed: PackedArray): number[] {
  return Array.from(unpackFlat(packed) as ArrayLike<number>, Number);
}
