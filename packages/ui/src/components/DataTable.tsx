// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/**
 * A compact table of records: typed columns, cells editable in place (text, number, yes/no, a
 * choice), a delete button per row. The rows are the app's; an edit reports the row, the key
 * and the new value and the app decides what it becomes.
 */

import { useEffect, useState, type ReactNode } from "react";

import { cn } from "../cn";

export interface ColumnOption {
  value: string;
  label: string;
}

export interface Column<R> {
  key: string;
  label: ReactNode;
  title?: string;
  kind?: "text" | "number" | "boolean" | "select";
  editable?: boolean;
  options?: ColumnOption[] | ((row: R) => ColumnOption[]);
  /** How a value is shown when not being edited. */
  format?: (value: unknown, row: R) => ReactNode;
  align?: "left" | "right";
  width?: string;
}

export interface DataTableProps<R extends { id: string }> {
  columns: Column<R>[];
  rows: R[];
  onChange?: (row: R, key: string, value: string | number | boolean | null) => void;
  onDelete?: (row: R) => void;
  rowTitle?: (row: R) => string | undefined;
  rowClassName?: (row: R) => string | undefined;
  emptyText?: ReactNode;
  className?: string;
  "aria-label"?: string;
}

function Cell<R extends { id: string }>({
  column,
  row,
  onChange,
}: {
  column: Column<R>;
  row: R;
  onChange?: DataTableProps<R>["onChange"];
}) {
  const raw = (row as Record<string, unknown>)[column.key];
  const kind = column.kind ?? "text";
  const [text, setText] = useState(raw === null || raw === undefined ? "" : String(raw));
  useEffect(() => {
    setText(raw === null || raw === undefined ? "" : String(raw));
  }, [raw]);
  if (!column.editable || !onChange) {
    return (
      <>
        {column.format
          ? column.format(raw, row)
          : raw === null || raw === undefined
            ? ""
            : String(raw)}
      </>
    );
  }
  const inputClass =
    "h-5 w-full min-w-0 rounded border border-transparent bg-transparent px-0.5 text-xs outline-none hover:border-line-2 focus:border-accent focus:bg-surface";
  if (kind === "boolean") {
    return (
      <input
        type="checkbox"
        checked={Boolean(raw)}
        onChange={(event) => onChange(row, column.key, event.target.checked)}
        className="h-3.5 w-3.5 accent-accent"
        aria-label={typeof column.label === "string" ? column.label : column.key}
      />
    );
  }
  if (kind === "select") {
    const options =
      typeof column.options === "function" ? column.options(row) : (column.options ?? []);
    return (
      <select
        value={String(raw ?? "")}
        onChange={(event) => onChange(row, column.key, event.target.value)}
        className={cn(inputClass, "cursor-pointer")}
        aria-label={typeof column.label === "string" ? column.label : column.key}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  const commit = () => {
    if (kind === "number") {
      const trimmed = text.trim();
      if (!trimmed) {
        if (raw !== null && raw !== undefined) onChange(row, column.key, null);
        return;
      }
      const value = Number(trimmed);
      if (Number.isFinite(value)) {
        if (value !== raw) onChange(row, column.key, value);
      } else setText(raw === null || raw === undefined ? "" : String(raw));
      return;
    }
    if (text !== (raw ?? "")) onChange(row, column.key, text);
  };
  return (
    <input
      type="text"
      inputMode={kind === "number" ? "decimal" : undefined}
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") (event.target as HTMLInputElement).blur();
        if (event.key === "Escape") setText(raw === null || raw === undefined ? "" : String(raw));
      }}
      className={cn(inputClass, kind === "number" && "text-right tabular-nums")}
      aria-label={typeof column.label === "string" ? column.label : column.key}
    />
  );
}

export function DataTable<R extends { id: string }>({
  columns,
  rows,
  onChange,
  onDelete,
  rowTitle,
  rowClassName,
  emptyText = "Nothing yet.",
  className,
  ...aria
}: DataTableProps<R>) {
  return (
    <div className={cn("overflow-auto rounded-md border border-line", className)}>
      <table className="w-full border-collapse text-xs" aria-label={aria["aria-label"]}>
        <thead className="sticky top-0 bg-surface-2 text-muted">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                title={column.title}
                style={{ width: column.width }}
                className={cn(
                  "px-1.5 py-1 font-medium whitespace-nowrap",
                  column.align === "right" ? "text-right" : "text-left",
                )}
              >
                {column.label}
              </th>
            ))}
            {onDelete ? <th className="w-5" /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (onDelete ? 1 : 0)} className="px-2 py-2 text-muted">
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.id}
                data-id={row.id}
                title={rowTitle?.(row)}
                className={cn("border-t border-line hover:bg-surface-2/60", rowClassName?.(row))}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      "px-1.5 py-0.5 align-middle",
                      column.align === "right" && "text-right tabular-nums",
                    )}
                  >
                    <Cell column={column} row={row} onChange={onChange} />
                  </td>
                ))}
                {onDelete ? (
                  <td className="px-0.5 text-center">
                    <button
                      type="button"
                      onClick={() => onDelete(row)}
                      className="text-muted hover:text-danger"
                      aria-label={`remove ${row.id}`}
                      title="Remove"
                    >
                      ×
                    </button>
                  </td>
                ) : null}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
