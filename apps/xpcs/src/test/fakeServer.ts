// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/** A `fetch` that answers the page's routes from a map, for the component tests. */

export type Routes = Record<string, unknown | ((url: URL, init?: RequestInit) => unknown)>;

export function fakeFetch(routes: Routes): typeof fetch {
  return async (input, init) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
      "http://localhost/",
    );
    const key = Object.keys(routes).find(
      (path) => url.pathname === path || url.pathname.endsWith(path),
    );
    if (!key)
      return new Response(JSON.stringify({ detail: `no such route: ${url.pathname}` }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    const route = routes[key];
    const body =
      typeof route === "function"
        ? (route as (u: URL, i?: RequestInit) => unknown)(url, init)
        : route;
    if (body instanceof Response) return body;
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}
