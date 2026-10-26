// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { DetectorImage } from "./DetectorImage";
import { finiteRange } from "./sampling";

/** A synthetic SAXS pattern: a ring, a beam stop and noise, on a 512 by 480 detector sent at factor 2. */
function synthetic(rows = 240, cols = 256, factor = 2) {
  const data = new Float32Array(rows * cols);
  const labels = new Float32Array(rows * cols);
  const cx = 130;
  const cy = 118;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const d = Math.hypot(c - cx, r - cy);
      let v = 2000 / (1 + d * d * 0.02) + 40 * Math.exp(-((d - 70) ** 2) / 50) + Math.random() * 2;
      if (d < 6) v = 0;
      data[r * cols + c] = Math.log10(Math.max(v, 1e-3));
      labels[r * cols + c] = d > 20 && d < 110 ? 1 + Math.floor((d - 20) / 10) : Number.NaN;
    }
  }
  return {
    data,
    labels,
    sampling: { factor, x0: (factor - 1) / 2, y0: (factor - 1) / 2, rows, cols },
    beamCenter: [cx * factor, cy * factor] as [number, number],
  };
}

const sample = synthetic();

const meta = {
  title: "viz/DetectorImage",
  component: DetectorImage,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof DetectorImage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Intensity: Story = {
  args: {
    data: sample.data,
    sampling: sample.sampling,
    fullShape: [480, 512],
    colormap: "viridis",
    scale: "linear",
    domain: finiteRange(sample.data),
    beamCenter: sample.beamCenter,
    colorBarLabel: "log₁₀ I",
  },
  render: (args) => (
    <div style={{ height: 480 }}>
      <DetectorImage {...args} />
    </div>
  ),
};

export const WithBinsAndReadout: Story = {
  args: {
    ...Intensity.args,
    overlay: { data: sample.labels, sampling: sample.sampling, highlighted: 3 },
  },
  render: function Render(args) {
    const [readout, setReadout] = useState("hover over the image");
    return (
      <div style={{ height: 520, display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, minHeight: 0 }}>
          <DetectorImage
            {...args}
            onHover={(x, y) => setReadout(`x ${x.toFixed(1)}, y ${y.toFixed(1)}`)}
            onLeave={() => setReadout("")}
          />
        </div>
        <div style={{ padding: 8, fontFamily: "monospace", fontSize: 12 }}>{readout}</div>
      </div>
    );
  },
};
