// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import type { ReactNode } from "react";

import { Busy, Placeholder } from "../components/Busy";

export interface MetadataCardProps {
  /** `[label, value]` rows; null while nothing is shown. */
  rows: [string, string][] | null;
  loading?: boolean;
  error?: string | null;
  emptyText?: string;
  /** Rendered beside the rows' table, e.g. the file's badges. */
  header?: ReactNode;
}

/** The metadata card of the file shown: label and value rows. */
export function MetadataCard({
  rows,
  loading,
  error,
  emptyText = "Click a file to see its metadata.",
  header,
}: MetadataCardProps) {
  return (
    <div className="relative h-full min-h-0 overflow-auto">
      <Busy active={Boolean(loading)} />
      {error ? (
        <Placeholder error>{error}</Placeholder>
      ) : !rows ? (
        <Placeholder>{emptyText}</Placeholder>
      ) : (
        <>
          {header ? <div className="px-2.5 pt-1.5">{header}</div> : null}
          <table className="w-full text-xs">
            <tbody>
              {rows.map(([label, value], i) => (
                <tr key={i} className="border-t border-line first:border-t-0">
                  <th className="w-[38%] px-2.5 py-0.5 text-left align-top font-medium text-ink-2">
                    {label}
                  </th>
                  <td className="px-2 py-0.5 align-top break-words text-ink tabular-nums">
                    {value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
