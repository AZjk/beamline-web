// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import "@h5web/lib/styles.css";

export {
  COLORMAPS,
  SERIES,
  h5webColorMap,
  orderedColor,
  sampleScale,
  seriesColor,
} from "./colormaps";
export type { ColorStop, ColormapName, H5WebColorMap } from "./colormaps";
export { ArrayImage, toNdArray } from "./image/ArrayImage";
export type { ArrayImageProps, ImageExtent, ImageScale } from "./image/ArrayImage";
export { DetectorImage } from "./image/DetectorImage";
export { DataOverlays } from "./image/DataOverlays";
export type { OverlayItem } from "./image/DataOverlays";
export { OverlayMesh } from "./image/OverlayMesh";
export type { OverlayMeshProps } from "./image/OverlayMesh";
export type { DetectorImageProps, LabelOverlay } from "./image/DetectorImage";
export { levelsAt, percentile, positivePart, sortedFinite } from "./image/levels";
export { finiteRange, sampledExtent, sampledIndex, valueAt } from "./image/sampling";
export type { Sampling } from "./image/sampling";
export {
  fillShape,
  handlesOf,
  mirroredX,
  normalizedRect,
  pointInEllipse,
  pointInPolygon,
  pointInRect,
  pointInShape,
  rasterize,
  shapeBounds,
  translated,
  withHandleAt,
} from "./shapes/geometry";
export type { Bounds } from "./shapes/geometry";
export { MaskMesh } from "./shapes/MaskMesh";
export type { MaskMeshProps } from "./shapes/MaskMesh";
export { editorInteractions } from "./shapes/interactions";
export { ShapeEditor } from "./shapes/ShapeEditor";
export type { ShapeEditorProps } from "./shapes/ShapeEditor";
export type {
  EllipseShape,
  Point,
  PolygonShape,
  RectShape,
  Shape,
  ShapeStyle,
  ShapeTool,
} from "./shapes/types";
export { Plot, loadPlotly, usePlotly } from "./plot/Plot";
export type { PlotProps } from "./plot/Plot";
export {
  ACCENT,
  CONFIG,
  FONT,
  GRID,
  INK,
  INK2,
  MUTED,
  SURFACE,
  SYMBOLS,
  axis,
  baseLayout,
  errorBars,
  grid,
  heightFor,
  logAxis,
  logTicks,
  markers,
  outerLegend,
  positiveExtent,
  symbol,
  withAlpha,
} from "./plot/theme";
export type { AxisOptions, GridOptions, Panel } from "./plot/theme";
export { column, g2Figure } from "./plot/g2Figure";
export type { G2FigureOptions, G2FitInput, G2SeriesInput } from "./plot/g2Figure";
export type {
  Config as PlotConfig,
  Layout as PlotLayout,
  LayoutAxis,
  PlotData,
  PlotMouseEvent,
  PlotRelayoutEvent,
} from "plotly.js";
export type AxisAnchor = import("plotly.js").LayoutAxis["anchor"];
