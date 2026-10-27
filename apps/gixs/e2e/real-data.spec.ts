// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/** The flows over a real service (gixsu web on a data folder): run with GIXS_URL pointing at the app. */

import { expect, test } from "@playwright/test";

test.skip(!process.env.GIXS_URL, "needs GIXS_URL: an app served over a real gixsu web");

test("load, select, image, views, cut, peaks, setup, calibrate, series", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  const rows = page.locator("tr[data-id]");
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  await rows.filter({ hasText: "film_a" }).first().click();
  await expect(page.getByRole("status")).toHaveText(/film_a/);
  await expect(page.getByText("Detector", { exact: true })).toBeVisible();
  await expect(page.getByLabel("processing status")).toContainText("level I2");

  // the image renders on a canvas, in each view; the color map and scale ask the server nothing
  const image = page.getByLabel("detector image");
  await expect(image.locator("canvas")).toBeVisible({ timeout: 30_000 });
  const box = await image.locator("canvas").boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect(page.getByLabel("readout")).toContainText("q ", { timeout: 10_000 });
  const imageRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/files\/.*\/image/.test(request.url())) imageRequests.push(request.url());
  });
  const scale = page.getByRole("radiogroup", { name: "intensity scale" });
  await scale.getByRole("radio", { name: "linear" }).click();
  await scale.getByRole("radio", { name: "log" }).click();
  await page.getByLabel("color map").selectOption("inferno");
  await page.waitForTimeout(500);
  expect(imageRequests).toEqual([]);
  await page.getByRole("radiogroup", { name: "view" }).getByRole("radio", { name: /q_r/ }).click();
  await expect(image.locator("canvas")).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(800);
  expect(imageRequests.length).toBeGreaterThan(0); // another view is another array

  // a standard cut, then its curve; the cut's box is on the image of its view
  await page.getByRole("tab", { name: "Cuts" }).click();
  await page.getByRole("button", { name: /I\(q\), all directions/ }).click();
  await expect(page.getByLabel("cuts").locator("tr[data-id]")).toHaveCount(1);
  await expect(page.getByLabel("cuts figure").locator(".plot-container")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("radiogroup", { name: "view" }).getByRole("radio", { name: /χ/ }).click();
  await expect(image.locator("[data-kind=rect]")).toHaveCount(1, { timeout: 30_000 });

  // a box drawn on the image adds a cut
  await page
    .getByRole("radiogroup", { name: "pointer tool" })
    .getByRole("radio", { name: "draw a cut" })
    .click();
  const canvas = image.locator("canvas");
  const b = (await canvas.boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.35, b.y + b.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.7, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByLabel("cuts").locator("tr[data-id]")).toHaveCount(2, { timeout: 10_000 });

  // a peak fit on the first cut
  await page.getByRole("tab", { name: "Peaks" }).click();
  await expect(page.getByLabel("peak fit figure").locator(".plot-container")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Fit", exact: true }).click();
  await expect(page.getByLabel("fitted peaks").locator("tr[data-id]")).toHaveCount(1, {
    timeout: 60_000,
  });

  // the setup file of this session changes the geometry shown
  await page.getByRole("tab", { name: "Setup" }).click();
  await page.getByLabel("setup file").fill("setup/beamline.json");
  await page.getByRole("button", { name: "Load", exact: true }).click();
  await expect(page.getByText(/In use: beamline.json/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Distance", { exact: true })).toBeVisible();
  await expect(page.locator("text=/0\\.31.*\\*/")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Clear", exact: true }).first().click();
  await expect(page.getByText(/No setup file/)).toBeVisible({ timeout: 15_000 });

  // a calibration answers, or explains why not, and the series tab runs a job on the stack
  await page.getByRole("tab", { name: "Calibrate" }).click();
  await page.getByRole("button", { name: "Find the beam center" }).click();
  await expect(
    page
      .locator("pre, p.text-danger")
      .filter({ hasText: /Beam center|beam center|spot/ })
      .first(),
  ).toBeVisible({ timeout: 30_000 });
  await rows.filter({ hasText: "stack" }).first().click();
  await page.getByRole("tab", { name: "Series" }).click();
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByLabel("series figure").locator(".plot-container")).toBeVisible({
    timeout: 60_000,
  });

  await expect(page).toHaveURL(/file=/);
  expect(pageErrors).toEqual([]);
  await page.screenshot({ path: process.env.GIXS_SHOT ?? "test-results/real-data.png" });
});
