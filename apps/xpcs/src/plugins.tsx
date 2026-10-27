// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/** The tabs and panels of the xpcs app, registered with the kit's plugin registry. */

import { PluginRegistry, definePlugin, type PluginProps } from "@beamline-web/ui";

import { InttPanel } from "./panels/InttPanel";
import { ProfilePanel } from "./panels/ProfilePanel";
import { G2Tab } from "./tabs/G2Tab";
import { HdfTab } from "./tabs/HdfTab";
import { Pending } from "./tabs/Pending";
import { TauqTab } from "./tabs/TauqTab";

export const registry = new PluginRegistry().register(
  definePlugin({ id: "g2", label: "g2", placement: "tab", order: 1, component: G2Tab }),
  definePlugin({
    id: "tauq",
    label: "τ(q)",
    placement: "tab",
    order: 2,
    dependsOn: ["g2"],
    component: TauqTab,
  }),
  definePlugin({
    id: "twotime",
    label: "Two-time",
    placement: "tab",
    order: 3,
    component: (p: PluginProps) => <Pending {...p} what="The two-time tab" />,
  }),
  definePlugin({ id: "hdf", label: "Metadata", placement: "tab", order: 4, component: HdfTab }),
  definePlugin({
    id: "profile",
    label: "I(q)",
    placement: "panel",
    order: 1,
    component: ProfilePanel,
  }),
  definePlugin({ id: "intt", label: "I(t)", placement: "panel", order: 2, component: InttPanel }),
);
registry.check();
