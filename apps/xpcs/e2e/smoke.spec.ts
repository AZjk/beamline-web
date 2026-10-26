// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import { expect, test } from "@playwright/test";

test("the empty app loads and renders its shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "pyXPCSViewer web" })).toBeVisible();
  await expect(page.getByTestId("connection")).toContainText("No service");
  await expect(page.getByLabel("cursor readout")).toBeVisible();
});
