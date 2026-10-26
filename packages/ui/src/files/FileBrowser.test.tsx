// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { FileBrowser, type FileRow } from "./FileBrowser";

const files: FileRow[] = [
  { id: "a.hdf", label: "a", modified: "2026-10-26 10:00", atype: ["Multitau"] },
  { id: "b.hdf", label: "b", modified: "2026-10-26 11:00", atype: ["Twotime"] },
  { id: "c.hdf", label: "c", modified: "2026-10-26 12:00", atype: ["Multitau", "Twotime"] },
  { id: "d.txt", label: "d", modified: "2026-10-26 13:00", atype: null },
];

function setup(selection: string[] = []) {
  const onActivate = vi.fn();
  const onSelectionChange = vi.fn();
  render(
    <FileBrowser
      files={files}
      total={4}
      active={null}
      selection={selection}
      onActivate={onActivate}
      onSelectionChange={onSelectionChange}
      filter=""
      onFilterChange={() => {}}
      sort="name:asc"
      onSortChange={() => {}}
      onRescan={() => {}}
    />,
  );
  return { onActivate, onSelectionChange };
}

test("a click shows a file, ctrl-click checks it, shift-click checks a range", () => {
  const { onActivate, onSelectionChange } = setup();
  fireEvent.click(screen.getByText("a"));
  expect(onActivate).toHaveBeenCalledWith("a.hdf");
  fireEvent.click(screen.getByText("b"), { ctrlKey: true });
  expect(onSelectionChange).toHaveBeenLastCalledWith(["b.hdf"]);
  fireEvent.click(screen.getByText("c"), { shiftKey: true });
  expect(onSelectionChange).toHaveBeenLastCalledWith(["b.hdf", "c.hdf"]);
});

test("an unreadable file cannot be checked and the header box checks the readable ones", () => {
  const { onSelectionChange } = setup();
  expect((screen.getByLabelText("check d") as HTMLInputElement).disabled).toBe(true);
  fireEvent.click(screen.getByLabelText("check every file shown"));
  expect(onSelectionChange).toHaveBeenLastCalledWith(["a.hdf", "b.hdf", "c.hdf"]);
});

test("the footer counts and clears", () => {
  const { onSelectionChange } = setup(["a.hdf", "c.hdf"]);
  expect(screen.getByText(/2 checked/)).toBeTruthy();
  fireEvent.click(screen.getByText("clear"));
  expect(onSelectionChange).toHaveBeenLastCalledWith([]);
});
