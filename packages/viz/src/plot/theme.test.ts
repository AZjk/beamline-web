// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import { expect, test } from "vitest";

import {
  grid,
  heightFor,
  logAxis,
  logTicks,
  outerLegend,
  positiveExtent,
  withAlpha,
} from "./theme";

test("a grid of three panels in two columns", () => {
  const g = grid(3, 2, { titles: ["a", "b", "c"] });
  expect(g.rows).toBe(2);
  expect(g.panels.map((p) => [p.x, p.y])).toEqual([
    ["x", "y"],
    ["x2", "y2"],
    ["x3", "y3"],
  ]);
  expect(g.panels[2]!.row).toBe(1);
  expect(g.layout.annotations).toHaveLength(3);
  const xa = g.layout.xaxis as { domain: [number, number]; anchor: string };
  expect(xa.anchor).toBe("y");
  expect(xa.domain[0]).toBe(0);
  const xb = g.layout.xaxis2 as { domain: [number, number] };
  expect(xb.domain[1]).toBeCloseTo(1);
});

test("log axes, ticks, extents, legends and heights", () => {
  expect(logAxis({ range: [1e-3, 1e3] }).range).toEqual([-3, 3]);
  expect(logTicks(1e-3, 1e3)).toEqual({ dtick: 1 });
  expect(logTicks(1, 5)).toEqual({ dtick: "D2" });
  expect(positiveExtent([[0, -1, 2, 8], new Float32Array([0.5, Number.NaN])])).toEqual([0.5, 8]);
  expect(positiveExtent([[0, -1]])).toBeNull();
  expect(outerLegend(2).marginTop).toBe(36);
  expect(outerLegend(12).marginRight).toBe(135);
  expect(heightFor(300, 1)).toBe(296);
  expect(heightFor(300, 4, 220)).toBe(940);
  expect(withAlpha("#2a78d6", 0.5)).toBe("rgba(42,120,214,0.5)");
});
