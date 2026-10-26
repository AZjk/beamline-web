// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/** The typed client of pyXpcsViewer's API, and the names of its payloads. */

import { createApi } from "@beamline-web/client";

import type { components, paths } from "./schema";

export const api = createApi<paths>();

export type Schemas = components["schemas"];
export type Info = Schemas["Info"];
export type FileRow = Schemas["FileRow"];
export type Files = Schemas["Files"];
export type Summary = Schemas["Summary"];
export type Geometry = Schemas["Geometry"];
export type HdfInfo = Schemas["HdfInfo"];
export type ImageMeta = Schemas["ImageMeta"];
export type Pixel = Schemas["Pixel"];
export type G2 = Schemas["G2"];
export type G2File = Schemas["G2File"];
export type G2Fit = Schemas["G2Fit"];
export type G2Meta = Schemas["G2Meta"];
export type G2FitRequest = Schemas["G2FitRequest"];
export type Tauq = Schemas["Tauq"];
export type TauqRequest = Schemas["TauqRequest"];
export type Saxs1d = Schemas["Saxs1d"];
export type Saxs1dRequest = Schemas["Saxs1dRequest"];
export type Stability = Schemas["Stability"];
export type G2Stability = Schemas["G2Stability"];
export type Intt = Schemas["Intt"];
export type TwotimeBins = Schemas["TwotimeBins"];
export type TwotimeC2 = Schemas["TwotimeC2"];
export type C2Meta = Schemas["C2Meta"];
export type JobState = Schemas["JobState"];
export type PackedArray = Schemas["PackedArray"];
export type ImageKind = ImageMeta["kind"];
export type ImageScale = ImageMeta["scale"];
