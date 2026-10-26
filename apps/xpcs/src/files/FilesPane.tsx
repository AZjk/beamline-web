// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/** The left column: the folder's files, and the metadata card of the file shown. */

import {
  Card,
  FileBrowser,
  MetadataCard,
  Pane,
  PaneGroup,
  PaneHandle,
  useLocalState,
  type FileSort,
} from "@beamline-web/ui";
import { useEffect, useMemo, useState } from "react";

import { useFiles, useSummary } from "../api/queries";
import { fileRow, useAppStore } from "../store";

export function Badges({ atype }: { atype: string[] | null }) {
  if (!atype) {
    return (
      <span
        className="rounded bg-danger/10 px-1 text-[10px] text-danger"
        title="not a readable result file"
      >
        ?
      </span>
    );
  }
  return (
    <>
      {atype.map((t) => (
        <span
          key={t}
          className="rounded bg-accent/10 px-1 text-[10px] font-medium text-accent"
          title={t === "Multitau" ? "multi-tau (g2)" : "two-time (C2)"}
        >
          {t === "Multitau" ? "MT" : t === "Twotime" ? "TT" : t}
        </span>
      ))}
    </>
  );
}

export function FilesPane({ onListed }: { onListed?: () => void }) {
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useLocalState<FileSort>("xpcs:files:sort", "name:asc");
  const [rescan, setRescan] = useState(0);
  const [sortKey, direction] = sort.split(":") as ["name" | "time", "asc" | "desc"];
  const query = useFiles({ pattern: filter, sort: sortKey, reverse: direction === "desc", rescan });
  const active = useAppStore((s) => s.active);
  const selection = useAppStore((s) => s.selection);
  const setActive = useAppStore((s) => s.setActive);
  const setSelection = useAppStore((s) => s.setSelection);
  const setFiles = useAppStore((s) => s.setFiles);
  const files = useAppStore((s) => s.files);

  useEffect(() => {
    if (!query.data) return;
    setFiles(query.data.files, query.data.total);
    onListed?.();
    // after a rescan, a file gone from the folder is dropped from the selection and the view
    if (rescan) {
      const known = new Set(query.data.files.map((f) => f.id));
      const state = useAppStore.getState();
      const kept = state.selection.filter((id) => known.has(id));
      if (kept.length !== state.selection.length) setSelection(kept);
      if (state.active && !known.has(state.active)) setActive(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);

  const summary = useSummary(active);
  const activeRow = useMemo(() => fileRow({ files }, active), [files, active]);
  const rows = useMemo(
    () => summary.data?.rows.map(([k, v]) => [k, v] as [string, string]) ?? null,
    [summary.data],
  );

  return (
    <PaneGroup
      orientation="vertical"
      storageKey="xpcs:files"
      panelIds={["list", "meta"]}
      className="h-full p-1.5"
    >
      <Pane id="list" defaultSize={62} minSize={20}>
        <Card title="Files" className="h-full">
          <FileBrowser
            files={query.data?.files ?? files}
            total={query.data?.total ?? 0}
            loading={query.isFetching}
            error={query.error?.message ?? null}
            active={active}
            selection={selection}
            onActivate={setActive}
            onSelectionChange={setSelection}
            filter={filter}
            onFilterChange={setFilter}
            sort={sort}
            onSortChange={setSort}
            onRescan={() => setRescan((n) => n + 1)}
            badges={(row) => <Badges atype={row.atype} />}
            emptyText="No result files (.hdf, .h5) in this folder."
          />
        </Card>
      </Pane>
      <PaneHandle orientation="vertical" className="my-1.5 bg-transparent" />
      <Pane id="meta" defaultSize={38} minSize={15}>
        <Card
          title="File shown"
          actions={
            activeRow ? (
              <span className="inline-flex gap-0.5">
                <Badges atype={activeRow.atype} />
              </span>
            ) : null
          }
          className="h-full"
        >
          <MetadataCard
            rows={active ? rows : null}
            loading={summary.isFetching}
            error={active ? (summary.error?.message ?? null) : null}
          />
        </Card>
      </Pane>
    </PaneGroup>
  );
}
