// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/**
 * The detector image: a map of the detector (intensity, q-bin labels, a mask) with the beam
 * center, an optional label-map overlay with one label highlighted, and the cursor's detector
 * pixel reported to the page, which reads the value from the array it holds.
 */

import { Annotation, type Domain } from "@h5web/lib";
import { useMemo, type ReactNode } from "react";

import { SERIES, h5webColorMap } from "../colormaps";
import { OverlayMesh } from "./OverlayMesh";
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

function BeamCenter({ center }: { center: [number, number] }) {
  return (
    <Annotation x={center[0]} y={center[1]} center style={{ pointerEvents: "none" }}>
      <svg
        width="22"
        height="22"
        viewBox="-11 -11 22 22"
        aria-label="beam center"
        style={{ display: "block" }}
      >
        <path d="M-9 0H9M0 -9V9" stroke="rgba(0,0,0,0.55)" strokeWidth="4" strokeLinecap="round" />
        <path d="M-9 0H9M0 -9V9" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </Annotation>
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
      svg={svg}
    >
      {overlay ? (
        <OverlayMesh
          values={overlay.data}
          rows={overlay.sampling.rows}
          cols={overlay.sampling.cols}
          palette={SERIES}
          opacity={overlay.opacity ?? 0.4}
          highlighted={overlay.highlighted ?? null}
        />
      ) : null}
      {beamCenter ? <BeamCenter center={beamCenter} /> : null}
    </ArrayImage>
  );
}
