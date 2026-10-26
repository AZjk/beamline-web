// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { Readout } from "./Readout";

test("shows the position and value, and a dash when off the image", () => {
  render(<Readout x={10.25} y={3} value={1.23456} />);
  expect(screen.getByText("10.3")).toBeTruthy();
  expect(screen.getByText("3.0")).toBeTruthy();
  expect(screen.getByText("1.235")).toBeTruthy();
});

test("renders dashes without a cursor", () => {
  render(<Readout />);
  expect(screen.getAllByText("–")).toHaveLength(3);
});
