// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import { expect, test } from "vitest";

import { flatOverlays, framesOf, selectedFiles, useAppStore } from "./store";

test("the files an analysis works on, the frames spelling, the overlays", () => {
  expect(selectedFiles({ active: "a", selection: ["b", "a", "c"] })).toEqual(["a", "b", "c"]);
  expect(selectedFiles({ active: null, selection: ["b"] })).toEqual(["b"]);
  expect(framesOf(-1)).toBe("mean");
  expect(framesOf(2)).toBe("2");
  const state = useAppStore.getState();
  state.setToolOverlays("index", [{ name: "p", rows: [1], cols: [2] }]);
  state.setToolOverlays("empty", []);
  expect(flatOverlays(useAppStore.getState().toolOverlays)).toHaveLength(1);
  state.setToolOverlays("index", null);
  expect(flatOverlays(useAppStore.getState().toolOverlays)).toHaveLength(0);
});
