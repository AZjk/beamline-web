// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import { useEffect, useRef, useState } from "react";

/**
 * Whether a hidden tab's inputs changed since it was last shown: true once `deps` change while
 * `visible` is false, false again when it is shown. A tab shows a dot while stale and refreshes
 * when shown.
 */
export function useStale(visible: boolean, deps: unknown[]): boolean {
  const [stale, setStale] = useState(false);
  const first = useRef(true);
  const key = JSON.stringify(deps);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!visible) setStale(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    if (visible) setStale(false);
  }, [visible]);
  return stale && !visible;
}
