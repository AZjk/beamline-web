// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import { expect, test } from "@playwright/test";

test("the app loads its shell and reports the missing service", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("XPCS")).toBeVisible();
  await expect(page.getByText(/Could not reach the service/)).toBeVisible();
});
