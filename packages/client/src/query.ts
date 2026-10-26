// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/** A TanStack Query client with the stack's defaults: answers stay fresh for a while, a
 * request error is not retried when the service refused it (4xx), and focus changes do not
 * refetch (a beamline page stays open for hours). */

import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "./errors";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 1,
      },
    },
  });
}
