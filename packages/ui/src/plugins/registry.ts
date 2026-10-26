// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/**
 * The plugin registry: an app's tabs and panels register here with where they go, and the shell
 * places them. The contract is gixsu's tool contract generalized: an id, a label, a placement,
 * a component, the ids it depends on, and an order.
 */

import type { ComponentType, ReactNode } from "react";

export type Placement = "tab" | "panel" | "side";

export interface PluginProps {
  /** Whether the plugin is on screen; a hidden tab should not fetch, only mark itself stale. */
  visible: boolean;
}

export interface Plugin {
  id: string;
  label: ReactNode;
  /** A tab of the analysis column, a panel under the image, or a side tab in the files column. */
  placement: Placement;
  component: ComponentType<PluginProps>;
  title?: string;
  /** Plugins whose results this one reads through the shared store. */
  dependsOn?: string[];
  order?: number;
}

export function definePlugin(plugin: Plugin): Plugin {
  return plugin;
}

export class PluginRegistry {
  private readonly plugins = new Map<string, Plugin>();

  register(...plugins: Plugin[]): this {
    for (const plugin of plugins) {
      if (this.plugins.has(plugin.id)) throw new Error(`plugin "${plugin.id}" registered twice`);
      this.plugins.set(plugin.id, plugin);
    }
    return this;
  }

  get(id: string): Plugin | undefined {
    return this.plugins.get(id);
  }

  /** The plugins of a placement, in order (registration order for equal `order`). */
  list(placement?: Placement): Plugin[] {
    const all = [...this.plugins.values()];
    const chosen = placement ? all.filter((p) => p.placement === placement) : all;
    return chosen
      .map((p, i) => [p, i] as const)
      .sort((a, b) => (a[0].order ?? 0) - (b[0].order ?? 0) || a[1] - b[1])
      .map(([p]) => p);
  }

  /** Every dependency of every plugin is registered. */
  check(): void {
    for (const plugin of this.plugins.values()) {
      for (const dep of plugin.dependsOn ?? []) {
        if (!this.plugins.has(dep))
          throw new Error(`plugin "${plugin.id}" depends on "${dep}", which is not registered`);
      }
    }
  }
}
