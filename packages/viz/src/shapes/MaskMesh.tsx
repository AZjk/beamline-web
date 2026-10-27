// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/** A mask (nonzero = masked) tinted over the array it belongs to, inside the canvas. */

import { OverlayMesh } from "../image/OverlayMesh";

export interface MaskMeshProps {
  /** Row-major, `rows` × `cols`, nonzero where masked. */
  mask: Uint8Array;
  rows: number;
  cols: number;
  color?: string;
  opacity?: number;
}

export function MaskMesh({ mask, rows, cols, color = "#dc2626", opacity = 0.45 }: MaskMeshProps) {
  return <OverlayMesh values={mask} rows={rows} cols={cols} palette={[color]} opacity={opacity} />;
}
