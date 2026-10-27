// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/**
 * Markers, lines and labels in data coordinates over an array image (a tool's results: found
 * peaks, predicted reflections, a ring, a fitted beam center), as SVG that follows pan and
 * zoom. Rendered inside the canvas (a child of ArrayImage). A null or NaN point breaks a line.
 */

import { DataToHtml, SvgElement } from "@h5web/lib";
import { useMemo } from "react";
import { Vector3 } from "three";

export interface OverlayItem {
  name: string;
  x: (number | null)[];
  y: (number | null)[];
  /** "markers", "lines", "markers+text", "lines+markers", ... as Plotly names them. */
  mode?: string;
  /** circle, square, diamond, x, cross, star; "-open" for an outline. */
  symbol?: string;
  color?: string;
  size?: number;
  dash?: string;
  text?: string[] | null;
}

interface Point {
  x: number;
  y: number;
  i: number;
}

const DASHES: Record<string, string | undefined> = {
  dash: "6 4",
  dot: "2 3",
  dashdot: "6 3 2 3",
  longdash: "12 4",
  longdashdot: "12 3 2 3",
};

function finitePoints(item: OverlayItem): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < item.x.length; i += 1) {
    const x = item.x[i];
    const y = item.y[i];
    if (
      x !== null &&
      x !== undefined &&
      y !== null &&
      y !== undefined &&
      isFinite(x) &&
      isFinite(y)
    )
      points.push({ x, y, i });
  }
  return points;
}

/** Runs of consecutive indices: a gap in the source (a null) starts a new line. */
function segments(points: Point[], html: { x: number; y: number }[]): string[] {
  const out: string[] = [];
  let current: string[] = [];
  let previous = -2;
  points.forEach((p, k) => {
    if (p.i !== previous + 1 && current.length) {
      out.push(current.join(" "));
      current = [];
    }
    const h = html[k]!;
    current.push(`${h.x},${h.y}`);
    previous = p.i;
  });
  if (current.length) out.push(current.join(" "));
  return out;
}

function Symbol({
  x,
  y,
  symbol,
  size,
  color,
}: {
  x: number;
  y: number;
  symbol: string;
  size: number;
  color: string;
}) {
  const open = symbol.endsWith("-open") || symbol.includes("thin");
  const base = symbol.replace(/-open$/, "").replace(/-thin$/, "");
  const r = size / 2;
  const fill = open ? "none" : color;
  const stroke = { stroke: color, strokeWidth: open ? 1.5 : 0.5 };
  switch (base) {
    case "square":
      return <rect x={x - r} y={y - r} width={size} height={size} fill={fill} {...stroke} />;
    case "diamond":
      return (
        <polygon
          points={`${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}`}
          fill={fill}
          {...stroke}
        />
      );
    case "x":
      return (
        <path
          d={`M${x - r},${y - r}L${x + r},${y + r}M${x - r},${y + r}L${x + r},${y - r}`}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
        />
      );
    case "cross":
      return (
        <path
          d={`M${x - r},${y}L${x + r},${y}M${x},${y - r}L${x},${y + r}`}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
        />
      );
    case "star": {
      const pts: string[] = [];
      for (let k = 0; k < 10; k += 1) {
        const a = (Math.PI / 5) * k - Math.PI / 2;
        const rr = k % 2 ? r * 0.45 : r;
        pts.push(`${x + rr * Math.cos(a)},${y + rr * Math.sin(a)}`);
      }
      return <polygon points={pts.join(" ")} fill={fill} {...stroke} />;
    }
    default:
      return <circle cx={x} cy={y} r={r} fill={fill} {...stroke} />;
  }
}

function Item({ item }: { item: OverlayItem }) {
  const points = useMemo(() => finitePoints(item), [item]);
  const vectors = useMemo(() => points.map((p) => new Vector3(p.x, p.y, 0)), [points]);
  if (!points.length) return null;
  const mode = item.mode ?? "markers";
  const color = item.color ?? "#ffffff";
  const size = item.size ?? 10;
  const symbol = item.symbol ?? "circle-open";
  const labels = item.text ?? null;
  return (
    <DataToHtml points={vectors}>
      {(...html) => (
        <SvgElement>
          <g data-overlay={item.name} style={{ pointerEvents: "none" }}>
            {mode.includes("lines")
              ? segments(points, html).map((d, k) => (
                  <polyline
                    key={k}
                    points={d}
                    fill="none"
                    stroke={color}
                    strokeWidth={1.5}
                    strokeDasharray={DASHES[item.dash ?? "solid"]}
                  />
                ))
              : null}
            {mode.includes("markers")
              ? html.map((h, k) => (
                  <Symbol key={k} x={h.x} y={h.y} symbol={symbol} size={size} color={color} />
                ))
              : null}
            {mode.includes("text") && labels
              ? html.map((h, k) => (
                  <text
                    key={`t${k}`}
                    x={h.x}
                    y={h.y - size / 2 - 3}
                    fill={color}
                    fontSize={10}
                    textAnchor="middle"
                    style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.6)", strokeWidth: 2 }}
                  >
                    {labels[points[k]!.i] ?? ""}
                  </text>
                ))
              : null}
          </g>
        </SvgElement>
      )}
    </DataToHtml>
  );
}

export function DataOverlays({ items }: { items: OverlayItem[] }) {
  return (
    <>
      {items.map((item, i) => (
        <Item key={`${item.name}-${i}`} item={item} />
      ))}
    </>
  );
}
