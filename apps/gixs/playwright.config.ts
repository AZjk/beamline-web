// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import { defineConfig, devices } from "@playwright/test";

/** With GIXS_URL set, the flows run against that app (a dev server over a real service, or a
 * beamline deployment) instead of the built app served by `pnpm preview`. */
const external = process.env.GIXS_URL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: external ?? "http://127.0.0.1:4382",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: external
    ? undefined
    : {
        command: "pnpm build && pnpm preview",
        url: "http://127.0.0.1:4382",
        // never reuse: an unrelated server on the port would be tested instead of the app
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
