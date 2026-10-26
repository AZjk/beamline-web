// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // relative URLs, so the built bundle works under any portal prefix once copied into the wheel
  base: "./",
  plugins: [react(), tailwindcss()],
  server: {
    // `pnpm dev` beside a running `pyxpcsviewer-web` on its default port
    proxy: { "/api": "http://127.0.0.1:8070" },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    exclude: ["e2e/**", "node_modules/**"],
  },
});
