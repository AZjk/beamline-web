// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/**
 * The mask-editor spike: polygon and ellipse drawing on H5Web's data layer over a synthetic
 * detector image, the shapes rasterized to a mask in the browser and tinted over the image.
 */

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo, useState } from "react";

import { ArrayImage } from "../image/ArrayImage";
import { finiteRange, sampledExtent } from "../image/sampling";
import { rasterize } from "./geometry";
import { MaskMesh } from "./MaskMesh";
import { editorInteractions } from "./interactions";
import { ShapeEditor } from "./ShapeEditor";
import type { Shape, ShapeTool } from "./types";

const rows = 240;
const cols = 256;
const data = new Float32Array(rows * cols);
for (let r = 0; r < rows; r += 1) {
  for (let c = 0; c < cols; c += 1) {
    const d = Math.hypot(c - 130, r - 118);
    const v = 2000 / (1 + d * d * 0.02) + 40 * Math.exp(-((d - 70) ** 2) / 50) + 1;
    data[r * cols + c] = Math.log10(d < 6 ? 1e-3 : v);
  }
}
const extent = sampledExtent({ factor: 1, x0: 0, y0: 0, rows, cols });
const domain = finiteRange(data);

const INITIAL: Shape[] = [
  { id: "beamstop", kind: "ellipse", cx: 130, cy: 118, rx: 9, ry: 9 },
  {
    id: "arm",
    kind: "polygon",
    points: [
      { x: 120, y: 118 },
      { x: 140, y: 118 },
      { x: 148, y: 239 },
      { x: 112, y: 239 },
    ],
  },
];

const TOOLS: ShapeTool[] = ["select", "polygon", "ellipse", "rect"];

function Spike() {
  const [tool, setTool] = useState<ShapeTool>("polygon");
  const [shapes, setShapes] = useState<Shape[]>(INITIAL);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showMask, setShowMask] = useState(true);
  const mask = useMemo(() => rasterize(shapes, rows, cols), [shapes]);
  const masked = useMemo(() => mask.reduce<number>((n, v) => n + v, 0), [mask]);
  return (
    <div className="flex h-screen min-h-0 flex-col gap-2 bg-surface p-2 text-ink">
      <div
        className="flex flex-wrap items-center gap-2 text-sm"
        role="toolbar"
        aria-label="mask tools"
      >
        {TOOLS.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tool === t}
            onClick={() => setTool(t)}
            className="rounded border border-line px-2 py-0.5 aria-pressed:bg-accent aria-pressed:text-white"
          >
            {t}
          </button>
        ))}
        <button
          type="button"
          className="rounded border border-line px-2 py-0.5"
          onClick={() => {
            setShapes([]);
            setSelectedId(null);
          }}
        >
          clear
        </button>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={showMask}
            onChange={(e) => setShowMask(e.target.checked)}
          />
          mask
        </label>
        <output data-testid="masked" className="tabular-nums">
          {masked} px masked ({((100 * masked) / mask.length).toFixed(1)} %)
        </output>
        <span className="text-xs text-muted">
          polygon: click the vertices, close on the first one, Enter or double-click. ellipse: drag
          from the center. select: click a shape, drag its handles or its body; Delete removes,
          Escape deselects. Scroll zooms; pan is on in select mode with nothing selected.
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <ArrayImage
          data={data}
          rows={rows}
          cols={cols}
          extent={extent}
          domain={domain}
          colorMap="Viridis"
          colorBarLabel="log₁₀ I"
          interactions={editorInteractions(tool, selectedId)}
        >
          {showMask ? <MaskMesh mask={mask} rows={rows} cols={cols} /> : null}
          <ShapeEditor
            tool={tool}
            shapes={shapes}
            onChange={setShapes}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onDrawn={() => setTool("select")}
            styles={{
              arm: { label: "arm", color: "#2a78d6", mirrorX: true },
              beamstop: { label: "beam stop" },
            }}
          />
        </ArrayImage>
      </div>
      <pre data-testid="shapes" className="max-h-24 overflow-auto text-2xs text-muted">
        {JSON.stringify(shapes)}
      </pre>
    </div>
  );
}

const meta = {
  title: "viz/Mask editor spike",
  parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;

export const MaskEditorSpike: StoryObj = { render: () => <Spike /> };
