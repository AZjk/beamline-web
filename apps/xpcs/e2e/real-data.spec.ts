// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/** The flows over a real service with beamline files: run with XPCS_URL pointing at the app. */

import { expect, test } from "@playwright/test";

test.skip(!process.env.XPCS_URL, "needs XPCS_URL: an app served over a real pyxpcsviewer-web");

test("the folder lists, a file shows its metadata, the metadata tab shows the groups", async ({
  page,
}) => {
  await page.goto("/");
  const rows = page.locator("tr[data-id]");
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  const count = await rows.count();
  expect(count).toBeGreaterThan(0);
  // the first multi-tau file: its label carries no "twotime"
  const target = rows.filter({ hasNot: page.getByText("twotime") }).first();
  await target.click();
  await expect(page.getByRole("status")).not.toHaveText("No file shown");
  await expect(page.getByText("Analysis", { exact: true })).toBeVisible();
  // the detector image renders on a canvas, and hovering it fills the readout
  const image = page.getByLabel("detector image");
  await expect(image.locator("canvas")).toBeVisible({ timeout: 20_000 });
  const box = await image.locator("canvas").boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect(page.getByLabel("readout")).toContainText("q ", { timeout: 10_000 });
  await page.getByRole("tab", { name: "Metadata" }).click();
  await expect(page.locator("details summary").first()).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/file=/);
  await page.screenshot({
    path: process.env.XPCS_SHOT ?? "test-results/real-data.png",
    fullPage: false,
  });
});
