// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import type { Meta, StoryObj } from "@storybook/react-vite";

import { Readout } from "./Readout";

const meta = {
  title: "viz/Readout",
  component: Readout,
} satisfies Meta<typeof Readout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OnAPixel: Story = {
  args: { x: 1034, y: 987, value: 12345.678 },
};

export const OffTheImage: Story = {
  args: {},
};
