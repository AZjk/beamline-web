#!/usr/bin/env node
// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/**
 * Copy an app's built bundle into a tool's static folder, for a local install of the tool:
 *   node scripts/deploy-app.mjs xpcs ../pyXpcsViewer/src/pyxpcsviewer/web/static
 * The release workflow does the same from a release asset.
 */
import { cpSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [app, target] = process.argv.slice(2);
if (!app || !target) {
  console.error("usage: deploy-app.mjs <app> <static folder>");
  process.exit(2);
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "apps", app, "dist");
if (!existsSync(path.join(dist, "index.html"))) {
  console.error(
    `${dist} has no index.html: run pnpm --filter @beamline-web/app-${app} build first`,
  );
  process.exit(1);
}
rmSync(target, { recursive: true, force: true });
cpSync(dist, target, { recursive: true });
console.log(`${path.relative(root, dist)} -> ${target}`);
