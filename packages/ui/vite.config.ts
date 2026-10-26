// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom" },
});
