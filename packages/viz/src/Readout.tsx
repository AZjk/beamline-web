// Copyright © UChicago Argonne LLC
// See LICENSE file for details

export interface ReadoutProps {
  /** Cursor position in data coordinates; undefined when the cursor is off the image. */
  x?: number;
  y?: number;
  /** The value under the cursor. */
  value?: number;
  /** Decimal places for the position. */
  precision?: number;
}

function format(value: number | undefined, precision: number): string {
  return value === undefined || Number.isNaN(value) ? "–" : value.toFixed(precision);
}

/**
 * The cursor readout under a detector image: position and value, with no server round trip.
 * Phase 1 adds the q and phi columns the tool supplies.
 */
export function Readout({ x, y, value, precision = 1 }: ReadoutProps) {
  const cells: [string, string][] = [
    ["x", format(x, precision)],
    ["y", format(y, precision)],
    ["value", format(value, 3)],
  ];
  return (
    <dl className="flex gap-4 font-mono text-sm" aria-label="cursor readout">
      {cells.map(([label, text]) => (
        <div key={label} className="flex gap-1">
          <dt className="text-neutral-500">{label}</dt>
          <dd>{text}</dd>
        </div>
      ))}
    </dl>
  );
}
