// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import * as RadixTabs from "@radix-ui/react-tabs";
import type { ReactNode } from "react";

import { cn } from "../cn";

export interface TabItem {
  id: string;
  label: ReactNode;
  /** The tab's content changed while it was hidden: a dot on its handle. */
  stale?: boolean;
  title?: string;
}

export interface TabsProps {
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
  /** The content of each tab, by id; every tab's content stays mounted (its state survives). */
  children: (id: string) => ReactNode;
  className?: string;
  "aria-label"?: string;
}

/** Side tabs: a strip of handles and one content area, all contents mounted. */
export function Tabs({ tabs, value, onChange, children, className, ...aria }: TabsProps) {
  return (
    <RadixTabs.Root
      value={value}
      onValueChange={onChange}
      className={cn("flex min-h-0 flex-1 flex-col", className)}
    >
      <RadixTabs.List
        aria-label={aria["aria-label"]}
        className="flex shrink-0 gap-0.5 border-b border-line bg-surface-2 px-1 pt-1"
      >
        {tabs.map((tab) => (
          <RadixTabs.Trigger
            key={tab.id}
            value={tab.id}
            title={tab.title}
            className={cn(
              "relative rounded-t-md border border-b-0 border-transparent px-3 py-1 text-[13px] text-ink-2",
              "hover:text-ink data-[state=active]:border-line data-[state=active]:bg-surface data-[state=active]:text-ink",
            )}
          >
            {tab.label}
            {tab.stale ? (
              <i
                aria-label="changed"
                className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-accent"
              />
            ) : null}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {tabs.map((tab) => (
        <RadixTabs.Content
          key={tab.id}
          value={tab.id}
          forceMount
          className="min-h-0 flex-1 data-[state=inactive]:hidden"
        >
          {children(tab.id)}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}
