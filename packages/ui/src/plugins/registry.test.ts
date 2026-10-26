// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import { expect, test } from "vitest";

import { PluginRegistry, definePlugin } from "./registry";

const Nothing = () => null;

test("plugins list by placement in order, and dependencies are checked", () => {
  const registry = new PluginRegistry().register(
    definePlugin({
      id: "tauq",
      label: "τ(q)",
      placement: "tab",
      component: Nothing,
      dependsOn: ["g2"],
      order: 2,
    }),
    definePlugin({ id: "g2", label: "g2", placement: "tab", component: Nothing, order: 1 }),
    definePlugin({ id: "intt", label: "I(t)", placement: "panel", component: Nothing }),
  );
  expect(registry.list("tab").map((p) => p.id)).toEqual(["g2", "tauq"]);
  expect(registry.list("panel").map((p) => p.id)).toEqual(["intt"]);
  expect(registry.list().length).toBe(3);
  registry.check();
  expect(() =>
    registry.register(definePlugin({ id: "g2", label: "", placement: "tab", component: Nothing })),
  ).toThrow(/twice/);
  const broken = new PluginRegistry().register(
    definePlugin({ id: "x", label: "", placement: "tab", component: Nothing, dependsOn: ["nope"] }),
  );
  expect(() => broken.check()).toThrow(/not registered/);
});
