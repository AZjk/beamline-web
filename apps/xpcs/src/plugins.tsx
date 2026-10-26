// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/** The tabs and panels of the xpcs app, registered with the kit's plugin registry. */

import { PluginRegistry, definePlugin, type PluginProps } from "@beamline-web/ui";

import { HdfTab } from "./tabs/HdfTab";
import { Pending } from "./tabs/Pending";

export const registry = new PluginRegistry().register(
  definePlugin({
    id: "g2",
    label: "g2",
    placement: "tab",
    order: 1,
    component: (p: PluginProps) => <Pending {...p} what="The g2 tab" />,
  }),
  definePlugin({
    id: "tauq",
    label: "τ(q)",
    placement: "tab",
    order: 2,
    dependsOn: ["g2"],
    component: (p: PluginProps) => <Pending {...p} what="The τ(q) tab" />,
  }),
  definePlugin({
    id: "twotime",
    label: "Two-time",
    placement: "tab",
    order: 3,
    component: (p: PluginProps) => <Pending {...p} what="The two-time tab" />,
  }),
  definePlugin({ id: "hdf", label: "Metadata", placement: "tab", order: 4, component: HdfTab }),
);
registry.check();
