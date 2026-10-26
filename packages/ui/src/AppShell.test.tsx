// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { AppShell } from "./AppShell";

test("renders the title, the version and the content", () => {
  render(
    <AppShell title="Demo" version="1.2.3">
      <p>hello</p>
    </AppShell>,
  );
  expect(screen.getByRole("heading", { name: "Demo" })).toBeTruthy();
  expect(screen.getByText("1.2.3")).toBeTruthy();
  expect(screen.getByText("hello")).toBeTruthy();
});
