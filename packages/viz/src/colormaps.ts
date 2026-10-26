// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/**
 * The one named list of color maps of the stack, with the names of the Qt GUIs, rendered on
 * the client: by H5Web for images, by Plotly for the few plots that color by value.
 * H5Web has no "hot" or "jet"; the nearest of its maps stands in, as noted per entry.
 */

import type { ColorMap } from "@h5web/lib";

export const COLORMAPS = [
  "viridis",
  "inferno",
  "magma",
  "plasma",
  "cividis",
  "turbo",
  "hot",
  "gray",
  "jet",
] as const;
export type ColormapName = (typeof COLORMAPS)[number];

export interface H5WebColorMap {
  colorMap: ColorMap;
  invert: boolean;
}

const H5WEB: Record<ColormapName, H5WebColorMap> = {
  viridis: { colorMap: "Viridis", invert: false },
  inferno: { colorMap: "Inferno", invert: false },
  magma: { colorMap: "Magma", invert: false },
  plasma: { colorMap: "Plasma", invert: false },
  cividis: { colorMap: "Cividis", invert: false },
  turbo: { colorMap: "Turbo", invert: false },
  // hot (black, red, yellow, white): the nearest sequential map, dark red to pale yellow
  hot: { colorMap: "YlOrRd", invert: true },
  gray: { colorMap: "Greys", invert: true },
  // jet: a rainbow (H5Web's is cyclic, d3's interpolateRainbow)
  jet: { colorMap: "Rainbow", invert: false },
};

/** The H5Web color map of a named map (viridis for an unknown name). */
export function h5webColorMap(name: string): H5WebColorMap {
  return H5WEB[name as ColormapName] ?? H5WEB.viridis;
}

/** categorical series colors in a fixed order (validated for color-vision deficiency as ordered) */
export const SERIES = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
  "#4a3aa7",
  "#e34948",
] as const;

export const seriesColor = (i: number): string =>
  SERIES[((i % SERIES.length) + SERIES.length) % SERIES.length]!;

export type ColorStop = [number, string];

function parseRgb(text: string): [number, number, number] {
  const rgb = /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/.exec(text);
  if (rgb) return [+rgb[1]!, +rgb[2]!, +rgb[3]!];
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(text);
  return hex ? [parseInt(hex[1]!, 16), parseInt(hex[2]!, 16), parseInt(hex[3]!, 16)] : [0, 0, 0];
}

/** The color at `t` (0 … 1) of a Plotly color scale (`[[position, "rgb(...)"], ...]`). */
export function sampleScale(scale: ColorStop[], t: number): string {
  if (!scale.length) return SERIES[0];
  const v = Math.min(1, Math.max(0, t));
  let i = 0;
  while (i < scale.length - 1 && scale[i + 1]![0] < v) i += 1;
  const [p0, c0] = scale[i]!;
  const [p1, c1] = scale[Math.min(i + 1, scale.length - 1)]!;
  const f = p1 > p0 ? (v - p0) / (p1 - p0) : 0;
  const a = parseRgb(c0);
  const b = parseRgb(c1);
  const mix = a.map((x, k) => Math.round(x + (b[k]! - x) * f));
  return `rgb(${mix[0]},${mix[1]},${mix[2]})`;
}

/** A color per ordered series (q-bins, time segments): a perceptual map from dark to bright, never its two ends. */
export function orderedColor(i: number, count: number, scale: ColorStop[]): string {
  const t = count <= 1 ? 0.5 : 0.08 + 0.84 * (i / (count - 1));
  return sampleScale(scale, t);
}
