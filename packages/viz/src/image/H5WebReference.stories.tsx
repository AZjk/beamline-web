// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/** H5Web's own HeatmapVis on the same synthetic data: a reference beside the kit's viewer. */

import { HeatmapVis, ScaleType, getDomain } from "@h5web/lib";
import type { Meta, StoryObj } from "@storybook/react-vite";
import ndarray from "ndarray";

const rows = 240;
const cols = 256;
const data = new Float32Array(rows * cols);
for (let r = 0; r < rows; r += 1)
  for (let c = 0; c < cols; c += 1) data[r * cols + c] = Math.hypot(c - 130, r - 118);
const dataArray = ndarray(data, [rows, cols]);

const meta = { title: "viz/H5Web reference", parameters: { layout: "fullscreen" } } satisfies Meta;
export default meta;

export const HeatmapVisReference: StoryObj = {
  render: () => (
    <div style={{ height: 480 }}>
      <HeatmapVis
        dataArray={dataArray}
        domain={getDomain(dataArray)}
        colorMap="Viridis"
        scaleType={ScaleType.Linear}
        aspect="equal"
      />
    </div>
  ),
};
