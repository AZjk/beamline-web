// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/**
 * The detector image: a map of the detector (intensity, q-bin labels, a mask) with the beam
 * center, an optional label-map overlay with one label highlighted, and the cursor's detector
 * pixel reported to the page, which reads the value from the array it holds.
 */

import { DataToHtml, HeatmapMesh, ScaleType, type Domain } from "@h5web/lib";
import ndarray from "ndarray";
import { useMemo, type ReactNode } from "react";
import { Vector3 } from "three";

import { h5webColorMap } from "../colormaps";
import { ArrayImage, type ImageScale } from "./ArrayImage";
import { sampledExtent, type Sampling } from "./sampling";

export interface LabelOverlay {
  /** Label per sent pixel (0 or NaN outside every label), float32. */
  data: Float32Array;
  sampling: Sampling;
  /** The label drawn in white, e.g. the two-time bin shown. */
  highlighted?: number | null;
  opacity?: number;
}

export interface DetectorImageProps {
  data: Float32Array | Uint8Array;
  sampling: Sampling;
  /** Rows, columns of the detector, for the axis range. */
  fullShape: [number, number];
  colormap: string;
  scale?: ImageScale;
  /** The color levels; the array's range when undefined. */
  domain: Domain | undefined;
  beamCenter?: [number, number] | null;
  overlay?: LabelOverlay | null;
  showColorBar?: boolean;
  colorBarLabel?: string;
  onHover?: (x: number, y: number) => void;
  onLeave?: () => void;
  onClick?: (x: number, y: number) => void;
  svg?: ReactNode;
  className?: string;
}

const OVERLAY_COLORS = 8;

/** The labels cycled through eight hues, and an alpha channel that hides what has no label. */
function overlayArrays(overlay: LabelOverlay) {
  const { data, sampling } = overlay;
  const hue = new Float32Array(data.length);
  const alpha = new Uint8Array(data.length);
  const highlight = new Float32Array(data.length);
  const alphaHighlight = new Uint8Array(data.length);
  const a = Math.round(255 * (overlay.opacity ?? 0.4));
  for (let i = 0; i < data.length; i += 1) {
    const v = data[i]!;
    const on = Number.isFinite(v) && v > 0;
    hue[i] = on ? (v - 1) % OVERLAY_COLORS : 0;
    alpha[i] = on ? a : 0;
    const chosen =
      on &&
      overlay.highlighted !== null &&
      overlay.highlighted !== undefined &&
      v === overlay.highlighted;
    highlight[i] = 1;
    alphaHighlight[i] = chosen ? 217 : 0;
  }
  const shape = [sampling.rows, sampling.cols];
  return {
    hue: ndarray(hue, shape),
    alpha: ndarray(alpha, shape),
    highlight: ndarray(highlight, shape),
    alphaHighlight: ndarray(alphaHighlight, shape),
    any: overlay.highlighted !== null && overlay.highlighted !== undefined,
  };
}

function Overlay({ overlay }: { overlay: LabelOverlay }) {
  const arrays = useMemo(() => overlayArrays(overlay), [overlay]);
  return (
    <>
      <HeatmapMesh
        values={arrays.hue}
        domain={[-0.5, OVERLAY_COLORS - 0.5]}
        scaleType={ScaleType.Linear}
        colorMap="Rainbow"
        alphaValues={arrays.alpha}
        alphaDomain={[0, 255]}
      />
      {arrays.any ? (
        <HeatmapMesh
          values={arrays.highlight}
          domain={[0, 1]}
          scaleType={ScaleType.Linear}
          colorMap="Greys"
          invertColorMap
          alphaValues={arrays.alphaHighlight}
          alphaDomain={[0, 255]}
        />
      ) : null}
    </>
  );
}

function BeamCenter({ center }: { center: [number, number] }) {
  const point = useMemo(() => [new Vector3(center[0], center[1], 0)] as [Vector3], [center]);
  return (
    <DataToHtml points={point}>
      {(pt) => (
        <g aria-label="beam center" transform={`translate(${pt.x} ${pt.y})`}>
          <path
            d="M-9 0H9M0 -9V9"
            stroke="rgba(0,0,0,0.55)"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path d="M-9 0H9M0 -9V9" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      )}
    </DataToHtml>
  );
}

export function DetectorImage({
  data,
  sampling,
  fullShape,
  colormap,
  scale = "log",
  domain,
  beamCenter,
  overlay,
  showColorBar = true,
  colorBarLabel,
  onHover,
  onLeave,
  onClick,
  svg,
  className,
}: DetectorImageProps) {
  const { colorMap, invert } = h5webColorMap(colormap);
  const extent = useMemo(() => sampledExtent(sampling), [sampling]);
  void fullShape;
  return (
    <ArrayImage
      data={data}
      rows={sampling.rows}
      cols={sampling.cols}
      extent={extent}
      xLabel="column (px)"
      yLabel="row (px)"
      domain={domain}
      scale={scale}
      colorMap={colorMap}
      invertColorMap={invert}
      aspect="equal"
      showColorBar={showColorBar}
      colorBarLabel={colorBarLabel}
      onHover={onHover}
      onLeave={onLeave}
      onClick={onClick}
      className={className}
      svg={
        <>
          {beamCenter ? <BeamCenter center={beamCenter} /> : null}
          {svg}
        </>
      }
    >
      {overlay ? <Overlay overlay={overlay} /> : null}
    </ArrayImage>
  );
}
