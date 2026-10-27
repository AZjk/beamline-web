// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/** The tools of the gixsu app, registered with the kit's plugin registry: seven analyses as
 * tabs of the right-hand column, Calibrate and Setup as side tabs under the files. */

import { PluginRegistry, definePlugin } from "@beamline-web/ui";

import { CalibrateTab } from "./side/CalibrateTab";
import { SetupTab } from "./side/SetupTab";
import { CutsTab } from "./tabs/CutsTab";
import { IncidenceTab } from "./tabs/IncidenceTab";
import { IndexTab } from "./tabs/IndexTab";
import { PeaksTab } from "./tabs/PeaksTab";
import { SeriesTab } from "./tabs/SeriesTab";
import { TextureTab } from "./tabs/TextureTab";
import { XrrTab } from "./tabs/XrrTab";

export const registry = new PluginRegistry().register(
  definePlugin({ id: "cuts", label: "Cuts", placement: "tab", order: 1, component: CutsTab }),
  definePlugin({
    id: "peaks",
    label: "Peaks",
    placement: "tab",
    order: 2,
    dependsOn: ["cuts"],
    component: PeaksTab,
  }),
  definePlugin({
    id: "series",
    label: "Series",
    placement: "tab",
    order: 3,
    dependsOn: ["cuts"],
    component: SeriesTab,
  }),
  definePlugin({ id: "index", label: "Index", placement: "tab", order: 4, component: IndexTab }),
  definePlugin({
    id: "texture",
    label: "Texture",
    placement: "tab",
    order: 5,
    dependsOn: ["peaks"],
    component: TextureTab,
  }),
  definePlugin({ id: "xrr", label: "XRR", placement: "tab", order: 6, component: XrrTab }),
  definePlugin({
    id: "incidence",
    label: "αi",
    title: "Incidence-angle series",
    placement: "tab",
    order: 7,
    dependsOn: ["cuts"],
    component: IncidenceTab,
  }),
  definePlugin({
    id: "calibrate",
    label: "Calibrate",
    placement: "side",
    order: 1,
    component: CalibrateTab,
  }),
  definePlugin({ id: "setup", label: "Setup", placement: "side", order: 2, component: SetupTab }),
);
registry.check();
