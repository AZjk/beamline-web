// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import { Placeholder, type PluginProps } from "@beamline-web/ui";

/** A tab whose port is still under way. */
export function Pending({ what }: PluginProps & { what: string }) {
  return <Placeholder>{what} arrives with the next step of Phase 1.</Placeholder>;
}
