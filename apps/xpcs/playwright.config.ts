// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:4381",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm build && pnpm preview",
    url: "http://127.0.0.1:4381",
    // never reuse: an unrelated server on the port would be tested instead of the app
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
