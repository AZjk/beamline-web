// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/**
 * The typed API client of an app: `openapi-fetch` over the app's generated `paths`, with the
 * page's session header on every request and the one error shape raised as `ApiError`.
 *
 *   const api = createApi<paths>();
 *   const files = unwrap(await api.GET("/api/files", { params: { query: { pattern: "" } } }));
 *
 * Paths in the document are absolute (`/api/...`); they are resolved against the page's own
 * folder, so an app served under a portal prefix (`/xpcs/`) talks to `/xpcs/api/...`.
 */

import createClient, { type Client, type Middleware } from "openapi-fetch";

import { ApiError, errorFrom } from "./errors";
import { SESSION_HEADER, sessionId } from "./session";

/** The URL of the page's folder, without a trailing slash: `https://host/xpcs`. */
export function pageBaseUrl(): string {
  if (typeof window === "undefined") return "";
  return new URL(".", window.location.href).href.replace(/\/$/, "");
}

/** An absolute URL under the page's folder, with `query` encoded (null and undefined left out). */
export function apiUrl(
  path: string,
  query?: Record<string, string | number | boolean | null | undefined>,
): string {
  const url = new URL(
    pageBaseUrl() + path,
    typeof window === "undefined" ? "http://localhost" : window.location.href,
  );
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== null && value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.href;
}

/** The path of one file's routes: `/api/files/<name>` with the name encoded. */
export function filePath(name: string): string {
  return `/api/files/${encodeURIComponent(name)}`;
}

export interface ApiOptions {
  /** Where `/api/...` lives; by default the page's own folder. */
  baseUrl?: string;
  /** Send the session header (default true). */
  session?: boolean;
}

export function createApi<Paths extends object>(options: ApiOptions = {}): Client<Paths> {
  const client = createClient<Paths>({
    baseUrl: options.baseUrl ?? pageBaseUrl(),
    // resolved per request, so a test's fetch stub and a late polyfill both apply
    fetch: (request) => globalThis.fetch(request),
  });
  const middleware: Middleware = {
    onRequest({ request }) {
      if (options.session !== false) request.headers.set(SESSION_HEADER, sessionId());
      return request;
    },
  };
  client.use(middleware);
  return client;
}

/** The data of an `openapi-fetch` answer, or an `ApiError` carrying the service's `detail`. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.data === undefined) {
    const detail = result.error;
    const body =
      detail && typeof detail === "object" && "detail" in detail ? detail.detail : detail;
    throw new ApiError(result.response.status, body ?? null);
  }
  return result.data;
}

export { errorFrom };
