// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/**
 * A 2-D array as an image on the GPU (H5Web over react-three-fiber): the color map, the scale
 * and the levels apply in the browser, pan and zoom run at the frame rate, and overlays draw
 * in data coordinates. The detector image and the two-time map are built on it.
 */

import {
  ColorBar,
  DefaultInteractions,
  HeatmapMesh,
  ResetZoomButton,
  ScaleType,
  SvgElement,
  VisCanvas,
  useCanvasEvent,
  type AxisConfig,
  type ColorMap,
  type Domain,
  type VisScaleType,
} from "@h5web/lib";
import ndarray from "ndarray";
import { useMemo, type ComponentProps, type ReactNode } from "react";

export type ImageScale = "linear" | "log" | "symlog" | "sqrt";

const SCALE: Record<ImageScale, VisScaleType> = {
  linear: ScaleType.Linear,
  log: ScaleType.Log,
  symlog: ScaleType.SymLog,
  sqrt: ScaleType.Sqrt,
};

export interface ImageExtent {
  /** The data coordinates of the array's outer edges. */
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
}

export interface ArrayImageProps {
  /** Row-major values, `rows` × `cols`. */
  data: Float32Array | Uint8Array | Uint16Array;
  rows: number;
  cols: number;
  /** Where the array sits in data coordinates (axis values at its edges). */
  extent: ImageExtent;
  xLabel?: string;
  yLabel?: string;
  /** The color levels; the array's own range when undefined. */
  domain: Domain | undefined;
  scale?: ImageScale;
  colorMap: ColorMap;
  invertColorMap?: boolean;
  /** Equal data units on both axes (a detector), or fill the area. */
  aspect?: "equal" | "auto";
  showColorBar?: boolean;
  colorBarLabel?: string;
  /** Further meshes inside the canvas (overlays in data coordinates). */
  children?: ReactNode;
  /** SVG drawn in data coordinates over the image. */
  svg?: ReactNode;
  /** Draw x decreasing to the right, y decreasing upwards (a detector with row 0 at the top). */
  flipX?: boolean;
  flipY?: boolean;
  /** H5Web's default interactions, each configurable or off (`pan: false` while a tool draws). */
  interactions?: ComponentProps<typeof DefaultInteractions>;
  onHover?: (x: number, y: number) => void;
  onLeave?: () => void;
  onClick?: (x: number, y: number) => void;
  className?: string;
}

/** Pointer events of the canvas in data coordinates. */
function CanvasEvents({
  onHover,
  onLeave,
  onClick,
}: Pick<ArrayImageProps, "onHover" | "onLeave" | "onClick">) {
  useCanvasEvent("pointermove", (event) => onHover?.(event.dataPt.x, event.dataPt.y));
  useCanvasEvent("pointerleave", () => onLeave?.());
  useCanvasEvent("click", (event) => onClick?.(event.dataPt.x, event.dataPt.y));
  return null;
}

/** The array's values as the GPU reads them: float32 or 8/16-bit unsigned, rows × cols. */
export function toNdArray(
  data: Float32Array | Uint8Array | Uint16Array,
  rows: number,
  cols: number,
) {
  return ndarray(data, [rows, cols]);
}

/**
 * The array with its rows and/or columns reversed. H5Web's axis flip reverses the scale the
 * axes, the pointer and the SVG use, not the texture: the texture's first row always lands on
 * the plane's bottom edge, which a flipped ordinate labels with the largest y. So the mesh gets
 * the rows reversed when the y axis is flipped (and the columns when x is), and the picture
 * agrees with the marks drawn over it.
 */
export function oriented<T extends Float32Array | Uint8Array | Uint16Array>(
  data: T,
  rows: number,
  cols: number,
  flipX: boolean,
  flipY: boolean,
): T {
  if (!flipX && !flipY) return data;
  const out = new (data.constructor as new (n: number) => T)(data.length);
  for (let r = 0; r < rows; r += 1) {
    const source = (flipY ? rows - 1 - r : r) * cols;
    const target = r * cols;
    if (!flipX) {
      out.set(data.subarray(source, source + cols), target);
    } else {
      for (let c = 0; c < cols; c += 1) out[target + c] = data[source + cols - 1 - c]!;
    }
  }
  return out;
}

export function ArrayImage({
  data,
  rows,
  cols,
  extent,
  xLabel,
  yLabel,
  domain,
  scale = "linear",
  colorMap,
  invertColorMap = false,
  aspect = "equal",
  showColorBar = true,
  colorBarLabel,
  children,
  svg,
  flipX = false,
  flipY = false,
  interactions,
  onHover,
  onLeave,
  onClick,
  className,
}: ArrayImageProps) {
  const values = useMemo(
    () => toNdArray(oriented(data, rows, cols, flipX, flipY), rows, cols),
    [data, rows, cols, flipX, flipY],
  );
  const abscissa: AxisConfig = useMemo(
    () => ({
      visDomain: [extent.xmin, extent.xmax],
      label: xLabel,
      showGrid: false,
      nice: false,
      flip: flipX,
    }),
    [extent.xmin, extent.xmax, xLabel, flipX],
  );
  const ordinate: AxisConfig = useMemo(
    () => ({
      visDomain: [extent.ymin, extent.ymax],
      label: yLabel,
      showGrid: false,
      nice: false,
      flip: flipY,
    }),
    [extent.ymin, extent.ymax, yLabel, flipY],
  );
  const safeDomain: Domain = domain && domain[0] < domain[1] ? domain : [0, 1];
  return (
    <div className={className ?? "flex h-full min-h-0 w-full"}>
      {/* a flex container: H5Web's VisCanvas is styled as a flex item (flex: 1, z-index: 0), and that
          z-index is what keeps its layers, drawn at negative z-indices, inside its own stacking context;
          as a block child they would paint under any opaque background higher up */}
      <div className="relative flex min-h-0 min-w-0 flex-1">
        <VisCanvas abscissaConfig={abscissa} ordinateConfig={ordinate} aspect={aspect}>
          <DefaultInteractions {...interactions} />
          <ResetZoomButton />
          <HeatmapMesh
            values={values}
            domain={safeDomain}
            scaleType={SCALE[scale]}
            colorMap={colorMap}
            invertColorMap={invertColorMap}
          />
          {children}
          {svg ? <SvgElement>{svg}</SvgElement> : null}
          <CanvasEvents onHover={onHover} onLeave={onLeave} onClick={onClick} />
        </VisCanvas>
      </div>
      {showColorBar ? (
        <div
          className="flex shrink-0 flex-col items-center text-2xs text-muted"
          aria-label="color bar"
        >
          {colorBarLabel ? <span className="py-1">{colorBarLabel}</span> : null}
          <div className="min-h-0 flex-1">
            <ColorBar
              domain={safeDomain}
              scaleType={SCALE[scale]}
              colorMap={colorMap}
              invertColorMap={invertColorMap}
              withBounds
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
