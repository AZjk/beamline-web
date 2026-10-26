// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/**
 * Arrays on the wire, as `beamline_webkit.arrays.array_response` sends them: the raw
 * little-endian bytes in the body, the shape and dtype in two headers. The bytes become a
 * typed array with no copy and no base64. Typed arrays use the platform's byte order, which is
 * little-endian on every platform a browser runs on.
 */

import { errorFrom } from "./errors";

export const SHAPE_HEADER = "x-array-shape";
export const DTYPE_HEADER = "x-array-dtype";
/** A little JSON describing the array (a sampling factor, an offset, a color range). */
export const META_HEADER = "x-array-meta";

export type DtypeCode = "i1" | "u1" | "i2" | "u2" | "i4" | "u4" | "i8" | "u8" | "f4" | "f8";

export type TypedArray =
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | BigInt64Array
  | BigUint64Array
  | Float32Array
  | Float64Array;

const CONSTRUCTORS = {
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
} as const;

export interface WireArray<T extends TypedArray = TypedArray, M = unknown> {
  /** The values, row-major (C order). */
  data: T;
  /** The array's shape; `[]` for a scalar. */
  shape: number[];
  dtype: DtypeCode;
  /** The `X-Array-Meta` JSON, when the response carries one. */
  meta: M | null;
}

/** `"2162,2068"` → `[2162, 2068]`; `""` → `[]`. */
export function parseShape(text: string): number[] {
  const parts = text
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const shape = parts.map(Number);
  if (shape.some((n) => !Number.isInteger(n) || n < 0)) {
    throw new Error(`bad array shape header: "${text}"`);
  }
  return shape;
}

function header(headers: Headers | Record<string, string>, name: string): string | null {
  if (headers instanceof Headers) return headers.get(name);
  return headers[name] ?? headers[name.toUpperCase()] ?? headers[canonical(name)] ?? null;
}

function canonical(name: string): string {
  return name.replace(/(^|-)([a-z])/g, (_match, sep: string, c: string) => sep + c.toUpperCase());
}

/** The array of a binary response: its body and headers. */
export function decodeArray<M = unknown>(
  buffer: ArrayBuffer,
  headers: Headers | Record<string, string>,
): WireArray<TypedArray, M> {
  const dtype = header(headers, DTYPE_HEADER);
  const shapeText = header(headers, SHAPE_HEADER);
  if (dtype === null || shapeText === null) {
    throw new Error(`not an array response: missing ${DTYPE_HEADER} or ${SHAPE_HEADER}`);
  }
  const ctor = CONSTRUCTORS[dtype as DtypeCode];
  if (!ctor) throw new Error(`unknown array dtype "${dtype}"`);
  const shape = parseShape(shapeText);
  const count = shape.reduce((product, n) => product * n, 1);
  const expected = count * ctor.BYTES_PER_ELEMENT;
  if (buffer.byteLength !== expected) {
    throw new Error(
      `array body has ${buffer.byteLength} bytes, expected ${expected} for shape [${shape}] ${dtype}`,
    );
  }
  const metaText = header(headers, META_HEADER);
  const meta = metaText === null ? null : (JSON.parse(metaText) as M);
  return { data: new ctor(buffer), shape, dtype: dtype as DtypeCode, meta };
}

/** Fetch a binary array endpoint. Rejects with an `ApiError` on a non-2xx answer. `M` types the meta. */
export async function fetchArray<M = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<WireArray<TypedArray, M>> {
  const response = await fetch(input, init);
  if (!response.ok) throw await errorFrom(response);
  return decodeArray<M>(await response.arrayBuffer(), response.headers);
}
