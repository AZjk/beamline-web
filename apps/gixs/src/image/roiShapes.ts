// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/** The box ROIs of a view as the kit's rect shapes (open ends taken to the image's edge) and back. */

import { seriesColor, type RectShape, type ShapeStyle } from "@beamline-web/viz";

import type { Roi, ViewInfo } from "../api/client";

export interface Extent {
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
}

export function shapesOf(boxes: Roi[], view: ViewInfo, extent: Extent) {
  const shapes: RectShape[] = [];
  const styles: Record<string, ShapeStyle> = {};
  boxes.forEach((roi, index) => {
    if (roi.x_map !== view.x_map || roi.y_map !== view.y_map) return;
    shapes.push({
      id: roi.id,
      kind: "rect",
      x0: roi.x0 ?? extent.xmin,
      x1: roi.x1 ?? extent.xmax,
      y0: roi.y0 ?? extent.ymin,
      y1: roi.y1 ?? extent.ymax,
    });
    styles[roi.id] = {
      color: seriesColor(index),
      label: roi.name || roi.id,
      dashed: roi.enabled === false,
      mirrorX: Boolean(roi.mirror),
    };
  });
  return { shapes, styles };
}

const round = (v: number) => Number(v.toPrecision(6));

/** The ROI with the box's edges; an edge still at the image's edge stays open. */
export function roiWithShape(roi: Roi, rect: RectShape, extent: Extent): Roi {
  const edge = (value: number, open: number | null | undefined, limit: number) =>
    open === null || open === undefined
      ? Math.abs(value - limit) < 1e-9
        ? null
        : round(value)
      : round(value);
  return {
    ...roi,
    x0: edge(rect.x0, roi.x0, extent.xmin),
    x1: edge(rect.x1, roi.x1, extent.xmax),
    y0: edge(rect.y0, roi.y0, extent.ymin),
    y1: edge(rect.y1, roi.y1, extent.ymax),
  };
}

export function sameRect(a: RectShape, b: RectShape): boolean {
  return a.x0 === b.x0 && a.x1 === b.x1 && a.y0 === b.y0 && a.y1 === b.y1;
}
