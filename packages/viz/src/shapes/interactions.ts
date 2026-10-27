// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import type { ArrayImageProps } from "../image/ArrayImage";
import type { ShapeTool } from "./types";

/**
 * The interactions ArrayImage keeps while the editor is in this state: the pan is off while a
 * tool draws or a shape is selected (a drag then edits), and back once the selection is cleared.
 */
export function editorInteractions(
  tool: ShapeTool,
  selectedId: string | null,
): NonNullable<ArrayImageProps["interactions"]> {
  return tool === "select" && selectedId === null ? {} : { pan: false };
}
