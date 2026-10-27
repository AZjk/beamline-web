// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/** What the tools share: the result-over-controls layout, jobs in the message bar, downloads,
 * the cut choices, the fields grid. */

import {
  ApiError,
  JobError,
  apiUrl,
  runJob,
  sessionHeaders,
  type JobState,
} from "@beamline-web/client";
import { Pane, PaneGroup, PaneHandle, toast } from "@beamline-web/ui";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

import type { Roi } from "../api/client";
import { labelOf, useAppStore, type AppState } from "../store";

export function messageOf(error: unknown): string {
  if (error instanceof JobError || error instanceof ApiError || error instanceof Error)
    return error.message;
  return String(error);
}

/** A tool's tab: its result above its controls, the split draggable and remembered. */
export function ResultAndControls({
  id,
  result,
  controls,
}: {
  id: string;
  result: ReactNode;
  controls: ReactNode;
}) {
  return (
    <PaneGroup
      orientation="vertical"
      storageKey={`gixs:tab:${id}`}
      panelIds={["result", "controls"]}
      className="h-full"
    >
      <Pane id="result" defaultSize={58} minSize={15}>
        <div className="relative h-full min-h-0 overflow-auto border-b border-line bg-surface">
          {result}
        </div>
      </Pane>
      <PaneHandle orientation="vertical" className="bg-transparent" />
      <Pane id="controls" defaultSize={42} minSize={10}>
        <div className="h-full min-h-0 overflow-auto p-2 text-xs">{controls}</div>
      </Pane>
    </PaneGroup>
  );
}

/** A tool with no result view: its controls fill the tab. */
export function ControlsOnly({ children }: { children: ReactNode }) {
  return <div className="h-full min-h-0 overflow-auto p-2 text-xs">{children}</div>;
}

/** Labeled fields side by side: as many 250 px columns as fit. */
export function Fields({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] items-center gap-x-3 gap-y-1.5 ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

/** A labeled control on its own row of the fields grid: the label left, the control right. */
export function Row({
  label,
  unit,
  title,
  children,
}: {
  label: ReactNode;
  unit?: ReactNode;
  title?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex items-center gap-2" title={title}>
      <span className="w-28 shrink-0 text-muted">{label}</span>
      <span className="min-w-0 flex-1">{children}</span>
      {unit ? <span className="w-10 shrink-0 text-muted">{unit}</span> : null}
    </label>
  );
}

export function Section({
  title,
  hint,
  children,
}: {
  title: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-1.5 border-t border-line pt-2 first:border-t-0 first:pt-0">
      <h4 className="text-xs font-semibold text-ink">{title}</h4>
      {children}
      {hint ? <p className="text-2xs text-muted">{hint}</p> : null}
    </section>
  );
}

export function Message({ text, error = false }: { text: string | null; error?: boolean }) {
  if (!text) return null;
  return <p className={error ? "text-danger" : "text-muted"}>{text}</p>;
}

export function Summary({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <pre className="max-h-40 overflow-auto rounded-md border border-line bg-surface-2 p-2 text-2xs whitespace-pre-wrap">
      {text}
    </pre>
  );
}

/** The height of a box, kept up to date, for a figure that fills it. */
export function useBoxHeight(initial = 300): [RefObject<HTMLDivElement>, number] {
  const box = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(initial);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setHeight(el.clientHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [box, height];
}

/** Run a job with its progress in the message bar; a failure is a toast and null. */
export function useJob() {
  const setMessage = useAppStore((s) => s.setMessage);
  const [running, setRunning] = useState(false);
  const run = async <R,>(name: string, start: () => Promise<unknown>): Promise<R | null> => {
    setRunning(true);
    try {
      const result = await runJob<R>(start as () => Promise<JobState<R>>, {
        onProgress: (state) =>
          setMessage(
            `${name} …${state.total ? ` ${state.done} / ${state.total}` : ""}${
              state.message ? ` · ${state.message}` : ""
            }`,
          ),
      });
      setMessage(null);
      return result;
    } catch (error) {
      setMessage(null);
      toast(`${name} failed`, { kind: "error", description: messageOf(error) });
      return null;
    } finally {
      setRunning(false);
    }
  };
  return { run, running };
}

function saveBlob(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function saveText(text: string, filename: string, type = "text/plain") {
  saveBlob(new Blob([text], { type }), filename);
}

/** Post to a download route and save what comes back. */
export async function downloadPost(path: string, body: unknown, filename: string) {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers: { ...sessionHeaders(), "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new ApiError(response.status, await response.text());
  saveBlob(await response.blob(), filename);
}

/** (label, id) of the enabled ROIs: "name — along q_z". */
export function roiChoices(boxes: Roi[], mapLabel: (name: string) => string) {
  return boxes
    .filter((r) => r.enabled !== false)
    .map((r) => ({
      value: r.id,
      label: `${r.name || r.id} — along ${mapLabel(r.along ?? r.y_map)}`,
    }));
}

/** One choice per enabled ROI and file (the file shown first), as "roi-id|file". */
export function cutChoices(
  state: Pick<AppState, "files" | "active" | "selection" | "boxes">,
  files: string[],
) {
  const out: { value: string; label: string }[] = [];
  for (const file of files)
    for (const roi of state.boxes)
      if (roi.enabled !== false)
        out.push({
          value: `${roi.id}|${file}`,
          label: `${roi.name || roi.id} · ${labelOf(state, file)}`,
        });
  return out;
}

export function splitChoice(value: string | null): [string, string] | null {
  if (!value) return null;
  const at = value.indexOf("|");
  return at < 0 ? null : [value.slice(0, at), value.slice(at + 1)];
}

/** Three numbers from "0 0 1" or "0,0,1"; null if blank. */
export function parseVector(text: string): number[] | null {
  const parts = text.replace(/,/g, " ").split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  if (parts.length !== 3) throw new Error(`${text}: give three numbers, like 0 0 1`);
  const values = parts.map(Number);
  if (values.some((v) => !Number.isFinite(v))) throw new Error(`${text}: give three numbers`);
  return values;
}

/** The peaks to fit: a number to find ("2"), or starting positions ("0.021, 0.042"). */
export function parsePeaks(text: string): number | number[] {
  const parts = text.replace(/;/g, ",").replace(/,/g, " ").split(/\s+/).filter(Boolean);
  if (!parts.length) return 1;
  if (parts.length === 1 && /^\d+$/.test(parts[0]!)) return Math.max(1, Number(parts[0]));
  const values = parts.map(Number);
  if (values.some((v) => !Number.isFinite(v)))
    throw new Error(`peaks ${text}: give a number (to find) or starting positions`);
  return values;
}

export const MAP_NAMES: Record<string, string> = {
  x: "column",
  y: "row",
  qr: "q_r",
  qz: "q_z",
  qx: "q_x",
  qy: "q_y",
  q: "q",
  chi: "χ",
  alpha_f: "α_f",
  two_theta_f: "2θ_f",
};
export const mapName = (name: string) => MAP_NAMES[name] ?? name;
