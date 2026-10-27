// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import { describe, expect, it } from "vitest";

import {
  handlesOf,
  mirroredX,
  pointInEllipse,
  pointInPolygon,
  pointInRect,
  pointInShape,
  rasterize,
  shapeBounds,
  translated,
  withHandleAt,
} from "./geometry";
import type { EllipseShape, Point, PolygonShape, RectShape, Shape } from "./types";

const square: PolygonShape = {
  id: "sq",
  kind: "polygon",
  points: [
    { x: 2, y: 2 },
    { x: 6, y: 2 },
    { x: 6, y: 6 },
    { x: 2, y: 6 },
  ],
};
const ellipse: EllipseShape = { id: "el", kind: "ellipse", cx: 10, cy: 8, rx: 4, ry: 2 };

/** The mask every pixel center would get from the point tests. */
function bruteForce(shapes: Shape[], rows: number, cols: number) {
  const mask = new Uint8Array(rows * cols);
  for (let r = 0; r < rows; r += 1)
    for (let c = 0; c < cols; c += 1)
      if (shapes.some((s) => pointInShape(c, r, s))) mask[r * cols + c] = 1;
  return mask;
}

function count(mask: Uint8Array) {
  let n = 0;
  for (const v of mask) n += v;
  return n;
}

/** A deterministic pseudo-random polygon (no Math.random: a failure must reproduce). */
function jaggedPolygon(n: number, seed: number): Point[] {
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  const points: Point[] = [];
  for (let i = 0; i < n; i += 1) {
    const angle = (2 * Math.PI * i) / n;
    const radius = 8 + 12 * rand();
    points.push({ x: 25 + radius * Math.cos(angle), y: 20 + radius * Math.sin(angle) });
  }
  return points;
}

describe("point tests", () => {
  it("even-odd rule with half-open edges", () => {
    expect(pointInPolygon(4, 4, square.points)).toBe(true);
    expect(pointInPolygon(2, 4, square.points)).toBe(true); // the left edge is in
    expect(pointInPolygon(6, 4, square.points)).toBe(false); // the right edge is out
    expect(pointInPolygon(7, 4, square.points)).toBe(false);
    expect(pointInPolygon(4, 2, square.points)).toBe(true); // the bottom edge (ymin) is in
    expect(pointInPolygon(4, 6, square.points)).toBe(false);
  });

  it("ellipse by the normalized radius", () => {
    expect(pointInEllipse(10, 8, ellipse)).toBe(true);
    expect(pointInEllipse(14, 8, ellipse)).toBe(true);
    expect(pointInEllipse(14.01, 8, ellipse)).toBe(false);
    expect(pointInEllipse(10, 10.5, ellipse)).toBe(false);
    expect(pointInEllipse(10, 8, { ...ellipse, rx: 0 })).toBe(false);
  });
});

describe("rasterize", () => {
  it("fills the square: 4 by 4 pixels with the half-open rule", () => {
    const mask = rasterize([square], 10, 10);
    expect(count(mask)).toBe(16);
    expect(mask[4 * 10 + 2]).toBe(1);
    expect(mask[4 * 10 + 6]).toBe(0);
    expect(mask[6 * 10 + 4]).toBe(0);
  });

  it("agrees with the point tests on a jagged polygon and an ellipse", () => {
    const shapes: Shape[] = [
      { id: "j", kind: "polygon", points: jaggedPolygon(9, 7) },
      { id: "e", kind: "ellipse", cx: 12.3, cy: 30.7, rx: 7.5, ry: 4.2 },
    ];
    const mask = rasterize(shapes, 50, 60);
    expect(count(mask)).toBeGreaterThan(100);
    expect(Array.from(mask)).toEqual(Array.from(bruteForce(shapes, 50, 60)));
  });

  it("clips to the array and ignores degenerate shapes", () => {
    const mask = rasterize(
      [
        { id: "e", kind: "ellipse", cx: 0, cy: 0, rx: 3, ry: 3 },
        { id: "p", kind: "polygon", points: [{ x: 1, y: 1 }] },
      ],
      5,
      5,
    );
    expect(mask[0]).toBe(1);
    expect(count(mask)).toBe(
      bruteForce([{ id: "e", kind: "ellipse", cx: 0, cy: 0, rx: 3, ry: 3 }], 5, 5).reduce(
        (a, b) => a + b,
        0,
      ),
    );
  });

  it("handles a detector-sized frame in a fraction of a second", () => {
    const rows = 2162;
    const cols = 2068;
    const points: Point[] = [];
    for (let i = 0; i < 12; i += 1) {
      const angle = (2 * Math.PI * i) / 12;
      points.push({ x: 1034 + 900 * Math.cos(angle), y: 1081 + 950 * Math.sin(angle) });
    }
    const shapes: Shape[] = [
      { id: "p", kind: "polygon", points },
      { id: "e", kind: "ellipse", cx: 1034, cy: 1081, rx: 300, ry: 200 },
    ];
    const start = performance.now();
    const mask = rasterize(shapes, rows, cols);
    const ms = performance.now() - start;
    expect(count(mask)).toBeGreaterThan(1_000_000);
    expect(ms).toBeLessThan(1000);
  });
});

