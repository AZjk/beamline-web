// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import type { Meta, StoryObj } from "@storybook/react-vite";

import { g2Figure, type G2SeriesInput } from "./g2Figure";
import { Plot } from "./Plot";
import { seriesColor } from "../colormaps";
import { axis, baseLayout, logAxis } from "./theme";

/** Synthetic g2 curves: stretched exponentials with noise, three q-bins, two files. */
function synthetic(label: string, tau: number): G2SeriesInput {
  const t = Array.from({ length: 40 }, (_, i) => 1e-5 * 10 ** (i / 8));
  const nq = 3;
  const g2 = new Float32Array(t.length * nq);
  const err = new Float32Array(t.length * nq);
  t.forEach((ti, i) => {
    for (let n = 0; n < nq; n += 1) {
      const value = 1 + 0.25 * Math.exp(-2 * (ti / (tau / (n + 1))) ** 0.9);
      g2[i * nq + n] = value + (Math.random() - 0.5) * 0.01;
      err[i * nq + n] = 0.006;
    }
  });
  return {
    label,
    q: [0.005, 0.01, 0.015],
    labels: ["qbin=1, q=0.005 Å⁻¹", "qbin=2, q=0.01 Å⁻¹", "qbin=3, q=0.015 Å⁻¹"],
    t,
    g2,
    err,
    fit: null,
  };
}

const files = [synthetic("sample A", 0.02), synthetic("sample B", 0.08)];

const meta = { title: "viz/Plot", parameters: { layout: "fullscreen" } } satisfies Meta;
export default meta;
type Story = StoryObj;

export const G2ByQ: Story = {
  render: () => {
    const fig = g2Figure(files, { mode: "q", cols: 3 });
    return (
      <div style={{ height: 420 }}>
        <Plot data={fig.data} layout={fig.layout} />
      </div>
    );
  },
};

export const G2ByFileScrolling: Story = {
  render: () => {
    const fig = g2Figure(files, { mode: "file", cols: 1 });
    return (
      <div style={{ height: 360, overflow: "auto", border: "1px solid #ecebe7" }}>
        <Plot data={fig.data} layout={fig.layout} height={fig.rows * 260} />
      </div>
    );
  },
};

export const IntensityVsQ: Story = {
  render: () => {
    const q = Array.from({ length: 200 }, (_, i) => 1e-3 * 10 ** (i / 100));
    const data = [0, 1].map((k) => ({
      type: "scatter" as const,
      mode: "lines" as const,
      x: q,
      y: q.map((v) => ((k + 1) * 1e4) / (1 + (v / 0.02) ** 4)),
      name: `file ${k + 1}`,
      line: { color: seriesColor(k), width: 1.4 },
    }));
    return (
      <div style={{ height: 320 }}>
        <Plot
          data={data}
          layout={baseLayout({
            xaxis: logAxis({ title: "q (Å⁻¹)" }),
            yaxis: logAxis({ title: "I (photon/pixel/frame)" }),
          })}
        />
      </div>
    );
  },
};

export const Empty: Story = {
  render: () => (
    <div style={{ height: 240 }}>
      <Plot
        data={[]}
        layout={baseLayout({
          xaxis: axis({ visible: false }),
          yaxis: axis({ visible: false }),
          annotations: [
            {
              text: "nothing selected",
              showarrow: false,
              xref: "paper",
              yref: "paper",
              x: 0.5,
              y: 0.5,
            },
          ],
        })}
      />
    </div>
  ),
};
