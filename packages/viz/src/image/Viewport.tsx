// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/**
 * What the canvas shows after pan and zoom, in data coordinates, reported to the page as it
 * changes: a profile drawn beside the image follows the image's zoom with it. Rendered inside
 * the canvas (a child of ArrayImage).
 */

import { useCameraState, useVisCanvasContext, type Domain } from "@h5web/lib";
import { useEffect } from "react";

export interface Viewport {
  /** The data range across the canvas, ascending. */
  x: Domain;
  /** The data range up the canvas, ascending. */
  y: Domain;
}

const sorted = (d: Domain): Domain => (d[0] <= d[1] ? d : [d[1], d[0]]);

export function ViewportReporter({ onChange }: { onChange: (viewport: Viewport) => void }) {
  const { getVisibleDomains } = useVisCanvasContext();
  const domains = useCameraState((camera) => getVisibleDomains(camera), [getVisibleDomains]);
  const x = sorted(domains.xVisibleDomain);
  const y = sorted(domains.yVisibleDomain);
  const key = `${x[0]},${x[1]},${y[0]},${y[1]}`;
  useEffect(() => {
    onChange({ x, y });
    // the domains are read through their key: a camera update with the same numbers is no change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}
