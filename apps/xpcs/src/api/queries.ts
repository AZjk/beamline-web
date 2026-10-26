// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/** The queries of the page, one hook per route, keyed so a changed input refetches and a repeated one hits the cache. */

import {
  apiUrl,
  fetchArray,
  filePath,
  sessionHeaders,
  unwrap,
  type WireArray,
} from "@beamline-web/client";
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";

import {
  api,
  type C2Meta,
  type Files,
  type G2Meta,
  type HdfInfo,
  type ImageKind,
  type ImageMeta,
  type ImageScale,
  type Info,
  type Summary,
  type TwotimeBins,
} from "./client";

type Query<T> = Omit<UseQueryOptions<T, Error>, "queryKey" | "queryFn">;

export function useInfo() {
  return useQuery<Info, Error>({
    queryKey: ["info"],
    queryFn: async () => unwrap(await api.GET("/api/info")),
    staleTime: Infinity,
  });
}

export function useColormaps() {
  return useQuery({
    queryKey: ["colormaps"],
    queryFn: async () => unwrap(await api.GET("/api/colormaps")),
    staleTime: Infinity,
  });
}

export interface FilesParams {
  pattern: string;
  sort: "name" | "time";
  reverse: boolean;
  rescan?: number;
}

export function useFiles(params: FilesParams) {
  return useQuery<Files, Error>({
    queryKey: ["files", params],
    queryFn: async () =>
      unwrap(
        await api.GET("/api/files", {
          params: {
            query: {
              pattern: params.pattern,
              sort: params.sort,
              reverse: params.reverse,
              rescan: Boolean(params.rescan),
            },
          },
        }),
      ),
    placeholderData: (previous) => previous,
  });
}

export function useSummary(name: string | null, options: Query<Summary> = {}) {
  return useQuery<Summary, Error>({
    queryKey: ["summary", name],
    queryFn: async () =>
      unwrap(await api.GET("/api/files/{name}/summary", { params: { path: { name: name! } } })),
    enabled: name !== null && options.enabled !== false,
    ...options,
  });
}

export function useHdf(name: string | null, enabled = true) {
  return useQuery<HdfInfo, Error>({
    queryKey: ["hdf", name],
    queryFn: async () =>
      unwrap(await api.GET("/api/files/{name}/hdf", { params: { path: { name: name! } } })),
    enabled: name !== null && enabled,
  });
}

export function useTwotimeBins(name: string | null, enabled = true) {
  return useQuery<TwotimeBins, Error>({
    queryKey: ["twotime-bins", name],
    queryFn: async () =>
      unwrap(
        await api.GET("/api/files/{name}/twotime/bins", { params: { path: { name: name! } } }),
      ),
    enabled: name !== null && enabled,
  });
}

export interface ImageParams {
  kind: ImageKind;
  scale: ImageScale;
  max_size: number;
}

/** The detector map as a typed array with its meta (the binary route). */
export function useImageArray(name: string | null, params: ImageParams, enabled = true) {
  return useQuery<WireArray<Float32Array | Uint8Array, ImageMeta>, Error>({
    queryKey: ["image", name, params],
    queryFn: () =>
      fetchArray<ImageMeta>(apiUrl(`${filePath(name!)}/image/data`, { ...params }), {
        headers: sessionHeaders(),
      }) as Promise<WireArray<Float32Array | Uint8Array, ImageMeta>>,
    enabled: name !== null && enabled,
    staleTime: 5 * 60_000,
  });
}

export interface RangeParams {
  q_min?: number;
  q_max?: number;
  t_min?: number;
  t_max?: number;
}

/** The g2 of one file as a (2, delays, q-bins) float32 array with its meta (the binary route). */
export function useG2Array(name: string | null, params: RangeParams, enabled = true) {
  return useQuery<WireArray<Float32Array, G2Meta>, Error>({
    queryKey: ["g2-array", name, params],
    queryFn: () =>
      fetchArray<G2Meta>(apiUrl(`${filePath(name!)}/g2/data`, { ...params }), {
        headers: sessionHeaders(),
      }) as Promise<WireArray<Float32Array, G2Meta>>,
    enabled: name !== null && enabled,
  });
}

export interface C2Params {
  selection: number;
  correct_diag: boolean;
  max_size: number;
}

/** The two-time map of one q-bin as a float32 array with its meta (the binary route). */
export function useC2Array(name: string | null, params: C2Params, enabled = true) {
  return useQuery<WireArray<Float32Array, C2Meta>, Error>({
    queryKey: ["c2-array", name, params],
    queryFn: () =>
      fetchArray<C2Meta>(apiUrl(`${filePath(name!)}/twotime/c2/data`, { ...params }), {
        headers: sessionHeaders(),
      }) as Promise<WireArray<Float32Array, C2Meta>>,
    enabled: name !== null && enabled,
  });
}
