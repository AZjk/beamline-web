// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/** The metadata tab: the groups stored in the file shown, as a filterable tree. */

import { JsonTree, type JsonValue, type PluginProps } from "@beamline-web/ui";

import { useHdf } from "../api/queries";
import { useAppStore } from "../store";

export function HdfTab({ visible }: PluginProps) {
  const active = useAppStore((s) => s.active);
  const query = useHdf(active, visible);
  return (
    <JsonTree
      data={active ? ((query.data?.groups as Record<string, JsonValue> | undefined) ?? null) : null}
      loading={query.isFetching}
      error={active ? (query.error?.message ?? null) : null}
      emptyText="Click a file to see its metadata."
    />
  );
}
