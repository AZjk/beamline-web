// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import { expect, test } from "vitest";

import { createSharedStore, filesForAnalysis } from "./store";

test("the shared store holds the file shown, the selection and the tab", () => {
  const store = createSharedStore();
  store.getState().setActive("a.hdf");
  expect(filesForAnalysis(store.getState())).toEqual(["a.hdf"]);
  store.getState().setSelection(["b.hdf", "c.hdf"]);
  expect(filesForAnalysis(store.getState())).toEqual(["b.hdf", "c.hdf"]);
  store.getState().setOption("norm", "q2");
  store.getState().setOverlay("bins", { selected: 2 });
  expect(store.getState().options).toEqual({ norm: "q2" });
  expect(store.getState().overlays).toEqual({ bins: { selected: 2 } });
});
