// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/**
 * The geometry of a sent image: a detector map downsampled by an integer `factor`, with `x0`
 * and `y0` the centers of its first column and row in detector pixels (as the image routes of
 * the tools describe it).
 */

export interface Sampling {
  factor: number;
  x0: number;
  y0: number;
  rows: number;
  cols: number;
}

/** The data coordinates of the outer edges of the sent pixels. */
export function sampledExtent({ factor, x0, y0, rows, cols }: Sampling) {
  const half = factor / 2;
  return {
    xmin: x0 - half,
    xmax: x0 + (cols - 1) * factor + half,
    ymin: y0 - half,
    ymax: y0 + (rows - 1) * factor + half,
  };
}

/** The sent pixel (row, column) under detector coordinates (x, y), or null outside the array. */
export function sampledIndex(
  { factor, x0, y0, rows, cols }: Sampling,
  x: number,
  y: number,
): [number, number] | null {
  const col = Math.round((x - x0) / factor) + 0; // + 0: never a negative zero
  const row = Math.round((y - y0) / factor) + 0;
  if (col < 0 || col >= cols || row < 0 || row >= rows) return null;
  return [row, col];
}

/** The value of a row-major array at (row, col). */
export function valueAt(data: ArrayLike<number>, cols: number, row: number, col: number): number {
  return data[row * cols + col] ?? Number.NaN;
}

/** A first color range for an image: the data's own finite range. */
export function finiteRange(data: ArrayLike<number>): [number, number] | undefined {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < data.length; i += 1) {
    const v = data[i]!;
    if (Number.isFinite(v)) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  return lo <= hi ? [lo, hi] : undefined;
}