describe("handles", () => {
  it("polygon vertices move one at a time", () => {
    expect(handlesOf(square)).toHaveLength(4);
    const moved = withHandleAt(square, 1, { x: 8, y: 2 }) as PolygonShape;
    expect(moved.points[1]).toEqual({ x: 8, y: 2 });
    expect(moved.points[0]).toEqual({ x: 2, y: 2 });
  });

  it("ellipse handles: center, then the semi-axes", () => {
    expect(handlesOf(ellipse)).toEqual([
      { x: 10, y: 8 },
      { x: 14, y: 8 },
      { x: 10, y: 10 },
    ]);
    expect(withHandleAt(ellipse, 0, { x: 1, y: 1 })).toMatchObject({ cx: 1, cy: 1, rx: 4, ry: 2 });
    expect(withHandleAt(ellipse, 1, { x: 4, y: 8 })).toMatchObject({ rx: 6 });
    expect(withHandleAt(ellipse, 2, { x: 10, y: 9 })).toMatchObject({ ry: 1 });
  });

  it("translation and bounds", () => {
    expect(shapeBounds(translated(ellipse, 1, -1))).toEqual({
      xmin: 7,
      xmax: 15,
      ymin: 5,
      ymax: 9,
    });
    expect(shapeBounds(translated(square, 1, 1))).toEqual({ xmin: 3, xmax: 7, ymin: 3, ymax: 7 });
  });
});

describe("rects", () => {
  const box: RectShape = { id: "b", kind: "rect", x0: 2, x1: 6, y0: 1, y1: 4 };

  it("half-open like the polygon rule, and the same mask as its polygon", () => {
    expect(pointInRect(2, 1, box)).toBe(true);
    expect(pointInRect(6, 1, box)).toBe(false);
    expect(pointInRect(3, 4, box)).toBe(false);
    const asPolygon: PolygonShape = {
      id: "p",
      kind: "polygon",
      points: [
        { x: 2, y: 1 },
        { x: 6, y: 1 },
        { x: 6, y: 4 },
        { x: 2, y: 4 },
      ],
    };
    expect(Array.from(rasterize([box], 8, 8))).toEqual(Array.from(rasterize([asPolygon], 8, 8)));
    expect(rasterize([box], 8, 8).reduce<number>((n, v) => n + v, 0)).toBe(12);
  });

  it("corner handles keep the opposite corner and the order", () => {
    expect(handlesOf(box)).toHaveLength(4);
    const dragged = withHandleAt(box, 2, { x: 1, y: 0 }) as RectShape; // the (x1, y1) corner past (x0, y0)
    expect([dragged.x0, dragged.x1, dragged.y0, dragged.y1]).toEqual([1, 2, 0, 1]);
    expect(translated(box, 1, 1)).toMatchObject({ x0: 3, x1: 7, y0: 2, y1: 5 });
    expect(mirroredX(box)).toMatchObject({ x0: -6, x1: -2, y0: 1, y1: 4 });
    expect(mirroredX(mirroredX(box))).toEqual(box);
    expect(shapeBounds(box)).toEqual({ xmin: 2, xmax: 6, ymin: 1, ymax: 4 });
  });
});
