// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "../components/Button";
import { Busy, Placeholder } from "../components/Busy";
import { fmt } from "../format";

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface JsonTreeProps {
  /** The groups to show: an object of nested objects and leaves. */
  data: Record<string, JsonValue> | null;
  loading?: boolean;
  error?: string | null;
  emptyText?: string;
}

function isGroup(value: JsonValue): value is { [key: string]: JsonValue } {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function valueText(value: JsonValue): string {
  if (value === null || value === undefined) return "–";
  if (Array.isArray(value)) {
    const flat = (value as JsonValue[]).flat(Infinity as 1) as JsonValue[];
    const items = (xs: JsonValue[]) =>
      xs.map((v) => (typeof v === "number" ? fmt(v) : String(v))).join(", ");
    return flat.length > 12
      ? `[${items(flat.slice(0, 8))}, … ${flat.length} values]`
      : `[${items(flat)}]`;
  }
  if (typeof value === "number") return fmt(value, 6);
  return String(value);
}

function highlight(text: string, words: string[]): ReactNode {
  if (!words.length) return text;
  const pattern = new RegExp(
    `(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "ig",
  );
  return text.split(pattern).map((part, i) =>
    part && words.some((w) => w.toLowerCase() === part.toLowerCase()) ? (
      <mark key={i} className="rounded bg-series-4/40 px-0.5">
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function Group({
  name,
  value,
  words,
  depth,
  openAll,
}: {
  name: string;
  value: { [key: string]: JsonValue };
  words: string[];
  depth: number;
  openAll: boolean | null;
}) {
  const entries = Object.entries(value);
  const leaves = entries.filter(([, v]) => !isGroup(v));
  const nested = entries.filter(([, v]) => isGroup(v));
  const rows = leaves.filter(
    ([k, v]) =>
      !words.length || words.every((w) => `${k} ${valueText(v)}`.toLowerCase().includes(w)),
  );
  const subs = nested
    .map(([k, v]) => (
      <Group
        key={k}
        name={k}
        value={v as { [key: string]: JsonValue }}
        words={words}
        depth={depth + 1}
        openAll={openAll}
      />
    ))
    .filter(Boolean);
  const [open, setOpen] = useState(depth === 0);
  useEffect(() => {
    if (openAll !== null) setOpen(openAll);
  }, [openAll]);
  useEffect(() => {
    if (words.length) setOpen(true);
  }, [words.length]);
  if (!rows.length && !subs.length) return null;
  return (
    <details
      open={open}
      onToggle={(event) => setOpen((event.target as HTMLDetailsElement).open)}
      className="pl-2"
    >
      <summary className="cursor-pointer py-0.5 text-xs font-medium text-ink-2 select-none hover:text-ink">
        {name}
      </summary>
      {rows.length ? (
        <table className="w-full text-xs">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k} className="border-t border-line">
                <td className="w-[40%] px-2 py-0.5 align-top font-mono text-2xs text-ink-2">
                  {highlight(k, words)}
                </td>
                <td className="px-2 py-0.5 align-top break-all tabular-nums">
                  {highlight(valueText(v), words)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {subs}
    </details>
  );
}

/** A filterable tree of nested groups and their values (a file's metadata). */
export function JsonTree({
  data,
  loading,
  error,
  emptyText = "Click a file to see its metadata.",
}: JsonTreeProps) {
  const [text, setText] = useState("");
  const [openAll, setOpenAll] = useState<boolean | null>(null);
  const tick = useRef(0);
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const groups = data ? Object.entries(data).filter(([, v]) => isGroup(v)) : [];
  const setAll = (open: boolean) => {
    tick.current += 1;
    setOpenAll(open);
    // let a later toggle of the same kind apply again
    window.setTimeout(() => setOpenAll(null), 0);
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 p-1.5">
        <input
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Filter keys and values"
          aria-label="filter metadata"
          className="h-7 min-w-0 flex-1 rounded-md border border-line-2 bg-surface px-2 text-[13px] outline-none focus:border-accent"
        />
        <Button variant="link" size="sm" onClick={() => setAll(true)}>
          expand all
        </Button>
        <Button variant="link" size="sm" onClick={() => setAll(false)}>
          collapse
        </Button>
      </div>
      <div className="relative min-h-0 flex-1 overflow-auto pb-2">
        <Busy active={Boolean(loading)} />
        {error ? (
          <Placeholder error>{error}</Placeholder>
        ) : !data ? (
          <Placeholder>{emptyText}</Placeholder>
        ) : (
          groups.map(([name, value]) => (
            <Group
              key={name}
              name={name}
              value={value as { [key: string]: JsonValue }}
              words={words}
              depth={0}
              openAll={openAll}
            />
          ))
        )}
      </div>
    </div>
  );
}
