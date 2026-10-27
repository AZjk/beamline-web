// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/**
 * Shapes drawn over an array, in data coordinates (detector pixels: a pixel's center sits at
 * integer coordinates; or the units of a remapped view). The JSON of a shape list is the ROI
 * wire format the tools exchange.
 */

export interface Point {
  x: number;
  y: number;
}

export interface PolygonShape {
  id: string;
  kind: "polygon";
  points: Point[];
}

/** An axis-aligned ellipse: center and semi-axes. */
export interface EllipseShape {
  id: string;
  kind: "ellipse";
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

/** An axis-aligned box: x0 <= x1, y0 <= y1. */
export interface RectShape {
  id: string;
  kind: "rect";
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export type Shape = PolygonShape | EllipseShape | RectShape;

export type ShapeTool = "select" | "polygon" | "ellipse" | "rect";

/** How an app draws one shape: its color, a label at its top left, dotted when disabled, and
 * a twin reflected in x (x → −x) drawn dashed, which is not editable. */
export interface ShapeStyle {
  color?: string;
  label?: string;
  dashed?: boolean;
  mirrorX?: boolean;
}
