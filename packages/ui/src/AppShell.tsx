// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import type { ReactNode } from "react";

export interface AppShellProps {
  /** The tool's display name, e.g. "pyXPCSViewer web". */
  title: string;
  /** The tool's version, shown beside the title when known. */
  version?: string;
  children?: ReactNode;
}

/**
 * The outer frame every app renders into: a top bar and the content area.
 * Phase 1 grows it into the three resizable panes, side tabs, message bar and toasts.
 */
export function AppShell({ title, version, children }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="flex items-center gap-3 border-b border-neutral-200 px-4 py-2 dark:border-neutral-800">
        <h1 className="text-base font-semibold">{title}</h1>
        {version ? <span className="text-xs text-neutral-500">{version}</span> : null}
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
