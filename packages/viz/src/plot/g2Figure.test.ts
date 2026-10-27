// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import { expect, test } from "vitest";

import { column, g2Figure, type G2SeriesInput } from "./g2Figure";

function series(label: string, nq = 3, nt = 4, fit = false): G2SeriesInput {
  const t = [1e-4, 1e-3, 1e-2, 1e-1];
  const g2 = new Float32Array(nt * nq);
  for (let i = 0; i < nt; i += 1)
    for (let n = 0; n < nq; n += 1) g2[i * nq + n] = 1 + 0.2 * Math.exp(-t[i]! * 100 * (n + 1));
  return {
    label,
    q: [0.01, 0.02, 0.03].slice(0, nq),
    labels: ["qbin=1, q=0.01", "qbin=2, q=0.02", "qbin=3, q=0.03"].slice(0, nq),
    t,
    g2,
    err: new Float32Array(nt * nq).fill(0.01),
    fit: fit
      ? {
          fitX: [1e-4, 1e-1],
          fitY: new Float32Array(nq * 2).fill(1.1),
          nx: 2,
          success: [true, false, true],
          params: [[0.2, 0.01, 1, 1.05], null, [0.2, 0.01, 1, 0.95]],
        }
      : null,
  };
}

test("column reads a delays × q-bins array", () => {
  expect(column([1, 2, 3, 4, 5, 6], 2, 3, 1)).toEqual([2, 5]);
});

test("by q: one panel per q-bin, one legend entry per file", () => {
  const fig = g2Figure([series("a"), series("b")], { mode: "q", cols: 2 });
  expect(fig.rows).toBe(2);
  expect(fig.data).toHaveLength(6);
  expect(fig.data.filter((d) => d.showlegend)).toHaveLength(2);
  expect(fig.data[0]!.xaxis).toBe("x");
  expect(fig.data[1]!.xaxis).toBe("x2");
  expect((fig.layout as { annotations: { text: string }[] }).annotations[0]!.text).toBe(
    "q=0.01  ·  bin 1",
  );
});

test("fits add a line per successful bin and the baseline is subtracted", () => {
  const fig = g2Figure([series("a", 3, 4, true)], {
    mode: "file",
    showFit: true,
    subtractBaseline: true,
  });
  const lines = fig.data.filter((d) => d.mode === "lines");
  expect(lines).toHaveLength(2);
  const first = fig.data[0]!;
  // the first bin's baseline 1.05 is shifted to 1: the points move down by 0.05
  expect((first.y as number[])[3]).toBeCloseTo(1 + 0.2 * Math.exp(-0.1 * 100) - 0.05, 6);
  expect((lines[0]!.y as number[])[0]).toBeCloseTo(1.1 - 0.05, 6);
});

test("combined: everything in one panel, an offset per file", () => {
  const fig = g2Figure([series("a"), series("b")], { mode: "combined", offset: 0.5 });
  expect(new Set(fig.data.map((d) => d.xaxis)).size).toBe(1);
  expect((fig.data[3]!.y as number[])[0]! - (fig.data[0]!.y as number[])[0]!).toBeCloseTo(0.5, 6);
  expect(g2Figure([]).data).toEqual([]);
});
