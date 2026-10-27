// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/** The flows over a real service with beamline files: run with XPCS_URL pointing at the app. */

import { expect, test } from "@playwright/test";

test.skip(!process.env.XPCS_URL, "needs XPCS_URL: an app served over a real pyxpcsviewer-web");

test("load, select, image, panels, fit, tau(q), metadata", async ({ page }) => {
  await page.goto("/");
  const rows = page.locator("tr[data-id]");
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });
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

  // the panels under the image draw
  await expect(page.getByLabel("I(q) figure").locator(".plot-container")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByLabel("I(t) figure").locator(".plot-container")).toBeVisible({
    timeout: 20_000,
  });

  // g2: the curves, then a fit as a job, then its parameters
  await page.getByRole("tab", { name: "g2" }).click();
  await expect(page.getByLabel("g2 figure").locator(".plot-container")).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole("button", { name: "Fit g2" }).click();
  await expect(page.getByText("a · contrast").first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("status")).toContainText(/Fitted|failed/, { timeout: 60_000 });

  // tau(q) from the fits
  await page.getByRole("tab", { name: "τ(q)" }).click();
  await expect(page.getByLabel("tau(q) figure").locator(".plot-container")).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole("button", { name: "Fit τ(q)" }).click();
  await expect(page.getByText(/τ = a·q\^b/)).toBeVisible({ timeout: 30_000 });

  // two-time: a two-time file, its C2 map and the g2 computed from it, the next bin with ]
  await rows.filter({ hasText: "twotime" }).first().click();
  await page.getByRole("tab", { name: "Two-time" }).click();
  await expect(page.getByLabel("C2 map").locator("canvas")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel("two-time g2 figure").locator(".plot-container")).toBeVisible({
    timeout: 30_000,
  });
  const bin = page.getByLabel("two-time bin");
  const before = await bin.inputValue();
  await page.keyboard.press("]");
  await expect(bin).not.toHaveValue(before);
  await expect(page.getByLabel("C2 map").locator("canvas")).toBeVisible({ timeout: 30_000 });
  await page.screenshot({
    path: (process.env.XPCS_SHOT ?? "test-results/real-data.png").replace(/\.png$/, "-twotime.png"),
  });

  await page.getByRole("tab", { name: "Metadata" }).click();
  await expect(page.locator("details summary").first()).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/file=/);
  await page.getByRole("tab", { name: "g2" }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: process.env.XPCS_SHOT ?? "test-results/real-data.png",
    fullPage: false,
  });
});
