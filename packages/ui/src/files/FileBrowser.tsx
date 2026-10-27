// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import { RefreshCw } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";

import { Button } from "../components/Button";
import { Busy, Placeholder } from "../components/Busy";
import { SelectField } from "../components/SelectField";
import { cn } from "../cn";

export interface FileRow {
  id: string;
  label: string;
  /** The modification time as text, "YYYY-MM-DD HH:MM". */
  modified: string;
  /** What the file holds (the tool's analysis types); null for a file that cannot be read. */
  atype: string[] | null;
}

export type FileSort = "name:asc" | "name:desc" | "time:desc" | "time:asc";

export interface FileBrowserProps {
  files: FileRow[];
  /** Files matching the filter before any limit. */
  total: number;
  loading?: boolean;
  error?: string | null;
  /** The file shown. */
  active: string | null;
  /** The files checked, in list order. */
  selection: string[];
  onActivate: (id: string) => void;
  onSelectionChange: (ids: string[]) => void;
  filter: string;
  onFilterChange: (text: string) => void;
  sort: FileSort;
  onSortChange: (sort: FileSort) => void;
  onRescan: () => void;
  /** The badges of a row (its analysis types); a default renders each type's first letters. */
  badges?: (row: FileRow) => ReactNode;
  emptyText?: string;
  /** The app's own controls under the filter row (a follow-the-newest toggle, a count). */
  extras?: ReactNode;
}

const SORTS: { value: FileSort; label: string }[] = [
  { value: "name:asc", label: "name ↑" },
  { value: "name:desc", label: "name ↓" },
  { value: "time:desc", label: "newest first" },
  { value: "time:asc", label: "oldest first" },
];

function defaultBadges(row: FileRow): ReactNode {
  if (!row.atype) {
    return (
      <span
        className="rounded bg-danger/10 px-1 text-[10px] text-danger"
        title="not a readable result file"
      >
        ?
      </span>
    );
  }
  return row.atype.map((t) => (
    <span
      key={t}
      className="rounded bg-accent/10 px-1 text-[10px] font-medium text-accent"
      title={t}
    >
      {t.replace(/[a-z]/g, "").slice(0, 2) || t.slice(0, 2).toUpperCase()}
    </span>
  ));
}

/** A label with a line-break opportunity after every underscore or hyphen. */
function breakable(label: string): ReactNode {
  const parts = label.split(/(?<=[_-])/);
  return parts.map((part, i) => (
    <span key={i}>
      {i ? <wbr /> : null}
      {part}
    </span>
  ));
}

/**
 * The folder's files: a filter, a sort, a rescan; click a row to show it, check rows to
 * compare them (shift-click a range, ctrl-click toggles); arrows move the file shown, space checks it.
 */
