// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import type { ReactNode } from "react";

import { cn } from "../cn";
import { Pane, PaneGroup, PaneHandle } from "../components/Panes";
import { Toaster } from "../components/Toaster";

export interface AppShellProps {
  /** The tool's mark and name, top left. */
  brand: ReactNode;
  /** What is served (the folder), beside the brand. */
  subtitle?: ReactNode;
  /** The message bar: the file shown, a job's progress, an error. */
  status?: ReactNode;
  version?: string;
  /** The three columns: files and metadata, the image and its panels, the analysis tabs. */
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  /** Column widths in percent, used until the user drags a gutter. */
  defaultLayout?: [number, number, number];
  /** Where the dragged sizes are kept (localStorage). */
  storageKey?: string;
  className?: string;
}

/**
 * The frame every app renders into: a top bar and three resizable columns. The columns' sizes
 * survive a reload. Toasts render at the bottom right.
 */
export function AppShell({
  brand,
  subtitle,
  status,
  version,
  left,
  center,
  right,
  defaultLayout = [22, 50, 28],
  storageKey = "shell",
  className,
}: AppShellProps) {
  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-surface-2 text-ink", className)}>
      <header className="flex h-9 shrink-0 items-center gap-3 border-b border-line bg-surface px-3">
        <div className="flex shrink-0 items-center gap-2">{brand}</div>
        {subtitle ? (
          <div className="min-w-0 flex-1 truncate font-mono text-xs text-muted">{subtitle}</div>
        ) : (
          <div className="flex-1" />
        )}
        <div role="status" className="max-w-[40%] truncate text-xs text-ink-2">
          {status}
        </div>
        {version ? <div className="shrink-0 text-xs text-muted">v{version}</div> : null}
      </header>
      <PaneGroup
        orientation="horizontal"
        storageKey={storageKey}
        panelIds={["left", "center", "right"]}
        className="flex-1"
      >
        <Pane id="left" defaultSize={defaultLayout[0]} minSize={12}>
          {left}
        </Pane>
        <PaneHandle />
        <Pane id="center" defaultSize={defaultLayout[1]} minSize={25}>
          {center}
        </Pane>
        <PaneHandle />
        <Pane id="right" defaultSize={defaultLayout[2]} minSize={18}>
          {right}
        </Pane>
      </PaneGroup>
      <Toaster />
    </div>
  );
}

/** A card: a titled box inside a column. */
export function Card({
  title,
  children,
  className,
  actions,
}: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <section
      className={cn("flex min-h-0 flex-col rounded-md border border-line bg-surface", className)}
    >
      {title ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-line px-2.5 py-1 text-xs font-semibold text-ink-2">
          <span className="min-w-0 flex-1 truncate">{title}</span>
          {actions}
        </div>
      ) : null}
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}
