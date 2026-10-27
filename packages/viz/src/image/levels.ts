// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/**
 * Color levels from the array itself, so a contrast change never asks the server: the finite
 * values sorted once, then any percentile of them (or of the positive ones, for a log scale).
 */

/** The finite values of `data`, ascending. */
export function sortedFinite(data: ArrayLike<number>): Float64Array {
  const out = new Float64Array(data.length);
  let n = 0;
  for (let i = 0; i < data.length; i += 1) {
    const v = data[i]!;
    if (Number.isFinite(v)) out[n++] = v;
  }
  return out.subarray(0, n).sort();
}

/** The part of a sorted array above zero. */
export function positivePart(sorted: Float64Array): Float64Array {
  let i = 0;
  while (i < sorted.length && sorted[i]! <= 0) i += 1;
  return sorted.subarray(i);
}

/** The value at percentile `p` (0 to 100) of a sorted array, interpolated; NaN of an empty one. */
export function percentile(sorted: Float64Array, p: number): number {
  if (!sorted.length) return Number.NaN;
  const at = (Math.min(100, Math.max(0, p)) / 100) * (sorted.length - 1);
  const lo = Math.floor(at);
  const hi = Math.min(sorted.length - 1, lo + 1);
  const t = at - lo;
  return sorted[lo]! * (1 - t) + sorted[hi]! * t;
}

/** `[low, high]` levels at two percentiles of the finite values (of the positive ones when
 * `log`), a sensible pair when they coincide, `null` without values. */
export function levelsAt(
  sorted: Float64Array,
  low: number,
  high: number,
  log = false,
): [number, number] | null {
  const values = log ? positivePart(sorted) : sorted;
  if (!values.length) return null;
  const lo = percentile(values, low);
  let hi = percentile(values, high);
  if (!(hi > lo)) {
    if (log) {
      hi = lo * 1.001;
    } else {
      hi = lo + 1;
    }
  }
  return [lo, hi];
}
