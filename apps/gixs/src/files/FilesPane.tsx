// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/** The left column: the folder's files (with a follow-the-newest mode), the metadata and
 * processing status of the file shown, and the setup tools' tabs. */

import {
  Card,
  FileBrowser,
  MetadataCard,
  Pane,
  PaneGroup,
  PaneHandle,
  Tabs,
  Toggle,
  useLocalState,
  type FileRow as KitFileRow,
  type FileSort,
} from "@beamline-web/ui";
import { useEffect, useMemo, useRef, useState } from "react";

import { queryOf } from "../api/context";
import { useFiles, useSummary } from "../api/queries";
import { registry } from "../plugins";
import { useAppStore } from "../store";

function stamp(mtime: number): string {
  const d = new Date(mtime * 1000);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

const STATE_CLASS: Record<string, string> = {
  ok: "border-line bg-surface-2 text-ink",
  warn: "border-amber-300 bg-amber-50 text-amber-900",
  info: "border-line bg-surface text-muted",
};

function SideTabs() {
  const plugins = registry.list("side");
  const [current, setCurrent] = useLocalState("gixs:side", plugins[0]?.id ?? "");
  const items = useMemo(
    () => plugins.map((p) => ({ id: p.id, label: p.label, title: p.title })),
    [plugins],
  );
  const value = items.some((t) => t.id === current) ? current : (items[0]?.id ?? "");
  return (
    <Tabs
      tabs={items}
      value={value}
      onChange={setCurrent}
      aria-label="Setup tools"
      className="h-full"
    >
      {(id) => {
        const Component = registry.get(id)!.component;
        return (
          <div className="h-full min-h-0">
            <Component visible={id === value} />
          </div>
        );
      }}
    </Tabs>
  );
}

export function FilesPane({ onListed }: { onListed?: () => void }) {
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useLocalState<FileSort>("gixs:files:sort", "time:desc");
  const [follow, setFollow] = useState(false);
  const [rescan, setRescan] = useState(0);
  const query = useFiles(filter, rescan, follow);
  const active = useAppStore((s) => s.active);
  const selection = useAppStore((s) => s.selection);
  const setActive = useAppStore((s) => s.setActive);
  const setSelection = useAppStore((s) => s.setSelection);
  const setFiles = useAppStore((s) => s.setFiles);
  const files = useAppStore((s) => s.files);
  const processing = useAppStore((s) => s.processing);
  const fileOverrides = useAppStore((s) => s.fileOverrides);
  const newest = useRef<string | null>(null);

  useEffect(() => {
    if (!query.data) return;
    setFiles(query.data.files, query.data.total);
    onListed?.();
    const known = new Set(query.data.files.map((f) => f.id));
    const state = useAppStore.getState();
    const kept = state.selection.filter((id) => known.has(id));
    if (kept.length !== state.selection.length) setSelection(kept);
    if (state.active && !known.has(state.active)) setActive(null);
    const first = query.data.files[0]?.id ?? null; // newest first
    if (follow && first && first !== newest.current && first !== state.active) setActive(first);
    newest.current = first;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);

  const rows = useMemo<KitFileRow[]>(() => {
    const [key, direction] = sort.split(":") as ["name" | "time", "asc" | "desc"];
    const list = (query.data?.files ?? files).map((f) => ({
      id: f.id,
      label: f.label,
      modified: stamp(f.mtime),
      atype: [] as string[],
      mtime: f.mtime,
    }));
    list.sort((a, b) =>
      key === "name"
        ? a.label.localeCompare(b.label)
        : a.mtime - b.mtime || a.label.localeCompare(b.label),
    );
    if (direction === "desc") list.reverse();
    return list;
  }, [query.data, files, sort]);

  const summary = useSummary(active, queryOf({ processing, fileOverrides }, active));
  const metaRows = useMemo(
    () =>
      summary.data?.rows.map(
        (r) => [r.label, r.changed ? `${r.value} *` : r.value] as [string, string],
      ) ?? null,
    [summary.data],
  );
  const changed = summary.data?.rows.some((r) => r.changed) ?? false;

  return (
    <PaneGroup
      orientation="vertical"
      storageKey="gixs:files"
      panelIds={["list", "meta", "side"]}
      className="h-full p-1.5"
    >
      <Pane id="list" defaultSize={40} minSize={15}>
        <Card title="Files" className="h-full">
          <FileBrowser
            files={rows}
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
            badges={() => null}
            emptyText="No dataset files (.h5, .hdf, .tif) in this folder."
            extras={
              <Toggle
                checked={follow}
                onChange={setFollow}
                title="Show the newest file as files arrive (the folder is checked every 5 s)"
              >
                follow the newest file
              </Toggle>
            }
          />
        </Card>
      </Pane>
      <PaneHandle orientation="vertical" className="my-1.5 bg-transparent" />
      <Pane id="meta" defaultSize={28} minSize={10}>
        <Card title="Metadata" className="h-full">
          <div className="flex h-full min-h-0 flex-col">
            <div className="min-h-0 flex-1 overflow-auto">
              <MetadataCard
                rows={active ? metaRows : null}
                loading={summary.isFetching}
                error={active ? (summary.error?.message ?? null) : null}
              />
              {changed ? (
                <p className="px-2 pb-1 text-2xs text-muted">* set by the setup file or in Setup</p>
              ) : null}
            </div>
            {summary.data ? (
              <div
                className="flex shrink-0 flex-wrap gap-1 border-t border-line p-1.5"
                aria-label="processing status"
              >
                {summary.data.status.map((item) => (
                  <span
                    key={item.key}
                    title={item.title}
                    className={`rounded border px-1 text-2xs ${STATE_CLASS[item.state] ?? STATE_CLASS.info}`}
                  >
                    {item.text}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </Card>
      </Pane>
      <PaneHandle orientation="vertical" className="my-1.5 bg-transparent" />
      <Pane id="side" defaultSize={32} minSize={10}>
        <div className="h-full min-h-0 rounded-md border border-line bg-surface">
          <SideTabs />
        </div>
      </Pane>
    </PaneGroup>
  );
}
