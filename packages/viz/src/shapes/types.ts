// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/**
 * Shapes drawn over an array, in data coordinates (detector pixels: a pixel's center sits at
 * integer coordinates). The JSON of a shape list is the ROI wire format the tools exchange.
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

export type Shape = PolygonShape | EllipseShape;

export type ShapeTool = "select" | "polygon" | "ellipse";
