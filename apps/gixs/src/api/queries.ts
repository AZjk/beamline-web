// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/** The queries of the page, one hook per route, keyed so a changed input refetches and a repeated one hits the cache. */

import { apiUrl, fetchArray, sessionHeaders, unwrap, type WireArray } from "@beamline-web/client";
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";

import { type ContextQuery } from "./context";
import {
  api,
  filePath,
  type Context,
  type Cuts,
  type FileList,
  type ImageMeta,
  type Info,
  type OverlayIn,
  type OverlayTrace,
  type Roi,
  type SessionSetup,
  type Summary,
} from "./client";

type Query<T> = Omit<UseQueryOptions<T, Error>, "queryKey" | "queryFn">;

export function useInfo() {
  return useQuery<Info, Error>({
    queryKey: ["info"],
    queryFn: async () => unwrap(await api.GET("/api/info")),
    staleTime: Infinity,
  });
}

export function useFiles(pattern: string, rescan: number, follow: boolean) {
  return useQuery<FileList, Error>({
    queryKey: ["files", pattern, rescan],
    queryFn: async () =>
      unwrap(
        await api.GET("/api/files", {
          params: { query: { pattern, limit: 2000, rescan: rescan > 0 } },
        }),
      ),
    placeholderData: (previous) => previous,
    refetchInterval: follow ? 5000 : false,
  });
}

export function useSummary(id: string | null, query: ContextQuery, options: Query<Summary> = {}) {
  return useQuery<Summary, Error>({
    queryKey: ["summary", id, query],
    queryFn: async () =>
      unwrap(
        await api.GET("/api/files/{name}/summary", {
          params: { path: { name: id! }, query },
        }),
      ),
    enabled: id !== null && options.enabled !== false,
    ...options,
  });
}

/** The image of a view as a float32 array with its meta (the binary route). */
export function useImageArray(
  id: string | null,
  view: string,
  query: ContextQuery,
  enabled = true,
) {
  return useQuery<WireArray<Float32Array, ImageMeta>, Error>({
    queryKey: ["image", id, view, query],
    queryFn: () =>
      fetchArray<ImageMeta>(apiUrl(`${filePath(id!)}/image`, { view, ...query }), {
        headers: sessionHeaders(),
      }) as Promise<WireArray<Float32Array, ImageMeta>>,
    enabled: id !== null && enabled,
    staleTime: 5 * 60_000,
  });
}

/** The tools' overlays in the coordinates of the view shown. */
export function useOverlayTraces(
  id: string | null,
  view: string,
  overlays: OverlayIn[],
  context: Context,
) {
  return useQuery<OverlayTrace[], Error>({
    queryKey: ["overlays", id, view, overlays, context],
    queryFn: async () =>
      unwrap(
        await api.POST("/api/files/{name}/overlays", {
          params: { path: { name: id! }, query: { view } },
          body: { overlays, context },
        }),
      ),
    enabled: id !== null && overlays.length > 0,
    placeholderData: (previous) => previous,
  });
}

export function useCuts(files: string[], rois: Roi[], context: Context, enabled = true) {
  const active = rois.filter((r) => r.enabled !== false);
  return useQuery<Cuts, Error>({
    queryKey: ["cuts", files, active, context],
    queryFn: async () =>
      unwrap(await api.POST("/api/cuts", { body: { files, rois: active, context } })),
    enabled: enabled && files.length > 0 && active.length > 0,
    placeholderData: (previous) => previous,
  });
}

export function useSessionSetup() {
  return useQuery<SessionSetup, Error>({
    queryKey: ["session-setup"],
    queryFn: async () => unwrap(await api.GET("/api/session/setup")),
    staleTime: Infinity,
  });
}
