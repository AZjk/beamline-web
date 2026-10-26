// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import type { ReactNode } from "react";
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
  type GroupProps,
  type PanelProps,
} from "react-resizable-panels";

import { cn } from "../cn";

export interface PaneGroupProps extends Omit<GroupProps, "defaultLayout"> {
  children: ReactNode;
  /** Keep the dragged sizes in localStorage under this key; needs an `id` on every pane. */
  storageKey?: string;
  /** The ids of the panes, for the saved layout. */
  panelIds?: string[];
}

function Persistent({
  storageKey,
  panelIds,
  className,
  children,
  ...rest
}: PaneGroupProps & { storageKey: string }) {
  const layout = useDefaultLayout({ id: storageKey, panelIds, storage: window.localStorage });
  return (
    <Group {...layout} className={cn("min-h-0 min-w-0", className)} {...rest}>
      {children}
    </Group>
  );
}

/** Resizable panes side by side (`orientation="horizontal"`) or stacked (`"vertical"`). */
export function PaneGroup({ storageKey, panelIds, className, children, ...rest }: PaneGroupProps) {
  if (storageKey && typeof window !== "undefined" && window.localStorage) {
    return (
      <Persistent storageKey={storageKey} panelIds={panelIds} className={className} {...rest}>
        {children}
      </Persistent>
    );
  }
  return (
    <Group className={cn("min-h-0 min-w-0", className)} {...rest}>
      {children}
    </Group>
  );
}

export function Pane({ className, children, ...rest }: PanelProps & { children: ReactNode }) {
  return (
    <Panel className={cn("flex min-h-0 min-w-0 flex-col", className)} {...rest}>
      {children}
    </Panel>
  );
}

/** The draggable gutter between two panes. */
export function PaneHandle({
  className,
  orientation = "horizontal",
}: {
  className?: string;
  orientation?: "horizontal" | "vertical";
}) {
  return (
    <Separator
      className={cn(
        "relative shrink-0 bg-line transition-colors hover:bg-accent/40 data-[resize-handle-active]:bg-accent",
        orientation === "horizontal" ? "w-[5px] cursor-col-resize" : "h-[5px] cursor-row-resize",
        className,
      )}
      title="Drag to resize"
    />
  );
}
