// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/**
 * Geometry of the shapes: hit tests, handles, and the mask they cover. A pixel is covered when
 * its center is inside the shape, with the half-open rule `left <= x < right` along each
 * scanline so neighbouring shapes never claim a pixel twice; a server rasterizing the same
 * JSON must use the same rule.
 */

import type { EllipseShape, Point, PolygonShape, Shape } from "./types";

/** The even-odd rule. */
export function pointInPolygon(x: number, y: number, points: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const a = points[i]!;
    const b = points[j]!;
    if (a.y > y !== b.y > y) {
      const cross = a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y);
      if (x < cross) inside = !inside;
    }
  }
  return inside;
}

export function pointInEllipse(x: number, y: number, e: EllipseShape): boolean {
  if (e.rx <= 0 || e.ry <= 0) return false;
  const dx = (x - e.cx) / e.rx;
  const dy = (y - e.cy) / e.ry;
  return dx * dx + dy * dy <= 1;
}

export function pointInShape(x: number, y: number, shape: Shape): boolean {
  return shape.kind === "polygon"
    ? pointInPolygon(x, y, shape.points)
    : pointInEllipse(x, y, shape);
}

export interface Bounds {
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
}

export function shapeBounds(shape: Shape): Bounds {
  if (shape.kind === "ellipse") {
    return {
      xmin: shape.cx - shape.rx,
      xmax: shape.cx + shape.rx,
      ymin: shape.cy - shape.ry,
      ymax: shape.cy + shape.ry,
    };
  }
  const b: Bounds = { xmin: Infinity, xmax: -Infinity, ymin: Infinity, ymax: -Infinity };
  for (const p of shape.points) {
    b.xmin = Math.min(b.xmin, p.x);
    b.xmax = Math.max(b.xmax, p.x);
    b.ymin = Math.min(b.ymin, p.y);
    b.ymax = Math.max(b.ymax, p.y);
  }
  return b;
}

/** The points a user drags: a polygon's vertices; an ellipse's center, right and top. */
export function handlesOf(shape: Shape): Point[] {
  if (shape.kind === "polygon") return shape.points;
  return [
    { x: shape.cx, y: shape.cy },
    { x: shape.cx + shape.rx, y: shape.cy },
    { x: shape.cx, y: shape.cy + shape.ry },
  ];
}

/** The shape with handle `index` moved to `p`. */
export function withHandleAt(shape: Shape, index: number, p: Point): Shape {
  if (shape.kind === "polygon") {
    return { ...shape, points: shape.points.map((q, i) => (i === index ? p : q)) };
  }
  if (index === 0) return { ...shape, cx: p.x, cy: p.y };
  if (index === 1) return { ...shape, rx: Math.abs(p.x - shape.cx) };
  return { ...shape, ry: Math.abs(p.y - shape.cy) };
}

export function translated(shape: Shape, dx: number, dy: number): Shape {
  if (shape.kind === "polygon") {
    return { ...shape, points: shape.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
  }
  return { ...shape, cx: shape.cx + dx, cy: shape.cy + dy };
}

function fillSpan(
  mask: Uint8Array,
  cols: number,
  row: number,
  left: number,
  right: number,
  value: number,
) {
  // pixel centers at integers: covered when left <= x < right
  const c0 = Math.max(0, Math.ceil(left));
  const c1 = Math.min(cols - 1, Math.ceil(right) - 1);
  if (c0 <= c1) mask.fill(value, row * cols + c0, row * cols + c1 + 1);
}

function fillEllipse(mask: Uint8Array, rows: number, cols: number, e: EllipseShape, value: number) {
  if (e.rx <= 0 || e.ry <= 0) return;
  const r0 = Math.max(0, Math.ceil(e.cy - e.ry));
  const r1 = Math.min(rows - 1, Math.floor(e.cy + e.ry));
  for (let r = r0; r <= r1; r += 1) {
    const t = (r - e.cy) / e.ry;
    const half = e.rx * Math.sqrt(Math.max(0, 1 - t * t));
    // inside when (x - cx)^2 <= half^2: both ends inclusive
    const c0 = Math.max(0, Math.ceil(e.cx - half));
    const c1 = Math.min(cols - 1, Math.floor(e.cx + half));
    if (c0 <= c1) mask.fill(value, r * cols + c0, r * cols + c1 + 1);
  }
}

function fillPolygon(mask: Uint8Array, rows: number, cols: number, p: PolygonShape, value: number) {
  const pts = p.points;
  if (pts.length < 3) return;
  const b = shapeBounds(p);
  const r0 = Math.max(0, Math.ceil(b.ymin));
  const r1 = Math.min(rows - 1, Math.floor(b.ymax));
  const crossings: number[] = [];
  for (let r = r0; r <= r1; r += 1) {
    crossings.length = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
      const a = pts[i]!;
      const c = pts[j]!;
      if (a.y > r !== c.y > r) crossings.push(a.x + ((r - a.y) * (c.x - a.x)) / (c.y - a.y));
    }
    crossings.sort((u, v) => u - v);
    for (let k = 0; k + 1 < crossings.length; k += 2) {
      fillSpan(mask, cols, r, crossings[k]!, crossings[k + 1]!, value);
    }
  }
}

/** Marks the pixels of `mask` (rows × cols, row-major) whose center the shape covers. */
export function fillShape(mask: Uint8Array, rows: number, cols: number, shape: Shape, value = 1) {
  if (shape.kind === "ellipse") fillEllipse(mask, rows, cols, shape, value);
  else fillPolygon(mask, rows, cols, shape, value);
}

/** The mask of the shapes: 1 where any shape covers the pixel's center. */
export function rasterize(shapes: readonly Shape[], rows: number, cols: number): Uint8Array {
  const mask = new Uint8Array(rows * cols);
  for (const shape of shapes) fillShape(mask, rows, cols, shape);
  return mask;
}
