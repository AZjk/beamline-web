// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/**
 * A translucent layer over the image, inside the canvas: labels or a mask tinted from a
 * palette and blended over what lies below. H5Web's HeatmapMesh cannot stack: its material
 * never blends, so a second one replaces the image, alpha included. This mesh takes the same
 * plane (VisMesh) with a blending material of its own, drawn after the image.
 */

import { VisMesh } from "@h5web/lib";
import { useEffect, useMemo } from "react";
import {
  ClampToEdgeWrapping,
  Color,
  DataTexture,
  FloatType,
  NearestFilter,
  RedFormat,
  ShaderMaterial,
  UnsignedByteType,
  UVMapping,
  Vector3,
} from "three";

const MAX_COLORS = 8;

export interface OverlayMeshProps {
  /** Row-major, `rows` × `cols`: 0 or NaN is clear; a label n takes `palette[(n - 1) % length]`. */
  values: Float32Array | Uint8Array;
  rows: number;
  cols: number;
  /** CSS colors, up to 8. */
  palette: readonly string[];
  opacity?: number;
  /** A label drawn as `highlightColor` at `highlightOpacity` instead of its palette color. */
  highlighted?: number | null;
  highlightColor?: string;
  highlightOpacity?: number;
}

const VERTEX = `
  varying vec2 coords;
  void main() {
    coords = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = `
  uniform sampler2D data;
  uniform float normFactor;
  uniform vec3 palette[${MAX_COLORS}];
  uniform int paletteSize;
  uniform float opacity;
  uniform float highlighted;
  uniform vec3 highlightColor;
  uniform float highlightOpacity;
  varying vec2 coords;

  void main() {
    float value = texture2D(data, coords).r * normFactor;
    if (isnan(value) || value <= 0.0) discard;
    if (highlighted >= 0.0 && abs(value - highlighted) < 0.5) {
      gl_FragColor = vec4(highlightColor, highlightOpacity);
      return;
    }
    int index = int(mod(floor(value + 0.5) - 1.0, float(paletteSize)));
    vec3 color = palette[0];
    for (int i = 1; i < ${MAX_COLORS}; i++) {
      if (i == index) color = palette[i];
    }
    gl_FragColor = vec4(color, opacity);
  }
`;

function textureOf(values: Float32Array | Uint8Array, rows: number, cols: number) {
  const bytes = values instanceof Uint8Array;
  const texture = new DataTexture(
    values as unknown as BufferSource, // typed arrays over any buffer kind
    cols,
    rows,
    RedFormat,
    bytes ? UnsignedByteType : FloatType,
    UVMapping,
    ClampToEdgeWrapping,
    ClampToEdgeWrapping,
    NearestFilter,
    NearestFilter,
  );
  texture.unpackAlignment = 1; // rows of any width
  texture.needsUpdate = true;
  return texture;
}

function vec3Of(css: string) {
  const color = new Color(css);
  return new Vector3(color.r, color.g, color.b);
}

export function OverlayMesh({
  values,
  rows,
  cols,
  palette,
  opacity = 0.4,
  highlighted = null,
  highlightColor = "#ffffff",
  highlightOpacity = 0.85,
}: OverlayMeshProps) {
  const texture = useMemo(() => textureOf(values, rows, cols), [values, rows, cols]);
  useEffect(() => () => texture.dispose(), [texture]);
  const paletteKey = palette.join(",");
  const material = useMemo(() => {
    const colors = paletteKey.split(",").slice(0, MAX_COLORS).map(vec3Of);
    while (colors.length < MAX_COLORS)
      colors.push(colors[colors.length - 1] ?? new Vector3(1, 0, 0));
    return new ShaderMaterial({
      uniforms: {
        data: { value: texture },
        normFactor: { value: values instanceof Uint8Array ? 255 : 1 },
        palette: { value: colors },
        paletteSize: { value: Math.max(1, Math.min(palette.length, MAX_COLORS)) },
        opacity: { value: opacity },
        highlighted: { value: highlighted ?? -1 },
        highlightColor: { value: vec3Of(highlightColor) },
        highlightOpacity: { value: highlightOpacity },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    // the palette is read through its key so a new array of the same colors is no change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texture, values, paletteKey, opacity, highlighted, highlightColor, highlightOpacity]);
  useEffect(() => () => material.dispose(), [material]);
  return <VisMesh material={material} renderOrder={1} />;
}