export function FileBrowser({
  files,
  total,
  loading,
  error,
  active,
  selection,
  onActivate,
  onSelectionChange,
  filter,
  onFilterChange,
  sort,
  onSortChange,
  onRescan,
  badges = defaultBadges,
  emptyText = "No result files in this folder.",
  extras,
}: FileBrowserProps) {
  const [text, setText] = useState(filter);
  const anchor = useRef<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  useEffect(() => setText(filter), [filter]);
  useEffect(() => {
    if (text === filter) return;
    const timer = window.setTimeout(() => onFilterChange(text), 200);
    return () => window.clearTimeout(timer);
  }, [text, filter, onFilterChange]);

  const checked = new Set(selection);
  const readable = files.filter((f) => f.atype);
  const order = new Map(files.map((f, i) => [f.id, i]));
  const ordered = (ids: Iterable<string>) =>
    [...new Set(ids)]
      .filter((id) => order.has(id) || checked.has(id))
      .sort((a, b) => (order.get(a) ?? 1e9) - (order.get(b) ?? 1e9));

  const setChecked = (id: string, on: boolean) => {
    if (on === checked.has(id)) return;
    onSelectionChange(ordered(on ? [...selection, id] : selection.filter((x) => x !== id)));
  };
  const checkRange = (from: string, to: string, on: boolean) => {
    const ids = files.map((f) => f.id);
    let a = ids.indexOf(from);
    let b = ids.indexOf(to);
    if (a < 0 || b < 0) return;
    if (a > b) [a, b] = [b, a];
    const span = ids.slice(a, b + 1).filter((id) => files[order.get(id)!]?.atype);
    onSelectionChange(
      ordered(on ? [...selection, ...span] : selection.filter((id) => !span.includes(id))),
    );
  };
  const checkShown = (on: boolean) => {
    const shown = readable.map((f) => f.id);
    onSelectionChange(
      ordered(on ? [...selection, ...shown] : selection.filter((id) => !shown.includes(id))),
    );
  };
  const rowClick = (event: MouseEvent, row: FileRow) => {
    if (event.shiftKey && anchor.current && anchor.current !== row.id)
      checkRange(anchor.current, row.id, true);
    else if (event.ctrlKey || event.metaKey) {
      if (row.atype) setChecked(row.id, !checked.has(row.id));
    } else onActivate(row.id);
    anchor.current = row.id;
  };
  const boxClick = (event: MouseEvent<HTMLInputElement>, row: FileRow) => {
    event.stopPropagation();
    const on = (event.target as HTMLInputElement).checked;
    if (event.shiftKey && anchor.current && anchor.current !== row.id)
      checkRange(anchor.current, row.id, on);
    else setChecked(row.id, on);
    anchor.current = row.id;
  };
  const moveActive = (step: 1 | -1) => {
    const ids = files.map((f) => f.id);
    if (!ids.length) return;
    let i = active ? ids.indexOf(active) : -1;
    i = i < 0 ? (step > 0 ? 0 : ids.length - 1) : Math.max(0, Math.min(ids.length - 1, i + step));
    const id = ids[i];
    if (id === undefined) return;
    onActivate(id);
    tableRef.current
      ?.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  };
  const keys = (event: KeyboardEvent) => {
    if (
      (event.target as HTMLElement).tagName === "INPUT" &&
      (event.target as HTMLInputElement).type !== "checkbox"
    )
      return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
    } else if (event.key === " " && active) {
      event.preventDefault();
      const row = files.find((f) => f.id === active);
      if (row?.atype) setChecked(active, !checked.has(active));
    }
  };

  const checkedShown = readable.filter((f) => checked.has(f.id)).length;
  const allRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (allRef.current)
      allRef.current.indeterminate = checkedShown > 0 && checkedShown < readable.length;
  }, [checkedShown, readable.length]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-1.5 p-1.5">
        <input
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Filter files"
          aria-label="filter files"
          autoComplete="off"
          className="h-7 min-w-0 flex-1 rounded-md border border-line-2 bg-surface px-2 text-[13px] outline-none focus:border-accent"
        />
        <SelectField
          options={SORTS}
          value={sort}
          onChange={onSortChange}
          title="Sort"
          aria-label="sort"
        />
        <Button
          onClick={onRescan}
          title="Look for new files"
          aria-label="rescan"
          disabled={loading}
        >
          <RefreshCw size={13} />
        </Button>
      </div>
      {extras ? (
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 px-1.5 pb-1 text-xs">
          {extras}
        </div>
      ) : null}
      <div
        ref={tableRef}
        tabIndex={0}
        onKeyDown={keys}
        className="relative min-h-0 flex-1 overflow-auto outline-none focus-visible:ring-1 focus-visible:ring-accent"
      >
        <Busy active={Boolean(loading)} />
        {error ? (
          <Placeholder error>{error}</Placeholder>
        ) : files.length === 0 ? (
          <Placeholder>{total ? "No file matches the filter." : emptyText}</Placeholder>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 bg-surface-2 text-left text-2xs text-muted uppercase">
              <tr>
                <th className="w-6 px-1.5 py-1">
                  <input
                    ref={allRef}
                    type="checkbox"
                    aria-label="check every file shown"
                    checked={readable.length > 0 && checkedShown === readable.length}
                    onChange={(event) => checkShown(event.target.checked)}
                    className="accent-accent"
                  />
                </th>
                <th className="px-1 py-1 font-medium">file</th>
                <th className="px-1 py-1" />
                <th className="px-1.5 py-1 font-medium">modified</th>
              </tr>
            </thead>
            <tbody>
              {files.map((row) => (
                <tr
                  key={row.id}
                  data-id={row.id}
                  title={row.id}
                  onClick={(event) => rowClick(event, row)}
                  aria-selected={row.id === active}
                  className={cn(
                    "cursor-pointer border-t border-line hover:bg-surface-3",
                    row.id === active && "bg-accent/10 hover:bg-accent/15",
                    checked.has(row.id) && "font-medium",
                    !row.atype && "text-muted",
                  )}
                >
                  <td className="px-1.5 py-1 align-top">
                    <input
                      type="checkbox"
                      aria-label={`check ${row.label}`}
                      checked={checked.has(row.id)}
                      disabled={!row.atype}
                      onClick={(event) => boxClick(event, row)}
                      onChange={() => {}}
                      className="accent-accent"
                    />
                  </td>
                  <td className="px-1 py-1 align-top break-words">{breakable(row.label)}</td>
                  <td className="px-1 py-1 align-top whitespace-nowrap">
                    <span className="inline-flex gap-0.5">{badges(row)}</span>
                  </td>
                  <td className="px-1.5 py-1 align-top whitespace-nowrap text-muted tabular-nums">
                    {row.modified.slice(0, 10)}
                    <br />
                    {row.modified.slice(11)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-x-1.5 px-2 py-1 text-2xs text-muted">
        <span>
          {files.length}
          {files.length < total ? ` of ${total}` : ""} file{total === 1 ? "" : "s"} ·{" "}
          {selection.length ? `${selection.length} checked` : "none checked"}
        </span>
        <span>—</span>
        <Button variant="link" size="sm" onClick={() => checkShown(true)} className="text-2xs">
          check shown
        </Button>
        <span>·</span>
        <Button
          variant="link"
          size="sm"
          onClick={() => checkShown(false)}
          disabled={!selection.length}
          className="text-2xs"
        >
          clear
        </Button>
      </div>
    </div>
  );
}
