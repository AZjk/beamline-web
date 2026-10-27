// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/** The typed client of gixsu's API, and the names of its payloads. */

import { createApi } from "@beamline-web/client";

import type { components, paths } from "./schema";

export const api = createApi<paths>();

export type Schemas = components["schemas"];
export type Info = Schemas["Info"];
export type ViewInfo = Schemas["ViewInfo"];
export type FieldInfo = Schemas["FieldInfo"];
export type SetupInfo = Schemas["SetupInfo"];
export type SessionSetup = Schemas["SessionSetup"];
export type FileRow = Schemas["FileRow"];
export type FileList = Schemas["FileList"];
export type Summary = Schemas["Summary"];
export type StatusItem = Schemas["StatusItem"];
export type ImageMeta = Schemas["ImageMeta"];
export type Axis = Schemas["Axis"];
export type PixelInfo = Schemas["PixelInfo"];
export type OverlayIn = Schemas["OverlayIn"];
export type OverlayTrace = Schemas["OverlayTrace"];
export type Roi = Schemas["Roi"];
export type Curve = Schemas["Curve"];
export type Cuts = Schemas["Cuts"];
export type Context = Schemas["Context"];
export type ProcessingIn = Schemas["ProcessingIn"];
export type FitCut = Schemas["FitCut"];
export type FitCutRequest = Schemas["FitCutRequest"];
export type PeakRow = Schemas["PeakRow"];
export type Peaks2d = Schemas["Peaks2d"];
export type Peak2d = Schemas["Peak2d"];
export type Indexed = Schemas["Indexed"];
export type Refined = Schemas["Refined"];
export type LatticeRequest = Schemas["LatticeRequest"];
export type Texture = Schemas["Texture"];
export type TextureFile = Schemas["TextureFile"];
export type Crystallinity = Schemas["Crystallinity"];
export type PoleMap = Schemas["PoleMap"];
export type FrameSeries = Schemas["FrameSeries"];
export type Reflectivity = Schemas["Reflectivity"];
export type Incidence = Schemas["Incidence"];
export type Calibration = Schemas["Calibration"];
export type Overrides = Schemas["Overrides"];
export type JobState = Schemas["JobState"];

/** The path of one file's routes; a file in a subfolder keeps its slashes. */
export function filePath(id: string): string {
  return `/api/files/${id.split("/").map(encodeURIComponent).join("/")}`;
}
