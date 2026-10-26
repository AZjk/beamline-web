// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/** A compact number: `digits` significant digits, trailing zeros dropped, a dash for none. */
export function fmt(x: number | null | undefined, digits = 4): string {
  if (x === null || x === undefined || Number.isNaN(x)) return "–";
  if (x === 0) return "0";
  const abs = Math.abs(x);
  if (abs >= 1e5 || abs < 1e-3)
    return Number(x)
      .toExponential(digits - 1)
      .replace(/\.?0+e/, "e");
  return String(parseFloat(Number(x).toPrecision(digits)));
}

/** The ordered pair of two numbers, or null when either is missing. */
export function range(
  a: number | null | undefined,
  b: number | null | undefined,
): [number, number] | null {
  if (
    a === null ||
    b === null ||
    a === undefined ||
    b === undefined ||
    Number.isNaN(a) ||
    Number.isNaN(b)
  )
    return null;
  return a <= b ? [a, b] : [b, a];
}
